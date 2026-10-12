use std::path::PathBuf;
use windows::{core::PCWSTR,Win32::{Foundation::HWND,System::Com::{CoCreateInstance,CoTaskMemFree,CLSCTX_INPROC_SERVER},UI::Shell::*}};
use crate::grants::GrantError;
static DIALOG_ACTIVE:std::sync::atomic::AtomicBool=std::sync::atomic::AtomicBool::new(false);
pub async fn on_sta<T:Send+'static>(window:&tauri::WebviewWindow,work:impl FnOnce()->Result<T,GrantError>+Send+'static)->Result<T,GrantError>{
 if DIALOG_ACTIVE.swap(true,std::sync::atomic::Ordering::AcqRel){return Err(GrantError{code:"dialog_busy"});}
 struct Active;impl Drop for Active{fn drop(&mut self){DIALOG_ACTIVE.store(false,std::sync::atomic::Ordering::Release);}}
 let active=Active;
 let (sender,receiver)=std::sync::mpsc::channel();
 // Post after the WebView IPC callback has returned. The existing UI thread
 // is initialized STA; never nest a modal loop inside WebMessageReceived.
 window.run_on_main_thread(move||{let _active=active;let _=sender.send(work());}).map_err(|_|error())?;
 tauri::async_runtime::spawn_blocking(move||receiver.recv().map_err(|_|error())).await.map_err(|_|error())??
}
fn error()->GrantError{GrantError{code:"dialog_failed"}}
#[derive(Debug)]
struct Completion {accepted:bool,cleanup_error:Option<u32>}
fn completion(shown:windows::core::HRESULT,cleared:windows::core::HRESULT)->Result<Completion,GrantError>{
 if shown.is_err()&&shown.0 as u32!=0x800704c7{return Err(GrantError{code:"dialog_show_failed"});}
 // User-approved Gate v3: client-history cleanup is independent of selection
 // and authorization. Its failure remains a failure, reported as a warning.
 Ok(Completion{accepted:shown.is_ok(),cleanup_error:cleared.is_err().then_some(cleared.0 as u32)})
}
pub struct DialogResult<T>{pub value:T,pub cleanup_error:Option<u32>}
fn classify(shown:&windows::core::Result<()>,cleared:&windows::core::Result<()>)->Result<Completion,GrantError>{
 completion(shown.as_ref().err().map(|e|e.code()).unwrap_or(windows::core::HRESULT(0)),cleared.as_ref().err().map(|e|e.code()).unwrap_or(windows::core::HRESULT(0)))
}
fn path(item:IShellItem)->Result<PathBuf,GrantError>{unsafe{let p=item.GetDisplayName(SIGDN_FILESYSPATH).map_err(|_|error())?;let value=p.to_string().map_err(|_|error());CoTaskMemFree(Some(p.0.cast()));Ok(value?.into())}}
pub fn pick(hwnd:HWND,accept:&str,multiple:bool)->Result<DialogResult<Vec<PathBuf>>,GrantError>{unsafe{
 if accept.len()>256||accept.split(',').filter(|s|!s.is_empty()).any(|s|!matches!(s,".pdf"|".docx"|".md"|".markdown"|".txt"|".html"|".htm"|".csv"|".tsv"|".json"|".yaml"|".yml"|".xlsx"|".png"|".jpg"|".jpeg"|".webp")){return Err(GrantError{code:"invalid_filter"});}
 let dialog:IFileOpenDialog=CoCreateInstance(&FileOpenDialog,None,CLSCTX_INPROC_SERVER).map_err(|_|GrantError{code:"dialog_create_failed"})?;
 // A new, never-reused client identity has no prior FileFlow dialog state.
 // Best-effort cleanup does not authorize files; native selection and Store
 // validation remain mandatory even when Windows client history cannot clear.
 dialog.SetClientGuid(&windows::core::GUID::from_u128(uuid::Uuid::new_v4().as_u128())).map_err(|_|GrantError{code:"dialog_identity_failed"})?;
 let mut options=FOS_FORCEFILESYSTEM|FOS_FILEMUSTEXIST|FOS_PATHMUSTEXIST|FOS_DONTADDTORECENT|FOS_NOCHANGEDIR|FOS_NODEREFERENCELINKS;if multiple{options|=FOS_ALLOWMULTISELECT;}
 dialog.SetOptions(options).map_err(|_|GrantError{code:"dialog_options_failed"})?;
 let shown=dialog.Show(Some(hwnd));let cleared=dialog.ClearClientData();
 #[cfg(debug_assertions)] eprintln!("FileFlow dialog lifecycle: show={:?} clear={:?}",shown.as_ref().map_err(|e|e.code()),cleared.as_ref().map_err(|e|e.code()));
 let result=classify(&shown,&cleared)?;if !result.accepted{return Ok(DialogResult{value:vec![],cleanup_error:result.cleanup_error});}
 let items=dialog.GetResults().map_err(|_|error())?;let count=items.GetCount().map_err(|_|error())?;if count>50{return Err(GrantError{code:"limit"});}let mut paths=Vec::new();for i in 0..count{paths.push(path(items.GetItemAt(i).map_err(|_|error())?)?);}Ok(DialogResult{value:paths,cleanup_error:result.cleanup_error})
}}
pub fn save(hwnd:HWND,name:&str)->Result<DialogResult<Option<PathBuf>>,GrantError>{unsafe{
 if name.len()>240||name.is_empty()||name.contains(['\\','/','\0',':']){return Err(GrantError{code:"unsafe_name"});}
 let dialog:IFileSaveDialog=CoCreateInstance(&FileSaveDialog,None,CLSCTX_INPROC_SERVER).map_err(|_|error())?;
 dialog.SetClientGuid(&windows::core::GUID::from_u128(uuid::Uuid::new_v4().as_u128())).map_err(|_|error())?;
 dialog.SetOptions(FOS_FORCEFILESYSTEM|FOS_PATHMUSTEXIST|FOS_DONTADDTORECENT|FOS_NOCHANGEDIR|FOS_NODEREFERENCELINKS).map_err(|_|error())?;
 let title:Vec<u16>=name.encode_utf16().chain(Some(0)).collect();dialog.SetFileName(PCWSTR(title.as_ptr())).map_err(|_|error())?;
 let extension=name.rsplit('.').next().ok_or_else(error)?;let suffix:Vec<u16>=extension.encode_utf16().chain(Some(0)).collect();dialog.SetDefaultExtension(PCWSTR(suffix.as_ptr())).map_err(|_|error())?;
 let shown=dialog.Show(Some(hwnd));let cleared=dialog.ClearClientData();let result=classify(&shown,&cleared)?;if !result.accepted{return Ok(DialogResult{value:None,cleanup_error:result.cleanup_error});}let chosen=path(dialog.GetResult().map_err(|_|error())?)?;if !chosen.extension().and_then(|s|s.to_str()).is_some_and(|s|s.eq_ignore_ascii_case(extension)){return Err(GrantError{code:"unsafe_name"});}Ok(DialogResult{value:Some(chosen),cleanup_error:result.cleanup_error})
}}

#[cfg(test)]
mod tests {
 use super::*;
 use windows::core::HRESULT;
 #[test] fn cleanup_failure_is_a_warning_after_successful_selection() {
  let result=completion(HRESULT(0),HRESULT(0x80004005u32 as i32)).unwrap();
  assert!(result.accepted);
  assert_eq!(result.cleanup_error,Some(0x80004005));
 }
 #[test] fn cancel_with_cleanup_failure_does_not_authorize_a_selection() {
  let result=completion(HRESULT(0x800704c7u32 as i32),HRESULT(0x80004005u32 as i32)).unwrap();
  assert!(!result.accepted);
  assert_eq!(result.cleanup_error,Some(0x80004005));
 }
 #[test] fn failed_show_still_blocks_even_when_history_cleanup_fails() {
  assert!(completion(HRESULT(0x80070005u32 as i32),HRESULT(0x80004005u32 as i32)).is_err());
 }
 #[test] fn successful_cleanup_has_no_warning() {
  let result=completion(HRESULT(0),HRESULT(0)).unwrap();
  assert!(result.accepted);assert_eq!(result.cleanup_error,None);
 }
}

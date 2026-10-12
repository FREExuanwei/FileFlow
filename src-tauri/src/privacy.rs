use std::{fs::{File,OpenOptions},io::{Read,Seek,SeekFrom,Write},os::windows::{ffi::OsStrExt,fs::{MetadataExt,OpenOptionsExt},io::AsRawHandle},path::{Component,Path,PathBuf},sync::mpsc};
use serde::Serialize;
use windows::{core::{Interface,PCWSTR,PWSTR,BOOL},Win32::{Foundation::{HANDLE,HLOCAL,LocalFree,CloseHandle},Security::*,Security::Authorization::*,Storage::FileSystem::{FILE_FLAG_BACKUP_SEMANTICS,FILE_FLAG_OPEN_REPARSE_POINT,FILE_ATTRIBUTE_REPARSE_POINT,FILE_SHARE_READ},System::{Com::CoTaskMemFree,Threading::{GetCurrentProcess,OpenProcessToken}},UI::Shell::*}};
use webview2_com::{CoreWebView2EnvironmentOptions,CreateCoreWebView2EnvironmentCompletedHandler,Microsoft::Web::WebView2::Win32::*};
type Result<T> = std::result::Result<T,Box<dyn std::error::Error>>;
fn wide(path:&Path)->Vec<u16>{path.as_os_str().encode_wide().chain(Some(0)).collect()}
fn normal(path:&Path)->Option<String>{if !path.is_absolute()||path.components().any(|c|matches!(c,Component::ParentDir|Component::CurDir)){return None;}Some(path.to_string_lossy().replace('/',"\\").trim_end_matches('\\').to_lowercase())}
fn within(path:&str,root:&str)->bool{path==root||path.starts_with(&(root.to_owned()+"\\"))}
fn allowed_root(path:&Path,local:&Path,sync:&[PathBuf])->bool{let (Some(p),Some(l))=(normal(path),normal(local))else{return false};p!=l&&within(&p,&l)&&sync.iter().all(|s|normal(s).is_none_or(|s|!within(&p,&s)))}
fn known_folder(id:&windows::core::GUID)->Result<PathBuf>{unsafe{let p=SHGetKnownFolderPath(id,KF_FLAG_DEFAULT,None)?;let s=p.to_string()?;CoTaskMemFree(Some(p.0.cast()));Ok(s.into())}}
fn user_sid()->Result<String>{unsafe{let mut token=HANDLE::default();OpenProcessToken(GetCurrentProcess(),TOKEN_QUERY,&mut token)?;let mut length=0;let _=GetTokenInformation(token,TokenUser,None,0,&mut length);let mut buffer=vec![0usize;(length as usize).div_ceil(std::mem::size_of::<usize>())];let result=GetTokenInformation(token,TokenUser,Some(buffer.as_mut_ptr().cast()),length,&mut length);let _=CloseHandle(token);result?;let info=&*buffer.as_ptr().cast::<TOKEN_USER>();let mut text=PWSTR::null();ConvertSidToStringSidW(info.User.Sid,&mut text)?;let sid=text.to_string()?;let _=LocalFree(Some(HLOCAL(text.0.cast())));Ok(sid)}}
fn valid_dacl(value:&str,sid:&str)->bool{let aces=format!("(A;OICI;FA;;;SY)(A;OICI;FA;;;{sid})");value==format!("D:P{aces}")||value==format!("D:PAI{aces}")}
fn protect(directory:&File,sid:&str)->Result<String>{unsafe{
 let handle=HANDLE(directory.as_raw_handle());let mut before=PSECURITY_DESCRIPTOR::default();GetSecurityInfo(handle,SE_FILE_OBJECT,OWNER_SECURITY_INFORMATION,None,None,None,None,Some(&mut before)).ok()?;
 let mut owner=PSID::default();let mut defaulted=BOOL::default();GetSecurityDescriptorOwner(before,&mut owner,&mut defaulted)?;let mut owner_text=PWSTR::null();ConvertSidToStringSidW(owner,&mut owner_text)?;let owner_sid=owner_text.to_string()?;let _=LocalFree(Some(HLOCAL(owner_text.0.cast())));let _=LocalFree(Some(HLOCAL(before.0)));if owner_sid!=sid{return Err("profile-owner-mismatch".into());}
 let sddl=format!("D:P(A;OICI;FA;;;SY)(A;OICI;FA;;;{sid})");let text:Vec<u16>=sddl.encode_utf16().chain(Some(0)).collect();let mut descriptor=PSECURITY_DESCRIPTOR::default();ConvertStringSecurityDescriptorToSecurityDescriptorW(PCWSTR(text.as_ptr()),1,&mut descriptor,None)?;let mut present=BOOL::default();let mut dacl=std::ptr::null_mut();GetSecurityDescriptorDacl(descriptor,&mut present,&mut dacl,&mut defaulted)?;
 let result=SetSecurityInfo(handle,SE_FILE_OBJECT,DACL_SECURITY_INFORMATION|PROTECTED_DACL_SECURITY_INFORMATION,None,None,Some(dacl),None).ok();let _=LocalFree(Some(HLOCAL(descriptor.0)));result?;
 let mut actual=PSECURITY_DESCRIPTOR::default();GetSecurityInfo(handle,SE_FILE_OBJECT,DACL_SECURITY_INFORMATION,None,None,None,None,Some(&mut actual)).ok()?;let mut readback=PWSTR::null();ConvertSecurityDescriptorToStringSecurityDescriptorW(actual,1,DACL_SECURITY_INFORMATION,&mut readback,None)?;let value=readback.to_string()?;let _=LocalFree(Some(HLOCAL(readback.0.cast())));let _=LocalFree(Some(HLOCAL(actual.0)));if !valid_dacl(&value,sid){return Err("profile-acl-mismatch".into());}Ok(value)
}}
#[derive(Serialize,Default,Clone)]pub struct Preferences {pub theme:String,pub language:String}
pub struct Profile {pub root:PathBuf,pub session:PathBuf,pub acl:String,_parents:Vec<File>,_session:Vec<File>,_root:File,_lock:File,prefs:File}
impl Profile {
 pub fn open()->Result<Self>{
  let local=known_folder(&FOLDERID_LocalAppData)?;let root=local.join("FileFlow.Desktop");let mut sync=Vec::new();for id in [FOLDERID_Desktop,FOLDERID_Documents,FOLDERID_OneDrive]{if let Ok(p)=known_folder(&id){sync.push(p);}}
  for key in ["OneDrive","OneDriveCommercial","OneDriveConsumer"]{if let Some(p)=std::env::var_os(key){sync.push(p.into());}}
  let roots=windows::Storage::Provider::StorageProviderSyncRootManager::GetCurrentSyncRoots()?;for i in 0..roots.Size()?{sync.push(PathBuf::from(roots.GetAt(i)?.Path()?.Path()?.to_string()));}
  if !allowed_root(&root,&local,&sync){return Err("profile-location-denied".into());}let parents=crate::grants::pin_directory(&local)?;
  if !root.exists(){std::fs::create_dir(&root)?;}let directory=OpenOptions::new().read(true).access_mode(0x80|0x0002_0000|0x0004_0000).share_mode(FILE_SHARE_READ.0).custom_flags(FILE_FLAG_BACKUP_SEMANTICS.0|FILE_FLAG_OPEN_REPARSE_POINT.0).open(&root)?;
  if !directory.metadata()?.is_dir()||directory.metadata()?.file_attributes()&FILE_ATTRIBUTE_REPARSE_POINT.0!=0{return Err("profile-reparse-denied".into());}
  let acl=protect(&directory,&user_sid()?)?;
  let lock=OpenOptions::new().read(true).write(true).create(true).truncate(false).share_mode(0).custom_flags(FILE_FLAG_OPEN_REPARSE_POINT.0).open(root.join("session.lock"))?;if lock.metadata()?.file_attributes()&FILE_ATTRIBUTE_REPARSE_POINT.0!=0{return Err("profile-lock-reparse".into());}
  let sessions=root.join("profiles");if !sessions.exists(){std::fs::create_dir(&sessions)?;}let pinned=crate::grants::pin_directory(&sessions)?;
  for entry in std::fs::read_dir(&sessions)?{remove_owned(&entry?.path(),&sessions)?;}
  let session=sessions.join(uuid::Uuid::new_v4().simple().to_string());std::fs::create_dir(&session)?;
  let mut session_handles=pinned;session_handles.extend(crate::grants::pin_directory(&session)?);
  let prefs=OpenOptions::new().read(true).write(true).create(true).truncate(false).share_mode(0).custom_flags(FILE_FLAG_OPEN_REPARSE_POINT.0).open(root.join("preferences.bin"))?;if prefs.metadata()?.file_attributes()&FILE_ATTRIBUTE_REPARSE_POINT.0!=0{return Err("preferences-reparse".into());}
  Ok(Self{root,session,acl,_parents:parents,_session:session_handles,_root:directory,_lock:lock,prefs})
 }
 pub fn get_preferences(&mut self)->Result<Preferences>{let mut bytes=[0u8;2];self.prefs.seek(SeekFrom::Start(0))?;if self.prefs.read(&mut bytes)?!=2{return Ok(Preferences::default());}Ok(Preferences{theme:match bytes[0]{1=>"light",2=>"dark",_=>"system"}.into(),language:match bytes[1]{1=>"zh-CN",2=>"en",_=>""}.into()})}
 pub fn set_preferences(&mut self,p:Preferences)->Result<()>{let theme=match p.theme.as_str(){"system"=>0,"light"=>1,"dark"=>2,_=>return Err("invalid-preferences".into())};let language=match p.language.as_str(){""=>0,"zh-CN"=>1,"en"=>2,_=>return Err("invalid-preferences".into())};self.prefs.seek(SeekFrom::Start(0))?;self.prefs.write_all(&[theme,language])?;self.prefs.set_len(2)?;self.prefs.sync_all()?;Ok(())}
}
fn remove_owned(path:&Path,root:&Path)->Result<()>{
 let (Some(p),Some(r))=(normal(path),normal(root))else{return Err("cleanup-path-denied".into());};if p==r||!within(&p,&r){return Err("cleanup-path-denied".into());}
 // Acquire every ancestor and the child before enumeration. No delete/write
 // sharing, no reparse following; delete the validated object by its handle.
 let _parents=crate::grants::pin_directory(path.parent().ok_or("cleanup-path-denied")?)?;
 remove_locked_child(path)
}
fn remove_locked_child(path:&Path)->Result<()>{
 let child=match OpenOptions::new().access_mode(0x80|0x0001_0000).share_mode(FILE_SHARE_READ.0).custom_flags(FILE_FLAG_BACKUP_SEMANTICS.0|FILE_FLAG_OPEN_REPARSE_POINT.0).open(path){Ok(h)=>h,Err(e)if e.kind()==std::io::ErrorKind::NotFound=>return Ok(()),Err(e)=>return Err(e.into())};
 let m=child.metadata()?;if m.file_attributes()&FILE_ATTRIBUTE_REPARSE_POINT.0!=0{return Err("cleanup-reparse-denied".into());}
 if m.is_dir(){for e in std::fs::read_dir(path)?{remove_locked_child(&e?.path())?;}}
 let info=windows::Win32::Storage::FileSystem::FILE_DISPOSITION_INFO{DeleteFile:true};
 unsafe{windows::Win32::Storage::FileSystem::SetFileInformationByHandle(HANDLE(child.as_raw_handle()),windows::Win32::Storage::FileSystem::FileDispositionInfo,(&info as *const windows::Win32::Storage::FileSystem::FILE_DISPOSITION_INFO).cast(),std::mem::size_of_val(&info) as u32)?;}Ok(())
}
pub fn environment(profile:&Profile)->Result<ICoreWebView2Environment>{
 let folder=wide(&profile.session);let options=CoreWebView2EnvironmentOptions::default();unsafe{options.set_is_custom_crash_reporting_enabled(true);options.set_exclusive_user_data_folder_access(true);options.set_are_browser_extensions_enabled(false);}let options:ICoreWebView2EnvironmentOptions=options.into();let upload=options.cast::<ICoreWebView2EnvironmentOptions3>()?;let mut enabled=BOOL::default();unsafe{upload.IsCustomCrashReportingEnabled(&mut enabled)?;}if !enabled.as_bool(){return Err("crash-upload-control-failed".into());}
 let (tx,rx)=mpsc::channel();CreateCoreWebView2EnvironmentCompletedHandler::wait_for_async_operation(Box::new(move|handler|unsafe{CreateCoreWebView2EnvironmentWithOptions(PCWSTR::null(),PCWSTR(folder.as_ptr()),&options,&handler).map_err(webview2_com::Error::WindowsError)}),Box::new(move|error,env|{error?;let _=tx.send(env);Ok(())}))?;let environment=rx.recv()?.ok_or("environment-unavailable")?;let folder_interface=environment.cast::<ICoreWebView2Environment7>()?;let mut actual=PWSTR::null();unsafe{folder_interface.UserDataFolder(&mut actual)?;}let actual_folder=PathBuf::from(unsafe{actual.to_string()?});unsafe{CoTaskMemFree(Some(actual.0.cast()));}if normal(&actual_folder)!=normal(&profile.session){return Err("runtime-profile-override-denied".into());}Ok(environment)
}
#[cfg(test)]mod tests {
 use super::*;
 #[test]fn cleanup_removes_nested_owned_tree(){let root=PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("target/privacy-fixtures").join(uuid::Uuid::new_v4().simple().to_string());let session=root.join("session");std::fs::create_dir_all(session.join("nested")).unwrap();std::fs::write(session.join("nested/fictional.txt"),b"synthetic").unwrap();let result=remove_owned(&session,&root);let removed=!session.exists();std::fs::remove_dir_all(root).unwrap();assert!(result.is_ok(),"{result:?}");assert!(removed);}
 #[test]fn cleanup_refuses_locked_directory_before_touching_contents(){
  let root=PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("target/privacy-fixtures").join(uuid::Uuid::new_v4().simple().to_string());
  let child=root.join("session");std::fs::create_dir_all(&child).unwrap();let file=child.join("fictional.txt");std::fs::write(&file,b"synthetic keep").unwrap();
  let held=OpenOptions::new().read(true).share_mode(FILE_SHARE_READ.0).custom_flags(FILE_FLAG_BACKUP_SEMANTICS.0|FILE_FLAG_OPEN_REPARSE_POINT.0).open(&child).unwrap();let result=remove_owned(&child,&root);let retained=file.exists();drop(held);std::fs::remove_dir_all(root).unwrap();
  assert!(result.is_err());assert!(retained,"cleanup must acquire a non-replaceable child handle before traversing it");
 }
 #[test]fn protected_auto_inherited_dacl_preserves_exact_principals(){assert!(valid_dacl("D:PAI(A;OICI;FA;;;SY)(A;OICI;FA;;;S-1-5-21-111-222-333-1001)","S-1-5-21-111-222-333-1001"));assert!(!valid_dacl("D:P(A;OICI;FA;;;WD)(A;OICI;FA;;;S-1-5-21-111-222-333-1001)","S-1-5-21-111-222-333-1001"));}
 #[test]fn dedicated_local_root_is_allowed(){assert!(allowed_root(Path::new("C:/Local/FileFlow"),Path::new("C:/Local"),&[]));}
 #[test]fn known_sync_roots_are_denied(){assert!(!allowed_root(Path::new("C:/Local/Sync/FileFlow"),Path::new("C:/Local"),&["C:/Local/Sync".into()]));assert!(!allowed_root(Path::new("c:/local/SYNC/fileflow"),Path::new("C:/Local"),&["C:/Local/Sync".into()]));}
 #[test]fn outside_local_and_parent_traversal_are_denied(){assert!(!allowed_root(Path::new("C:/Desktop/FileFlow"),Path::new("C:/Local"),&[]));assert!(!allowed_root(Path::new("C:/Local/../Desktop/FileFlow"),Path::new("C:/Local"),&[]));}
}

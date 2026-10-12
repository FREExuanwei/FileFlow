mod privacy;
mod grants;
mod dialogs;
mod ocr;
use std::sync::{Mutex,atomic::{AtomicU64,AtomicBool,Ordering}};
use tauri::{Manager,Emitter,WebviewWindow,State,WebviewUrl,WebviewWindowBuilder,RunEvent};
use grants::{Store,FileGrant,GrantError};
use windows::core::{Interface,PWSTR};
use webview2_com::{WebResourceRequestedEventHandler,Microsoft::Web::WebView2::Win32::*};
static DENIED:AtomicU64=AtomicU64::new(0);
static IN_PRIVATE:AtomicBool=AtomicBool::new(false);
fn guard(w:&WebviewWindow)->Result<(),GrantError>{let u=w.url().map_err(|_|GrantError{code:"untrusted_origin"})?;if w.label()!="main"||u.scheme()!="http"||u.host_str()!=Some("tauri.localhost"){return Err(GrantError{code:"untrusted_origin"});}Ok(())}
fn lock<'a>(s:&'a State<'_,Mutex<Store>>)->Result<std::sync::MutexGuard<'a,Store>,GrantError>{s.lock().map_err(|_|GrantError{code:"internal_error"})}
#[tauri::command]async fn ocr_info(w:WebviewWindow)->Result<ocr::EngineInfo,GrantError>{guard(&w)?;tauri::async_runtime::spawn_blocking(ocr::info).await.map_err(|_|GrantError{code:"ocr_unavailable"})?}
#[tauri::command]fn ocr_begin(w:WebviewWindow,s:State<'_,ocr::Sessions>,language:String)->Result<String,GrantError>{guard(&w)?;s.begin(&language)}
#[tauri::command]fn ocr_cancel(w:WebviewWindow,s:State<'_,ocr::Sessions>,id:String)->Result<(),GrantError>{guard(&w)?;s.cancel(&id)}
#[tauri::command]fn ocr_finish(w:WebviewWindow,s:State<'_,ocr::Sessions>,id:String)->Result<(),GrantError>{guard(&w)?;s.finish(&id)}
#[tauri::command]async fn ocr_pixels(w:WebviewWindow,s:State<'_,ocr::Sessions>,request:tauri::ipc::Request<'_>)->Result<String,GrantError>{
 guard(&w)?;let tauri::ipc::InvokeBody::Raw(bytes)=request.body()else{return Err(GrantError{code:"ocr_pixel_limit"});};
 let header=|name|request.headers().get(name).and_then(|v|v.to_str().ok());let id=header("x-fileflow-ocr").ok_or(GrantError{code:"ocr_session"})?;
 let width:u32=header("x-fileflow-width").and_then(|v|v.parse().ok()).ok_or(GrantError{code:"ocr_pixel_limit"})?;let height:u32=header("x-fileflow-height").and_then(|v|v.parse().ok()).ok_or(GrantError{code:"ocr_pixel_limit"})?;
 ocr::validate_pixels(width,height,bytes.len(),4096)?;let permit=s.acquire(id)?;let pixels=bytes.to_vec();
 tauri::async_runtime::spawn_blocking(move||ocr::recognize(permit,width,height,pixels)).await.map_err(|_|GrantError{code:"ocr_failed"})?
}
#[derive(Clone,serde::Serialize)]struct DialogWarning{code:&'static str,hresult:u32,operation:&'static str}
fn dialog_warning(w:&WebviewWindow,hresult:Option<u32>,operation:&'static str){if let Some(hresult)=hresult{let _=w.emit_to("main","fileflow-dialog-warning",DialogWarning{code:"dialog_history_cleanup_failed",hresult,operation});}}
#[tauri::command]async fn pick_inputs(w:WebviewWindow,s:State<'_,Mutex<Store>>,accept:String,multiple:bool)->Result<Vec<FileGrant>,GrantError>{guard(&w)?;let hwnd=w.hwnd().map_err(|_|GrantError{code:"dialog_failed"})?.0 as isize;let result=dialogs::on_sta(&w,move||dialogs::pick(windows::Win32::Foundation::HWND(hwnd as *mut _),&accept,multiple)).await?;guard(&w)?;dialog_warning(&w,result.cleanup_error,"import");lock(&s)?.admit_paths(result.value)}
#[tauri::command]fn read_input(w:WebviewWindow,s:State<'_,Mutex<Store>>,id:String,offset:u64,length:u32)->Result<tauri::ipc::Response,GrantError>{guard(&w)?;Ok(tauri::ipc::Response::new(lock(&s)?.read(&id,offset,length)?))}
#[tauri::command]fn release_input(w:WebviewWindow,s:State<'_,Mutex<Store>>,id:String)->Result<(),GrantError>{guard(&w)?;lock(&s)?.release(&id)}
#[tauri::command]async fn choose_save(w:WebviewWindow,s:State<'_,Mutex<Store>>,name:String,size:u64)->Result<Option<FileGrant>,GrantError>{guard(&w)?;let hwnd=w.hwnd().map_err(|_|GrantError{code:"dialog_failed"})?.0 as isize;let result=dialogs::on_sta(&w,move||dialogs::save(windows::Win32::Foundation::HWND(hwnd as *mut _),&name)).await?;guard(&w)?;dialog_warning(&w,result.cleanup_error,"save");match result.value{Some(path)=>Ok(Some(lock(&s)?.begin_save(path,size)?)),None=>Ok(None)}}
#[tauri::command]fn write_save(w:WebviewWindow,s:State<'_,Mutex<Store>>,request:tauri::ipc::Request<'_>)->Result<(),GrantError>{guard(&w)?;let tauri::ipc::InvokeBody::Raw(bytes)=request.body()else{return Err(GrantError{code:"invalid_chunk"});};if bytes.len()>grants::MAX_CHUNK as usize{return Err(GrantError{code:"limit"});}let id=request.headers().get("x-fileflow-grant").and_then(|v|v.to_str().ok()).ok_or(GrantError{code:"unknown_grant"})?;let offset=request.headers().get("x-fileflow-offset").and_then(|v|v.to_str().ok()).and_then(|v|v.parse().ok()).ok_or(GrantError{code:"invalid_offset"})?;lock(&s)?.write(id,offset,bytes)}
#[tauri::command]fn commit_save(w:WebviewWindow,s:State<'_,Mutex<Store>>,id:String)->Result<(),GrantError>{guard(&w)?;lock(&s)?.commit(&id)}
#[tauri::command]fn abort_save(w:WebviewWindow,s:State<'_,Mutex<Store>>,id:String)->Result<(),GrantError>{guard(&w)?;lock(&s)?.abort(&id)}
#[derive(serde::Serialize)]struct PrivacyStatus{custom_crash_reporting:bool,in_private:bool,protected_profile:bool,denied_app_requests:u64}
#[tauri::command]fn privacy_status(w:WebviewWindow,p:State<'_,Mutex<privacy::Profile>>)->Result<PrivacyStatus,GrantError>{guard(&w)?;let profile=p.lock().map_err(|_|GrantError{code:"internal_error"})?;Ok(PrivacyStatus{custom_crash_reporting:true,in_private:IN_PRIVATE.load(Ordering::Acquire),protected_profile:profile.acl.starts_with("D:P"),denied_app_requests:DENIED.load(Ordering::Relaxed)})}
#[tauri::command]fn get_preferences(w:WebviewWindow,p:State<'_,Mutex<privacy::Profile>>)->Result<privacy::Preferences,GrantError>{guard(&w)?;p.lock().map_err(|_|GrantError{code:"internal_error"})?.get_preferences().map_err(|_|GrantError{code:"preferences_failed"})}
#[tauri::command]fn set_preferences(w:WebviewWindow,p:State<'_,Mutex<privacy::Profile>>,theme:String,language:String)->Result<(),GrantError>{guard(&w)?;p.lock().map_err(|_|GrantError{code:"internal_error"})?.set_preferences(privacy::Preferences{theme,language}).map_err(|_|GrantError{code:"preferences_failed"})}
pub fn run(){
 let application=tauri::Builder::default().manage(ocr::Sessions::default()).invoke_handler(tauri::generate_handler![ocr_info,ocr_begin,ocr_pixels,ocr_cancel,ocr_finish,pick_inputs,read_input,release_input,choose_save,write_save,commit_save,abort_save,privacy_status,get_preferences,set_preferences]).setup(|app|{
  unsafe{windows::Win32::System::Com::CoInitializeEx(None,windows::Win32::System::Com::COINIT_APARTMENTTHREADED).ok().map_err(|_|"FileFlow COM initialization failed")?;}
  let profile=privacy::Profile::open().map_err(|error|{#[cfg(debug_assertions)] eprintln!("Profile setup: {error}");"FileFlow protected profile unavailable"})?;let environment=privacy::environment(&profile).map_err(|_|"FileFlow crash upload control unavailable")?;
  let data_directory=profile.session.clone();app.manage(Mutex::new(profile));app.manage(Mutex::new(Store::new()));
  let window=WebviewWindowBuilder::new(app,"main",WebviewUrl::App("desktop.html".into())).title("FileFlow").inner_size(1280.,850.).min_inner_size(760.,600.).data_directory(data_directory).with_environment(environment).incognito(true).devtools(false).on_navigation(|u|u.scheme()=="http"&&u.host_str()==Some("tauri.localhost")).on_new_window(|_,_|tauri::webview::NewWindowResponse::Deny).build()?;
  let handle=app.handle().clone();window.on_window_event(move|e|{if matches!(e,tauri::WindowEvent::CloseRequested{..}|tauri::WindowEvent::Destroyed){handle.exit(0);}if let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop{paths,..})=e{let store=handle.state::<Mutex<Store>>();let result=store.lock().map_err(|_|GrantError{code:"internal_error"}).and_then(|mut s|s.admit_paths(paths.clone()));match result{Ok(grants)=>{let _=handle.emit("fileflow-drop",grants);},Err(error)=>{let _=handle.emit("fileflow-native-error",error);}}}});
  window.with_webview(|view|unsafe{
   let core=view.controller().CoreWebView2().expect("WebView2 core");let profile=core.cast::<ICoreWebView2_13>().expect("WebView2 profile interface").Profile().expect("WebView2 profile");let mut in_private=windows::core::BOOL::default();profile.IsInPrivateModeEnabled(&mut in_private).expect("WebView2 InPrivate readback");assert!(in_private.as_bool(),"WebView2 InPrivate gate failed");IN_PRIVATE.store(in_private.as_bool(),Ordering::Release);
   let environment=view.environment();let handler=WebResourceRequestedEventHandler::create(Box::new(move|_,args|{if let Some(args)=args{let request=args.Request()?;let mut uri=PWSTR::null();request.Uri(&mut uri)?;let address=uri.to_string()?;windows::Win32::System::Com::CoTaskMemFree(Some(uri.0.cast()));if !address.starts_with("http://tauri.localhost/")&&!address.starts_with("http://ipc.localhost/")&&!address.starts_with("ipc:")&&!address.starts_with("blob:")&&!address.starts_with("data:"){DENIED.fetch_add(1,Ordering::Relaxed);let response=environment.CreateWebResourceResponse(None,403,windows::core::w!("Blocked"),windows::core::w!("Content-Type: text/plain"))?;args.SetResponse(&response)?;}}Ok(())}));let mut token=0;core.add_WebResourceRequested(&handler,&mut token).expect("WebView2 request guard");let filter=core.cast::<ICoreWebView2_22>().expect("WebView2 request source guard");filter.AddWebResourceRequestedFilterWithRequestSourceKinds(windows::core::w!("*"),COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL,COREWEBVIEW2_WEB_RESOURCE_REQUEST_SOURCE_KINDS_ALL).expect("WebView2 source filter");
  })?;Ok(())
 }).build(tauri::generate_context!()).expect("FileFlow startup blocked by configuration or privacy gate");
 application.run(|app,event|{if let RunEvent::Exit=event{app.state::<ocr::Sessions>().cancel_all();if let Ok(mut store)=app.state::<Mutex<Store>>().lock(){store.clear();}}});
}

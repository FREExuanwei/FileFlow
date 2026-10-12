use std::{sync::{Arc,Mutex,OnceLock,mpsc,atomic::{AtomicBool,Ordering}},time::{Duration,Instant}};
use windows::{Media::Ocr::OcrEngine,Globalization::Language,Graphics::Imaging::{SoftwareBitmap,BitmapPixelFormat,BitmapAlphaMode},Storage::Streams::DataWriter,Win32::System::WinRT::{RoInitialize,RoUninitialize,RO_INIT_MULTITHREADED}};
use crate::grants::GrantError;
fn error(code:&'static str)->GrantError{GrantError{code}}
pub fn validate_pixels(width:u32,height:u32,len:usize,max_side:u32)->Result<(),GrantError>{
 let pixels=(width as u64)*(height as u64);
 if width==0||height==0||width>4096.min(max_side)||height>4096.min(max_side)||pixels>6_000_000||pixels*4!=len as u64{return Err(error("ocr_pixel_limit"));}Ok(())
}
struct Session{id:String,language:String,cancel:AtomicBool,busy:AtomicBool,created:Instant}
#[derive(Default)]pub struct Sessions{current:Mutex<Option<Arc<Session>>>}
pub struct Permit{session:Arc<Session>}
impl Permit{pub fn cancelled(&self)->bool{self.session.cancel.load(Ordering::SeqCst)}}
impl Drop for Permit{fn drop(&mut self){self.session.busy.store(false,Ordering::SeqCst);}}
impl Sessions{
 pub fn begin(&self,language:&str)->Result<String,GrantError>{
  if !["eng","chi_sim","chi_sim+eng"].contains(&language){return Err(error("ocr_language"));}
  let mut slot=self.current.lock().map_err(|_|error("internal_error"))?;
  if slot.is_some(){return Err(error("ocr_busy"));}let id=uuid::Uuid::new_v4().to_string();
  *slot=Some(Arc::new(Session{id:id.clone(),language:language.to_owned(),cancel:AtomicBool::new(false),busy:AtomicBool::new(false),created:Instant::now()}));Ok(id)
 }
 fn session(&self,id:&str)->Result<Arc<Session>,GrantError>{self.current.lock().map_err(|_|error("internal_error"))?.as_ref().filter(|s|s.id==id).cloned().ok_or(error("ocr_session"))}
 pub fn acquire(&self,id:&str)->Result<Permit,GrantError>{let s=self.session(id)?;if s.created.elapsed()>Duration::from_secs(20*60)||s.cancel.load(Ordering::SeqCst){return Err(error("cancelled"));}if s.busy.swap(true,Ordering::SeqCst){return Err(error("ocr_busy"));}Ok(Permit{session:s})}
 pub fn cancel(&self,id:&str)->Result<(),GrantError>{self.session(id)?.cancel.store(true,Ordering::SeqCst);Ok(())}
 pub fn finish(&self,id:&str)->Result<(),GrantError>{let mut slot=self.current.lock().map_err(|_|error("internal_error"))?;let s=slot.as_ref().filter(|s|s.id==id).ok_or(error("ocr_session"))?;if s.busy.load(Ordering::SeqCst){return Err(error("ocr_busy"));}*slot=None;Ok(())}
 pub fn cancel_all(&self){if let Ok(slot)=self.current.lock(){if let Some(s)=slot.as_ref(){s.cancel.store(true,Ordering::SeqCst);}}}
}
struct Apartment;
impl Apartment{fn new()->Result<Self,GrantError>{unsafe{RoInitialize(RO_INIT_MULTITHREADED).map_err(|_|error("ocr_unavailable"))?;}Ok(Self)}}
impl Drop for Apartment{fn drop(&mut self){unsafe{RoUninitialize();}}}
#[derive(serde::Serialize)]#[serde(rename_all="camelCase")]pub struct EngineInfo{pub id:&'static str,pub installed_languages:Vec<String>,pub modes:Vec<&'static str>,pub max_side:u32,pub english_fallback:bool}
fn info_on_worker()->Result<EngineInfo,GrantError>{
 let langs=OcrEngine::AvailableRecognizerLanguages().map_err(|_|error("ocr_unavailable"))?;let mut tags=Vec::new();for lang in langs{tags.push(lang.LanguageTag().map_err(|_|error("ocr_unavailable"))?.to_string());}
 let chinese=tags.iter().any(|l|l.starts_with("zh-Hans")||l=="zh-CN");let english=tags.iter().any(|l|l.starts_with("en"));let mut modes=Vec::new();if english||chinese{modes.push("eng");}if chinese{modes.extend(["chi_sim","chi_sim+eng"]);}
 Ok(EngineInfo{id:"windows-media-ocr",installed_languages:tags,modes,max_side:OcrEngine::MaxImageDimension().map_err(|_|error("ocr_unavailable"))?.min(4096),english_fallback:chinese&&!english})
}
fn selected_language(mode:&str)->Result<Language,GrantError>{
 let langs=OcrEngine::AvailableRecognizerLanguages().map_err(|_|error("ocr_unavailable"))?;let mut chinese=None;for lang in langs{let tag=lang.LanguageTag().map_err(|_|error("ocr_unavailable"))?.to_string();if mode=="eng"&&tag.starts_with("en"){return Ok(lang);}if tag.starts_with("zh-Hans")||tag=="zh-CN"{chinese=Some(lang);}}
 chinese.ok_or(error("ocr_language_missing"))
}
struct Bitmap(SoftwareBitmap);
impl Drop for Bitmap{fn drop(&mut self){let _=self.0.Close();}}
/// Raw RGBA only; no filenames, disk IO, compressed decoder or network calls.
fn recognize_on_worker(permit:Permit,width:u32,height:u32,mut bytes:Vec<u8>)->Result<String,GrantError>{
 validate_pixels(width,height,bytes.len(),OcrEngine::MaxImageDimension().map_err(|_|error("ocr_unavailable"))?)?;
 if permit.cancelled(){return Err(error("cancelled"));}
 let language=selected_language(&permit.session.language)?;let engine=OcrEngine::TryCreateFromLanguage(&language).map_err(|_|error("ocr_language_missing"))?;
 for pixel in bytes.chunks_exact_mut(4){pixel.swap(0,2);pixel[3]=255;}
 let writer=DataWriter::new().map_err(|_|error("ocr_failed"))?;writer.WriteBytes(&bytes).map_err(|_|error("ocr_failed"))?;let buffer=writer.DetachBuffer().map_err(|_|error("ocr_failed"))?;let _=writer.Close();drop(bytes);
 let bitmap=Bitmap(SoftwareBitmap::CreateCopyWithAlphaFromBuffer(&buffer,BitmapPixelFormat::Bgra8,width as i32,height as i32,BitmapAlphaMode::Ignore).map_err(|_|error("ocr_failed"))?);drop(buffer);
 let operation=engine.RecognizeAsync(&bitmap.0).map_err(|_|error("ocr_failed"))?;let started=Instant::now();let mut cancelled=false;let mut timed_out=false;
 // Official WinRT AsyncStatus::Started numeric value is 0.
 while operation.Status().map_err(|_|error("ocr_failed"))?.0==0{
  if !cancelled&&(permit.cancelled()||started.elapsed()>Duration::from_secs(120)){timed_out=!permit.cancelled();cancelled=true;let _=operation.Cancel();}
  std::thread::sleep(Duration::from_millis(10));
 }
 // Keep bitmap/permit alive until the official async operation is terminal.
 if timed_out{return Err(error("ocr_timeout"));}if permit.cancelled()||cancelled{return Err(error("cancelled"));}
 let result=operation.GetResults().map_err(|_|error("ocr_failed"))?;let mut lines=Vec::new();let mut units=0;
 for line in result.Lines().map_err(|_|error("ocr_failed"))?{let text=line.Text().map_err(|_|error("ocr_failed"))?.to_string();units+=text.chars().count();if units>65_536||lines.len()>=2000{return Err(error("ocr_text_limit"));}lines.push(text);}
 Ok(lines.join("\n"))
}
enum Work{Info(mpsc::SyncSender<Result<EngineInfo,GrantError>>),Recognize(Permit,u32,u32,Vec<u8>,mpsc::SyncSender<Result<String,GrantError>>)}
static WORKER:OnceLock<mpsc::SyncSender<Work>>=OnceLock::new();
fn worker()->&'static mpsc::SyncSender<Work>{WORKER.get_or_init(||{
 let(tx,rx)=mpsc::sync_channel(1);
 std::thread::Builder::new().name("fileflow-local-ocr".into()).spawn(move||{
  // OcrEngine's cached WinRT factories must not outlive a torn-down apartment.
  // Hold one MTA for the entire dedicated worker lifetime, never per request.
  let apartment=Apartment::new();
  while let Ok(work)=rx.recv(){match work{
   Work::Info(reply)=>{let value=if apartment.is_ok(){info_on_worker()}else{Err(error("ocr_unavailable"))};let _=reply.send(value);}
   Work::Recognize(p,w,h,b,reply)=>{let value=if apartment.is_ok(){recognize_on_worker(p,w,h,b)}else{Err(error("ocr_unavailable"))};let _=reply.send(value);}
  }}
 }).expect("local OCR thread creation");tx
})}
pub fn info()->Result<EngineInfo,GrantError>{let(tx,rx)=mpsc::sync_channel(1);worker().send(Work::Info(tx)).map_err(|_|error("ocr_unavailable"))?;rx.recv().map_err(|_|error("ocr_unavailable"))?}
pub fn recognize(permit:Permit,width:u32,height:u32,bytes:Vec<u8>)->Result<String,GrantError>{validate_pixels(width,height,bytes.len(),4096)?;let(tx,rx)=mpsc::sync_channel(1);worker().send(Work::Recognize(permit,width,height,bytes,tx)).map_err(|_|error("ocr_unavailable"))?;rx.recv().map_err(|_|error("ocr_unavailable"))?}
#[cfg(test)]
mod tests {
 use super::*;
 #[test] fn pixels_are_exact_bounded_and_overflow_safe(){assert_eq!(validate_pixels(1,1,4,10000),Ok(()));assert!(validate_pixels(1,1,5,10000).is_err());assert!(validate_pixels(0,1,0,10000).is_err());assert!(validate_pixels(10000,10000,400000000,10000).is_err());assert!(validate_pixels(u32::MAX,2,4,10000).is_err());assert!(validate_pixels(4097,1,4097*4,10000).is_err());}
 #[test] fn sessions_reject_spoofing_and_hold_busy_until_permit_drop(){let s=Sessions::default();let id=s.begin("chi_sim").unwrap();assert!(s.begin("eng").is_err());assert!(s.acquire("guessed").is_err());let p=s.acquire(&id).unwrap();s.cancel(&id).unwrap();assert!(p.cancelled());assert!(s.finish(&id).is_err());drop(p);s.finish(&id).unwrap();assert!(s.acquire(&id).is_err());}
 #[test] fn closed_language_values_do_not_accept_paths_or_arbitrary_models(){let s=Sessions::default();assert!(s.begin("../../private").is_err());assert!(s.begin("cloud").is_err());let id=s.begin("chi_sim+eng").unwrap();s.finish(&id).unwrap();}
 #[test] fn actual_windows_engine_recognizes_generated_chinese_english_and_mixed_pixels(){
  let root=std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../.npm-cache/phase65-fixtures");
  let information=info().expect("Windows native OCR activation");assert!(information.modes.contains(&"chi_sim+eng"));
  for(name,mode,expected)in[("chinese","chi_sim","虚构文字识别样本"),("english","eng","Alice"),("mixed","chi_sim+eng","本地OCR测试")]{let bytes=std::fs::read(root.join(format!("{name}.rgba"))).expect("generated fictional RGBA fixture");let s=Sessions::default();let id=s.begin(mode).unwrap();let text=recognize(s.acquire(&id).unwrap(),1800,600,bytes).expect("actual native recognition");let normalized:String=text.chars().filter(|c|!c.is_whitespace()).collect();assert!(normalized.contains(expected),"unexpected fictional {name} recognition");s.finish(&id).unwrap();}
 }
}

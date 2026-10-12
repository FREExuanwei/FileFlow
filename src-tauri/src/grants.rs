//! Native-only file capabilities. Paths enter here from trusted native dialogs;
//! IPC must expose only the opaque IDs and the closed error codes below.
use serde::Serialize;
use std::{
    collections::HashMap,
    fs::{File, OpenOptions},
    io::{Read, Seek, SeekFrom, Write},
    mem::{offset_of, size_of},
    os::windows::{ffi::OsStrExt, fs::{MetadataExt, OpenOptionsExt}, io::AsRawHandle},
    path::{Component, Path, PathBuf, Prefix},
    time::{Duration, Instant},
};
use uuid::Uuid;
use windows::Win32::{
    Foundation::HANDLE,
    Storage::FileSystem::{
        SetFileInformationByHandle, FileDispositionInfo, FileRenameInfo,
        DELETE, FILE_ATTRIBUTE_REPARSE_POINT, FILE_DISPOSITION_INFO,
        FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT,
        FILE_READ_ATTRIBUTES, FILE_RENAME_INFO, FILE_RENAME_INFO_0, FILE_SHARE_READ,
    },
};

pub const MAX_CHUNK: u32 = 1024 * 1024;
const MAX_GRANTS: usize = 50;
const MAX_FILE: u64 = 40 * 1024 * 1024;
fn file_input_limit(path:&Path)->u64{match path.extension().and_then(|s|s.to_str()).map(|s|s.to_ascii_lowercase()).as_deref(){Some("pdf"|"png"|"jpg"|"jpeg"|"webp")=>100*1024*1024,_=>MAX_FILE}}
#[cfg(test)]
#[test]
fn desktop_pdf_image_admission_keeps_allocation_and_other_format_caps(){assert_eq!(file_input_limit(Path::new("fiction.pdf")),100*1024*1024);assert_eq!(file_input_limit(Path::new("fiction.PNG")),100*1024*1024);assert_eq!(file_input_limit(Path::new("fiction.csv")),40*1024*1024);assert_eq!(file_input_limit(Path::new("fiction.pdf.exe")),40*1024*1024);}
const MAX_INPUTS: u64 = 200 * 1024 * 1024;
const MAX_OUTPUTS: u64 = 128 * 1024 * 1024;
const TTL: Duration = Duration::from_secs(15 * 60);

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct GrantError { pub code: &'static str }
impl std::fmt::Display for GrantError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { f.write_str(self.code) }
}
impl std::error::Error for GrantError {}
fn err(code: &'static str) -> GrantError { GrantError { code } }

#[derive(Debug, Clone, Serialize)]
pub struct FileGrant { pub id: String, pub name: String, pub size: u64 }
pub type SaveGrant = FileGrant;

struct Input {
    file: File,
    _parents: Vec<File>,
    size: u64,
    expires: Instant,
}
struct Output {
    file: File,
    _parents: Vec<File>,
    target: PathBuf,
    size: u64,
    written: u64,
    expires: Instant,
    committed: bool,
}
impl Drop for Output {
    fn drop(&mut self) {
        // Address the owned handle, never a path that another process can replace.
        if !self.committed { let _ = disposition(&self.file, true); }
    }
}

pub struct Store {
    inputs: HashMap<String, Input>,
    outputs: HashMap<String, Output>,
    ttl: Duration,
}
impl Default for Store { fn default() -> Self { Self::new() } }
impl Store {
    pub fn new() -> Self { Self { inputs: HashMap::new(), outputs: HashMap::new(), ttl: TTL } }

    /// All-or-nothing admission; renderer-supplied paths must never call this method.
    pub fn admit_paths(&mut self, paths: Vec<PathBuf>) -> Result<Vec<FileGrant>, GrantError> {
        self.prune();
        if paths.len() + self.inputs.len() + self.outputs.len() > MAX_GRANTS { return Err(err("limit")); }
        let mut bytes: u64 = self.inputs.values().map(|g| g.size).sum();
        let mut pending = Vec::new();
        for path in paths {
            validate_path(&path)?;
            let parent = path.parent().ok_or_else(|| err("unsafe_path"))?;
            let parents = pin_directory(parent)?;
            let file = OpenOptions::new().read(true).share_mode(FILE_SHARE_READ.0)
                .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT.0 | FILE_FLAG_BACKUP_SEMANTICS.0)
                .open(&path).map_err(|_| err("file_unavailable"))?;
            let metadata = file.metadata().map_err(|_| err("file_unavailable"))?;
            if metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT.0 != 0 { return Err(err("reparse_point")); }
            if !metadata.is_file() { return Err(err("not_regular_file")); }
            let size = metadata.len();
            bytes = bytes.checked_add(size).ok_or_else(|| err("limit"))?;
            if size > file_input_limit(&path) || bytes > MAX_INPUTS { return Err(err("limit")); }
            let name = validated_name(&path, false)?;
            let id = self.unique_id();
            let grant = FileGrant { id, name, size };
            pending.push((grant, Input { file, _parents: parents, size, expires: Instant::now() + self.ttl }));
        }
        let mut grants = Vec::with_capacity(pending.len());
        for (grant, input) in pending { self.inputs.insert(grant.id.clone(), input); grants.push(grant); }
        Ok(grants)
    }

    pub fn read(&mut self, id: &str, offset: u64, len: u32) -> Result<Vec<u8>, GrantError> {
        self.check_input(id)?;
        if len == 0 { return Err(err("invalid_chunk")); }
        if len > MAX_CHUNK { return Err(err("limit")); }
        let grant = self.inputs.get_mut(id).ok_or_else(|| err("unknown_grant"))?;
        if offset > grant.size { return Err(err("invalid_offset")); }
        let count = u64::from(len).min(grant.size - offset) as usize;
        let mut bytes = vec![0; count];
        grant.file.seek(SeekFrom::Start(offset)).map_err(|_| err("read_failed"))?;
        grant.file.read_exact(&mut bytes).map_err(|_| err("read_failed"))?;
        Ok(bytes)
    }

    pub fn release(&mut self, id: &str) -> Result<(), GrantError> {
        self.check_input(id)?;
        self.inputs.remove(id);
        Ok(())
    }

    /// `path` must be the result of this process's native save dialog.
    pub fn begin_save(&mut self, path: PathBuf, size: u64) -> Result<SaveGrant, GrantError> {
        self.prune();
        let name = validated_name(&path, true)?;
        validate_path(&path)?;
        let reserved: u64 = self.outputs.values().map(|g| g.size).sum();
        if self.inputs.len() + self.outputs.len() >= MAX_GRANTS || size > MAX_OUTPUTS || reserved.checked_add(size).is_none_or(|n| n > MAX_OUTPUTS) { return Err(err("limit")); }
        let parent = path.parent().ok_or_else(|| err("unsafe_path"))?;
        let parents = pin_directory(parent)?;
        match std::fs::symlink_metadata(&path) {
            Ok(_) => return Err(err("target_exists")),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {},
            Err(_) => return Err(err("save_failed")),
        }
        let id = self.unique_id();
        let temp = parent.join(format!(".fileflow-{}.tmp", Uuid::new_v4().simple()));
        // DELETE access permits handle-based cleanup and rename. No sharing means
        // neither a writer nor a rename/delete opener can substitute this object.
        let file = OpenOptions::new().write(true).create_new(true)
            .access_mode(0x4000_0000 | DELETE.0).share_mode(0)
            .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT.0)
            .open(temp).map_err(|_| err("save_failed"))?;
        let output = Output { file, _parents: parents, target: path, size, written: 0, expires: Instant::now() + self.ttl, committed: false };
        // Delete-pending state also cleans up if the process terminates before Drop.
        disposition(&output.file, true)?;
        self.outputs.insert(id.clone(), output);
        Ok(SaveGrant { id, name, size })
    }

    pub fn write(&mut self, id: &str, offset: u64, bytes: &[u8]) -> Result<(), GrantError> {
        self.check_output(id)?;
        if bytes.is_empty() { return Err(err("invalid_chunk")); }
        if bytes.len() > MAX_CHUNK as usize { return Err(err("limit")); }
        let grant = self.outputs.get_mut(id).ok_or_else(|| err("unknown_grant"))?;
        if offset != grant.written { return Err(err("invalid_offset")); }
        let end = offset.checked_add(bytes.len() as u64).ok_or_else(|| err("limit"))?;
        if end > grant.size { return Err(err("limit")); }
        if grant.file.write_all(bytes).is_err() {
            self.outputs.remove(id);
            return Err(err("write_failed"));
        }
        grant.written = end;
        Ok(())
    }

    pub fn commit(&mut self, id: &str) -> Result<(), GrantError> {
        self.check_output(id)?;
        let grant = self.outputs.get_mut(id).ok_or_else(|| err("unknown_grant"))?;
        if grant.written != grant.size { return Err(err("incomplete_save")); }
        grant.file.sync_all().map_err(|_| err("save_failed"))?;
        disposition(&grant.file, false)?;
        if let Err(error) = rename_no_replace(&grant.file, &grant.target) {
            disposition(&grant.file, true)?;
            return Err(error);
        }
        grant.committed = true;
        self.outputs.remove(id);
        Ok(())
    }

    pub fn abort(&mut self, id: &str) -> Result<(), GrantError> {
        self.check_output(id)?;
        let grant = self.outputs.get(id).ok_or_else(|| err("unknown_grant"))?;
        disposition(&grant.file, true)?;
        self.outputs.remove(id);
        Ok(())
    }

    pub fn clear(&mut self) { self.inputs.clear(); self.outputs.clear(); }

    fn check_input(&mut self, id: &str) -> Result<(), GrantError> {
        let grant = self.inputs.get(id).ok_or_else(|| err("unknown_grant"))?;
        if Instant::now() >= grant.expires { self.inputs.remove(id); return Err(err("expired_grant")); }
        Ok(())
    }
    fn check_output(&mut self, id: &str) -> Result<(), GrantError> {
        let grant = self.outputs.get(id).ok_or_else(|| err("unknown_grant"))?;
        if Instant::now() >= grant.expires { self.outputs.remove(id); return Err(err("expired_grant")); }
        Ok(())
    }
    fn prune(&mut self) {
        let now = Instant::now();
        self.inputs.retain(|_, g| g.expires > now);
        self.outputs.retain(|_, g| g.expires > now);
    }
    fn unique_id(&self) -> String {
        loop {
            let id = Uuid::new_v4().simple().to_string();
            if !self.inputs.contains_key(&id) && !self.outputs.contains_key(&id) { return id; }
        }
    }
}

fn validate_path(path: &Path) -> Result<(), GrantError> {
    if !path.is_absolute() { return Err(err("unsafe_path")); }
    for component in path.components() {
        match component {
            Component::Prefix(prefix) => match prefix.kind() {
                Prefix::Disk(_) | Prefix::VerbatimDisk(_) => {},
                _ => return Err(err("unsafe_path")), // Reject UNC/device/named-pipe namespaces.
            },
            Component::ParentDir | Component::CurDir => return Err(err("unsafe_path")),
            Component::Normal(name) => {
                let value = name.to_str().ok_or_else(|| err("unsafe_path"))?;
                if value.contains(':') || value.chars().any(|c| c == '\0') { return Err(err("unsafe_path")); }
            },
            Component::RootDir => {},
        }
    }
    Ok(())
}

/// Pins every directory component without following reparse points. The handles
/// deny write and delete sharing so checked components cannot be renamed or
/// converted into reparse points while the capability is live.
pub fn pin_directory(path: &Path) -> Result<Vec<File>, GrantError> {
    validate_path(path)?;
    let mut ancestors: Vec<_> = path.ancestors().filter(|p| p.has_root()).collect();
    ancestors.reverse();
    let mut handles = Vec::with_capacity(ancestors.len());
    for ancestor in ancestors {
        let handle = OpenOptions::new().access_mode(FILE_READ_ATTRIBUTES.0)
            .share_mode(FILE_SHARE_READ.0)
            .custom_flags(FILE_FLAG_BACKUP_SEMANTICS.0 | FILE_FLAG_OPEN_REPARSE_POINT.0)
            .open(ancestor).map_err(|_| err("file_unavailable"))?;
        let metadata = handle.metadata().map_err(|_| err("file_unavailable"))?;
        if metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT.0 != 0 { return Err(err("reparse_point")); }
        if !metadata.is_dir() { return Err(err("unsafe_path")); }
        handles.push(handle);
    }
    Ok(handles)
}

fn validated_name(path: &Path, save: bool) -> Result<String, GrantError> {
    let name = path.file_name().and_then(|n| n.to_str()).ok_or_else(|| err("unsafe_name"))?;
    if name.is_empty() || name.encode_utf16().count() > 240 || name.starts_with('.') || name.ends_with(['.', ' '])
        || name.chars().any(|c| c.is_control() || "<>:\"/\\|?*".contains(c) || matches!(c, '\u{202a}'..='\u{202e}' | '\u{2066}'..='\u{2069}')) { return Err(err("unsafe_name")); }
    let stem = name.split('.').next().unwrap_or("").to_ascii_uppercase();
    if stem.ends_with(' ') || ["CON", "PRN", "AUX", "NUL", "CLOCK$", "CONIN$", "CONOUT$"].contains(&stem.as_str())
        || ((stem.starts_with("COM") || stem.starts_with("LPT")) && stem.len() == 4 && matches!(stem.as_bytes()[3], b'1'..=b'9')) { return Err(err("unsafe_name")); }
    if save {
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase();
        if !["pdf", "docx", "md", "markdown", "txt", "html", "htm", "csv", "tsv", "json", "yaml", "yml", "xlsx", "png", "jpg", "jpeg", "webp", "zip"].contains(&ext.as_str()) { return Err(err("unsafe_name")); }
    }
    Ok(name.to_owned())
}

fn disposition(file: &File, delete: bool) -> Result<(), GrantError> {
    let info = FILE_DISPOSITION_INFO { DeleteFile: delete };
    // SAFETY: file is live, and info has the ABI and lifetime required by this call.
    unsafe { SetFileInformationByHandle(HANDLE(file.as_raw_handle()), FileDispositionInfo, (&info as *const FILE_DISPOSITION_INFO).cast(), size_of::<FILE_DISPOSITION_INFO>() as u32) }
        .map_err(|_| err("save_failed"))
}

fn rename_buffer(name: &[u16]) -> (Vec<u64>, usize) {
    let offset = offset_of!(FILE_RENAME_INFO, FileName);
    // Win32 expects a NUL-terminated FileName even though FileNameLength does
    // not count the NUL. Alignment padding is not guaranteed to provide one.
    let bytes = offset + (name.len() + 1) * size_of::<u16>();
    // u64 storage supplies the alignment of FILE_RENAME_INFO on Windows x64.
    let mut storage = vec![0u64; bytes.max(size_of::<FILE_RENAME_INFO>()).div_ceil(size_of::<u64>())];
    let info = storage.as_mut_ptr().cast::<FILE_RENAME_INFO>();
    // SAFETY: storage is aligned and sized for the fixed header plus all UTF-16
    // bytes plus an explicit zero UTF-16 terminator; Windows consumes it
    // synchronously. FileNameLength continues to exclude the terminator.
    unsafe {
        (*info).Anonymous = FILE_RENAME_INFO_0 { ReplaceIfExists: false };
        (*info).RootDirectory = HANDLE::default();
        (*info).FileNameLength = (name.len() * size_of::<u16>()) as u32;
        std::ptr::copy_nonoverlapping(name.as_ptr(), storage.as_mut_ptr().cast::<u8>().add(offset).cast::<u16>(), name.len());
    }
    (storage, bytes)
}
fn rename_no_replace(file: &File, target: &Path) -> Result<(), GrantError> {
    let name: Vec<u16> = target.as_os_str().encode_wide().collect();
    let (storage, bytes) = rename_buffer(&name);
    let result = unsafe {
        SetFileInformationByHandle(HANDLE(file.as_raw_handle()), FileRenameInfo, storage.as_ptr().cast(), bytes as u32)
    };
    result.map_err(|e| {
        // Windows can report ACCESS_DENIED for a non-replacing rename onto an
        // existing file. The kernel has already refused the rename atomically;
        // this observation only chooses the closed UI error, never authorization.
        if matches!(e.code().0 as u32 & 0xffff, 80 | 183) || std::fs::symlink_metadata(target).is_ok() {
            err("target_exists")
        } else { err("save_failed") }
    })
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::{fs, fs::OpenOptions, os::windows::fs::symlink_dir};
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("target/grant-fixtures").join(uuid::Uuid::new_v4().simple().to_string());
            fs::create_dir_all(&root).unwrap(); Self(root)
        }
        fn path(&self, name:&str)->PathBuf { self.0.join(name) }
        fn file(&self,name:&str,bytes:&[u8])->PathBuf { let p=self.path(name); fs::write(&p,bytes).unwrap(); p }
        fn sized(&self,name:&str,size:u64)->PathBuf { let p=self.path(name); fs::File::create(&p).unwrap().set_len(size).unwrap(); p }
        fn entries(&self)->usize { fs::read_dir(&self.0).unwrap().count() }
    }
    impl Drop for Fixture { fn drop(&mut self) { fs::remove_dir_all(&self.0).unwrap(); } }
    fn error<T: std::fmt::Debug>(result:Result<T,GrantError>,code:&str) { assert_eq!(result.unwrap_err().code,code); }
    fn import(store:&mut Store,path:PathBuf)->FileGrant { store.admit_paths(vec![path]).unwrap().remove(0) }

    // Characterization of the explicitly authorized, generated incident fixture.
    // Does not open a chooser or establish manual native-picker acceptance.
    #[test] fn incident_fictional_csv_grant_and_read() {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent().unwrap()
            .join(".npm-cache/phase6-desktop-fixtures/虚构样本/虚构表格.csv");
        let mut store = Store::new();
        let grant = import(&mut store, path);
        assert_eq!(grant.name, "虚构表格.csv");
        assert_eq!(grant.size, 27);
        assert_eq!(store.read(&grant.id, 0, 27).unwrap(), b"name,score\nAlice,95\nBob,88\n");
        store.release(&grant.id).unwrap();
        error(store.read(&grant.id, 0, 1), "unknown_grant");
    }

    // Real Windows filesystem check at the same generated fixture location.
    // No dialog is opened, and this is not manual native-workflow acceptance.
    #[test] fn incident_fictional_json_save_in_native_path_forms() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent().unwrap()
            .join(".npm-cache/phase6-desktop-fixtures/虚构样本")
            .join(format!("save-probe-{}", Uuid::new_v4().simple()));
        fs::create_dir(&root).unwrap();
        let fixture = Fixture(root);
        let data = br#"[{"name":"Alice","score":"95"},{"name":"Bob","score":"88"}]"#;
        let normal = fixture.path("虚构结果.json");
        let verbatim = fs::canonicalize(&fixture.0).unwrap().join("虚构结果-longpath.json");
        for target in [normal, verbatim] {
            let mut store = Store::new();
            let grant = store.begin_save(target.clone(), data.len() as u64).expect("prepare temporary");
            store.write(&grant.id, 0, data).expect("write output");
            store.commit(&grant.id).expect("flush/disposition/rename output");
            assert_eq!(fs::read(target).unwrap(), data);
        }
        assert_eq!(fixture.entries(), 2);
    }

    #[test] fn opaque_grants_read_exact_binary_and_release() {
        let f=Fixture::new(); let mut s=Store::new(); let p=f.file("中文.pdf", &[0,255,17,22]);
        let g=import(&mut s,p.clone()); assert_eq!(g.name,"中文.pdf"); assert_eq!(g.size,4);
        assert_eq!(g.id.len(),32); assert!(!g.id.contains("中文")); assert_eq!(s.read(&g.id,1,2).unwrap(),[255,17]);
        assert_eq!(s.read(&g.id,4,1).unwrap(),Vec::<u8>::new()); s.release(&g.id).unwrap(); error(s.read(&g.id,0,1),"unknown_grant");
        fs::write(p,b"released").unwrap();
    }
    #[test] fn locked_file_cannot_be_written_or_renamed() {
        let f=Fixture::new(); let mut s=Store::new(); let p=f.file("locked.pdf",b"source"); let g=import(&mut s,p.clone());
        assert!(OpenOptions::new().write(true).open(&p).is_err()); assert!(fs::rename(&p,f.path("moved.pdf")).is_err());
        s.release(&g.id).unwrap(); fs::rename(p,f.path("moved.pdf")).unwrap();
    }
    #[test] fn pinned_parent_cannot_be_replaced_during_grant() {
        let f=Fixture::new(); let parent=f.path("parent"); fs::create_dir(&parent).unwrap(); let p=parent.join("a.pdf"); fs::write(&p,b"a").unwrap();
        let mut s=Store::new(); let g=import(&mut s,p); assert!(fs::rename(&parent,f.path("moved")).is_err()); s.release(&g.id).unwrap(); fs::rename(parent,f.path("moved")).unwrap();
    }
    #[test] fn read_rejects_oversized_and_out_of_range_requests() {
        let f=Fixture::new(); let mut s=Store::new(); let g=import(&mut s,f.file("a.pdf",b"abc"));
        error(s.read(&g.id,0,1_048_577),"limit"); error(s.read(&g.id,4,1),"invalid_offset"); error(s.read(&g.id,u64::MAX,1),"invalid_offset"); error(s.read(&g.id,0,0),"invalid_chunk");
        error(s.read("made-up",0,1),"unknown_grant");
    }
    #[test] fn batch_admission_is_atomic_and_count_bounded() {
        let f=Fixture::new(); let mut s=Store::new(); let good=f.file("a.pdf",b"a");
        let started=Instant::now();
        eprintln!("batch probe: atomic admission at {:?}",started.elapsed());
        error(s.admit_paths(vec![good.clone(),f.path("missing.pdf")]),"file_unavailable"); fs::write(&good,b"not locked").unwrap();
        eprintln!("batch probe: reject 51 at {:?}",started.elapsed());
        error(s.admit_paths((0..51).map(|i|f.path(&format!("{i}.pdf"))).collect()),"limit");
        eprintln!("batch probe: create 50 at {:?}",started.elapsed());
        let paths:Vec<_>=(0..50).map(|i|f.file(&format!("{i}.pdf"),b"a")).collect();
        eprintln!("batch probe: admit 50 at {:?}",started.elapsed());
        s.admit_paths(paths).unwrap();
        eprintln!("batch probe: reject extra at {:?}",started.elapsed());
        error(s.admit_paths(vec![good]),"limit");
        eprintln!("batch probe: done at {:?}",started.elapsed());
    }
    #[test] fn file_and_combined_byte_caps_apply_before_grant() {
        let f=Fixture::new(); let mut s=Store::new(); error(s.admit_paths(vec![f.sized("too-big.pdf",104_857_601)]),"limit");
        error(s.admit_paths(vec![f.sized("too-big.csv",41_943_041)]),"limit");
        let paths=(0..5).map(|i|f.sized(&format!("{i}.pdf"),41_943_040)).collect(); s.admit_paths(paths).unwrap(); error(s.admit_paths(vec![f.file("extra.pdf",b"x")]),"limit");
    }
    #[test] fn rejects_relative_traversal_and_directory_inputs() {
        let f=Fixture::new(); let mut s=Store::new(); error(s.admit_paths(vec![PathBuf::from("relative.pdf")]),"unsafe_path");
        error(s.admit_paths(vec![f.path("folder/../a.pdf")]),"unsafe_path"); error(s.admit_paths(vec![f.0.clone()]),"not_regular_file");
    }
    #[test] fn expires_input_and_removes_save_temporary() {
        let f=Fixture::new(); let mut s=Store::new(); s.ttl=Duration::ZERO;
        let g=import(&mut s,f.file("a.pdf",b"a")); error(s.read(&g.id,0,1),"expired_grant");
        let save=s.begin_save(f.path("save.pdf"),1).unwrap(); error(s.write(&save.id,0,b"a"),"expired_grant"); assert_eq!(f.entries(),1);
    }
    #[test] fn save_enforces_filename_extension_and_declared_size() {
        let f=Fixture::new(); let mut s=Store::new();
        for name in ["a.exe","CON.pdf","a.pdf:stream","a.pdf.","a .pdf", "..pdf", "a\u{202e}fdp.pdf"] { error(s.begin_save(f.path(name),1),"unsafe_name"); }
        error(s.begin_save(f.path("a.pdf"),134_217_729),"limit"); error(s.begin_save(f.path("folder/../a.pdf"),1),"unsafe_path"); assert_eq!(f.entries(),0);
    }
    #[test] fn transactional_save_orders_bounded_writes_and_commits() {
        let f=Fixture::new(); let mut s=Store::new(); let target=f.path("中文.pdf"); let g=s.begin_save(target.clone(),4).unwrap();
        assert!(!target.exists()); error(s.write(&g.id,1,b"a"),"invalid_offset"); error(s.write(&g.id,0,&vec![0;1_048_577]),"limit");
        s.write(&g.id,0,&[0,255]).unwrap(); error(s.commit(&g.id),"incomplete_save"); error(s.write(&g.id,2,b"abc"),"limit");
        s.write(&g.id,2,b"ok").unwrap(); s.commit(&g.id).unwrap(); assert_eq!(fs::read(&target).unwrap(),[0,255,111,107]); assert_eq!(f.entries(),1); error(s.commit(&g.id),"unknown_grant");
    }
    #[test] fn save_preserves_exact_filename_across_utf16_alignment_boundaries() {
        let f = Fixture::new();
        let data = b"fictional-json-output";
        // Consecutive lengths exercise every x64 storage padding case. Heap
        // reuse deliberately avoids assuming fresh allocator pages are zero.
        for index in 0..128 {
            let name = format!("{}-{:03}.json", "x".repeat(index % 4), index);
            // IFileSaveDialog returns ordinary DOS paths with backslashes,
            // unlike our older fixtures with embedded forward separators.
            let target = PathBuf::from(f.path(&name).to_str().unwrap().replace('/', "\\"));
            let mut store = Store::new();
            let grant = store.begin_save(target.clone(), data.len() as u64).unwrap();
            store.write(&grant.id, 0, data).unwrap();
            store.commit(&grant.id).unwrap();
            assert_eq!(fs::read(&target).expect("exact chosen filename must exist"), data);
            assert_eq!(f.entries(), index + 1, "no malformed or temporary filenames");
        }
    }
    #[test] fn rename_abi_has_an_explicit_nul_even_without_allocator_padding() {
        // Documented Win32 ABI: FileName is NUL-terminated, FileNameLength
        // excludes that NUL. This path fills a u64 allocation exactly.
        let name: Vec<u16> = "C:\\aa.json".encode_utf16().collect();
        let (storage, bytes) = rename_buffer(&name);
        let units = unsafe { std::slice::from_raw_parts(storage.as_ptr().cast::<u16>(), storage.len() * 4) };
        let offset = offset_of!(FILE_RENAME_INFO, FileName) / 2;
        assert_eq!(units.get(offset + name.len()), Some(&0), "Windows must not read past the allocation to find the filename terminator");
        assert!(bytes >= (offset + name.len() + 1) * 2);
        let info = unsafe { &*storage.as_ptr().cast::<FILE_RENAME_INFO>() };
        assert_eq!(info.FileNameLength, 20);
        assert_eq!(&units[offset..offset + name.len()], name);
    }
    #[test] fn existing_target_is_never_overwritten() {
        let f=Fixture::new(); let mut s=Store::new(); let target=f.file("existing.pdf",b"original"); error(s.begin_save(target.clone(),1),"target_exists"); assert_eq!(fs::read(target).unwrap(),b"original"); assert_eq!(f.entries(),1);
    }
    #[test] fn raced_target_conflicts_without_overwrite() {
        let f=Fixture::new(); let mut s=Store::new(); let target=f.path("raced.pdf"); let g=s.begin_save(target.clone(),1).unwrap(); s.write(&g.id,0,b"x").unwrap();
        fs::write(&target,b"winner").unwrap(); error(s.commit(&g.id),"target_exists"); assert_eq!(fs::read(&target).unwrap(),b"winner"); s.abort(&g.id).unwrap(); assert_eq!(f.entries(),1);
    }
    #[test] fn abort_clear_and_drop_remove_only_owned_temporaries() {
        let f=Fixture::new(); f.file("keep.pdf",b"keep"); let mut s=Store::new(); let g=s.begin_save(f.path("a.pdf"),1).unwrap(); s.write(&g.id,0,b"x").unwrap(); s.abort(&g.id).unwrap(); assert_eq!(f.entries(),1);
        s.begin_save(f.path("b.pdf"),1).unwrap(); s.clear(); assert_eq!(f.entries(),1);
        s.begin_save(f.path("c.pdf"),1).unwrap(); drop(s); assert_eq!(f.entries(),1); assert_eq!(fs::read(f.path("keep.pdf")).unwrap(),b"keep");
    }
    #[test] fn save_pins_parent_and_temp_against_substitution() {
        let f=Fixture::new(); let parent=f.path("parent"); fs::create_dir(&parent).unwrap(); let mut s=Store::new(); let g=s.begin_save(parent.join("a.pdf"),1).unwrap();
        assert!(fs::rename(&parent,f.path("moved")).is_err()); let temp=fs::read_dir(&parent).unwrap().next().unwrap().unwrap().path();
        assert!(fs::rename(&temp,parent.join("stolen.pdf")).is_err()); assert!(fs::write(&temp,b"substituted").is_err()); s.abort(&g.id).unwrap(); fs::rename(parent,f.path("moved")).unwrap();
    }
    #[test] fn reparse_components_are_rejected_when_symlinks_are_available() {
        let f=Fixture::new(); let real=f.path("real"); fs::create_dir(&real).unwrap(); fs::write(real.join("a.pdf"),b"a").unwrap(); let link=f.path("link");
        if let Err(e)=symlink_dir(&real,&link) { if e.raw_os_error()==Some(1314) { eprintln!("SKIP: symlink privilege unavailable (Win32 1314)"); return; } panic!("fixture symlink: {e}"); }
        let mut s=Store::new(); error(s.admit_paths(vec![link.join("a.pdf")]),"reparse_point"); error(s.begin_save(link.join("b.pdf"),1),"reparse_point"); fs::remove_dir(link).unwrap();
    }
    // A directory junction is a separate reparse-point fixture which does not
    // require enabling Developer Mode or granting symlink privileges. Keep the
    // original symbolic-link test/skip unchanged; this is not its replacement.
    #[test] fn junction_components_block_import_and_save_without_touching_target() {
        let f = Fixture::new();
        let allowed = fs::canonicalize(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("target/grant-fixtures")).unwrap();
        let owned = fs::canonicalize(&f.0).unwrap();
        assert_eq!(owned.parent(), Some(allowed.as_path()), "fixture must stay in the owned workspace root");
        let real = f.path("junction-target");
        fs::create_dir(&real).unwrap();
        fs::write(real.join("fictional.csv"), b"name,score\nAlice,95\n").unwrap();
        let link = f.path("junction-link");
        let output = std::process::Command::new("cmd.exe").args(["/D", "/C", "mklink", "/J"])
            .arg(link.to_str().unwrap().replace('/', "\\"))
            .arg(real.to_str().unwrap().replace('/', "\\"))
            .output().expect("create only the controlled fixture junction");
        assert!(output.status.success(), "junction creation failed; no skipped PASS");
        assert_ne!(fs::symlink_metadata(&link).unwrap().file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT.0, 0);
        let mut store = Store::new();
        error(store.admit_paths(vec![link.join("fictional.csv")]), "reparse_point");
        error(store.begin_save(link.join("fictional-output.json"), 1), "reparse_point");
        assert_eq!(fs::read(real.join("fictional.csv")).unwrap(), b"name,score\nAlice,95\n");
        assert_eq!(fs::read_dir(&real).unwrap().count(), 1);
        // Remove the junction itself, never recursively traverse its target.
        fs::remove_dir(&link).unwrap();
        assert!(real.join("fictional.csv").exists());
    }
    #[test] fn unknown_tokens_are_closed_errors_for_every_operation() {
        let mut s=Store::new(); error(s.read("unknown",0,1),"unknown_grant"); error(s.release("unknown"),"unknown_grant"); error(s.write("unknown",0,b"x"),"unknown_grant"); error(s.commit("unknown"),"unknown_grant"); error(s.abort("unknown"),"unknown_grant");
    }
}


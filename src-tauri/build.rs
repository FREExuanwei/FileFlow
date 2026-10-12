fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "pick_inputs", "read_input", "release_input", "choose_save",
            "write_save", "commit_save", "abort_save", "privacy_status", "get_preferences", "set_preferences",
            "ocr_info", "ocr_begin", "ocr_pixels", "ocr_cancel", "ocr_finish",
        ]),
    )).expect("desktop build configuration");
}

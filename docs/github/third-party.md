# Third-party source and distribution review

FileFlow first-party licensing is undecided; see CODE_USAGE.md. That does not remove existing third-party rights.

The accepted Desktop package includes full frontend/PDF/native notices in src-tauri/licenses. The local reviewed inventory includes47 installed non-dev npm graph entries (some Node-only helpers, not all bundled),9 PDF asset licenses, and243 locked Windows Cargo packages. No new runtime dependency or model was introduced by publication work.

React/Tauri API/pdf-lib use their recorded MIT/Apache options; PDF.js and SheetJS carry Apache notices; Mammoth is BSD-2-Clause, YAML ISC, and DOMPurify offers MPL-2.0 OR Apache-2.0. Full component texts, attribution and source references stay intact. Do not infer one blanket license for the whole app.

## MPL-covered native code

Five locked crates require MPL recipient/source information: cssparser0.37.0, cssparser-macros0.7.1, dtoa-short0.3.5, option-ext0.2.0 and selectors0.38.0. Existing notices identify exact crate/version sources and include license text. Official cached source archives were hashed against Cargo.lock and match; exact archive URLs and SHA-256 appear in mpl-sources.json. Source remains available under its MPL terms; this first-party notice imposes no restrictions on those rights.

Mozilla explains that executable distribution from unchanged MPL source must inform recipients where they can obtain that covered source; a larger work can retain different first-party terms. [Official FAQ, Q8/Q11](https://www.mozilla.org/en-US/MPL/2.0/FAQ/). This is a scoped component review, not independent legal certification of every possible distribution.

## OS and PDF assets

Windows.Media.Ocr recognizers/language resources and WebView2 runtime are provided under Microsoft/Windows terms. They are not copied into the installer or silently downloaded; no traineddata/Paddle/Python model is redistributed.

Local PDF.js CMaps,fonts and WASM have individual notices, preserved in PDF-ASSET-LICENSES.txt. Public source builds regenerate local assets from the exact locked package; do not distribute only the bundle without its notices.

Installer disclosure and permission gaps are independent of component-license checks. The accepted installer remains unuploaded. Any future release must include recipient-facing notices/source information and obtain explicit owner authorization.

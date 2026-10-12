# Architecture

- React/TypeScript workspace, shared queue and local conversion core.
- Vite builds separate Web/Desktop entries; Web can build without the native shell.
- Browser adapters use file admission/download behavior; Desktop adapters invoke explicit Tauri commands.
- Rust owns short-lived FileGrant/path validation, guarded reads/saves, budgeted Windows.Media.Ocr sessions and official WebView2 privacy controls.
- Heavy local conversion/PDF processing uses bounded workers; OCR is sequential and reuses reliable PDF text layers.
- PDF.js provides extraction/rendering; pdf-lib handles the six static page tools. Assets are shipped locally.
- Deterministic AI Ready recommendations/cleaning/outline/chunking run locally; Phase3 algorithm hashes remain frozen.
- Tauri2 capabilities/CSP remain minimal; no broad filesystem/shell plugin, cloud service, account or automatic updater.

Key code: src/core, src/converters, src/adapters, src/components, src-tauri/src. Historical scripts support specific local investigations and are not all portable one-command acceptance runners.

The earlier browser Tesseract candidate was security-deferred; it is not shipped. Current Desktop OCR is the Windows component, without Python/PaddleOCR/Tauri sidecar/model redistribution.

<div align="center">
<img src="public/favicon.svg" width="64" alt="FileFlow logo">
<h1>FileFlow</h1>
<p>Convert, recognize and organize your files — on your device.</p>
<p>Windows Desktop · Browser · English / 简体中文</p>
<p><a href="README.zh-CN.md">简体中文</a> · <a href="docs/github/windows.md">Windows guide</a> · <a href="docs/github/security.md">Privacy & security</a> · <a href="https://github.com/FREExuanwei/FileFlow/issues">Feedback</a></p>
</div>

**0.2.0-rc.1 · Release candidate.** Accepted for personal local use on one Windows 11 machine; not a stable release, production recommendation or independent security certification. **The Windows installer is not publicly available yet:** distribution checks found developer build paths in the binary, and native permission-test coverage remains incomplete. See [release status](docs/github/release-status.md).

FileFlow combines a file queue, configurable processing and readable previews. Processing stays local; the application has no file-upload feature, cloud conversion, AI API, account, API key or paid OCR service. The browser build remains independent; native file access and OCR are desktop features.

![Converter with invented CSV records](docs/github/assets/converter-light.png)

*Actual RC interface. Every screenshot uses fictional data.*

## Workspaces

| Workspace | Capabilities |
|---|---|
| Converter | Supported PDF text, DOCX, UTF-8 text, Markdown/HTML, image and data routes; single files or a bounded batch queue |
| AI Ready | Local recommendations, conservative cleaning, outline and chunk export; all token counts are **estimated tokens**, not exact model billing counts |
| Local OCR · Windows | PNG/JPEG/WebP and scans using **Windows.Media.Ocr**; Chinese, English/mixed text, page progress, cancel/retry and TXT/Markdown |
| PDF tools | **Merge, split, extract, delete, rotate, reorder** static pages; numbered preview and an operation summary before creating new PDFs |
| Images & data | Resize/quality options, XLSX → CSV/JSON, CSV/TSV/JSON/YAML routes, JSON validation/formatting, hashing and inspection |

Routes are explicitly listed by the app; arbitrary formats cannot necessarily be converted into each other. Office macros and spreadsheet formulas are not executed. Normal PDF text conversion needs a usable text layer; choose desktop OCR for scans.

![PDF extraction with invented pages](docs/github/assets/pdf-dark.png)

PDF tools create new files and preserve originals. This is a **static-page editor**: annotations, forms, bookmarks, attachments and digital signatures are **not retained**. Keep originals where these features matter.

![Local Windows OCR with invented Chinese and English text](docs/github/assets/ocr-light.png)

OCR reuses reliable PDF text layers and recognizes missing pages sequentially. Successful pages survive a page failure; partial results are clearly marked. Windows supplies installed recognizers; FileFlow bundles no model and downloads no language resources silently. English may use a disclosed Latin fallback when its recognizer is missing. Review recognized text. Browser OCR is not shipped.

## Windows

Planned artifact: unsigned, per-user NSIS installer for **Windows 11 x64**, requiring **WebView2 Evergreen Runtime 154+**. The runtime is checked, not downloaded automatically.

No installer download is provided by this source-only publication. Check [release status](docs/github/release-status.md) and [the Windows guide](docs/github/windows.md). After a future pre-release is approved, verify its SHA-256, preserve in-memory results and close the old version normally. Unknown-publisher/SmartScreen warnings may occur; do not disable system protections.

## Limits

Admission also depends on pages, decoded pixels, memory and output size. MiB = 1,048,576 bytes.

| Route | Web | Windows Desktop |
|---|---:|---:|
| Ordinary PDF → text | 40 MiB | 100 MiB |
| Ordinary PNG/JPEG/WebP | 20 MiB | 100 MiB |
| OCR PDF / image | Not available | 100 MiB |
| PDF tools | 40 MiB/file; 60 MiB combined | Same |
| Text / DOCX / ordinary data | 10 MiB | 10 MiB |
| XLSX | 4 MiB | 4 MiB |
| Structured JSON/YAML tools | 2 MiB | 2 MiB |

OCR: 100 physical pages / 50 OCR pages, 24 MP source images, 6 MP raster and 4096-pixel longest side. PDF tools: 500 combined pages, 50 outputs and 64 MiB output. AI Ready PDF remains 40 MiB. **256 MiB app-accounted transient memory is not a total process-memory ceiling.** 200 MiB is not enabled. [Details](docs/github/limits.md).

## Privacy and safety

Files, extracted text and previews are processed locally. Native access uses user-selected files, short-lived grants, validated Rust commands and guarded saves, without broad filesystem/shell plugin permissions. Previews are sanitized/sandboxed; desktop renderer requests are restricted to local app/IPC origins.

Only non-sensitive language/theme preferences are intentionally saved. Windows dialogs may retain history. WebView2 can write protected local crash dumps containing memory; official crash uploads are disabled, but FileFlow cannot fully control or prove absence of OS/runtime diagnostics. Cleanup reduces remnants, not prior disk writes. Read [boundaries and test gaps](docs/github/security.md), especially before confidential use. Never attach private documents, paths or dumps to public issues.

## Development

**React · TypeScript · Vite · Tauri 2 · Rust · WebView2**. Native adapters are separate from the shared conversion core. AI Ready algorithms remain frozen. [Architecture](docs/github/architecture.md).

Node.js **24.15+**, committed lockfiles:

~~~sh
npm ci
npm run dev
npm run build
~~~

Desktop builds additionally need Rust MSVC **1.99+**, Microsoft C++ Build Tools/Windows SDK and WebView2. In a correctly initialized developer terminal:

~~~sh
npm run desktop:dev
npm run desktop:build
~~~

Use **npm.cmd** in PowerShell if npm.ps1 is rejected; do not weaken execution policy. Historical local test wrappers contain machine-specific toolchain locations. Standard build commands use your installed toolchain. Local builds are new artifacts, not the accepted installer by default. [Build/test guide](docs/github/development.md).

Generated test data and raw results are excluded from public Git. Regenerate fictional fixtures:

~~~sh
npm run fixtures
node scripts/generate-ai-fixtures.mjs
node scripts/generate-phase5-fixtures.mjs --group data
node scripts/generate-phase5-fixtures.mjs --group yaml
node scripts/phase5-xlsx-fixtures.mjs --write
node -e "require('node:fs').mkdirSync('.npm-cache',{recursive:true})"
npm run test:unit
npm run lint
npm run typecheck
~~~

## Verification and history

Local records report **550/550 units**, **90/90 original browser cases** including one continuous **47/47 Phase 3 run**, and actual Windows OCR/PDF execution. Installed native dialogs, upgrade/uninstall/reinstall and physical-offline checks were owner-confirmed, not independently certified. Native permission fixtures have failures/skips; they are not counted as security passes. [Validation summary](docs/github/validation.md).

GitHub starts from a privacy-reviewed RC source snapshot. Previous local commits/tags and raw records stay local. Product source matches the accepted RC manifest; the public initial commit has a different identity. [Version history](docs/github/history.md) · [Changelog](CHANGELOG.md).

## Code use

**No general open-source license is selected for FileFlow's first-party code.** Public visibility does not grant general copying/modification/redistribution rights. GitHub platform rights and third-party licenses apply separately. [CODE_USAGE.md](CODE_USAGE.md). No blanket project MIT/Apache/GPL license is assigned here.

Full third-party notices and covered-source information, including MPL components, are provided separately. Windows recognizers/runtime are OS components, not redistributed models. [Distribution review](docs/github/third-party.md).

Report non-sensitive, reproducible problems in [Issues](https://github.com/FREExuanwei/FileFlow/issues) with version, route, expected/actual behavior and an invented minimal sample. Follow [SECURITY.md](SECURITY.md) for security reports.

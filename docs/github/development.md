# Development and reproducibility

Prerequisites: Node24.15+, npm, committed lockfiles. Desktop requires Rust MSVC1.99+, Visual Studio2022 C++ Build Tools/Windows SDK and WebView2 on Windows11 x64.

Use npm ci, then npm run dev / npm run build for Web. In an initialized Visual Studio developer terminal, npm run desktop:dev / desktop:build uses the existing locked Tauri project. Runtime files are bundled locally. Standard global toolchain setup is preferable to copying the original author's D-drive wrapper paths. PowerShell may require npm.cmd rather than unsigned npm.ps1.

Prepare fictional fixtures before tests: npm run fixtures; node scripts/generate-ai-fixtures.mjs; node scripts/generate-phase5-fixtures.mjs --group data; repeat with --group yaml. XLSX fixture generation is provided by scripts/phase5-xlsx-fixtures.mjs with --write. Create .npm-cache before the UI measurement test (node -e "require('node:fs').mkdirSync('.npm-cache',{recursive:true})"). PDF-tool/OCR larger samples use their existing generation scripts and .npm-cache output; never substitute private data.

Run npm run test:unit, npm run lint, npm run typecheck, npm run test:browser. Node desktop configuration/delivery tests are separate. Native tests run cargo test --locked --manifest-path src-tauri/Cargo.toml; log/inspect privilege soft skips rather than counting them as verified security assertions.

Full historical acceptance collectors also depend on local raw evidence omitted from public Git; missing raw reports are not product regressions or permission to fabricate results. They remain available in the owner's original local workspace.

Local builds create different artifacts. Never claim the accepted RC installer SHA for a rebuild. Before any public binary: configure supported build-path remapping, inspect resulting PE strings/debug metadata, review notices/source availability, run the required checks and get owner approval. No automatic upload/publish workflow is included.

No OCR model installation, silent runtime download, paid service or Windows security-policy alteration is part of these commands.

## RC.2 distribution build

The committed [product/resource fingerprints](product-source-manifest.json) match the RC.2 candidate used for the released installer. [Build provenance](build-provenance.json) records the locked toolchain, binary identities and Tauri's expected three-byte UNK-to-NSS bundle marker. Documentation edits do not rebuild the approved installer. Local rebuilds are distinct artifacts; neither lockfiles nor these steps promise identical bytes.

In an initialized Windows MSVC developer terminal, set equivalent path mappings for your own checkout and Cargo registry before npm run desktop:build. For example, in PowerShell:

~~~powershell
$sourceRoot = (Get-Location).Path
$cargoCache = if ($env:CARGO_HOME) { $env:CARGO_HOME } else { Join-Path $env:USERPROFILE '.cargo' }
$pathFlags = @(
  "--remap-path-prefix=$env:USERPROFILE=/build-user",
  "--remap-path-prefix=$sourceRoot=/fileflow",
  "--remap-path-prefix=$cargoCache/registry=/cargo/registry"
)
$env:CARGO_ENCODED_RUSTFLAGS = [string]::Join([char]31, $pathFlags)
npm.cmd run desktop:build
~~~

Normalize Windows/forward-slash forms as needed for your toolchain. Inspect the resulting installer, extracted main executable, frontend output and PE/PDB metadata; compiler mapping is best effort and does not cover all linker-generated information. Keep src-tauri/licenses resources, including exact MPL covered-source archives, with the binary. Do not bypass system security settings or reuse this release's acceptance/hash for a new build.

# 0.2.0-rc.2 Windows pre-release

[Release and installer](https://github.com/FREExuanwei/FileFlow/releases/tag/v0.2.0-rc.2) · [Direct Windows x64 download](https://github.com/FREExuanwei/FileFlow/releases/download/v0.2.0-rc.2/FileFlow_0.2.0-rc.2_x64-setup.exe). Owner-authorized, unsigned RC distribution; not stable, production-ready or independently audited.

| Identity | Value |
|---|---|
| Tag | v0.2.0-rc.2 |
| Installer | FileFlow_0.2.0-rc.2_x64-setup.exe |
| Size | 4,525,195 bytes |
| SHA-256 | 36E03964C48B97CA9205239E4C472655DF62042DF7DCE0DABF9800F9AD8D6054 |
| Authenticode | NotSigned |

RC.2 is a separately identified build. Seven version files changed and seven recipient notice/source resources were added; product behavior, source algorithms, IPC/grants/CSP, limits and locked dependencies are unchanged. No feature/refactor was added. Original local RC.1, its hash/acceptance records and public RC.1 commit/tag remain intact. RC.1's installer is not uploaded.

## Distribution changes and evidence

Rust-supported source-path remapping removed the known developer-workstation source prefixes that appeared 142 times in the old RC.1 main executable. Inspection found none of those prefixes in RC.2's installer, all 25 extracted files or separate frontend checks. PE CodeView inspection found no absolute PDB reference. Scope: known workstation paths in ASCII/UTF-16, byte-oriented credential patterns, ASCII frontend path checks; not universal encoded-secret detection.

All 18 recipient notice/source resources were content-verified, including five exact unmodified MPL source archives with Cargo.lock-matching checksums. They are installed beside the bilingual notice and source index, with offline access and official source URLs. No general first-party open-source license was assigned.

Six focused existing native assertions pass, including real Junction import/save rejection and unchanged target contents. The distinct privileged symlink fixture still soft-skips with Win32 1314: its assertions are unverified. Historical failures remain disclosed.

The exact EXE extracted from RC.2 passes six targeted app checks; two scoped NSIS resource installation/uninstallation checks pass. Prior RC.1 extensive functionality, native-dialog, installer and owner-reported physical-offline evidence is reused because core/NSIS logic is unchanged. No repeated complete RC.2 manual acceptance is claimed. External renderer requests were blocked for the new reload/smoke check; this is not physical disconnection. [Validation](validation.md).

## Residual risks

Unsigned publisher identity and SmartScreen prompts; unverified privileged symlink assertions; protected local WebView2 crash dumps that may contain memory; OS/runtime diagnostics outside renderer observations; limited machine/username/runtime/endurance coverage. These limitations are disclosed for a limited RC. Never disable protections or upload private data to public issues. [Security](security.md) · [Build provenance](build-provenance.json).

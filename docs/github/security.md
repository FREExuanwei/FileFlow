# Privacy, file access and distribution status

FileFlow has no cloud conversion, telemetry, remote error reporting, model-download or file-upload feature. User files and previews are local. Renderer observations were limited to app-owned/IPC origins; this does not establish zero Windows/WebView2 diagnostic networking.

Desktop files require explicit native selection or supported drop admission, validated Rust commands and short-lived tokens. Opened parent-directory handles reject reparse attributes and deny write/delete sharing; input bounds and transactional saves protect against unsafe paths and replacement. No broad filesystem/shell plugin is installed. HTML is sanitized and previewed in a restricted frame; existing parser/worker budgets and frozen AI Ready algorithms are unchanged. Originals are not silently edited.

Only theme/language preferences are intentionally saved. Dialog history, OS caches and protected WebView2 local crash dumps may remain; dumps can include memory. Official crash-upload control is enabled, while OS/runtime diagnostics remain outside FileFlow's complete control. Cleanup reduces residual risk, not earlier disk writes. The earlier strict-zero-dump gate remains historically BLOCKED; the later owner-approved protected-local-dump model is distinct.

## File access evidence and gaps

The original full native run reported 35 passes and one symbolic-link fixture creation failure (Win32 5). The initial publication recheck soft-skipped Win32 1314; neither result verifies the symbolic-link rejection assertions.

A later 2026-10-14 run of the existing Junction test in a permitted context passed actual import/save reparse rejection and confirmed the fictional target stayed unchanged. Six focused native checks also cover real read/save, existing/raced-target no-overwrite and pinned parent/temp protection. Earlier fixture failures are not erased or combined into a fictional full-suite PASS.

The privileged symbolic-link fixture still cannot be created (Win32 1314), and its separate assertions remain unverified. Real Junction rejection, shared reparse-point checks and opened-handle pinning support a limited RC with this disclosed coverage residual; they are not a complete symlink replacement. No Developer Mode, privilege or security-policy change was made. No actual path-authorization bypass was demonstrated by these checks.

## Binary privacy

RC.1's accepted main executable contained 142 Cargo developer-source path occurrences; its installer stays local. RC.2 is a new version with supported compiler path remapping and renewed package inspection. Known workstation prefixes were absent from its installer, 25 extracted files and separately checked frontend output; no absolute PE CodeView PDB path was found. These scoped scans and unchanged reviewed inputs do not prove absence of all encoded secrets or native vulnerabilities.

The public RC.2 remains unsigned, with limited machine, username and endurance coverage. Its targeted exact-package smoke reused prior RC.1 manual/physical-offline evidence; renderer request blocking is not a physical-disconnect test. No independent security audit or production suitability claim is made. Use only fictional examples in reports. [Release status](release-status.md).

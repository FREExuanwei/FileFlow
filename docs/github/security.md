# Privacy, file access and distribution status

FileFlow itself has no cloud conversion, telemetry, remote error reporting, model-download or file-upload feature. User files and previews are local. Renderer observations in local tests were limited to app-owned/IPC origins. This does **not** establish zero Windows/WebView2 diagnostic networking.

Desktop files require explicit native selection or supported drop admission, validated Rust commands and short-lived tokens. Parent directories/handles, reparse attributes, extension/size bounds and transactional saves protect against arbitrary paths and unsafe replacement. No broad filesystem/shell plugin is installed. Native and Web implementations are separated.

HTML is sanitized and previewed in a restricted frame; PDF/data parsers and workers retain existing budgets. Documents are untrusted. Original files are not silently edited. Frozen AI Ready algorithms have not been changed for publication.

Only theme/language preferences are intentionally saved. Dialog history, OS caches and protected WebView2 local crash dumps may remain. Dumps can include memory; official crash upload control is enabled, while OS/runtime diagnostics are a disclosed trust boundary. Cleanup reduces residual risk, not previous disk writes. The earlier strict-zero-dump gate remains historically BLOCKED; the later owner-approved protected-local-dump model is distinct.

## Permission coverage

Phase 8's full Rust run reported 35 passes and one failure while creating a symbolic-link fixture (Win32 5), before the reparse assertions. A fresh publication check, with current execution permissions, returned Win32 1314 and the existing test's explicit soft skip. Its runner “ok” is **not** a verified symbolic-link rejection.

A prior unchanged-source junction test did exercise import/save reparse rejection and confirmed its fictional target stayed unchanged. The publication-time junction rerun failed creating its fixture; its assertions did not execute. Preserve both conclusions; prior PASS does not erase new fixture FAIL, and a junction is not a complete symbolic-link replacement. No privilege, Developer Mode or security-policy change was made. No product-path authorization failure was demonstrated, but the coverage gap remains.

## Binary privacy

The accepted main executable contains 142 developer-workstation path strings identifying Cargo source files. These are build-source paths, not evidence of uploaded user documents, but they are inappropriate for an unreviewed public binary. The installer stays local. Do not rebuild/relabel a different installer as the accepted RC.1 or reuse its acceptance hash.

A later candidate needs supported build-path remapping, binary/path inspection and appropriate renewed validation. Neither a zero secrets scan nor a successful npm audit proves native/binary safety.

No independent security audit, production suitability, multi-machine completeness or hours-long endurance claim is made. Report only invented samples and redacted facts. [Release status](release-status.md).

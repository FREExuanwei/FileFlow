# Validation scope

These are conclusions from locally retained acceptance evidence; original logs, private paths, chat receipts and generated datasets are not uploaded.

| Check | Recorded result / scope |
|---|---|
| Existing Vitest units | 550/550; original case identities retained |
| Original browsers | 90/90, one run includes full47/47 Phase3; zero retries/skips/flaky |
| Phase5 production | 44/44, Edge22 + Chrome22 |
| Real desktop OCR | 20/20 with real WinRT; Chinese/Latin fallback/mixed, images/scans/Hybrid, cancel/retry/Partial, resource boundaries |
| Real desktop PDF | 14/14; six tools, independent result parsing/render, malformed/encrypted/boundary/cancel |
| Final RC integration | 6/6, bundled WebView2 + native OCR/IPC |
| Isolated installer | 11/11; compiled NSIS, simulated runtime registration and isolated names; not formal native-wizard observation |
| Node delivery/source tests | 18/18, separate from Vitest |
| lint/typecheck/Web/Desktop build | Passed in Phase8; warnings disclosed in local records |
| dependency checks | npm0, OSV/RustSec0 over243 locked Windows packages; no universal vulnerability guarantee |
| frozen algorithms | 16/16 hashes unchanged |
| owner-installed/manual/offline | Owner reported all consolidated checks passed; not independent agent observation |
| original Rust full run | 35 passes / 1 fixture failure, no rewrite as36/36 |
| fresh publication symlink check | Explicit privilege soft skip1314; reparse assertions unverified |
| fresh publication junction check | Fixture creation failed; assertions unverified; prior genuine junction evidence retained separately |

Desktop automation injects fictional inputs into the actual UI and exercises actual workers/WinRT; it does not impersonate native selection/save or physical disconnect. Limits, diagnostics, unsigned identity and uncovered environments remain risks.

The screenshots are fresh captures of the accepted RC, in an agent-owned test process, using invented CSV/PDF/OCR contents. They do not contain OS dialogs, private desktop content or actual personal records.

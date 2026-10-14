# Windows RC installation

[Download FileFlow 0.2.0-rc.2 x64](https://github.com/FREExuanwei/FileFlow/releases/download/v0.2.0-rc.2/FileFlow_0.2.0-rc.2_x64-setup.exe) · [Pre-release notes](https://github.com/FREExuanwei/FileFlow/releases/tag/v0.2.0-rc.2). FileFlow_0.2.0-rc.2_x64-setup.exe is 4,525,195 bytes. It is unsigned, not stable or independently audited.

Requirements: Windows 11 x64, WebView2 Evergreen Runtime 154+ (the tested project floor). FileFlow checks the runtime and does not download it silently. Use [Microsoft's official runtime source](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) if needed.

## Verify before installing

Run PowerShell in the download directory:

~~~powershell
(Get-FileHash -LiteralPath .\FileFlow_0.2.0-rc.2_x64-setup.exe -Algorithm SHA256).Hash
~~~

Expected SHA-256: `36E03964C48B97CA9205239E4C472655DF62042DF7DCE0DABF9800F9AD8D6054`. Stop if it differs.

Save in-memory results and close FileFlow normally. Run the per-user NSIS setup in a dedicated application directory, not one containing unrelated personal files. Unknown-publisher/SmartScreen warnings may occur; respect Windows policy and do not disable protections. No certificate purchase or bypass is required.

Upgrade in the intended installation directory. Preflight/maintenance checks require normal closure of running tasks. Check the footer version and shortcut target when older copies exist. Use Windows Settings to uninstall the intended copy; keep optional application-data deletion unchecked. User-selected exports must remain. Uninstall does not promise to erase all OS/profile/diagnostic traces.

The installed licenses directory contains full third-party notices, DISTRIBUTION-NOTICE.txt, MPL-covered-sources.json and five exact MPL-*.crate source archives. They are gzip-compressed tar archives readable offline with standard archive tools. The index gives versions, original official source URLs and SHA-256. MPL-covered source retains its own rights.

The protected profile is under %LOCALAPPDATA%/FileFlow.Desktop and can contain preferences and local diagnostics. Never publish crash dumps. Windows/WebView2 diagnostics and caches remain disclosed boundaries. Restart and select input again if source bytes were released after a conversion. Report errors with an invented minimal sample. [Security scope](security.md) · [Release status](release-status.md).

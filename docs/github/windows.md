# Windows RC installation

The source repository currently provides **no public Windows installer**. A draft is prepared for 0.2.0-rc.1; its accepted installer remains local until privacy/distribution gates are addressed. [Status](release-status.md).

Requirements: Windows 11 x64, WebView2 Evergreen Runtime 154+ (the tested project floor, not a universal API minimum). FileFlow detects the runtime and will not download it silently. Use [Microsoft's official runtime source](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) if needed.

For a future approved pre-release: download only its listed asset, check the release's SHA-256, save any in-memory results and close FileFlow normally. Run the per-user NSIS setup in a dedicated application directory. Do not select a directory containing unrelated personal files.

Unsigned means publisher identity is not authenticated. SmartScreen/unknown-publisher warnings may occur; respect Windows policy, do not disable protection. No certificate purchase or bypass is required by this project.

Upgrade in the same directory; installer preflight and maintenance checks request normal closure of running tasks. Check footer version and shortcut target when old copies exist. Use Windows Settings to uninstall the intended copy; keep the optional application-data deletion unchecked. User-selected exports must remain. Uninstall is not advertised as erasing all OS/profile/diagnostic traces.

The protected app profile is under %LOCALAPPDATA%/FileFlow.Desktop; it can contain non-sensitive preferences and local diagnostics. Never publish its crash dumps. Restart and select input again if source bytes were released after a conversion.

For errors: retain results, note the displayed error code and use an invented minimal example. History-cleanup warnings are not permission grants or permission failures; actual red import/save errors should be reported separately.

; Included by the pinned official Tauri NSIS template after utils.nsh.
; Replace only the running-application macro: never terminate a process.
!macroundef CheckIfAppIsRunning
!macro CheckIfAppIsRunning executablePath productName
  !insertmacro RestartManager_StartSession $R0
  StrCpy $R4 1
  ${If} $R0 != ""
    !insertmacro RestartManager_RegisterFile $R0 "${executablePath}"
    ${If} $0 = 0
      System::Call 'RSTRTMGR::RmGetList(i R0, *i .r1, *i .r2, p 0, *i .r3) i .r0'
      ${If} $0 = 0
        StrCpy $R4 0
      ${EndIf}
    ${EndIf}
    !insertmacro RestartManager_EndSession $R0
  ${EndIf}
  ${If} $R4 != 0
    SetErrorLevel 32
    IfSilent +2 0
      MessageBox MB_OK|MB_ICONSTOP "Please close ${productName} normally and retry. Running tasks will not be terminated.$\r$\n请正常关闭 ${productName} 后重试，安装器不会强制结束任务。"
    Quit
  ${EndIf}
!macroend

!macro FileFlowRequireRuntime guid
  ; Windows 11 x64; retain the official per-machine/per-user detection paths.
  ReadRegStr $4 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\${guid}" "pv"
  ${If} $4 == ""
    ReadRegStr $4 HKCU "SOFTWARE\Microsoft\EdgeUpdate\Clients\${guid}" "pv"
  ${EndIf}
  StrCpy $R4 1
  ${If} $4 != ""
    ${VersionCompare} "$4" "154.0.0.0" $R4
  ${EndIf}
  ${If} $4 == ""
  ${OrIf} $R4 = 2
    SetErrorLevel 2
    IfSilent +2 0
      MessageBox MB_OK|MB_ICONSTOP "FileFlow requires Microsoft Edge WebView2 Evergreen Runtime 154 or newer. Install the official runtime yourself, then retry this offline installer.$\r$\nFileFlow 需要 WebView2 Evergreen Runtime 154 或更高版本。请自行安装微软官方运行时后重试；本安装包不会联网安装。"
    Quit
  ${EndIf}
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro FileFlowRequireRuntime "${WEBVIEW2APPGUID}"
!macroend

; MUI2 calls this after .onInit resolved the previous installation location,
; before any maintenance page can execute the old uninstaller. Tauri includes
; this file before its defines, so these fixed FileFlow identifiers are literal.
; The release check verifies they still match the generated template.
!define MUI_CUSTOMFUNCTION_GUIINIT FileFlowPreflight
Function FileFlowPreflight
  Push $0
  Push $1
  Push $2
  Push $3
  Push $4
  Push $R0
  Push $R1
  Push $R2
  Push $R3
  Push $R4
  !insertmacro FileFlowRequireRuntime "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
  !insertmacro CheckIfAppIsRunning "$INSTDIR\fileflow-desktop.exe" "FileFlow"
  Pop $R4
  Pop $R3
  Pop $R2
  Pop $R1
  Pop $R0
  Pop $4
  Pop $3
  Pop $2
  Pop $1
  Pop $0
FunctionEnd

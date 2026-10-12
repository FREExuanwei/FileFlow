param([int]$OwnerPid,[string]$FileName,[switch]$Cancel)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class FileFlowDialogTest {
 [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)] public static extern IntPtr SendMessageW(IntPtr window, uint message, IntPtr wParam, string value);
 [DllImport("user32.dll", EntryPoint="SendMessageW", CharSet=CharSet.Unicode)] public static extern IntPtr ReadText(IntPtr window, uint message, IntPtr capacity, System.Text.StringBuilder value);
 [DllImport("user32.dll", SetLastError=true)] public static extern bool PostMessageW(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);
 [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr window);
 [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr window, uint flags);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool IsWindowEnabled(IntPtr window);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
}
'@
$root=[System.Windows.Automation.AutomationElement]::RootElement
$condition=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty,$OwnerPid)
$dialog=$null
for($attempt=0;$attempt -lt 150;$attempt++){
 $windows=$root.FindAll([System.Windows.Automation.TreeScope]::Children,$condition)
 foreach($window in $windows){
  if($window.Current.ClassName -eq '#32770'){$dialog=$window;break}
  $nested=$window.FindFirst([System.Windows.Automation.TreeScope]::Descendants,(New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty,'#32770')))
  if($nested){$dialog=$nested;break}
  $filename=$window.FindFirst([System.Windows.Automation.TreeScope]::Descendants,(New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty,'1001')))
  if($filename -and $filename.Current.NativeWindowHandle -ne 0){$dialog=$window;break}
 }
 if($dialog){break};Start-Sleep -Milliseconds 100
}
if(!$dialog){throw 'Owned native file dialog did not appear'}
if(![FileFlowDialogTest]::IsWindowVisible([IntPtr]$dialog.Current.NativeWindowHandle)){throw 'Owned native dialog is hidden; no UI action attempted'}
if(!$Cancel){
 $edits=$dialog.FindAll([System.Windows.Automation.TreeScope]::Descendants,(New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty,'Edit')))
 $edit=$null;foreach($candidate in $edits){if($candidate.Current.AutomationId -eq '1148' -and $candidate.Current.ProcessId -eq $OwnerPid){$edit=$candidate;break}}
 if(!$edit){
  $controls=$dialog.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
  $structure=@();foreach($control in $controls){$structure+=@{id=$control.Current.AutomationId;type=$control.Current.ControlType.ProgrammaticName;class=$control.Current.ClassName;hwnd=$control.Current.NativeWindowHandle}}
  Write-Output ($structure|ConvertTo-Json -Compress)
  throw 'Native filename edit unavailable'
 }
 if($edit.Current.NativeWindowHandle -eq 0){throw 'Native filename handle unavailable'}
 if([FileFlowDialogTest]::SendMessageW([IntPtr]$edit.Current.NativeWindowHandle,0x000C,[IntPtr]::Zero,$FileName) -eq [IntPtr]::Zero){throw 'Native filename assignment failed'}
 Start-Sleep -Milliseconds 300
 $actual=New-Object System.Text.StringBuilder 4096
 [void][FileFlowDialogTest]::ReadText([IntPtr]$edit.Current.NativeWindowHandle,0x000D,[IntPtr]4096,$actual)
 if($actual.ToString() -ne $FileName){throw 'Native filename did not retain the fictional test value'}
}
$buttonId=if($Cancel){'2'}else{'1'}
$buttonCondition=New-Object System.Windows.Automation.AndCondition((New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty,$buttonId)),(New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty,'Button')))
$button=$dialog.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$buttonCondition)
if(!$button -or $button.Current.ClassName -ne 'Button' -or $button.Current.ProcessId -ne $OwnerPid -or $button.Current.NativeWindowHandle -eq 0){throw 'Native dialog action unavailable'}
# BM_CLICK is accepted only after supported foreground activation succeeds.
# Never attach thread input or override Windows focus/security restrictions.
$buttonHwnd=[IntPtr]$button.Current.NativeWindowHandle
$dialogHwnd=[FileFlowDialogTest]::GetAncestor($buttonHwnd,2)
if(![FileFlowDialogTest]::IsWindowEnabled($buttonHwnd)){throw 'Native dialog action is disabled'}
if(![FileFlowDialogTest]::SetForegroundWindow($dialogHwnd) -or [FileFlowDialogTest]::GetForegroundWindow() -ne $dialogHwnd){throw 'Windows declined owned test dialog activation'}
if($Cancel){[System.Windows.Forms.SendKeys]::SendWait('{ESC}')}else{[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')}
Write-Output '{"nativeDialog":true,"actionCompleted":true}'

import {useEffect,useRef,useSyncExternalStore} from 'react';
import {useI18n} from '../i18n/Provider';
import {subscribeNotice,getNotice,cancelDesktopSave,dismissDesktopNotice,dismissDesktopHistoryWarning} from './service';
import {DesktopPrivacy} from './Privacy';
export function DesktopStatus(){
 const {language}=useI18n(),notice=useSyncExternalStore(subscribeNotice,getNotice),alert=useRef<HTMLParagraphElement>(null);
 useEffect(()=>{if(notice?.kind==='error')alert.current?.focus({preventScroll:true});},[notice]);
 const privacyFailure=notice?.code==='dialog_privacy_failed'||notice?.code==='dialog_show_and_clear_failed';
 const message=language==='zh-CN'
  ? notice?.kind==='importing'?'正在选择并读取文件…':notice?.kind==='imported'?'文件读取完成。请查看工作区并点击“转换文件”。':notice?.kind==='import-cancelled'?'导入已取消，没有导入文件。':notice?.kind==='saving'?'正在保存…':notice?.kind==='saved'?'文件已保存。':notice?.kind==='cancelled'?'保存已取消，转换结果仍可下载。':privacyFailure?'文件选择器的隐私清理失败，操作已安全阻止；未导入新文件，也未保存输出。请勿重复尝试此选择器。':notice?.code==='target_exists'?'目标文件已存在。请重新保存并选择新的文件名。':'本地操作失败，文件未能完成导入或保存。已有任务和结果仍保留。'
  : notice?.kind==='importing'?'Selecting and reading files…':notice?.kind==='imported'?'File reading finished. Check the workspace and click “Convert file”.':notice?.kind==='import-cancelled'?'Import cancelled; no file was imported.':notice?.kind==='saving'?'Saving…':notice?.kind==='saved'?'File saved.':notice?.kind==='cancelled'?'Save cancelled; the result remains available.':privacyFailure?'File-dialog privacy cleanup failed. The operation was safely blocked; no new file was imported or output saved. Do not repeatedly retry this picker.':notice?.code==='target_exists'?'Target already exists. Save again using a new filename.':'Local import or save failed. Existing tasks and results remain available.';
 return <aside className="desktop-status"><DesktopPrivacy/>{notice&&<div className="desktop-feedback">
  {notice.kind!=='warning'&&<p ref={alert} tabIndex={notice.kind==='error'?-1:undefined} role={notice.kind==='error'?'alert':'status'} className={notice.kind==='error'?'error':'small-note'}>{message}{notice.kind==='error'&&<span className="desktop-error-code">{language==='zh-CN'?'错误码':'Error code'}: {notice.code}</span>}{notice.kind==='saving'&&<button className="text-button" onClick={cancelDesktopSave}>{language==='zh-CN'?'取消保存':'Cancel save'}</button>}</p>}
  {notice.historyWarning&&<p role="status" className="desktop-history-warning" data-dialog-history-warning>{language==='zh-CN'?'Windows 未能清理选择器的本地历史（例如最近文件夹）。这不会阻止操作，文件授权、路径和安全保存校验仍会执行。':'Windows could not clear local file-dialog history, such as the last folder. This does not block the operation; file authorization, path and safe-save checks still apply.'}<span className="desktop-error-code">ClearClientData: 0x{notice.historyWarning.hresult.toString(16).toUpperCase().padStart(8,'0')}</span><button className="text-button desktop-warning-dismiss" onClick={dismissDesktopHistoryWarning}>{language==='zh-CN'?'收起此警告（本次运行不再重复）':'Dismiss warning for this session'}</button></p>}
  {notice.kind!=='saving'&&notice.kind!=='importing'&&<button className="text-button desktop-dismiss" onClick={dismissDesktopNotice}>{language==='zh-CN'?'收起提示':'Dismiss notice'}</button>}
 </div>}</aside>;
}

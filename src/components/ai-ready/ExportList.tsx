import type { ExportFile } from '../../core/ai-ready/types';
import type { AiDownloadController } from '../../adapters/web/ai-ready-downloads';
import { useI18n } from '../../i18n/Provider';
export function AiExportList({files,downloads}:{files:readonly ExportFile[];downloads:AiDownloadController}){const {t}=useI18n();return <div className="ai-export-list">{files.map(file=><div key={file.id}><span>{file.name}</span><button className="secondary" onClick={()=>downloads.saveOne(file)} aria-label={t('aiDownloadOne',{name:file.name})}>{t('download')}</button></div>)}</div>;}

import {useI18n} from '../i18n/Provider';
import {getDesktopPlatform} from '../adapters/platform';
import {Icon} from './Icon';
type Mode='convert'|'ai-ready'|'image'|'ocr'|'pdf-tools';
export function WorkspaceModes({mode,onModeChange,onTools}:{mode:Mode;onModeChange:(mode:Mode)=>void;onTools?:()=>void}){
 const {t,language}=useI18n(),zh=language==='zh-CN';
 const items=[
  {id:'convert' as const,label:t('converter'),detail:zh?'文档、图片与数据':'Documents, images & data',icon:'flow' as const,accent:'document'},
  {id:'ai-ready' as const,label:t('aiMode'),detail:zh?'清理、整理与分块':'Clean, organize & chunk',icon:'file' as const,accent:'document'},
  {id:'pdf-tools' as const,label:t('aiPdfTools'),detail:zh?'合并、拆分与页面整理':'Merge, split & arrange pages',icon:'file' as const,accent:'document'},
  {id:'image' as const,label:t('images'),detail:zh?'格式转换与尺寸调整':'Convert & resize',icon:'image' as const,accent:'image'},
  ...(getDesktopPlatform()?[{id:'ocr' as const,label:zh?'本地 OCR':'Local OCR',detail:zh?'图片与扫描 PDF':'Images & scanned PDFs',icon:'code' as const,accent:'ocr-accent'}]:[])
 ];
 return <div className="workspace-modes" aria-label={t('workbench')}>{items.map(item=><button key={item.id} className={item.accent} aria-label={item.label} aria-pressed={mode===item.id} onClick={()=>onModeChange(item.id)}><Icon name={item.icon} size={19}/><span><strong>{item.label}</strong><small>{item.detail}</small></span></button>)}{onTools&&<button className="data" data-testid="data-tools-nav" aria-label={zh?'数据工具':'Data tools'} onClick={onTools}><Icon name="data" size={19}/><span><strong>{zh?'数据工具':'Data tools'}</strong><small>CSV / JSON · {zh?'校验与文件信息':'Validate & inspect'}</small></span></button>}</div>;
}

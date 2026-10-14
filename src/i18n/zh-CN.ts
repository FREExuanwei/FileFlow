import type { Dictionary } from './types';
import { phase2Zh } from './phase2';
import { phase3Zh } from './phase3';
export const zhCN: Dictionary = {
  ...phase2Zh,
  ...phase3Zh,
  title: 'FileFlow — 本地文件转换，默认保护隐私', meta: '文件在本地转换，默认保护隐私。无需上传、账号或 API 密钥。',
  skip: '跳转到主要内容', home: 'FileFlow 首页', nav: '主导航', converter: '转换工具', formats: '支持格式', privacy: '隐私保护', device: '在你的设备上运行',
  language: '界面语言', theme: '外观主题', system: '跟随系统', light: '浅色', dark: '深色',
  heroBadge: '本地处理 · 默认保护隐私', heroTitle: '文件转换，就在本地', heroAccent: '隐私保护，从默认开始', heroDescription: '换一种格式，继续下一步。文件始终留在你的设备上。',
  import: '导入文件', drop: '把文件拖到这里', release: '松开以导入文件', dropDescription: '单个文件或一整批，全程在本地处理。', browse: '选择文件', choose: '选择要转换的文件', supported: 'PDF、DOCX、Markdown、数据与图片', sizeHint: '单个最大 40 MB · 各格式限制不同',
  stays: '文件只在你的设备上处理', noUploadAccount: '无需上传 · 无需账号', explore: '先体验一下？', sample: '试用虚构示例文件',
  formatEyebrow: '支持的转换格式', formatTitle: '为下一步，找到合适的格式', formatNote: '22 条转换路线 · 一个本地工具', documents: '文档', images: '图片', data: '数据', markup: '标记文本',
  documentsDescription: '提取文字，让内容更好用。', imagesDescription: '保留画面，换一种图片格式。', dataDescription: '给数据一种更合适的结构。', markupDescription: '清晰的内容，方便继续编辑。',
  formatFootnote: 'PDF 文本提取需要可读取的文字层，复杂排版可能变化。页面操作请使用 PDF 工具；Windows 桌面版提供本地 OCR。', routes: '{count} 条路线',
  privacyEyebrow: '隐私保护，融入每一步', privacyTitle: '你的文件，始终留在这里', privacyDescription: '从导入到结果，全程在你的设备上完成。', yourFile: '你的文件', browser: '你的浏览器', result: '转换结果', howPrivacy: '了解隐私保护', noUpload: '无需上传', noAccount: '无需账号', noTracking: '无追踪', noKey: '无需 API 密钥',
  footerLocal: '本地优先的文件转换工具', footerMessage: '为文件而做，为隐私而建。', version: 'FileFlow 0.2.0-rc.2',
  privacyDialogTitle: '你的设备，你的文件', closePrivacy: '关闭隐私说明', privacyProcessing: 'FileFlow 在浏览器中处理文件。文件内容不会发送到服务器、AI API 或在线转换服务。',
  privacyMemory: '文件和结果只在当前会话队列中保留。完成后自动释放源文件；移除或清除任务、关闭或刷新页面会释放保留的结果。本地仅保存外观主题和你手动选择的语言。',
  privacyAssets: '转换库和 PDF 所需资源均随应用本地提供。没有账号、统计分析、追踪或付费服务。', privacyLimits: '浏览器功能、操作系统行为和扩展程序不由 FileFlow 控制。安全限制有助于控制内存用量，但无法保证每台设备都能处理所有文件。', gotIt: '知道了',
  workspaceEyebrow: '你的本地工作区', workspaceTitle: '换一种格式，仍在本地', clear: '清除文件', local: '本地', convertTo: '转换为', outputCard: '已选输出格式', plainText: '纯文本', goodToKnow: '转换前须知', large: '这个文件较大，转换可能需要更多时间和设备内存。',
  quality: '输出质量', smaller: '文件更小', higher: '质量更高', converting: '正在本地转换… {percent}%', progress: '转换进度', cancel: '取消转换', convert: '开始转换', again: '再次转换', inlinePrivacy: '文件始终留在这台设备上。',
  ready: '转换完成', download: '下载文件', outputFormat: '输出格式', originalSize: '原文件大小', outputSize: '结果大小', originalDimensions: '原始尺寸', outputDimensions: '输出尺寸', pages: '已在本地处理 {count} 页',
  emptyTitle: '转换结果会显示在这里', emptyDescription: '选择输出格式并开始转换，下载前可以先预览。', processed: '本地处理', another: '转换另一个文件',
  previewHeading: '结果预览', preview: '预览', source: '源内容', convertedAlt: '转换后的图片', safePreview: '安全文档预览', truncated: '预览仅显示前 200,000 个字符，下载文件包含完整内容。', error: '暂时无法转换', warning: '请留意', info: '任务提示',
  genericError: '转换未能完成，请尝试更小的文件，或检查原始文件格式。', genericWarning: '部分内容未能完整保留，使用前请检查转换结果。',
};


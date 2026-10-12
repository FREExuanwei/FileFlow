import { phase2En } from './phase2';
import { phase3En } from './phase3';
export const en = {
  ...phase2En,
  ...phase3En,
  title: 'FileFlow — Private, local file conversion', meta: 'Local-first file conversion, private by default. No upload, account or API key.',
  skip: 'Skip to content', home: 'FileFlow home', nav: 'Main navigation', converter: 'Converter', formats: 'Formats', privacy: 'Privacy', device: 'On your device',
  language: 'Interface language', theme: 'Color theme', system: 'System', light: 'Light', dark: 'Dark',
  heroBadge: 'LOCAL BY DESIGN · PRIVATE BY DEFAULT', heroTitle: 'Convert files locally.', heroAccent: 'Private by default.', heroDescription: 'A new format for your next step. Your files stay right here.',
  import: 'Import files', drop: 'Drop files here', release: 'Release to import your files', dropDescription: 'One file or a whole batch. All on your device.', browse: 'Browse files', choose: 'Choose files', supported: 'PDF, DOCX, Markdown, data & images', sizeHint: 'Up to 40 MB each · limits vary by format',
  stays: 'Your files stay on this device.', noUploadAccount: 'No upload. No account.', explore: 'Just exploring?', sample: 'Try a fictional sample',
  formatEyebrow: 'SUPPORTED FORMATS', formatTitle: 'Find your next format.', formatNote: '22 routes · one local tool', documents: 'Documents', images: 'Images', data: 'Data', markup: 'Markup',
  documentsDescription: 'Bring the words along.', imagesDescription: 'A fresh format for your pixels.', dataDescription: 'Give your data a different shape.', markupDescription: 'Readable content, ready to reuse.',
  formatFootnote: 'Text extraction requires a readable PDF text layer; complex layouts may change. Use PDF tools for page operations. Local OCR is available in the Windows desktop version.', routes: '{count} routes',
  privacyEyebrow: 'PRIVACY, BUILT IN', privacyTitle: 'Your files stay here.', privacyDescription: 'A simple path, entirely on your device.', yourFile: 'Your file', browser: 'Your browser', result: 'Converted result', howPrivacy: 'How privacy works', noUpload: 'No upload', noAccount: 'No account', noTracking: 'No tracking', noKey: 'No API key',
  footerLocal: 'Local-first file conversion.', footerMessage: 'Made for your files. Built for your privacy.', version: 'FileFlow 0.2.0-rc.1',
  privacyDialogTitle: 'Your device. Your files.', closePrivacy: 'Close privacy details', privacyProcessing: 'FileFlow processes files in your browser. File contents are never sent to a server, AI API or online conversion service.',
  privacyMemory: 'Files and outputs live in the session queue. Successful sources release automatically; removing or clearing tasks, closing the page or refreshing releases retained outputs. Only your theme and manual language preferences are saved locally.',
  privacyAssets: 'All conversion libraries and PDF assets are served with the app. There are no accounts, analytics, tracking or paid services.', privacyLimits: 'Browser features, operating system behavior and extensions are outside FileFlow’s control. Limits help manage memory; they cannot guarantee your device will handle every file.', gotIt: 'Got it',
  workspaceEyebrow: 'YOUR LOCAL WORKSPACE', workspaceTitle: 'A new format. Same device.', clear: 'Clear file', local: 'Local', convertTo: 'Convert to', outputCard: 'Your selected output', plainText: 'Plain text', goodToKnow: 'GOOD TO KNOW', large: 'This is a larger file. Conversion may take longer and use more device memory.',
  quality: 'Output quality', smaller: 'Smaller file', higher: 'Higher quality', converting: 'Converting on your device… {percent}%', progress: 'Conversion progress', cancel: 'Cancel conversion', convert: 'Convert file', again: 'Convert again', inlinePrivacy: 'Your file never leaves this device.',
  ready: 'Conversion complete', download: 'Download', outputFormat: 'Output format', originalSize: 'Original size', outputSize: 'Output size', originalDimensions: 'Original dimensions', outputDimensions: 'Output dimensions', pages: '{count} page(s) processed locally',
  emptyTitle: 'Your output appears here', emptyDescription: 'Choose a format and convert. Preview it before you download.', processed: 'Processed locally', another: 'Convert another file',
  previewHeading: 'OUTPUT PREVIEW', preview: 'Preview', source: 'Source', convertedAlt: 'Converted output', safePreview: 'Safe document preview', truncated: 'Preview shows the first 200,000 characters. Download contains the full output.', error: 'Unable to convert', warning: 'Good to know', info: 'Task update',
  genericError: 'Conversion failed. Try a smaller file or check its format.', genericWarning: 'Some content could not be fully represented. Review the output before using it.',
} as const;


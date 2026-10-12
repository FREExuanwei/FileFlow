import { extractDocxHtml } from '../converters/docx/extract';
const scope = self as unknown as { onmessage: ((event: MessageEvent<ArrayBuffer>) => void) | null; postMessage: (value: unknown) => void };
scope.onmessage = async event => {
  try { scope.postMessage(await extractDocxHtml(event.data)); }
  catch (error) { scope.postMessage({ error: error instanceof Error && error.message.startsWith('DOCX') ? error.message : 'Unable to read this DOCX. It may be damaged, encrypted or unsupported.' }); }
};

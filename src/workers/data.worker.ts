import { convertData } from '../converters/data/transform';
const scope = self as unknown as { onmessage: ((event: MessageEvent<{ id: string; text: string }>) => void) | null; postMessage: (value: unknown) => void };
scope.onmessage = event => {
  try { scope.postMessage({ text: convertData(event.data.id, event.data.text) }); }
  catch (error) { scope.postMessage({ error: error instanceof Error ? error.message : 'Data conversion failed.' }); }
};

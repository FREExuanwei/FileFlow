import type { ConversionOptions, ConversionResult, Format, InputFile } from '../conversion/types';
export type Status = 'validating' | 'ready' | 'queued' | 'processing' | 'completed' | 'warning' | 'failed' | 'cancelled';
export interface QueueItem {
  id: string; name: string; size: number; type: string; input?: InputFile; format?: Format;
  target: Format; mode: 'convert' | 'image'; basename: string; options: ConversionOptions;
  status: Status; progress: number; error?: string; result?: ConversionResult;
  sourceDimensions?: { width: number; height: number };
  draftName?: string; draftResize?: { width: string; height: string };
  issues?: { name?: string; resize?: string };
}
export interface QueueSnapshot { items: readonly QueueItem[]; activeId?: string; notice?: string }
export const isFinished = (item: QueueItem) => item.status === 'completed' || item.status === 'warning';
export const isBusy = (item: QueueItem) => ['validating', 'queued', 'processing'].includes(item.status);
export const isImage = (format?: Format): format is 'png' | 'jpeg' | 'webp' => ['png', 'jpeg', 'webp'].includes(format ?? '');

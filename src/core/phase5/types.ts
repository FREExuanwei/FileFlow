import type { Converter, ConversionOptions, Format, InputFile } from '../conversion/types';
import type { ResourceBudget } from '../resources/budget';
import type { Status } from '../queue/types';

export type P5Format = Format | 'tsv' | 'yaml' | 'xlsx';
export type P5Primitive = string | number | boolean | null;
export type P5Data = P5Primitive | P5Data[] | { [key: string]: P5Data };
export interface P5Input extends InputFile { lastModified?: number }
export type P5Operation =
  | { kind: 'route'; routeId: string; sheetId?: string; headers?: 'first-row' | 'generated' }
  | { kind: 'json'; action: 'format' | 'minify' | 'validate' }
  | { kind: 'inspect'; structural: boolean }
  | { kind: 'hash'; algorithm: 'SHA-256' | 'SHA-512' };
export interface P5Notice { code: string; count?: number }
export interface P5RunContext {
  taskId: string; operationId: string; generation: number;
  signal: AbortSignal; budget: ResourceBudget; onStage(stage: string): void;
}
export interface P5FileResult {
  kind: 'file'; name: string; format: P5Format; blob: Blob; preview: string;
  notices: P5Notice[]; rows?: number; columns?: number;
}
export interface P5ReportResult {
  kind: 'report'; reportType: 'validation' | 'inspection' | 'hash';
  fields: Readonly<Record<string, P5Primitive>>; notices: P5Notice[];
}
export type P5Result = P5FileResult | P5ReportResult;
export type P5Runner = (input: P5Input, operation: P5Operation, context: P5RunContext) => Promise<P5Result>;
export type P5Converter = Omit<Converter, 'input' | 'output' | 'convert'> & {
  input: P5Format; output: P5Format;
  convert(input: P5Input, options: ConversionOptions & {sheetId?: string; headers?: 'first-row' | 'generated'}, context: P5RunContext): Promise<P5FileResult>;
};
export interface P5Message<T> { taskId: string; operationId: string; generation: number; payload: T }
export interface WorkerPolicy { transientBytes: number; timeoutMs: number; settlement: 'terminable' | 'native-digest' }
export interface P5Table { headers: readonly string[]; rows: readonly (readonly P5Primitive[])[] }
export interface SafeJson { value: P5Data; nodes: number; depth: number }
export interface P5Job {
  id: string; input?: P5Input; format?: P5Format; operation: P5Operation;
  status: Status; generation: number; stage?: string; result?: P5Result; errorCode?: string;
}
export interface P5Snapshot { items: readonly P5Job[]; activeId?: string; noticeCode?: string }

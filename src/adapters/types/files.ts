import type { InputFile } from '../../core/conversion/types';
export interface FileInputAdapter<Source> { read(source: Source): InputFile | undefined | Promise<InputFile | undefined> }
export interface FileOutputAdapter { save(blob: Blob, filename: string): void; dispose(): void }

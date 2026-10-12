export type Format = 'pdf' | 'docx' | 'md' | 'txt' | 'html' | 'csv' | 'json' | 'png' | 'jpeg' | 'webp';
export type Category = 'Document' | 'Markup' | 'Data' | 'Image';
export interface InputFile { name: string; type: string; size: number; blob: Blob }
export interface ConversionOptions { quality?: number; resize?: { width?: number; height?: number; keepAspect: boolean }; signal?: AbortSignal; onProgress?: (progress: number) => void; resourceBudget?: import('../resources/budget').ResourceBudget }
export interface ConversionResult {
  name: string; format: Format; blob: Blob; text?: string; warnings: string[];
  dimensions?: { width: number; height: number }; originalDimensions?: { width: number; height: number }; pages?: number;
}
export interface Converter {
  id: string; displayName: string; input: Format; output: Format;
  inputMime: string; outputMime: string; inputExtensions: string[]; outputExtension: string;
  category: Category; description: string; preview: boolean; lossy: boolean; limitations: string[];
  convert(file: InputFile, options: ConversionOptions): Promise<ConversionResult>;
}

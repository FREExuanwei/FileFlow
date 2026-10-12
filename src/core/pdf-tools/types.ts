import type {InputFile} from '../conversion/types';
export type PdfOperation='merge'|'split'|'extract'|'delete'|'rotate'|'reorder';
export interface PdfSettings {operation:PdfOperation;selection:string;splitSize:number;rotation:number}
export interface PdfPageInfo {width:number;height:number;rotation:number}
export interface PdfInfo {pages:PdfPageInfo[];annotations:boolean}
export interface PdfSource {id:string;input:InputFile;info:PdfInfo}
export interface PdfOutput {name:string;blob:Blob;pages:number}
export interface PdfRequest {kind:'inspect'|'write';inputs:readonly InputFile[];settings:PdfSettings}
export interface PdfResponse {info:PdfInfo[];outputs:PdfOutput[]}
export const PDF_TOOLS_LIMITS=Object.freeze({fileBytes:40*1024**2,totalBytes:60*1024**2,pages:500,outputs:50,resultBytes:64*1024**2,timeoutMs:60000});

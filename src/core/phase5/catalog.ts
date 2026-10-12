import type {Converter} from '../conversion/types';
import type {P5Format,P5Converter} from './types';
import {converters} from '../registry';
import {P5Error} from './errors';
export interface Admission{yaml:boolean;xlsx:boolean}
export interface P5Route{id:string;input:P5Format;output:P5Format;owner:'legacy'|'phase5';converter:Converter|P5Converter}
export const PRODUCT_ADMISSION:Readonly<Admission>=Object.freeze({yaml:true,xlsx:true});
const mime:Partial<Record<P5Format,string>>={csv:'text/csv',tsv:'text/tab-separated-values',json:'application/json',yaml:'application/yaml',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
export function activeCatalog(admission:Admission):readonly P5Route[]{
  const legacy:P5Route[]=converters.map(converter=>({id:converter.id,input:converter.input,output:converter.output,owner:'legacy',converter}));
  const pairs:readonly (readonly [P5Format,P5Format])[]=[['csv','tsv'],['tsv','json'],['tsv','csv'],['json','tsv'],...(admission.yaml?[['yaml','json'],['json','yaml']] as const:[]),...(admission.xlsx?[['xlsx','csv'],['xlsx','json']] as const:[])];
  return[...legacy,...pairs.map(([input,output]):P5Route=>{const id=`${input}-to-${output}`,converter:P5Converter={id,input,output,displayName:output.toUpperCase(),inputMime:mime[input]!,outputMime:mime[output]!,inputExtensions:input==='yaml'?['yaml','yml']:[input],outputExtension:output,category:'Data',description:id,preview:true,lossy:input==='xlsx'||input==='yaml'||output==='yaml',limitations:[input==='xlsx'?'xlsx-single-sheet':input==='yaml'||output==='yaml'?'yaml-layout-loss':'data-layout'],async convert(file,options,context){const {runPhase5Route}=await import('../../converters/phase5/run');return runPhase5Route(file,{kind:'route',routeId:id,sheetId:options.sheetId,headers:options.headers},context,admission);}};return{id,input,output,owner:'phase5',converter};})];
}
export function recommendedRoute(format:P5Format,admission:Admission):P5Route|undefined{const routes=activeCatalog(admission).filter(r=>r.input===format);return routes.find(r=>r.output===(format==='xlsx'?'csv':format==='tsv'||format==='yaml'?'json':undefined))??routes[0];}
export function assertAdmittedRoute(id:string,admission:Admission):P5Route{const route=activeCatalog(admission).find(r=>r.id===id&&r.owner==='phase5');if(!route)throw new P5Error('type');return route;}

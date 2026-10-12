import { P5Error } from './errors';
const MiB = 1024 ** 2;
export const P5_LIMITS = Object.freeze({
  tasks:50, sourceBytes:200*MiB,resultBytes:128*MiB,transientBytes:256*MiB,
  xlsxSource:4*MiB,xlsxExpanded:32*MiB,xlsxEntry:8*MiB,xlsxEntries:1024,xlsxRatio:100,xlsxSheets:32,xlsxRows:20000,xlsxColumns:256,xlsxCells:250000,xlsxCellUnits:32768,xlsxXmlMarkers:500000,xlsxSharedUnits:8*MiB,xlsxOutput:16*MiB,xlsxTransient:192*MiB,
  dataSource:10*MiB,dataRows:100000,dataColumns:1000,dataCells:1000000,dataOutput:32*MiB,dataTransient:96*MiB,
  structuredSource:2*MiB,depth:64,nodes:100000,scalarUnits:256*1024,structuredOutput:8*MiB,structuredTransient:64*MiB,
  yamlDocuments:1,yamlAnchors:20,yamlAliasNodes:20,yamlAliasCount:20,
  hashSource:32*MiB,hashTransient:98*MiB,inspectorSource:40*MiB,inspectorReport:16*1024,pdfPages:500,imageSource:20*MiB,imagePixels:24000000,imageEdge:16384,previewUnits:50000,workerTimeout:60000,
});
export function assertLimit(name: keyof typeof P5_LIMITS, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > P5_LIMITS[name]) throw new P5Error('size');
}

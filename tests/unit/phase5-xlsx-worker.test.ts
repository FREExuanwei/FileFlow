// @vitest-environment node
import {afterEach,expect,it,vi} from 'vitest';
import {fictionalWorkbook} from '../../scripts/phase5-xlsx-fixtures.mjs';
import {inspectWorkbookBytes,readSelectedSheet} from '../../src/converters/phase5/xlsx/parser';
import {preflightXlsx} from '../../src/converters/phase5/xlsx/zip-preflight';
const {read}=vi.hoisted(()=>({read:vi.fn()}));
vi.mock('xlsx',()=>({read}));
afterEach(()=>vi.resetAllMocks());
const signal=()=>new AbortController().signal;
it('rejects expansion before calling SheetJS',async()=>{
  await expect(inspectWorkbookBytes(fictionalWorkbook({extra:{'xl/large.xml':'x'.repeat(100000)},deflate:true}).bytes,signal())).rejects.toThrow();expect(read).not.toHaveBeenCalled();
});
it('inspection compares parser names/count against validated metadata',async()=>{
  const bytes=fictionalWorkbook().bytes;read.mockReturnValue({SheetNames:['Unexpected']});await expect(inspectWorkbookBytes(bytes,signal())).rejects.toMatchObject({code:'structure'});
  read.mockReturnValue({SheetNames:['Fictional']});expect(await inspectWorkbookBytes(bytes,signal())).toEqual({sheets:[{id:'rId1',name:'Fictional',visibility:'visible'}],dateSystem:'1900'});expect(read).toHaveBeenLastCalledWith(bytes,expect.objectContaining({type:'array',bookSheets:true,cellDates:false,cellHTML:false,bookVBA:false}));
});
it('hidden and unknown sheets cannot enter full parse',async()=>{
  const bytes=fictionalWorkbook({sheets:[{name:'Hidden',state:'hidden'}]}).bytes,envelope=await preflightXlsx(bytes,{signal:signal()});
  for(const id of ['rId1','unknown'])await expect(readSelectedSheet(bytes,id,envelope,signal())).rejects.toMatchObject({code:'input'});expect(read).not.toHaveBeenCalled();
});
it('selected parse uses no truncation and retains raw types/formats without date conversion',async()=>{
  const bytes=fictionalWorkbook().bytes,envelope=await preflightXlsx(bytes,{signal:signal()}),sheet={'!ref':'A1:B2'};read.mockReturnValue({SheetNames:['Fictional'],Sheets:{Fictional:sheet},Workbook:{Sheets:[{Hidden:0}]}});
  expect(await readSelectedSheet(bytes,'rId1',envelope,signal())).toBe(sheet);const options=read.mock.calls[0]![1];expect(options).toMatchObject({sheets:['Fictional'],dense:true,cellDates:false,cellNF:true,cellText:true,cellFormula:true,cellHTML:false,bookVBA:false});expect(options).not.toHaveProperty('sheetRows');
});
it('cancellation before and after asynchronous preflight does not invoke parser',async()=>{
  const controller=new AbortController();controller.abort();await expect(inspectWorkbookBytes(fictionalWorkbook().bytes,controller.signal)).rejects.toMatchObject({code:'cancel'});expect(read).not.toHaveBeenCalled();
});
it('source missing-cache evidence overrides reader omission or invented zero',async()=>{
  const bytes=fictionalWorkbook({dimension:'A1:B1',cells:'<row r="1"><c r="A1"><f>1+2</f></c><c r="B1" t="n"><f>2+3</f></c></row>'}).bytes,envelope=await preflightXlsx(bytes,{signal:signal()});
  read.mockReturnValue({SheetNames:['Fictional'],Sheets:{Fictional:{'!ref':'A1:B1','!data':[[{t:'n',v:0,w:'0',f:'1+2'}]]}},Workbook:{Sheets:[{Hidden:0}]}});
  const result=await readSelectedSheet(bytes,'rId1',envelope,signal()) as {'!data':{v?:unknown;w?:unknown;f?:string}[][]};expect(result['!data'][0]!.map(c=>({v:c.v,w:c.w,formula:typeof c.f==='string'}))).toEqual([{v:undefined,w:undefined,formula:true},{v:undefined,w:undefined,formula:true}]);
});

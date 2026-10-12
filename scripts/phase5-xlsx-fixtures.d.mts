export function fixtureCrc(bytes:Uint8Array):number;
export function fixtureZip(files:Record<string,string|Uint8Array>,options?:{deflate?:boolean}):Buffer;
export const spreadsheetNs:string;
export function semanticWorkbook(date1904?:boolean):{files:Record<string,string|Uint8Array>;bytes:Buffer};
export function fictionalWorkbook(options?:{sheets?:{name:string;state:string}[];dimension?:string;cells?:string;date1904?:boolean;extra?:Record<string,string|Uint8Array>;deflate?:boolean}):{files:Record<string,string|Uint8Array>;bytes:Buffer};

export interface RequestRecord {url:string;method:string;type:string}
export interface StorageRecord {local:Record<string,string|null>;session:Record<string,string|null>;databases:string[];caches:string[];cookies:number}
export function privacyViolations(requests:RequestRecord[],storage?:StorageRecord):string[];

export interface DependencyRecord {
  name:'yaml'|'xlsx';version:string;dependencySpec:string;source:string;archiveSha256:string;bytes:number;
  integrityVerified:boolean;license:string;memberHashes:Record<string,string>;licenses:string[];scripts:Record<string,string>;
  relationships:{direct:string[];transitive:string[];embedded:{name:string;license:string;review:string}[]};
  importGraph:string[];binaries:string[];runtimeNetwork:{reviewed:boolean;externalFallback:boolean};reviewComplete:boolean;decision?:'PASS'|'BLOCKED';
  fixVerifications?:{id:string;sourcePath:string;sourceSha256:string;fixedSourceEvidence:string[];regression:{command:string;exitCode:number;reportPath:string;reportSha256:string}}[];
}
export interface AdvisoryRecord {id:string;severity:string;actualVendoredVersion:string;disposition:'Applicable'|'Not applicable with evidence'|'Unresolved';evidence:string[];affectedRange?:string;scannerClaimedRange?:string;officialSheetjsRange?:string;reachableApi?:string;source?:string;checkedAt?:string;rawResponse?:string}
export function evaluateDependency(record:DependencyRecord,advisories:AdvisoryRecord[]):{decision:'PASS'|'BLOCKED';reasons:string[]};

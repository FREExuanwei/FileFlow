export function sha256(bytes: Uint8Array): string;
export function inspectArchive(bytes: Uint8Array): Map<string, Buffer>;
export function verifyFixReports(root:string,record:import('./phase5-dependency-policy.mjs').DependencyRecord):boolean;

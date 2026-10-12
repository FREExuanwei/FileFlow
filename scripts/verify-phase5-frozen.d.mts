export interface Phase5FrozenReport { unchanged: string[]; integration: string[]; unexpected: string[] }
export function verifyPhase5Frozen(root: string, trust?: {anchorSha256:string;packageSha256:string}): Phase5FrozenReport;

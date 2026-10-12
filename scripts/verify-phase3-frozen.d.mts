export interface FrozenPolicy {
  files: { path: string; sha256: string }[];
  integrationPaths: string[];
  protectedPaths?: string[];
  originalPackage: Record<string, unknown>;
  allowedRuntime: Record<string, string>;
  allowedDev: Record<string, string>;
  allowedScripts: Record<string, string>;
}
export interface VerificationReport { unchanged: string[]; allowedIntegration: string[]; unexpected: string[] }
export function verifyFrozen(root: string, policy: FrozenPolicy): VerificationReport;

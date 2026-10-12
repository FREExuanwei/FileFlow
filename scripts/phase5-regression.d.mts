export interface BrowserCaseIdentity { file: string; title: string }
export interface BrowserCaseResult extends BrowserCaseIdentity { runId: string; index: number; status: string; retry: number; attempts: number }
export interface BrowserBaselineReport { passed: number; total: number; contiguous: boolean; errors: string[] }
export function validateBrowserBaseline(results: BrowserCaseResult[], expected: BrowserCaseIdentity[]): BrowserBaselineReport;
export function browserCases(report: Record<string, unknown>, runId: string): BrowserCaseResult[];
export function validateCaseIdentities(actual: BrowserCaseIdentity[], expected: BrowserCaseIdentity[]): string[];
export function validateSealedBaseline(baseline: Record<string, unknown>): string[];

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const skip = new Set(['node_modules', '.npm-cache', '.git', 'dist', 'dist-desktop', 'coverage', 'test-results', 'playwright-report', '.superpowers']);
const textFiles = /\.(?:[cm]?[jt]sx?|json|html|css|md|ya?ml|toml|txt|rs|ps1|ns[hi])$/;
const assignment = /(?:API_KEY|api_key|apiKey|SECRET|TOKEN|ACCESS_TOKEN|PASSWORD|PRIVATE_KEY|CLIENT_SECRET)\s*[:=]\s*["']([^"'\r\n]{8,})["']/g;
const patterns = [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /\bAKIA[0-9A-Z]{16}\b/, /\bgh[pousr]_[A-Za-z0-9]{30,}\b/, /\bsk-[A-Za-z0-9]{20,}\b/];
const findings = [];
let scanned = 0;
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (path === join('.', 'src-tauri', 'target') || path === join('src-tauri', 'target')) continue;
    if (entry.isDirectory()) walk(path);
    else if (textFiles.test(entry.name) && path !== join('scripts', 'scan-secrets.mjs')) {
      scanned++;
      const text = readFileSync(path, 'utf8');
      if (patterns.some(pattern => pattern.test(text))) findings.push(path);
      for (const match of text.matchAll(assignment)) if (!/example|placeholder|fictional|planned|false|undefined/i.test(match[1])) findings.push(path);
    }
  }
}
walk('.');
const unique = [...new Set(findings)];
if (unique.length) { console.error('Potential credentials found (values redacted):', unique); process.exitCode = 1; }
else console.log(`Secret scan: ${scanned} project text files checked; 0 credential candidates. No file contents printed.`);

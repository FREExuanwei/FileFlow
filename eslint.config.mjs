import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'dist-desktop/**', 'src-tauri/target/**', 'src-tauri/gen/**', 'node_modules/**', '.npm-cache/**', 'public/pdf-assets/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { console: 'readonly', process: 'readonly', Buffer: 'readonly', URL: 'readonly', fetch: 'readonly', AbortSignal: 'readonly', setTimeout: 'readonly' } } },
);

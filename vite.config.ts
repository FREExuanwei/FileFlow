import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  worker: { format: 'es' },
  test: { environment: 'jsdom', include: ['tests/unit/**/*.test.ts','tests/unit/**/*.test.tsx'], testTimeout: 20000 },
});

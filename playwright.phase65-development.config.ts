import {defineConfig} from '@playwright/test';
import phase5 from './playwright.phase5.config';
export default defineConfig({
 ...phase5,
 outputDir:'docs/phase65/development-regression/artifacts',
 reporter:[['line'],['json',{outputFile:'docs/phase65/development-regression/combined.json'}]],
 webServer:{command:'node scripts/phase6-dev-server.mjs',env:{PHASE65_REGRESSION:'1'},url:'http://127.0.0.1:4174/__phase6_ready',reuseExistingServer:false,timeout:120000},
});

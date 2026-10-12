import {defineConfig} from '@playwright/test';
import phase5 from './playwright.phase5.config';

const browser=process.env.PHASE6_BROWSER ?? 'combined';
if(!['edge','chrome','combined'].includes(browser))throw new Error('Invalid PHASE6_BROWSER');
export default defineConfig({
  ...phase5,
  outputDir:`docs/phase6/development-regression/${browser}-artifacts`,
  reporter:[['line'],['json',{outputFile:`docs/phase6/development-regression/${browser}.json`}]],
  webServer:{
    command:'node scripts/phase6-dev-server.mjs',
    url:'http://127.0.0.1:4174/__phase6_ready',
    reuseExistingServer:false,
    timeout:120000,
  },
});

import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/phase5-browser',timeout:60000,workers:1,retries:0,
  testIgnore:/phase5-(?:security|privacy|limits|lifecycle|offline|performance)\.spec\.ts/,
  use:{baseURL:'http://127.0.0.1:4174',headless:true,trace:'retain-on-failure'},
  projects:[{name:'edge',use:{channel:'msedge'}},{name:'chrome',use:{channel:'chrome'}}],
  webServer:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4174 --strictPort',url:'http://127.0.0.1:4174',reuseExistingServer:false},
});

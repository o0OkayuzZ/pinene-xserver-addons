import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const base='https://o0okayuzz.github.io/pine-server/';
const routes=[
 ['contents/better-structure-loot/',['Early 13〜17回','End 15〜20回','16〜20枠']],
 ['database/entries/bsl-castle-slot-rewards/',['Elite19〜23枠','宝物庫23〜27枠']],
 ['database/entries/castle-key-rewards/',['16〜20枠','空欄なし']],
];
const browser=await chromium.launch({headless:true}),results=[];
await mkdir('artifacts/bsl-weighted-v2',{recursive:true});
try {
 for(const width of [390,1440]) {
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const [route,expected] of routes) {
   const response=await page.goto(base+route,{waitUntil:'domcontentloaded'});
   if(response.status()!==200)throw Error(`${route}: HTTP ${response.status()}`);
   const body=await page.locator('body').innerText();
   if(expected.some(t=>!body.includes(t)) || body.includes('残り26枠'))throw Error('Stale BSL content: '+route);
   if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw Error('Overflow: '+route);
   if(route.startsWith('contents/'))await page.screenshot({path:`artifacts/bsl-weighted-v2/bsl-${width}.png`});
   results.push({width,route,http:response.status(),content:true,overflow:false});
  }
  if(errors.length)throw Error(errors.join('\n'));
  await page.close();
 }
 await writeFile('artifacts/bsl-weighted-v2/live-verification.json',JSON.stringify({checkedAt:new Date().toISOString(),base,results},null,2));
 console.log(`PASS ${results.length} published BSL page/viewport checks.`);
} finally {await browser.close();}

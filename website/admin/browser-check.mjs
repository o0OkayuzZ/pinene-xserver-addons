import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
// Synthetic values are used only inside an intercepted test response, never
// saved to GitHub or used for the real-state screenshots.
const session=JSON.parse(await readFile(join(process.env.LOCALAPPDATA,'PINE SERVER','Admin','session.json'),'utf8'));
const browser=await chromium.launch();
try{
 for(const width of [390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:1000}});
  await page.goto(session.url,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
  await page.route('**/api/refresh',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({report:{generatedAt:'2026-09-12T00:00:00Z',site:'https://o0okayuzz.github.io/pine-server/',web:{status:'ok',provider:'ga4',period:{days:7,timezone:'Asia/Tokyo'},pageviews:12,visits:4,activeUsers:3,newUsers:2,averageSessionDuration:45,engagementRate:.5,notes:['Synthetic test fixture'],groups:{daily:{status:'ok',rows:[{label:'20260911',views:4},{label:'20260912',views:8}]},pages:{status:'ok',rows:[{label:'/pine-server/contents/mycology/',views:8},{label:'/pine-server/contents/infinite-castle/',views:4}]},events:{status:'ok',rows:[{label:'pine_recipe_view',views:3}]}}},repository:{status:'unavailable'},health:{status:'ok',httpStatus:200}}})}));
  await page.locator('#refresh').click();await page.waitForFunction(()=>document.querySelector('#pageviews').textContent==='12');
  if(await page.locator('.bar-column').count()!==2)throw new Error('Chart rows missing');
  await page.locator('.bar-column button').first().click();
  if(!(await page.locator('#notice').innerText()).includes('20260911'))throw new Error('Chart interaction failed');
  await page.locator('#filter').fill('mycology');
  if(await page.locator('#rows tr').count()!==1)throw new Error('Table filter failed');
  const download=page.waitForEvent('download');await page.locator('#csv').click();if((await download).suggestedFilename()!=='pine-pages.csv')throw new Error('CSV failed');
  await page.locator('#filter').fill('');await page.locator('[data-group="events"]').click();
  if(!(await page.locator('#rows').innerText()).includes('レシピの閲覧'))throw new Error('Event labels failed');
  await page.locator('[data-group="os"]').click();
  if(!(await page.locator('#rows').innerText()).includes('取得できない'))throw new Error('Missing metric masked');
  if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw new Error('Overflow');
  await page.close();console.log(`Admin ${width}: synthetic chart/table/filter/export/event/missing-data tests PASS`);
 }
}finally{await browser.close();}

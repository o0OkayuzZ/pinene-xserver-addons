import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const base='https://o0okayuzz.github.io/pine-server/';
const routes=[['contents/zombie-gear/','HP40'],['contents/better-structure-loot/','27枠'],['contents/infinite-castle/','無限城'],['contents/mycology/','Mycology'],['contents/minecraft-dungeons/','Minecraft Dungeons'],['contents/golden-foods/','Golden Foods'],['contents/grave/','無限城'],['database/entries/zombie-chestplate-c4/','2.5倍'],['database/entries/craft-zombie-stem-cell/','不死のトーテム'],['database/entries/castle-reconstruction/','5〜15分'],['database/entries/castle-temporary-death/','仮設定']];
const browser=await chromium.launch({headless:true}),results=[];
await mkdir('artifacts/release-20260913',{recursive:true});
try{
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const [route,expected] of routes){
   const response=await page.goto(base+route,{waitUntil:'domcontentloaded'});
   if(response.status()!==200)throw Error(`${route}: HTTP ${response.status()}`);
   if(!(await page.locator('body').innerText()).includes(expected))throw Error('Missing published content: '+route);
   if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw Error('Horizontal overflow: '+route);
   const images=await page.locator('img').evaluateAll(async nodes=>{
    const visible=nodes.filter(n=>{const r=n.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight;});
    await Promise.all(visible.map(n=>Promise.race([n.decode().catch(()=>{}),new Promise(resolve=>setTimeout(resolve,5000))])));
    return visible.every(n=>n.naturalWidth>0);
   });
   if(!images)throw Error('Broken image: '+route);
   if(route==='contents/zombie-gear/'||route==='contents/better-structure-loot/')await page.screenshot({path:`artifacts/release-20260913/${route.split('/')[1]}-${width}.png`});
   results.push({width,route,http:response.status(),content:true,images:true,overflow:false});
   console.log(`PASS ${width} ${route}`);
  }
  if(errors.length)throw Error(errors.join('\n'));await page.close();
 }
 await writeFile('artifacts/release-20260913/live-verification.json',JSON.stringify({checkedAt:new Date().toISOString(),base,results},null,2));
 console.log(`PASS ${results.length} live page/viewport checks, HTTP 200, expected content, images and layout; no page errors`);
}finally{await browser.close();}

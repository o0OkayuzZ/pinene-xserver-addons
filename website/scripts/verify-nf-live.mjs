import {chromium} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base='https://o0okayuzz.github.io/pine-server/';
const nf=JSON.parse(await readFile('../tools/mycology/data/nether_fungi_master_v1.0.json','utf8')).entries;
const hash=b=>createHash('sha256').update(b).digest('hex');
let matched=0;
for(let start=0;start<nf.length;start+=8)await Promise.all(nf.slice(start,start+8).map(async e=>{
 const number=String(e.number).padStart(3,'0');
 const image=await fetch(`${base}images/items/mycology-nf-${number}.png`);
 if(!image.ok)throw Error(`image ${number}: ${image.status}`);
 if(hash(Buffer.from(await image.arrayBuffer()))!==hash(await readFile(`public/images/items/mycology-nf-${number}.png`)))throw Error(`image mismatch ${number}`);
 const page=await fetch(`${base}database/entries/mycology-nf-${number}/`);
 if(!page.ok||!(await page.text()).includes(e.display_name))throw Error(`page mismatch ${number}`);
 matched++;
}));
const browser=await chromium.launch({headless:true}),screens=[];
try{
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const route of ['contents/mycology/','database/entries/mycology-nf-080/','database/entries/mycology-nf-100/']){
   const response=await page.goto(base+route,{waitUntil:'networkidle'});
   if(response.status()!==200)throw Error('HTTP '+response.status());
   if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw Error('overflow');
   if(errors.length)throw Error(errors.join('\n'));
   const name=route.includes('contents')?'catalogue':route.split('/')[2];
   await page.screenshot({path:`artifacts/nf-live-${name}-${width}.png`});
   screens.push({route,width,status:response.status()});
  }
  await page.close();
 }
}finally{await browser.close();}
const result={matchedOfficialSprites:matched,verifiedDetailPages:matched,screens,checkedAt:new Date().toISOString()};
await writeFile('artifacts/nf-live.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));

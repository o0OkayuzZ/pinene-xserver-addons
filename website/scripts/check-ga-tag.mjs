// Manual network check: downloads the configured Google tag, intercepts collection.
// Run against a local preview. Test visits are never sent to Analytics.
import {chromium} from 'playwright';
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const events=[];let loads=0;
 page.on('request',r=>{if(r.url().startsWith('https://www.googletagmanager.com/gtag/js'))loads++;});
 await page.route(/https:\/\/[^/]*google-analytics\.com\//,async route=>{
  const r=route.request();const url=new URL(r.url());
  for(const line of (r.postData()||'').split('\n')){const params=new URLSearchParams(url.search);for(const [k,v] of new URLSearchParams(line))params.set(k,v);if(params.has('en'))events.push({name:params.get('en'),id:params.get('tid'),location:params.get('dl'),leak:[...params.values()].some(v=>/PRIVATE_QUERY|PRIVATE_FRAGMENT|PRIVATE_SEARCH/.test(v))});}
  await route.fulfill({status:204});
 });
 await page.goto('http://127.0.0.1:4321/pine-server/database/items/?q=PRIVATE_QUERY#PRIVATE_FRAGMENT');
 await page.waitForTimeout(1000);if(loads||events.length)throw Error('loaded before consent');
 await page.locator('[data-consent="yes"]').click();
 await page.waitForTimeout(6000);
 await page.locator('#guide-search').fill('PRIVATE_SEARCH');
 await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
 await page.waitForTimeout(12000);
 console.log(JSON.stringify({loads,events}));
 if(loads!==1||events.filter(e=>e.name==='page_view').length!==1||!events.some(e=>e.name==='pine_search')||events.some(e=>e.leak||e.id!=='G-11K0Q4T42N'))throw Error('unexpected GA payload');
 console.log('Real Google tag verified; collection intercepted, no test data sent.');
} finally {await browser.close();}

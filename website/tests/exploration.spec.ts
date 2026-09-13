import { test, expect } from '@playwright/test';
const base='/pine-server/';
test('castle and Mycology guides navigate, expand and open details',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'contents/mycology/');
 await page.getByRole('link',{name:'キノコ図鑑を見る',exact:true}).click();
 await expect(page).toHaveURL(/#exploration-guide-title$/);
 await page.getByRole('navigation',{name:'種類別の図鑑一覧'}).getByRole('link',{name:'茶色キノコ 20'}).click();
 const brown=page.locator('#guide-brown');await brown.locator('summary').click();
 await expect(brown.locator('[data-guide-entry]:visible')).toHaveCount(20);
 await brown.locator('a[href$="/mycology-b20/"]').click();
 await expect(page.locator('h1')).toHaveText('ウラベニホテイシメジ');
 await page.goto(base+'contents/mycology/');
 await page.getByRole('link',{name:'キノコ図鑑を作る',exact:true}).click();
 await expect(page.locator('main')).toContainText('本 × 1');
 await page.goto(base+'contents/mycology/');
 await page.locator('#guide-guide summary').click();
 await page.locator('#guide-guide a[href$="/mushroom-reveal-settings/"]').click();
 await expect(page.locator('main')).toContainText('じっくり → 短縮 → OFF');
 await page.goto(base+'contents/infinite-castle/');
 await page.getByRole('link',{name:'探索ガイドを見る',exact:true}).click();
 await page.locator('#guide-rooms summary').click();
 await expect(page.locator('#guide-rooms [data-guide-entry]:visible')).toHaveCount(6);
 await page.locator('#guide-rooms a[href$="/castle-elite-room/"]').click();
 await expect(page.locator('main')).toContainText('深紅の鍵守');
 await page.goto(base+'contents/infinite-castle/');
 await page.locator('#guide-exploration summary').click();
 await page.locator('#guide-exploration a[href$="/castle-return-circle/"]').click();
 await expect(page.locator('main')).toContainText('30tick');
 for(const owner of ['mycology','infinite-castle']){
  await page.goto(base+'contents/'+owner+'/');
  await page.locator('img:visible').evaluateAll(images=>Promise.all(images.map(image=>{const img=image as HTMLImageElement;img.loading='eager';return img.decode();})));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.screenshot({path:`artifacts/${owner}-${info.project.name}.png`,fullPage:true});
 }
 expect(errors).toEqual([]);
});

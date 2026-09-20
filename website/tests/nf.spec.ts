import {test,expect} from '@playwright/test';
test('NF catalogue and final sprite pages display without overflow',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('contents/mycology/');
 await expect(page.locator('body')).toContainText('135');
 for(const n of ['001','080','100']){
  const response=await page.goto(`database/entries/mycology-nf-${n}/`);
  expect(response?.status()).toBe(200);
  await expect(page.locator('body')).toContainText(`NF-${n}`);
  await expect(page.locator('body')).toContainText('特殊効果はまだ設定されていません');
  const icon=page.locator(`img[src$="mycology-nf-${n}.png"]`).first();
  await icon.scrollIntoViewIfNeeded();
  await expect.poll(()=>icon.evaluate((i:HTMLImageElement)=>i.naturalWidth)).toBe(32);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 expect(errors).toEqual([]);
});

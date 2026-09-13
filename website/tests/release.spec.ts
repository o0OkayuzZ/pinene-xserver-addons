import {test,expect} from '@playwright/test';
test('September release publishes Zombie Gear FINAL and its crafting materials',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/pine-server/contents/zombie-gear/');
 await expect(page.getByRole('heading',{level:1})).toHaveText('Zombie Gear');
 await expect(page.locator('body')).toContainText('HP40');
 await expect(page.locator('body')).toContainText('毎秒1HP');
 await page.goto('/pine-server/database/entries/craft-zombie-stem-cell/');
 await expect(page.locator('body')).toContainText('不死のトーテム');
 await expect(page.locator('body')).toContainText('腐った肉');
 await page.goto('/pine-server/database/entries/zombie-chestplate-c4/');
 await expect(page.locator('body')).toContainText('2.5倍');
 await expect(page.locator('body')).toContainText('最大残機は0');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 expect(errors).toEqual([]);
});
test('September release publishes BSL and preserved temporary castle rules',async({page})=>{
 await page.goto('/pine-server/contents/better-structure-loot/');
 await expect(page.getByRole('heading',{level:1})).toHaveText('Better Structure Loot');
 await expect(page.locator('body')).toContainText('27枠');
 await page.goto('/pine-server/database/entries/castle-reconstruction/');
 await expect(page.locator('body')).toContainText('5〜15分');
 await page.goto('/pine-server/database/entries/castle-temporary-death/');
 await expect(page.locator('body')).toContainText('持ち込み品');
 await expect(page.locator('body')).toContainText('仮設定');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

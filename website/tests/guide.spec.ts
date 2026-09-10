import { test, expect } from '@playwright/test';
import records from '../src/data/field-guide.json' with { type: 'json' };
const base='/pinene-xserver-addons/';
test('guide search, owner/kind filters, reset and detail links',async({page},info)=>{
 await page.goto(base+'database/items/?content=xp-storage');
 await expect(page.locator('[data-guide-entry]:visible')).toHaveCount(4);
 await page.getByLabel('名前・説明を検索').fill('バルブ');
 await expect(page.locator('[data-guide-entry]:visible')).toHaveCount(1);
 await page.getByLabel('種類',{exact:true}).selectOption('feature');
 await expect(page.getByRole('heading',{name:'該当する項目はありません'})).toBeVisible();
 await page.getByRole('button',{name:'条件をリセット'}).click();
 await expect(page.getByLabel('名前・説明を検索')).toBeFocused();
 await expect(page.locator('[data-guide-entry]:visible')).toHaveCount(records.filter(e=>e.kind!=='recipe'&&e.visibility==='public').length);
 await page.getByLabel('種類',{exact:true}).selectOption('feature');
 await expect(page.locator('[data-guide-entry]:visible')).toHaveCount(records.filter(e=>e.kind==='feature'&&e.visibility==='public').length);
 await page.getByLabel('種類',{exact:true}).selectOption('item');
 await page.getByLabel('コンテンツ',{exact:true}).selectOption('xp-storage');
 await page.screenshot({path:'artifacts/guide-'+info.project.name+'.png',fullPage:true});
 await page.locator('[data-guide-entry]:visible').filter({hasText:'経験値パイプ'}).getByRole('link').click();
 await expect(page.getByRole('heading',{level:1})).toHaveText('経験値パイプ');
 await page.getByRole('link',{name:'経験値パイプのレシピ'}).click();
 await expect(page.getByText('ガラス × 6')).toBeVisible();
 await expect(page.getByText('完成数：4個')).toBeVisible();
 await expect(page.locator('.craft-grid td')).toHaveCount(6);
 await page.screenshot({path:'artifacts/recipe-'+info.project.name+'.png',fullPage:true});
});
test('every published guide page renders, links and selected textures resolve',async({page,request})=>{
 test.setTimeout(90000);
 const resources=new Set<string>();
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(const entry of records.filter(e=>e.visibility==='public')){
  const response=await page.goto(base+'database/entries/'+entry.id+'/');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading',{level:1})).toHaveText(entry.name);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),entry.id).toBeTruthy();
  const paths=await page.locator('a[href],img[src]').evaluateAll(els=>els.map(el=>el.getAttribute('href')??el.getAttribute('src')).filter((p):p is string=>!!p&&p.startsWith('/')));
  paths.forEach(p=>resources.add(p));
 }
 for(const path of resources){expect(path.startsWith(base)).toBeTruthy();expect((await request.get(path)).ok(),path).toBeTruthy();}
 expect(errors).toEqual([]);
});

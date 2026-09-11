import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import catalogue from '../src/data/content-registry.json' with { type: 'json' };
const publicCount = catalogue.contents.filter(c => c.visibility === 'public').length;
const base = '/pine-server/';
test('home layout, images, keyboard and navigation', async ({ page }, testInfo) => {
 const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
 await page.goto(base);
 await expect(page).toHaveTitle('PINE SERVER');
 await expect(page.locator('[data-content-card]')).toHaveCount(4);
 await expect(page.locator('[data-content-card] h3')).toHaveText(['PvP Island↗','無限城↗','Minecraft Dungeons↗','Mycology↗']);
 await page.locator('img').evaluateAll(async imgs => { await Promise.all(imgs.map(img => (img as HTMLImageElement).decode())); });
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
 await page.keyboard.press('Tab'); await expect(page.getByText('本文へスキップ')).toBeFocused();
 const menu = page.getByRole('button', { name: 'メニュー' });
 if (await menu.isVisible()) {
  await menu.focus(); await page.keyboard.press('Enter'); await expect(menu).toHaveAttribute('aria-expanded','true');
  await expect(page.locator('#main-nav')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(menu).toHaveAttribute('aria-expanded','false'); await expect(menu).toBeFocused();
 }
 await page.locator('h1').click();
 await mkdir('artifacts', { recursive: true });
 await page.screenshot({ path: 'artifacts/home-' + testInfo.project.name + '.png', fullPage: true });
 await page.locator('.hero-actions').getByRole('link', { name: '参加方法を見る' }).click();
 await expect(page.getByText('接続先は未設定です。')).toBeVisible();
 expect(errors).toEqual([]);
});
test('category deep links, search, zero results and reset', async ({ page }, testInfo) => {
 await page.goto(base + 'contents/?category=collection');
 await expect(page.locator('[data-content-card]:visible')).toHaveCount(4);
 await expect(page.getByRole('button',{name:'収集', exact:true})).toHaveAttribute('aria-pressed','true');
 const search = page.getByLabel('コンテンツを検索');
 await search.fill('Ｍｙｃｏｌｏｇｙ');
 await expect(page.locator('[data-content-card]:visible')).toHaveCount(1);
 await search.fill('存在しない検索語');
 await expect(page.locator('[data-content-card]:visible')).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'該当するコンテンツはありません'})).toBeVisible();
 await page.getByRole('button',{name:'条件をリセット'}).click();
 await expect(search).toBeFocused(); await expect(page.locator('[data-content-card]:visible')).toHaveCount(publicCount);
 await page.getByRole('button',{name:'音楽',exact:true}).click();
 await expect(page.locator('[data-content-card]:visible')).toHaveCount(0);
 await page.getByRole('button',{name:'条件をリセット'}).click();
 await page.screenshot({ path: 'artifacts/contents-' + testInfo.project.name + '.png', fullPage: true });
 await page.locator('[data-content-card]').first().getByRole('link').click();
 await expect(page.getByRole('heading',{level:1})).toHaveText('PvP Island');
 await page.getByText('公開技術情報と確認状況',{exact:true}).click();
 await expect(page.getByText('ゲーム内の操作・表示：未確認')).toBeVisible();
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
test('pack filters use buttons only and recover from zero matches', async ({ page }) => {
 await page.goto(base + 'packs/');
 const total = await page.locator('[data-pack-row]').count();
 await page.getByRole('button',{name:'ビヘイビアー',exact:true}).click();
 const count = await page.locator('[data-pack-row]:visible').count();
 expect(count).toBeGreaterThan(0); expect(count).toBeLessThan(total);
 await page.getByLabel('パック名・UUIDで検索').fill('no-such-pack');
 await expect(page.locator('[data-pack-row]:visible')).toHaveCount(0);
 await page.getByRole('button',{name:'条件をリセット'}).click();
 await expect(page.locator('[data-pack-row]:visible')).toHaveCount(total);
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
test('all public routes and local assets resolve under project base', async ({ page, request }) => {
 const routes=['','contents/','contents/pvp-island/','contents/infinite-castle/','contents/minecraft-dungeons/','contents/mycology/','start/','updates/','packs/','database/','database/items/','database/mobs/','database/recipes/','404.html'];
 const resources = new Set<string>();
 for (const route of routes) {
  const response=await page.goto(base+route); expect(response?.status()).toBeLessThan(400);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  const paths = await page.locator('a[href], img[src], script[src], link[rel=stylesheet]').evaluateAll(elements => elements.map(el=>el.getAttribute('href') ?? el.getAttribute('src')).filter((url): url is string=>!!url && url.startsWith('/')));
  paths.forEach(path=>resources.add(path));
  expect(await page.locator('body').innerText()).not.toContain('PINENE SERVER');
 }
 for (const resource of resources) { expect(resource.startsWith(base)).toBeTruthy(); const response=await request.get(resource); expect(response.ok(),resource).toBeTruthy(); }
 const og=await page.locator('meta[property="og:image"]').getAttribute('content');
 expect(og).toContain(base+'images/og.png');
 expect((await request.get(base+'images/og.png')).ok()).toBeTruthy();
});
test('missing images retain an explicit fallback', async ({ page }) => {
 await page.route('**/images/mycology.svg', route=>route.abort());
 await page.goto(base + 'contents/');
 const card=page.locator('[data-content-card]').filter({has:page.getByRole('heading',{name:'Mycology'})});
 await card.scrollIntoViewIfNeeded();
 await expect(card.locator('.card-image')).toHaveClass(/image-unavailable/);
});

import { test, expect } from '@playwright/test';

test('Dungeons category navigation, expanded gear and recipe round trip', async ({ page }, info) => {
 const base = '/pinene-xserver-addons/';
 const errors: string[] = [];
 page.on('pageerror', error => errors.push(error.message));
 await page.goto(base + 'contents/minecraft-dungeons/');
 await expect(page.getByRole('heading', { level: 1 })).toHaveText('Minecraft Dungeons');
 await page.getByRole('link', { name: '装備・レシピを見る', exact: true }).click();
 await expect(page).toHaveURL(/#dungeons-guide-title$/);
 await page.getByRole('navigation', { name: 'Dungeonsの種類別一覧' }).getByRole('link', { name: '防具 48' }).click();
 const armor = page.locator('#dungeons-armor');
 await expect(armor.locator('[data-guide-entry]:visible')).toHaveCount(4);
 await armor.locator('summary').click();
 await expect(armor.locator('[data-guide-entry]:visible')).toHaveCount(48);
 await armor.locator('[data-guide-entry]').last().getByRole('link').click();
 await expect(page).toHaveURL(/database\/entries\/dungeons-wither-leggings\/$/);
 await page.goBack();
 await page.getByRole('link', { name: '英雄の書を作る', exact: true }).click();
 await expect(page.getByText('金インゴット × 4', { exact: true })).toBeVisible();
 await page.getByRole('link', { name: '英雄の書の説明 →', exact: true }).click();
 await expect(page.getByRole('heading', { level: 1 })).toHaveText('英雄の書');
 await page.goto(base + 'database/entries/dungeons-harpoon-arrow-recipe/');
 await expect(page.getByText('完成数：6個', { exact: true })).toBeVisible();
 await expect(page.getByText('矢 × 4', { exact: true })).toBeVisible();
 await expect(page.getByText('鉄インゴット × 2', { exact: true })).toBeVisible();
 await expect(page.locator('.craft-grid')).toHaveCount(0);
 await page.getByRole('link', { name: /の説明 →$/ }).click();
 await expect(page).toHaveURL(/database\/entries\/dungeons-harpoon-arrow\/$/);
 await page.goto(base + 'contents/minecraft-dungeons/');
 await page.locator('img:visible').evaluateAll(images => Promise.all(images.map(image => {
  const img = image as HTMLImageElement; img.loading = 'eager'; return img.decode();
 })));
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
 await page.screenshot({ path: `artifacts/dungeons-${info.project.name}.png`, fullPage: true });
 expect(errors).toEqual([]);
});

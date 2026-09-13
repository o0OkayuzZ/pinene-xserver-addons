import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
const svg = readFileSync(new URL('../public/images/landscape.svg', import.meta.url),'utf8');
await page.setContent('<html><head><meta charset="utf-8"></head><body style="margin:0;font-family:Arial,sans-serif;background:#173d30;color:white"><div style="position:absolute;inset:0">' + svg + '</div><div style="position:absolute;inset:0;background:linear-gradient(90deg,#173d30e8,transparent)"></div><div style="position:absolute;left:70px;top:180px"><div style="font-size:76px;font-weight:900">PINE SERVER</div><p style="font-size:34px;font-weight:bold">遊びの、その先へ。</p></div><div style="position:absolute;bottom:20px;right:24px;background:#173d30;padding:8px;font-size:15px">仮の風景イラスト / 実際のゲーム画面ではありません</div></body></html>');
await page.screenshot({path:fileURLToPath(new URL('../public/images/og.png',import.meta.url))});
await browser.close();

import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedOrigin, searchKnowledge } from '../src/index.js';

const entries = [
  {
    id: 'guide:mycology-nf-027',
    type: 'item',
    title: 'T4ファージ茸',
    aliases: ['mycology-nf-027'],
    text: 'NF菌茸の1種。T4ファージをモチーフにしています。',
    url: '/database/entries/mycology-nf-027/',
  },
  {
    id: 'guide:pancake-batter',
    type: 'item',
    title: 'パンケーキ生地',
    aliases: ['pancake-batter'],
    text: '料理素材です。',
    url: '/database/entries/pancake-batter/',
  },
  {
    id: 'guide:craft-pancake-batter',
    type: 'recipe',
    title: 'パンケーキ生地のレシピ',
    aliases: ['craft-pancake-batter'],
    text: '材料: ミルク入りバケツ × 1、卵 × 4、小麦 × 4。完成数: 16。',
    url: '/database/entries/craft-pancake-batter/',
  },
  {
    id: 'update:pancake',
    type: 'update',
    title: 'パンケーキを更新',
    aliases: [],
    text: 'パンケーキの表示を更新しました。',
    url: '/updates/',
  },
];

test('identifier inside a natural-language question resolves NF entry first', () => {
  const result = searchKnowledge('NF-027って何？', entries);
  assert.equal(result[0]?.id, 'guide:mycology-nf-027');
});

test('crafting intent boosts the recipe above the item', () => {
  const result = searchKnowledge('パンケーキ生地ってどう作る？', entries);
  assert.equal(result[0]?.id, 'guide:craft-pancake-batter');
});

test('update intent can surface update entries', () => {
  const result = searchKnowledge('パンケーキの最新更新は？', entries);
  assert.ok(result.some((entry) => entry.id === 'update:pancake'));
});

test('origin allowlist accepts production and local development only', () => {
  assert.equal(isAllowedOrigin('https://o0okayuzz.github.io', 'https://o0okayuzz.github.io'), true);
  assert.equal(isAllowedOrigin('http://localhost:4321', 'https://o0okayuzz.github.io'), true);
  assert.equal(isAllowedOrigin('http://127.0.0.1:4321', 'https://o0okayuzz.github.io'), true);
  assert.equal(isAllowedOrigin('https://example.com', 'https://o0okayuzz.github.io'), false);
  assert.equal(isAllowedOrigin('', 'https://o0okayuzz.github.io'), false);
});

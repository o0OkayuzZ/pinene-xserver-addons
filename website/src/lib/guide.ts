import records from '../data/field-guide.json';
import { contents } from './data';
import { publishEntries } from './field-guide.mjs';
export const entries = publishEntries(records, new Set(contents.map(content => content.id)));
export const entryMap = new Map(entries.map(entry => [entry.id, entry]));
export const kindLabels: Record<string, string> = { item: 'アイテム・ブロック', feature: '小さな機能', recipe: 'レシピ' };

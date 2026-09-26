import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { projectPublicData } from '../src/lib/public-data.mjs';
import { publishEntries } from '../src/lib/field-guide.mjs';

const websiteRoot = fileURLToPath(new URL('..', import.meta.url));
const readJson = async (relative) => JSON.parse(await readFile(path.join(websiteRoot, relative), 'utf8'));

const contentRegistry = await readJson('src/data/content-registry.json');
const packRegistry = await readJson('src/data/pack-registry.json');
const updates = await readJson('src/data/updates.json');
const fieldGuide = await readJson('src/data/field-guide.json');

const published = projectPublicData(contentRegistry.contents, packRegistry.packs, updates);
const contentIds = new Set(published.contents.map((item) => item.id));
const guideEntries = publishEntries(fieldGuide, contentIds);

const compact = (parts) => parts.flat(Infinity).filter(Boolean).map(String).join('\n').trim();
const contentStatus = (item) => ({
  implementation: item.implementation ?? 'unknown',
  deployment: item.deployment ?? 'unknown',
  verification: (item.verification ?? []).map((v) => `${v.kind}:${v.result}`),
});

const entries = [
  ...published.contents.map((item) => ({
    id: `content:${item.id}`,
    type: 'content',
    title: item.name,
    aliases: [item.id],
    contentId: item.id,
    status: contentStatus(item),
    text: compact([item.summary, item.description, item.highlights, item.guide]),
    url: `/contents/${item.id}/`,
  })),
  ...guideEntries.map((item) => ({
    id: `guide:${item.id}`,
    type: item.kind || 'guide',
    title: item.name,
    aliases: [item.id],
    contentId: item.contentId,
    status: { implementation: 'published' },
    text: compact([item.summary, item.description, item.usage, item.obtaining, item.details]),
    url: `/database/entries/${item.id}/`,
  })),
  ...published.packs.map((item) => ({
    id: `pack:${item.uuid}`,
    type: 'pack',
    title: item.name,
    aliases: [item.uuid],
    status: { registered: item.registered, kind: item.kind, version: item.version },
    text: compact([
      `種類: ${item.kind}`,
      `バージョン: ${item.version}`,
      `登録状態: ${item.registered ? '登録済み' : '未登録'}`,
    ]),
    url: '/packs/',
  })),
  ...published.updates.map((item) => ({
    id: `update:${item.id}`,
    type: 'update',
    title: item.title,
    aliases: [item.id, item.date],
    status: { date: item.date },
    text: compact([item.body]),
    url: '/updates/',
  })),
];

const output = {
  schemaVersion: '0.1.0',
  generatedAt: new Date().toISOString(),
  sourceCommits: {
    contents: contentRegistry.source_commit ?? null,
    packs: packRegistry.source_commit ?? null,
  },
  entryCount: entries.length,
  entries,
};

const targetDir = path.join(websiteRoot, 'public', 'ai');
await mkdir(targetDir, { recursive: true });
await writeFile(path.join(targetDir, 'knowledge.json'), JSON.stringify(output));
console.log(`Takuya knowledge: ${entries.length} public entries`);

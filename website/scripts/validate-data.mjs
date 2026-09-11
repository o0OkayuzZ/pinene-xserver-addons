import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { projectPublicData } from '../src/lib/public-data.mjs';
import './validate-guide.mjs';
const read = name => JSON.parse(readFileSync(new URL('../src/data/' + name, import.meta.url), 'utf8'));
const { contents } = read('content-registry.json');
const { packs } = read('pack-registry.json');
const updates = read('updates.json');
const analytics=read('analytics-config.json');
if(!['ga4','cloudflare'].includes(analytics.provider)||typeof analytics.enabled!=='boolean')throw new Error('Invalid analytics settings');
if(Object.keys(analytics).some(key=>!['provider','enabled','measurementId','cloudflareBeacon'].includes(key)))throw new Error('Unexpected analytics settings: never store private keys here');
if(analytics.enabled&&!(analytics.provider==='ga4'?/^G-[A-Z0-9]{4,20}$/.test(analytics.measurementId):/^[a-f0-9]{32}$/i.test(analytics.cloudflareBeacon)))throw new Error('Missing public analytics ID');
export function validate(contents, packs, updates) {
 const errors = [];
 const fail = message => errors.push(message);
 const unique = (rows, key) => { const seen = new Set(); for (const row of rows) { if (!row[key] || seen.has(row[key])) fail('Missing/duplicate ' + key); seen.add(row[key]); } };
 unique(contents, 'id'); unique(packs, 'uuid'); unique(updates, 'id');
 const visibility = new Set(['public','draft','private']);
 const ids = new Set(contents.map(c => c.id)); const packIds = new Set(packs.map(p => p.uuid));
 const categories = new Set(['exploration','combat','collection','craft','systems','world','music']);
 const roles = new Set(['item-definition','behavior','runtime-script','recipe','loot','worldgen','texture','model','shared-asset','compatibility']);
 for (const record of [...contents,...packs,...updates]) if (!visibility.has(record.visibility)) fail('Invalid visibility');
 for (const c of contents) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c.id)) fail('Invalid slug');
  if (!['unknown','implemented','partial','planned','dormant','retired'].includes(c.implementation)) fail('Invalid implementation');
  if (!['unknown','repo-only','deployed-recorded'].includes(c.deployment)) fail('Invalid deployment');
  for (const id of c.related ?? []) if (!ids.has(id)) fail('Broken content reference: ' + id);
  for (const binding of c.packBindings ?? []) { if (!packIds.has(binding.uuid)) fail('Broken pack reference'); if (!binding.roles.length || binding.roles.some(role => !roles.has(role))) fail('Invalid binding role'); }
  if (c.visibility !== 'public') continue;
  for (const field of ['name','summary','description','guide']) if (typeof c[field] !== 'string' || !c[field].trim()) fail('Missing public content field: ' + field);
  if (!c.category?.length || c.category.some(cat => !categories.has(cat))) fail('Invalid category');
  if (!Array.isArray(c.highlights) || !Array.isArray(c.children) || !Array.isArray(c.verification)) fail('Missing arrays');
  if (!['concept','placeholder','actual-screenshot'].includes(c.image?.kind) || !c.image?.alt || !/^\/images\/[a-z0-9-]+\.(svg|png|webp|jpg)$/.test(c.image?.src)) fail('Invalid image');
  else if (!existsSync(new URL('../public' + c.image.src, import.meta.url))) fail('Missing image file');
  for (const v of c.verification ?? []) if (!['code','registration','server-start','gameplay','appearance'].includes(v.kind) || !['confirmed','unknown','stale','failed'].includes(v.result)) fail('Invalid verification');
 }
 for (const p of packs) {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(p.uuid)) fail('Invalid UUID');
  if (!p.name || !['behavior','resource'].includes(p.kind) || !/^\d+\.\d+\.\d+$/.test(p.version) || typeof p.registered !== 'boolean') fail('Invalid pack');
 }
 for (const u of updates) if (u.visibility === 'public' && (!u.title || !u.body || (u.date !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(u.date) || Number.isNaN(Date.parse(u.date)))))) fail('Invalid public update');
 if (errors.length) throw new Error(errors.join('\n'));
 return projectPublicData(contents,packs,updates);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
 const published = validate(contents,packs,updates);
 console.log('Data validation PASS: ' + published.contents.length + ' public contents, ' + published.packs.length + ' selected packs, ' + published.updates.length + ' public updates.');
}

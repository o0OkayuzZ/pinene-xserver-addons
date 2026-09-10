import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { projectPublicData } from '../src/lib/public-data.mjs';
import { validate } from './validate-data.mjs';
const read = name => JSON.parse(readFileSync(new URL('../src/data/'+name,import.meta.url),'utf8'));
const contents = read('content-registry.json').contents;
const packs = read('pack-registry.json').packs;
test('private/draft records and non-whitelisted fields cannot reach public output', () => {
 const c = structuredClone(contents.find(c=>c.visibility==='public'));
 c.internalNote = 'SECRET_SENTINEL'; c.image.internalNote = 'SECRET_SENTINEL';
 c.verification[0].privateLog = 'SECRET_SENTINEL';
 c.children.push({id:'private-item',name:'SECRET_SENTINEL',visibility:'private'});
 c.related.push('private-record'); c.packBindings.push({uuid:'private-pack',roles:['texture']});
 const result = projectPublicData([c,{...c,id:'private-record',visibility:'private',name:'SECRET_SENTINEL'},{...c,id:'draft-record',visibility:'draft',name:'SECRET_SENTINEL'}], [...packs,{uuid:'private-pack',visibility:'private',name:'SECRET_SENTINEL'}], [{id:'draft-news',visibility:'draft',title:'SECRET_SENTINEL'}]);
 assert.equal(result.contents.length,1); assert.equal(result.updates.length,0);
 assert.ok(!JSON.stringify(result).includes('SECRET_SENTINEL'));
 assert.ok(!result.contents[0].related.includes('private-record'));
 assert.ok(!result.contents[0].packBindings.some(b=>b.uuid==='private-pack'));
});
test('duplicate IDs and broken references fail, arbitrary valid counts pass', () => {
 assert.throws(()=>validate([...contents,contents[0]],packs,[]),/duplicate/);
 const c=structuredClone(contents[0]); c.related=['missing'];
 assert.throws(()=>validate([c],packs,[]),/Broken content reference/);
 c.related=[]; assert.equal(validate([c],packs,[]).contents.length,1);
});


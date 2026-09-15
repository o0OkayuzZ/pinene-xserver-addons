import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const tables=path.join(root,'behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables');
const load=p=>JSON.parse(readFileSync(p,'utf8').replace(/^\uFEFF/,''));
test('Trial pot excludes Heavy Core while preserving keys, bottle and Wind Burst book',()=>{
    const value=load(path.join(tables,'pots/trial_chambers/corridor.json'));
    const text=JSON.stringify(value);
    assert.ok(!text.includes('minecraft:heavy_core'));
    for(const id of ['minecraft:trial_key','minecraft:ominous_trial_key','minecraft:ominous_bottle','wind_burst']) assert.ok(text.includes(id));
});
test('audit accounts for every BSL table and every direct progression-item source',()=>{
    const audit=load(path.join(root,'docs/infinite_castle/reliability-bsl-audit.json'));
    const hits=Object.fromEntries(Object.keys(audit.preserved).map(k=>[k,[]]));
    let count=0;
    function scan(dir) {
        for(const entry of readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
            const p=path.join(dir,entry.name);
            if(entry.isDirectory()){scan(p);continue;}
            if(!p.endsWith('.json'))continue;
            count++;
            function visit(value,pointer) {
                if(Array.isArray(value))value.forEach((v,i)=>visit(v,`${pointer}/${i}`));
                else if(value&&typeof value==='object')Object.entries(value).forEach(([k,v])=>visit(v,`${pointer}/${k}`));
                else if(typeof value==='string'&&value in hits)hits[value].push({table:path.relative(tables,p).replaceAll('\\','/'),pointer});
            }
            visit(load(p),'');
        }
    }
    scan(tables);assert.equal(count,audit.tablesScanned);
    for(const key of Object.keys(hits))assert.deepEqual(hits[key].sort((a,b)=>a.table.localeCompare(b.table)),audit.preserved[key].sort((a,b)=>a.table.localeCompare(b.table)));
});

import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const file=new URL('../src/data/content-registry.json',import.meta.url);
const original=readFileSync(file,'utf8');
const run=(script,args=[])=>{const r=spawnSync(process.execPath,[script,...args],{stdio:'inherit',env:{...process.env,ASTRO_TELEMETRY_DISABLED:'1'}}); if(r.status!==0)throw new Error('Command failed: '+script);};
try {
 const registry=JSON.parse(original); const fixture=registry.contents.find(c=>c.visibility==='public');
 for(const visibility of ['private','draft']) registry.contents.push({...structuredClone(fixture),id:visibility+'-sentinel',name:'SECRET_SENTINEL',visibility});
 registry.contents.find(c=>c.visibility==='public').internalNote='SECRET_SENTINEL';
 writeFileSync(file,JSON.stringify(registry,null,2)+'\n');
 run('node_modules/astro/bin/astro.mjs',['build']);
 run('scripts/check-output.mjs');
} finally { writeFileSync(file,original); run('node_modules/astro/bin/astro.mjs',['build']); }
run('scripts/check-output.mjs');

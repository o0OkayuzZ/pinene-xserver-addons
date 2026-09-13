import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('../dist/', import.meta.url);
const contents = JSON.parse(readFileSync(new URL('../src/data/content-registry.json',import.meta.url),'utf8')).contents;
const hidden = contents.filter(c=>c.visibility!=='public').map(c=>'/contents/'+c.id+'/');
const forbidden = ['PINENE SERVER','/pinene-xserver-addons/','SECRET_SENTINEL','hidden_technical',...hidden];
let count=0;
function scan(dir) { for(const entry of readdirSync(dir,{withFileTypes:true})) { const path=join(dir,entry.name); if(entry.isDirectory()) scan(path); else {
 if(/\.(?:map|json)$/.test(entry.name)) throw new Error('Unexpected public data/source map: '+entry.name);
 if(/\.(?:html|js|css|svg)$/.test(entry.name)) { const text=readFileSync(path,'utf8'); for(const word of forbidden) if(text.includes(word)) throw new Error('Non-public output: '+word); if(/[A-Z]:[\\/]|(?:ssh-rsa|BEGIN PRIVATE KEY)/.test(text)) throw new Error('Unexpected private path/key'); count++; }
 } } }
import { fileURLToPath } from 'node:url';
scan(fileURLToPath(root)); console.log('Output audit PASS: '+count+' text assets, no draft routes, old brand, raw JSON, source maps or local paths.');

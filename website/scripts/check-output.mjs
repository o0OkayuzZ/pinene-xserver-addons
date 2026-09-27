import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootUrl = new URL('../dist/', import.meta.url);
const root = fileURLToPath(rootUrl);
const contents = JSON.parse(readFileSync(new URL('../src/data/content-registry.json',import.meta.url),'utf8')).contents;
const hidden = contents.filter(c=>c.visibility!=='public').map(c=>'/contents/'+c.id+'/');
const forbidden = ['PINENE SERVER','/pinene-xserver-addons/','SECRET_SENTINEL','hidden_technical',...hidden];
const allowedJson = new Set(['ai/knowledge.json']);
let count=0;

function auditText(path,text){
  for(const word of forbidden) if(text.includes(word)) throw new Error('Non-public output: '+word+' in '+path);
  if(/[A-Z]:[\\/]|(?:ssh-rsa|BEGIN PRIVATE KEY)/.test(text)) throw new Error('Unexpected private path/key in '+path);
}

function scan(dir){
  for(const entry of readdirSync(dir,{withFileTypes:true})){
    const path=join(dir,entry.name);
    if(entry.isDirectory()){ scan(path); continue; }
    const rel=relative(root,path).split(sep).join('/');
    if(/\.map$/.test(entry.name)) throw new Error('Unexpected public source map: '+rel);
    if(/\.json$/.test(entry.name)){
      if(!allowedJson.has(rel)) throw new Error('Unexpected public data JSON: '+rel);
      const text=readFileSync(path,'utf8');
      auditText(rel,text);
      const data=JSON.parse(text);
      if(data?.schemaVersion!=='0.1.0'||!Array.isArray(data?.entries)||data.entryCount!==data.entries.length)
        throw new Error('Invalid public Takuya knowledge shape: '+rel);
      count++;
      continue;
    }
    if(/\.(?:html|js|css|svg)$/.test(entry.name)){
      const text=readFileSync(path,'utf8');
      auditText(rel,text);
      count++;
    }
  }
}

scan(root);
console.log('Output audit PASS: '+count+' public text/data assets; only audited ai/knowledge.json is allowed as JSON.');

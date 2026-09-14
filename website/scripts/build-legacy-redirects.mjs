// Build a separate redirect-only artifact. Never overwrite dist or a checkout.
import { mkdirSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, join, relative, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const output=resolve(process.argv[2] ?? '');
if(!process.argv[2] || existsSync(output))throw new Error('Supply a new, nonexistent output directory');
const dist=fileURLToPath(new URL('../dist/',import.meta.url));
const targetBase='https://o0okayuzz.github.io/pine-server/';
let count=0;
function scan(dir){
 for(const item of readdirSync(dir,{withFileTypes:true})){
  const path=join(dir,item.name);
  if(item.isDirectory()){scan(path);continue;}
  if(!item.name.endsWith('.html'))continue;
  const pathRelative=relative(dist,path).split(sep).join('/');
  const target=targetBase+pathRelative.replace(/index\.html$/,'');
  const escaped=target.replaceAll('&','&amp;').replaceAll('"','&quot;');
  const html=`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PINE SERVER — 新しいURLへ移動</title><link rel="canonical" href="${escaped}"><script>const destination=new URL(${JSON.stringify(target)});destination.search=location.search;destination.hash=location.hash;location.replace(destination.href);</script><noscript><meta http-equiv="refresh" content="0;url=${escaped}"></noscript><h1>PINE SERVER</h1><p>WebサイトのURLが変わりました。</p><a href="${escaped}">新しいページを開く</a></html>`;
  const destination=join(output,pathRelative);mkdirSync(dirname(destination),{recursive:true});writeFileSync(destination,html);count++;
 }
}
scan(dist);writeFileSync(join(output,'.nojekyll'),'');
console.log(`Created ${count} legacy redirects in ${output}`);

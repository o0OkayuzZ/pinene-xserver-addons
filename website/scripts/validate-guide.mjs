import { readFileSync, existsSync } from 'node:fs';
import { publishEntries } from '../src/lib/field-guide.mjs';
const read = name => JSON.parse(readFileSync(new URL('../src/data/'+name,import.meta.url),'utf8'));
export function validateGuide(records, contents) {
 const ids=new Set(); const owners=new Map(contents.map(c=>[c.id,c]));
 for(const record of records) {
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.id)||ids.has(record.id))throw new Error('Invalid/duplicate guide ID'); ids.add(record.id);
  if(!['public','private','draft'].includes(record.visibility))throw new Error('Invalid guide visibility');
  if(!owners.has(record.contentId))throw new Error('Broken guide content reference');
  if(!['item','feature','recipe'].includes(record.kind))throw new Error('Invalid guide kind');
  if(record.visibility!=='public')continue;
  if(owners.get(record.contentId).visibility!=='public')throw new Error('Public guide has hidden owner');
  for(const field of ['name','summary','description','usage','obtaining'])if(typeof record[field]!=='string'||!record[field].trim())throw new Error('Missing guide field: '+field);
  if(!Array.isArray(record.details)||record.details.some(d=>typeof d!=='string'))throw new Error('Invalid guide details');
  if(!/^[0-9a-f]{40}$/.test(record.evidence?.commit)||!record.evidence?.paths?.length)throw new Error('Missing guide evidence');
  if(record.image && (record.image.kind!=='pack-texture'||!record.image.alt||!/^\/images\/items\/[a-z0-9-]+\.png$/.test(record.image.src)||!existsSync(new URL('../public'+record.image.src,import.meta.url))))throw new Error('Invalid guide image');
  if(record.kind==='recipe'&&!record.recipe)throw new Error('Missing recipe');
  if(record.recipe){const r=record.recipe;
   if(!Number.isInteger(r.count)||r.count<1||typeof r.shaped!=='boolean'||!r.ingredients?.length||r.ingredients.some(i=>!i.name||!Number.isInteger(i.count)||i.count<1))throw new Error('Invalid recipe ingredients/count');
   if(!Array.isArray(r.grid)||r.grid.some(row=>!Array.isArray(row)||row.some(cell=>typeof cell!=='string')))throw new Error('Invalid recipe grid');
   if(r.shaped&&(r.grid.length<1||r.grid.length>3||r.grid.some(row=>row.length<1||row.length>3||row.length!==r.grid[0].length)))throw new Error('Invalid recipe dimensions');
   if(!r.shaped&&r.grid.length)throw new Error('Shapeless recipe has layout');
   if(r.shaped){const counts=new Map();for(const row of r.grid)for(const name of row)if(name)counts.set(name,(counts.get(name)??0)+1);if(counts.size!==r.ingredients.length||r.ingredients.some(i=>counts.get(i.name)!==i.count))throw new Error('Recipe layout disagrees with ingredients');}
  }
 }
 for(const record of records)if(record.recipe){const target=records.find(e=>e.id===record.recipe.resultId);if(!target||target.kind!=='item'||target.contentId!==record.contentId||(record.visibility==='public'&&target.visibility!=='public'))throw new Error('Broken recipe result reference');}
 return publishEntries(records,new Set(contents.filter(c=>c.visibility==='public').map(c=>c.id)));
}
const published=validateGuide(read('field-guide.json'),read('content-registry.json').contents);
console.log('Guide validation PASS: '+published.length+' public entries.');

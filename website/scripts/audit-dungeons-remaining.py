"""Account for every pinned source item and recipe without assuming availability."""
import json, subprocess
from pathlib import Path
from collections import Counter, defaultdict
web=Path(__file__).resolve().parents[1];repo=web.parent
revision='3b66fddebe8006ea5f3656d509bf833d7594a09f'
def git(*args,**kwargs):return subprocess.check_output(['git',*args],cwd=repo,**kwargs)
tree=git('ls-tree','-r','--name-only',revision).decode('utf-8').splitlines()
bp=next(path.rsplit('/',1)[0] for path in tree if path.startswith('behavior_packs/bp_08_') and path.endswith('/manifest.json'))
paths=sorted(path for path in tree if path.startswith(bp+'/items/') and path.endswith('.json'))
payload=git('cat-file','--batch',input=''.join(revision+':'+path+'\n' for path in paths).encode())
sources={};offset=0
for path in paths:
    end=payload.index(b'\n',offset);size=int(payload[offset:end].split()[-1]);offset=end+1
    sources[path]=json.loads(payload[offset:offset+size].decode('utf-8-sig'));offset+=size+1
records=json.loads((web/'src/data/field-guide.json').read_text(encoding='utf-8'))
published=[e for e in records if e['contentId']=='minecraft-dungeons' and e['visibility']=='public']
ids={e['id'] for e in published};totals=Counter();missing=defaultdict(list);seen=set();covered_items=set()
for path,data in sources.items():
    identifier=data['minecraft:item']['description']['identifier'];assert identifier not in seen;seen.add(identifier)
    slug={'dungeons:hawkbrand':'hawkbrand','dungeons:book_of_heroes':'book-of-heroes'}.get(identifier,'dungeons-'+identifier.split(':')[1].replace('_','-'))
    parts=path[len(bp+'/items/'):].split('/')
    category='/'.join(parts[:2]) if parts[0] in ['armor','artifact'] or 'unobtainable' in parts else parts[0] if len(parts)>1 else 'other'
    totals[category]+=1
    if slug not in ids:missing[category].append(identifier)
    else:covered_items.add(slug)
recipe_sources={p for p in tree if p.startswith(bp+'/recipes/') and p.endswith('.json')}
recipe_evidence={p for e in published if e['kind']=='recipe' for p in e['evidence']['paths']}
covered=recipe_sources & recipe_evidence;missing_recipes=sorted(recipe_sources-covered)
categories=Counter(p[len(bp+'/recipes/'):].split('/')[0] if '/' in p[len(bp+'/recipes/'):] else 'root' for p in missing_recipes)
report=dict(sourceCommit=revision,publishedGuideEntries=len(published),sourceItemDefinitions=len(seen),publishedItems=sum(e['kind']=='item' for e in published),coveredSourceItemDefinitions=len(covered_items),additionalPublishedItems=[e['id'] for e in published if e['kind']=='item' and e['id'] not in covered_items],unpublishedItemDefinitions=sum(map(len,missing.values())),itemsByCategory=dict(totals),unpublishedItemsByCategory=dict(missing),sourceRecipeFiles=len(recipe_sources),coveredRecipeFiles=len(covered),unpublishedRecipeFiles=len(missing_recipes),unpublishedRecipePaths=missing_recipes,unpublishedRecipesByCategory=dict(sorted(categories.items())),note='Counts cover item definitions and recipe files, not every mob or script. Missing definitions include legacy, limited and unobtainable content; block entries can lack an item definition.')
assert report['coveredSourceItemDefinitions']+report['unpublishedItemDefinitions']==len(seen)
(web/'artifacts/dungeons-remaining-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k not in ['itemsByCategory','unpublishedItemsByCategory','unpublishedRecipePaths']},ensure_ascii=False))

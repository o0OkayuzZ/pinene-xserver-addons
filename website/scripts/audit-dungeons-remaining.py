"""Count source definitions versus published Dungeons entries, without inferring availability."""
import json,subprocess
from pathlib import Path
from collections import Counter, defaultdict
web=Path(__file__).resolve().parents[1];repo=web.parent
bp=next((repo/'behavior_packs').glob('bp_08_*'))
revision='3b66fddebe8006ea5f3656d509bf833d7594a09f'
# Local game files are retained; their item/recipe trees must match the audited revision.
for folder in ['items','recipes']:
    assert not subprocess.check_output(['git','diff','--name-only','aea85120954a8b74033b86253c17a04b691dab21',revision,'--',(bp/folder).relative_to(repo).as_posix()],cwd=repo)
records=json.loads((web/'src/data/field-guide.json').read_text(encoding='utf-8'))
published=[e for e in records if e['contentId']=='minecraft-dungeons' and e['visibility']=='public']
ids={e['id'] for e in published};totals=Counter();missing=defaultdict(list);seen=set()
for path in sorted((bp/'items').rglob('*.json')):
    d=json.loads(path.read_text(encoding='utf-8-sig'))['minecraft:item'];identifier=d['description']['identifier']
    assert identifier not in seen;seen.add(identifier)
    slug={'dungeons:hawkbrand':'hawkbrand','dungeons:book_of_heroes':'book-of-heroes'}.get(identifier,'dungeons-'+identifier.split(':')[1].replace('_','-'))
    parts=path.relative_to(bp/'items').parts
    category='/'.join(parts[:2]) if parts[0] in ['armor','artifact'] or 'unobtainable' in parts else parts[0] if len(parts)>1 else 'other'
    totals[category]+=1
    if slug not in ids:missing[category].append(identifier)
recipe_sources={p.relative_to(repo).as_posix() for p in (bp/'recipes').rglob('*.json')}
recipe_evidence={p for e in published if e['kind']=='recipe' for p in e['evidence']['paths']}
covered=recipe_sources & recipe_evidence
recipe_categories=Counter()
for p in recipe_sources-covered:
    parts=Path(p).relative_to(bp.relative_to(repo)/'recipes').parts
    recipe_categories[parts[0] if len(parts)>1 else 'root']+=1
report={'sourceCommit':revision,
 'publishedGuideEntries':len(published),'sourceItemDefinitions':len(seen),'publishedItems':sum(e['kind']=='item' for e in published),
 'unpublishedItemDefinitions':sum(len(v) for v in missing.values()),'itemsByCategory':dict(totals),'unpublishedItemsByCategory':dict(missing),
 'sourceRecipeFiles':len(recipe_sources),'coveredRecipeFiles':len(covered),'unpublishedRecipeFiles':len(recipe_sources-covered),
 'unpublishedRecipesByCategory':dict(sorted(recipe_categories.items())),
 'note':'Counts include legacy, limited and unobtainable definitions. They are not a promise that every definition will be published.'}
assert report['publishedItems']+report['unpublishedItemDefinitions']==len(seen)
(web/'artifacts/dungeons-remaining-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k not in ['itemsByCategory','unpublishedItemsByCategory']},ensure_ascii=False))
print(json.dumps({k:len(v) for k,v in missing.items()},ensure_ascii=False))

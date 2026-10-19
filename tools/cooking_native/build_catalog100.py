"""Generate the 100-dish implementation from the reviewed catalog.

No deployed files are touched. --write updates only this checkout. --check
detects drift without mutation. Missing approved artwork intentionally prevents
--release-check; fallback icons are development placeholders, not final art.
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path
import re
from compiler import LIMITS, compile_recipe, parse_data, native_counts, signature
from golden_materials import MAX_DISH_RANK, golden_recipe_rows, ingredient_registry, load_golden_spec, material_item

ROOT = Path(__file__).resolve().parents[2]
FOOD = Path('behavior_packs/bp_18_7e540260-69ce-4a82-951d-bc793e151cd5')
TOOLS = Path('behavior_packs/bp_19_211f47f7-5f1d-4b02-a162-e7546cf3fdc4')
RP = Path('resource_packs/rp_21_c81a6798-b6b1-4716-a514-c49967ad0ee2')
CATALOG = Path('docs/cooking_ui/catalog-100.json')
KEYS = ['id','name','rank','description','ingredients','layout','resultCount','icon','nutrition','saturation','edition','family','role','effects','effect_summary','effect_cooldown_seconds','station','retains_container','material_tier']
EFFECT_LIMITS = {'speed':90,'haste':90,'night_vision':120,'water_breathing':90,
                 'regeneration':6,'resistance':40,'strength':30,'absorption':90,
                 'fire_resistance':45,'slow_falling':45,'jump_boost':90}
FALLBACK = {'dessert':'carrot_cake','drink':'milk_bottle','egg':'egg_toast',
            'gratin':'mushroom_cream_soup','noodle':'noodles','meat':'honey_chicken',
            'fish':'seafood_soup','vegetable':'carrot_salad','bakery':'honey_bread',
            'fried':'potato_sandwich','pancake':'chocolate_pancake',
            'snack':'chocolate_bread','soup':'pumpkin_soup','sandwich':'chicken_sandwich',
            'special':'fruit_bowl'}

def dumps(value):
    return json.dumps(value, ensure_ascii=False, indent=2) + '\n'

def load_catalog(root=ROOT):
    return json.loads((root/CATALOG).read_text(encoding='utf-8-sig'))

def validate_catalog(catalog):
    dishes = catalog['dishes']; materials=catalog['materials']
    assert len(dishes)==100, 'Must contain exactly 100 dishes, excluding materials'
    assert Counter(r['edition'] for r in dishes)=={'free':10,'expansion':90}
    assert len(materials)==7 and all(r['rank']==0 for r in materials)
    all_rows=materials+dishes
    by_id={r['id']:r for r in all_rows}
    registered=ingredient_registry()
    assert len(by_id)==107, 'Duplicate IDs or material counted as a dish'
    assert len({r['name'] for r in dishes})==100, 'Duplicate dish names'
    assert sum(r['origin']=='existing' for r in dishes)==27
    assert sum(r['origin']=='approved_wave2' for r in dishes)==27
    assert sum(r['origin']=='new_20261019' for r in dishes)==46
    for r in dishes:
        assert r.get('station','cutting_board')=='cutting_board' and not r.get('retains_container'), 'Dishes must use the cooking station and return their input containers'
        assert 1<=r['rank']<=MAX_DISH_RANK and 1<=r['nutrition']<=16
        assert 0<r['saturation']<=1.7 and 1<=r['resultCount']<=64
        assert sum(p['count'] for p in r['ingredients'])<=9
        assert r['container_return'] in [None,'minecraft:bowl','minecraft:bucket','minecraft:glass_bottle']
        if r['container_return']:
            assert sum(p['count'] for p in r['ingredients'] if p.get('id')==r['container_return'])==r['resultCount'], 'Vessel count must equal dish output'
        assert len(r['effects'])<=2
        assert r['effect_cooldown_seconds']==(30 if r['effects'] else 0)
        for e in r['effects']:
            assert e['id'] in EFFECT_LIMITS and e['amplifier']==0
            assert 1<=e['seconds']<=EFFECT_LIMITS[e['id']]
        for part in r['ingredients']:
            assert re.fullmatch(r'[a-z0-9_]+:[a-z0-9_]+',part['id']), part['id']
            assert type(part['count']) is int and part['count']>0
            dep=by_id.get(part['id'])
            assert dep or part['id'].startswith('minecraft:') or part['id'] in ['pine:whole_cheese','pine:chili_pepper'] or part['id'] in registered, 'Unknown material'
            if dep:
                assert dep['rank']<=r['rank'], 'Requires a higher-rank ingredient'
                if r['edition']=='free':assert dep.get('edition','free')=='free', 'Free dish depends on expansion'
    visiting=set();done=set()
    def visit(ident):
        assert ident not in visiting, 'Ingredient cycle: '+ident
        if ident in done:return
        visiting.add(ident)
        for p in by_id[ident]['ingredients']:
            for child in p.get('ids',[p.get('id')]):
                if child in by_id:visit(child)
        visiting.remove(ident);done.add(ident)
    for ident in by_id:visit(ident)
    seen={}
    for r in all_rows:
        for filename,value in compile_recipe(r):
            counts=native_counts(value)
            sig=tuple(sorted(counts.items()))
            assert sig not in seen or seen[sig]==r['id'], 'Conflicting recipe: '+r['id']+' / '+seen.get(sig,'')
            seen[sig]=r['id']
            if r['id']!='pine:cooking_oil':assert counts==signature(r['ingredients'])
    return all_rows

def generated_files(catalog, root=ROOT):
    rows=validate_catalog(catalog);out={}
    gold_rows=golden_recipe_rows(catalog)
    rows=catalog['materials']+gold_rows+catalog['dishes']
    recipes=[{key:r[key] for key in KEYS if key in r} for r in rows]
    code='export const COOKING_RECIPES = '+json.dumps(recipes,ensure_ascii=False,indent=2)+';\nexport const CATEGORY_ORDER = [0,1,2,3,4,5,6,7,8,9,10];\n'
    assert len(parse_data(code))==107+len(gold_rows)
    out[TOOLS/'scripts/cooking_data.js']=code
    runtime={r['id']:{'resultCount':r['resultCount'],'rank':r['rank'],
                         'ingredients':[{'ids':p.get('ids',[p.get('id')]),'count':p['count']} for p in r['ingredients']]} for r in rows if r.get('station')!='crafting_table'}
    observed=sorted({r['id'] for r in rows}|{ident for r in rows for p in r['ingredients'] for ident in p.get('ids',[p.get('id')])}|set(ingredient_registry()))
    out[TOOLS/'scripts/cooking_runtime.js']='export const COOKING_RUNTIME = Object.freeze('+json.dumps(runtime,ensure_ascii=False,separators=(',',':'))+');\nexport const OBSERVED_ITEM_IDS = Object.freeze('+json.dumps(observed,separators=(',',':'))+');\n'
    for r in rows:
        destination=FOOD/'recipes/golden' if r.get('station')=='crafting_table' else TOOLS/'recipes/native'
        for filename,value in compile_recipe(r):out[destination/filename]=dumps(value)
    meal_data={r['id']:{'name':r['name'],'effects':r['effects'],'cooldownSeconds':r['effect_cooldown_seconds']} for r in catalog['dishes']}
    out[FOOD/'scripts/meal_catalog.generated.js']='// Generated by tools/cooking_native/build_catalog100.py.\nexport const MEALS = '+json.dumps(meal_data,ensure_ascii=False,indent=2)+';\n'
    atlas=json.loads((root/RP/'textures/item_texture.json').read_text(encoding='utf-8-sig'))
    icon_file=root/TOOLS/'scripts/inventory_icons.generated.js'
    icon_code=icon_file.read_text(encoding='utf-8-sig')
    icon_match=re.search(r'export const INVENTORY_ICONS\s*=\s*(\{[\s\S]*\});',icon_code)
    icons=json.loads(icon_match[1])
    for r in gold_rows:
        slug=r['id'].split(':')[1]
        out[FOOD/'items'/f'{slug}.json']=dumps(material_item(r))
        atlas['texture_data'][slug.removeprefix('enchanted_')]={'textures':r['icon']}
        icons[r['id']]=r['icon']
    for r in catalog['dishes']:
        slug=r['id'].split(':')[1]
        existing_path=root/FOOD/'items'/f'{slug}.json'
        if existing_path.exists():item=json.loads(existing_path.read_text(encoding='utf-8-sig'))
        else:
            item={'format_version':'1.21.90','minecraft:item':{
                'description':{'identifier':r['id'],'menu_category':{'category':'equipment','group':'minecraft:itemGroup.name.miscFood'}},
                'components':{'minecraft:icon':slug,'minecraft:display_name':{'value':'item.'+r['id']+'.name'},
                              'minecraft:max_stack_size':1 if r['container_return']=='minecraft:bucket' else 64,
                              'minecraft:food':{},'minecraft:use_modifiers':{'use_duration':1.6,'movement_modifier':0.35},
                              'minecraft:use_animation':'drink' if r['family']=='drink' else 'eat'}}}
        item['format_version']='1.21.90'
        components=item['minecraft:item']['components']
        components['minecraft:food'].update(nutrition=r['nutrition'],saturation_modifier=r['saturation'],can_always_eat=False)
        if r['container_return']:components['minecraft:food']['using_converts_to']=r['container_return']
        else:components['minecraft:food'].pop('using_converts_to',None)
        components['pine:meal_effects']={}
        out[FOOD/'items'/f'{slug}.json']=dumps(item)
        if r['art_status']=='existing_approved':path=r['icon']
        else:path='textures/items/'+FALLBACK[r['family']]
        atlas['texture_data'][slug]={'textures':path}
        icons[r['id']]=path
    out[RP/'textures/item_texture.json']=dumps(atlas)
    out[TOOLS/'scripts/inventory_icons.generated.js']='// Generated resource paths. Pending dish art uses explicit development fallbacks.\nexport const INVENTORY_ICONS = '+json.dumps(icons,ensure_ascii=False,indent=2)+';\n'
    for locale in ['ja_JP','en_US']:
        file=RP/'texts'/f'{locale}.lang'
        text=(root/file).read_text(encoding='utf-8-sig') if (root/file).exists() else ''
        for r in rows:
            key='item.'+r['id']+'.name'
            name=r['name'] if locale=='ja_JP' else r['id'].split(':')[1].replace('_',' ').title()
            if re.search(r'^'+re.escape(key)+r'=',text,re.M):
                if locale=='ja_JP':text=re.sub(r'^'+re.escape(key)+r'=.*$',lambda m:key+'='+name,text,flags=re.M)
            else:text=text.rstrip()+'\n'+key+'='+name+'\n'
        out[file]=text.replace('\r\n','\n')
    languages_path=RP/'texts/languages.json'
    languages=json.loads((root/languages_path).read_text(encoding='utf-8-sig')) if (root/languages_path).exists() else ['ja_JP']
    if 'en_US' not in languages:languages.append('en_US')
    out[languages_path]=dumps(languages)
    # Full ID lists are build-time content selection, never purchase checks.
    out[Path('docs/cooking_ui/edition-content.json')]=dumps({
        'schema_version':1,'free':[r['id'] for r in catalog['dishes'] if r['edition']=='free'],
        'expansion':[r['id'] for r in catalog['dishes'] if r['edition']=='expansion'],
        'shared_material_recipes':[r['id'] for r in catalog['materials']+gold_rows],
        'shared_material_items':['pine:whole_cheese','pine:chili_pepper'],
        'optional_existing_golden_ingredients':load_golden_spec()['existing_ingredients'],
        'paid_runtime_verification':False,'status':'Content assignment only; independent package export and shop integration pending.'})
    # The old server-only ingredient is also present in inactive legacy recipes.
    for file in (root/FOOD/'recipes').glob('*.json'):
        text=file.read_text(encoding='utf-8-sig')
        if 'myname:pancake' in text:out[file.relative_to(root)]=text.replace('myname:pancake','pine:pancake')
    lines=['# 料理100品 — 効果・レシピ初稿','', '無料10品＋追加90品の候補表。採用済み54品＋保留中の仮案46品。基本素材7種・金素材14種・道具・唐辛子は品数に含めない。',
           '','特殊効果はすべてI。特殊効果の再発動は食べ物をまたいで30秒待ち。食料回復は通常どおり。',
           '強い・長い既存効果を弱めない。満腹時には食べられない。料理とポーションの効果を加算して強度を増やさない。',
           '', '数値は実機で調整する初稿。新規73品の採用済み画像・3D・実機確認は未完了。','',
           '| 料理 | 区分 | Rank | 回復量 | 腹持ち係数 | 効果 | 材料 |', '|---|---|---:|---:|---:|---|---|']
    for r in catalog['dishes']:
        ingredients='、'.join(p['name']+'×'+str(p['count']) for p in r['ingredients'])
        lines.append(f"| {r['name']} | {'無料' if r['edition']=='free' else '追加'} | {r['rank']} | {r['nutrition']} | {r['saturation']} | {r['effect_summary']} | {ingredients} |")
    out[Path('docs/cooking_ui/COOKBOOK_100.md')]='\n'.join(lines)+'\n'
    return out

def main():
    ap=argparse.ArgumentParser();mode=ap.add_mutually_exclusive_group(required=True)
    mode.add_argument('--write',action='store_true');mode.add_argument('--check',action='store_true');mode.add_argument('--release-check',action='store_true')
    args=ap.parse_args();catalog=load_catalog();outputs=generated_files(catalog)
    if args.release_check:
        if load_golden_spec().get('art_status')!='approved':raise SystemExit('RELEASE BLOCKED: golden material icon candidates need visual approval and game-engine QA.')
        unreachable=[r['id'] for r in catalog['dishes'] if r['rank']>max(LIMITS.values())]
        if unreachable:raise SystemExit('RELEASE BLOCKED: Rank VIII-X dishes need an obtainable cooking-tool progression.')
        pending=[r['id'] for r in catalog['dishes'] if r['art_status']!='existing_approved']
        if pending:raise SystemExit(f'RELEASE BLOCKED: {len(pending)} dishes need approved art/models, plus engine and device QA.')
        raise SystemExit('RELEASE BLOCKED: real engine/device QA and independent package validation have not been recorded.')
    different=[]
    for relative,text in outputs.items():
        file=ROOT/relative
        if not file.exists() or file.read_text(encoding='utf-8-sig')!=text:
            different.append(str(relative))
            if args.write:file.parent.mkdir(parents=True,exist_ok=True);file.write_text(text,encoding='utf-8',newline='\n')
    print(json.dumps({'dishes':100,'free':10,'expansion':90,'basic_materials':7,'golden_materials':14,'native_recipe_variants':sum('/recipes/native/' in str(p).replace('\\','/') for p in outputs), 'files_changed' if args.write else 'drift':len(different)},ensure_ascii=False))
    if args.check and different:raise SystemExit(1)

if __name__=='__main__':main()

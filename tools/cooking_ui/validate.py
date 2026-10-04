"""Check recipe preservation, UI resources, and manifest links for cooking UI."""
from pathlib import Path
import json, re, subprocess
ROOT = Path(__file__).resolve().parents[2]
BP = ROOT/'behavior_packs/bp_19_211f47f7-5f1d-4b02-a162-e7546cf3fdc4'
RP = ROOT/'resource_packs/rp_22_392fe57f-87d4-4146-a8ba-5c548001ab45'
BASE = '9e43fe34527e18aaeedce5ba8b322f2160bc7834'
def read(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def recipes(s): return json.JSONDecoder().raw_decode(s[s.index('['):])[0]
def previous(p): return subprocess.check_output(['git','-c','safe.directory='+ROOT.as_posix(),'show',BASE+':'+p.relative_to(ROOT).as_posix()],cwd=ROOT).decode('utf-8-sig')
rows=recipes((BP/'scripts/cooking_data.js').read_text(encoding='utf-8-sig'))
old=recipes(previous(BP/'scripts/cooking_data.js'))
by={r['id']:r for r in rows}
assert len(rows)==len(by)==34
assert set(by)-{r['id'] for r in old}=={'pine:cooking_oil','pine:gelatin','pine:noodles','pine:cheese'}
for row in old:
    for key in ['rank','ingredients','resultCount','nutrition','saturation']:
        assert by[row['id']].get(key)==row.get(key),(row['id'],key)
food=ROOT/'resource_packs/rp_21_c81a6798-b6b1-4716-a514-c49967ad0ee2'
for row in rows:
    assert (food/(row['icon']+'.png')).is_file(),row['id']
    assert isinstance(row['resultCount'],int) and 1<=row['resultCount']<=64
    seen=set()
    for ingredient in row['ingredients']:
        ids=set(ingredient.get('ids',[ingredient.get('id')]))
        assert ids and None not in ids and not (seen & ids),row['id']
        seen|=ids
        assert isinstance(ingredient['count'],int) and ingredient['count']>0
for p in (BP/'items').glob('*.json'): assert read(p)==json.loads(previous(p)),p
for p in (BP/'recipes').glob('*.json'): assert read(p)==json.loads(previous(p)),p
for p in [*BP.rglob('*.json'),*RP.rglob('*.json')]:read(p)

import sys
sys.path.insert(0,str(ROOT/'tools/cooking_native'))
from compiler import compile_recipe,compile_board,table
assert read(RP/'ui/server_form.json')=={'namespace':'server_form'}
assert (BP/'scripts/main.js').read_text(encoding='utf-8').strip()=="import './native_boards.js';"
native=(BP/'scripts/native_boards.js').read_text(encoding='utf-8')
assert 'ActionFormData' not in native and 'CustomForm' not in native
assert 'bootstrap.js' not in native and 'minecraft:emerald_block' not in native
assert 'getAllPlayers().length!==1' not in native
assert 'migrateLegacyKnife' in native and 'otherSessionOwnsBoard' in native
expected={name:d for row in rows for name,d in compile_recipe(row)}
assert len(expected)==198
assert {p.name for p in (BP/'recipes/native').glob('*.json')}==set(expected)
for name,d in expected.items():assert read(BP/'recipes/native'/name)==d,name
for p in (BP/'blocks').glob('*_cutting_board.json'):
    original=json.loads(previous(p));wanted=compile_board(original);wanted['format_version']='1.21.120'
    assert read(p)==wanted,p
for p in (BP/'entities').glob('placed_*_knife.json'):
    d=read(p);assert d['minecraft:entity']['components']['minecraft:inventory']['inventory_size']==1
    d['minecraft:entity']['components'].pop('minecraft:inventory')
    assert d==json.loads(previous(p)),p
manifest=read(BP/'manifest.json')
assert next(d['version'] for d in manifest['dependencies'] if d.get('module_name')=='@minecraft/server')=='2.7.0'
assert not any(d.get('module_name')=='@minecraft/server-ui' for d in manifest['dependencies'])
assert manifest['modules'][1]['uuid']=='b86c67e2-0d84-4643-8d78-28cfdeb2718d'
# The food pack, placed food models, original icons and all item stats are untouched.
changed=subprocess.check_output(['git','-c','safe.directory='+ROOT.as_posix(),'diff','--name-only','986fe836c5c8207f3436638ae54580d7b89a96ca'],cwd=ROOT,text=True).splitlines()
assert not any('/bp_18_' in p or '/rp_21_' in p for p in changed)
print(json.dumps({'result':'PASS','recipes':34,'native_recipe_variants':198,'default_ui':'native crafting table','durability':'probabilistic per used session','engine_verification':'pending'}))

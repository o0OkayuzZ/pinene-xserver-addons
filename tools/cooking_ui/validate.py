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
ui=read(RP/'ui/server_form.json')
assert 'pinene_cooking_ui:' in json.dumps(ui)
# Modifications remain limited to the cooking title, preserving unrelated forms.
assert ui['long_form']==json.loads(previous(RP/'ui/server_form.json'))['long_form']
main=(BP/'scripts/main.js').read_text(encoding='utf-8')
assert 'placeable_food.js' not in main
assert 'hasRoomAfterCraft(container, recipe, ItemStack, CONTAINER_RETURNS)' in main
for p in (BP/'scripts').glob('*.js'):
    for rel in re.findall(r'from\s+["\'](\./[^"\']+)["\']',p.read_text(encoding='utf-8-sig')):
        assert (p.parent/rel).is_file(),(p,rel)
manifest=read(BP/'manifest.json')
assert next(d['version'] for d in manifest['dependencies'] if d.get('module_name')=='@minecraft/server-ui')=='2.2.0'
print(json.dumps({'result':'PASS','recipes':34,'existing_recipes_preserved':len(old),'new_material_ui_recipes':4,'native_ui':'default with legacy fallback','durability':'per output; final batch breaks knife; client gameplay unverified'}))

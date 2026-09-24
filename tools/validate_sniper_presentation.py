"""Validate crossbow item/attachable bindings without launching Minecraft."""
from pathlib import Path
import json
import sys

def load(path):
 return json.loads(path.read_text(encoding='utf-8-sig'))

def validate(root):
 def pack(kind,uuid):
  matches=[p.parent for p in (root/kind).glob('*/manifest.json') if load(p)['header']['uuid']==uuid]
  if len(matches)!=1: raise ValueError(f'{uuid}: expected one {kind} pack, got {len(matches)}')
  return matches[0]
 bp=pack('behavior_packs','7c8ac348-47ad-4f71-8503-dc40a6f813f1')
 rp=pack('resource_packs','4ab7ea5c-8d31-44e6-b3d6-42cc32ad2f10')
 geos={g['description']['identifier']:g for g in load(rp/'models/entity/pinene_sniper_crossbow.geo.json')['minecraft:geometry']}
 animations=load(rp/'animations/pinene_sniper_crossbow.animation.json')['animations']
 rc=load(rp/'render_controllers/pinene_sniper_crossbow.render_controllers.json')['render_controllers']
 icons=load(rp/'textures/item_texture.json')['texture_data']
 count=0
 for family in ['sniper_crossbow','sniper_tnt_crossbow']:
  for depth in range(4):
   name=family+('_awakened_'+str(depth) if depth else '')
   item=load(bp/'items'/(name+'.item.json'))['minecraft:item']
   d=load(rp/'attachables/crossbow'/(name+'.json'))['minecraft:attachable']['description']
   assert d['identifier']==item['description']['identifier']=='pinene:'+name,name
   c=item['components'];assert c['minecraft:shooter']['charge_on_draw'] is True
   assert c['minecraft:shooter']['max_draw_duration']==1.25
   assert c['minecraft:use_modifiers']['use_duration']==1.25
   for key,path in d['textures'].items():
    if key!='enchanted': assert (rp/(path+'.png')).is_file(),(name,key,path)
   for key,gid in d['geometry'].items():
    assert gid.startswith('geometry.pinene_sniper_crossbow') and gid in geos,(name,gid)
    for bone in geos[gid]['bones']:
     for mesh in bone.get('texture_meshes',[]):
      assert mesh['texture'] in d['textures'],(name,gid,mesh['texture'])
   assert all(a in animations for a in d['animations'].values()),name
   assert all(r in rc for r in d['render_controllers']),name
   assert icons[name]['textures']==d['textures']['default'],name
   count+=1
 script=(bp/'scripts/sniper_crossbow.js').read_text(encoding='utf-8')
 assert 'const SCOPE_FOV = 30;' in script
 assert 'SCOPE_CLEAR_MARKER' in script
 ui=(rp/'ui/hud_screen.json').read_text(encoding='utf-8');json.loads(ui)
 assert '__PINENE_SNIPER_SCOPE_CLEAR__' in ui
 assert (rp/'textures/ui/sniper_scope.png').is_file()
 assert count==8
 print('PASS: eight item definitions; all held-model texture/geometry/animation bindings; scope clear contract')

if __name__=='__main__':
 root=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parents[1]
 try: validate(root)
 except (AssertionError,ValueError,KeyError,OSError) as exc:
  print(f'FAIL: {exc}',file=sys.stderr);sys.exit(1)

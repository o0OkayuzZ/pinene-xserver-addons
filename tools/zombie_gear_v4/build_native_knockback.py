"""Preserve pinned vanilla player behavior, append only namespaced KB groups/events."""
from pathlib import Path
import json
ROOT = Path(__file__).resolve().parents[2]
source = Path(__file__).with_name('vanilla_player_1.26.40.05.json')
data = json.loads(source.read_text(encoding='utf-8-sig'))
entity = data['minecraft:entity']
values = {**{f'c{i}':r for i,r in enumerate([.4,.56,.72,.88,1])},
          'partial1':.1,'partial2':.2,'partial3':.3,'recovery':1,'off':0}
groups = [f'zombiegear:kb_{name}' for name in values]
for name, value in values.items():
    entity.setdefault('component_groups', {})[f'zombiegear:kb_{name}'] = {
        'minecraft:knockback_resistance': {'value':value,'max':1}}
for name in values:
    event = {'remove':{'component_groups':groups}}
    event['add'] = {'component_groups':[f'zombiegear:kb_{name}']}
    entity.setdefault('events', {})[f'zombiegear:kb_{name}'] = event
destination = ROOT / 'behavior_packs/bp_09_7c8ac348-47ad-4f71-8503-dc40a6f813f1/entities/player.json'
entity['component_groups']['zombiegear:health80'] = {'minecraft:health': {'value':80,'max':80}}
entity['component_groups']['zombiegear:health20'] = {'minecraft:health': {'value':20,'max':20}}
for event,group in [('health80','health80'),('health_off','health20')]:
    entity['events']['zombiegear:'+event] = {'remove': {'component_groups':['zombiegear:health80','zombiegear:health20']},'add':{'component_groups':['zombiegear:'+group]}}
destination.parent.mkdir(exist_ok=True)
destination.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Native knockback groups generated; vanilla player behavior preserved')

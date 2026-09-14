"""Rebuild additive glow geometry using existing labeled cubes/UVs. No PNG edits."""
import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BP = ROOT / 'behavior_packs/bp_05_90f045c3-0718-4981-a1ff-180976002a93'
RP = ROOT / 'resource_packs/rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b'

def read(p):
    return json.loads(p.read_text(encoding='utf-8-sig'))

def write(p, data):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

labels = read(ROOT / 'docs/pinenite/design/cube_labels.json')
for part, protection in zip(['helmet', 'chestplate', 'leggings', 'boots'], [8, 14, 11, 8]):
    path = BP / f'items/Deathnerite-Add-On/pinenite/armor/pinenite_{part}.json'
    item = read(path)
    inherited = read(BP / f'items/Deathnerite-Add-On/parcanite/armor/parcanite_{part}.json')['minecraft:item']['components']
    existing = item['minecraft:item']['components']
    item['minecraft:item']['components'] = {**inherited, **existing}
    item['minecraft:item']['components']['minecraft:wearable']['protection'] = protection
    write(path, item)
    geometry = read(RP / f'models/entity/pinenite/{part}.geo.json')
    overlay = copy.deepcopy(geometry)
    geo = overlay['minecraft:geometry'][0]
    geo['description']['identifier'] += '_glow'
    for bone in geo['bones']:
        entries = [entry for entry in labels[part] if entry['bone'] == bone['name']]
        assert len(entries) == len(bone.get('cubes', []))
        bone['cubes'] = [cube for cube, entry in zip(bone.get('cubes', []), entries)
                         if entry['material'] in ('core', 'crystal')]
        for cube in bone['cubes']:
            cube['inflate'] = 0.005
    write(RP / f'models/entity/pinenite/{part}_glow.geo.json', overlay)
    path = RP / f'attachables/deathnerite/pinenite/pinenite_{part}.json'
    attach = read(path)
    desc = attach['minecraft:attachable']['description']
    desc['geometry']['glow'] = geo['description']['identifier']
    desc['materials']['glow'] = 'entity_emissive_alpha'
    desc['render_controllers'] = ['controller.render.true_dn.pinenite_armor', 'controller.render.true_dn.pinenite_glow']
    write(path, attach)

path = RP / 'render_controllers/pinenite.render_controllers.json'
controllers = read(path)
controllers['render_controllers']['controller.render.true_dn.pinenite_glow'] = {
    'geometry': 'Geometry.glow', 'materials': [{'*': 'Material.glow'}], 'textures': ['Texture.default'],
    'part_visibility': [{'*': '!query.is_first_person && (variable.pinenite_glow ?? 0) > 0'}],
    'color': {'r': 1, 'g': 1, 'b': 1, 'a': 'variable.pinenite_glow ?? 0'},
    'ignore_lighting': True
}
write(path, controllers)
write(RP / 'animations/pinenite_sync.animation.json', {'format_version': '1.8.0', 'animations': {
    'animation.true_dn.pinenite_sync': {'loop': True, 'animation_length': 1}
}})
write(RP / 'particles/pinenite_frame.particle.json', {
    'format_version': '1.10.0', 'particle_effect': {
        'description': {'identifier': 'true_dn:pinenite_frame', 'basic_render_parameters': {
            'material': 'particles_blend', 'texture': 'textures/particle/particles'}},
        'components': {
            'minecraft:emitter_rate_instant': {'num_particles': 1},
            'minecraft:emitter_lifetime_once': {'active_time': 0.01},
            'minecraft:emitter_shape_point': {},
            'minecraft:particle_lifetime_expression': {'max_lifetime': 0.12},
            'minecraft:particle_appearance_billboard': {
                'size': ['variable.pinenite_size', 'variable.pinenite_size'], 'facing_camera_mode': 'lookat_xyz',
                'uv': {'texture_width': 128, 'texture_height': 128, 'uv': [0, 0], 'uv_size': [8, 8]}},
            'minecraft:particle_appearance_tinting': {'color': [
                'variable.pinenite_color.r', 'variable.pinenite_color.g',
                'variable.pinenite_color.b', 'variable.pinenite_color.a']}
        }
    }
})
burst = read(RP / 'particles/pinenite_frame.particle.json')
burst['particle_effect']['description']['identifier'] = 'true_dn:pinenite_reflect'
components = burst['particle_effect']['components']
components['minecraft:emitter_rate_instant']['num_particles'] = 18
del components['minecraft:emitter_shape_point']
components['minecraft:emitter_shape_sphere'] = {'radius': 0.25, 'direction': 'outwards'}
components['minecraft:particle_lifetime_expression']['max_lifetime'] = 0.35
components['minecraft:particle_initial_speed'] = 2
components['minecraft:particle_motion_dynamic'] = {'linear_acceleration': [0, -2, 0], 'linear_drag_coefficient': 3}
components['minecraft:particle_appearance_billboard']['size'] = [0.035, 0.035]
components['minecraft:particle_appearance_tinting']['color'] = [57 / 255, 197 / 255, 187 / 255, 1]
write(RP / 'particles/pinenite_reflect.particle.json', burst)

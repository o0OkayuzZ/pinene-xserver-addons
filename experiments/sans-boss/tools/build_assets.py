"""Build original cube models/atlases and a distributable Bedrock addon.

All geometry is authored here. Reference audio assets are documented in README.
Requires Python 3 and Pillow. Run from any directory.
"""
from pathlib import Path
import json
import zipfile
from visual_assets import write_models, write_ray

ROOT = Path(__file__).resolve().parents[1]
BP, RP = ROOT / 'BP', ROOT / 'RP'
BP_UUID = 'd3ee4106-29e6-5c94-b502-cb49346e75b2'
RP_UUID = '7243b118-8a4c-56de-a52b-4ae014f52d5a'
VERSION = [0, 9, 8]

def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def client(identifier, geo, animation=None, egg=None):
    desc = {'identifier': identifier, 'materials': {'default': 'entity_alphatest', 'glow': 'entity_emissive_alpha'},
            'textures': {'default': 'textures/entity/sans_atlas_render'},
            'geometry': {'default': geo},
            'render_controllers': ['controller.render.pinene_sans']}
    if animation:
        desc['animations'] = {'idle': animation}
        desc['scripts'] = {'animate': ['idle']}
    if egg:
        desc['spawn_egg'] = {'base_color': egg[0], 'overlay_color': egg[1]}
    return {'format_version': '1.10.0', 'minecraft:client_entity': {'description': desc}}

def prop_entity(identifier, properties):
    return {'format_version': '1.21.0', 'minecraft:entity': {
        'description': {'identifier': identifier, 'is_spawnable': False,
                        'is_summonable': True, 'properties': properties},
        'components': {
            'minecraft:type_family': {'family': ['pinene_sans_visual']},
            'minecraft:health': {'value': 1, 'max': 1},
            'minecraft:collision_box': {'width': 0.01, 'height': 0.01},
            'minecraft:physics': {'has_gravity': False, 'has_collision': False},
            'minecraft:pushable': {'is_pushable': False, 'is_pushable_by_piston': False},
            'minecraft:damage_sensor': {'triggers': [{'deals_damage': 'no'}]},
            'minecraft:timer': {'looping': False, 'time': 8,
                                'time_down_event': {'event': 'pinene_sans:expire', 'target': 'self'}},
        },
        'component_groups': {'pinene_sans:remove': {'minecraft:instant_despawn': {}}},
        'events': {'pinene_sans:expire': {'add': {'component_groups': ['pinene_sans:remove']}}},
    }}

def particle(identifier, color, size, lifetime, count=1):
    return {'format_version': '1.10.0', 'particle_effect': {
        'description': {'identifier': identifier, 'basic_render_parameters': {
            'material': 'particles_alpha', 'texture': 'textures/particle/sans_pixel'}},
        'components': {
            'minecraft:emitter_rate_instant': {'num_particles': count},
            'minecraft:emitter_lifetime_once': {'active_time': 0.05},
            'minecraft:emitter_shape_point': {'offset': [0, 0, 0]},
            'minecraft:particle_lifetime_expression': {'max_lifetime': lifetime},
            'minecraft:particle_appearance_billboard': {
                'size': [size, size], 'facing_camera_mode': 'lookat_xyz',
                'uv': {'texture_width': 8, 'texture_height': 8, 'uv': [0, 0], 'uv_size': [8, 8]}},
            'minecraft:particle_appearance_tinting': {'color': color},
        },
    }}

def build():
    save(BP / 'manifest.json', {
        'format_version': 2,
        'header': {'name': 'Pinene Sans Boss BP', 'description': 'Sans: warp fatigue, angled bone spikes and Gaster Blasters.',
                   'uuid': BP_UUID, 'version': VERSION, 'min_engine_version': [1, 26, 50]},
        'modules': [
            {'type': 'data', 'uuid': '17b04ce7-6d79-5828-97e1-7264da192ae2', 'version': VERSION},
            {'type': 'script', 'language': 'javascript', 'entry': 'scripts/main.js',
             'uuid': '2c828267-6f2b-53d7-9bea-d1783eb8cafa', 'version': VERSION}],
        'dependencies': [{'uuid': RP_UUID, 'version': VERSION},
                         {'module_name': '@minecraft/server', 'version': '2.7.0'}],
    })
    save(RP / 'manifest.json', {
        'format_version': 2,
        'header': {'name': 'Pinene Sans Boss RP', 'description': 'Original voxel Sans, bones and blaster visuals.',
                   'uuid': RP_UUID, 'version': VERSION, 'min_engine_version': [1, 26, 50]},
        'modules': [{'type': 'resources', 'uuid': 'f03492dd-3e27-5168-bb0f-ac30e8c371ee', 'version': VERSION}],
        'capabilities': ['pbr'],
    })
    save(BP / 'entities/sans.json', {
        'format_version': '1.21.0', 'minecraft:entity': {
            'description': {'identifier': 'pinene_sans:sans', 'is_spawnable': True, 'is_summonable': True,
                            'menu_category': {'category': 'nature', 'group': 'itemGroup.name.mobEgg'},
                            'properties': {'pinene_sans:slam': {'type': 'int', 'range': [0, 2], 'default': 0, 'client_sync': True},
                                           'pinene_sans:tired': {'type': 'float', 'range': [0, 1],
                                                                  'default': 0, 'client_sync': True},
                                           'pinene_sans:casting': {'type': 'bool', 'default': False, 'client_sync': True}}},
            'components': {
                'minecraft:type_family': {'family': ['pinene_sans_boss', 'mob']},
                'minecraft:health': {'value': 1, 'max': 1},
                'minecraft:collision_box': {'width': 0.65, 'height': 1.45},
                'minecraft:movement': {'value': 0},
                'minecraft:physics': {'has_gravity': True, 'has_collision': True},
                'minecraft:pushable': {'is_pushable': False, 'is_pushable_by_piston': False},
                'minecraft:knockback_resistance': {'value': 1, 'max': 1},
                'minecraft:fire_immune': {}, 'minecraft:persistent': {},
                'minecraft:nameable': {},
                'minecraft:boss': {'name': 'Sans', 'hud_range': 40, 'should_darken_sky': False},
            },
        },
    })
    save(BP / 'entities/soul.json', prop_entity('pinene_sans:soul', {}))
    save(RP / 'entity/soul.entity.json', client('pinene_sans:soul', 'geometry.pinene_sans.soul'))
    save(BP / 'entities/bone.json', prop_entity('pinene_sans:bone', {
        'pinene_sans:height': {'type': 'float', 'range': [0.1, 3], 'default': 1, 'client_sync': True},
        'pinene_sans:tilt': {'type': 'float', 'range': [0, 60], 'default': 0, 'client_sync': True},
        'pinene_sans:azimuth': {'type': 'float', 'range': [0, 360], 'default': 0, 'client_sync': True}}))
    save(BP / 'entities/blaster.json', prop_entity('pinene_sans:blaster', {
        'pinene_sans:firing': {'type': 'bool', 'default': False, 'client_sync': True},
        'pinene_sans:arrival': {'type': 'float', 'range': [0, 1], 'default': 0, 'client_sync': True},
        'pinene_sans:departure': {'type': 'float', 'range': [0, 1], 'default': 0, 'client_sync': True},
        'pinene_sans:recoil': {'type': 'float', 'range': [0, 1], 'default': 0, 'client_sync': True}}))
    save(BP / 'entities/ray.json', prop_entity('pinene_sans:ray', {
        'pinene_sans:firing': {'type': 'bool', 'default': False, 'client_sync': True},
        'pinene_sans:length': {'type': 'float', 'range': [0, 28], 'default': 0, 'client_sync': True},
        'pinene_sans:width': {'type': 'float', 'range': [0, 2], 'default': 0.1, 'client_sync': True}}))

    save(RP / 'sounds/sound_definitions.json', {
        'format_version': '1.20.20',
        'sound_definitions': {
            'pinene_sans.'+name: {'category':'hostile', 'sounds':['sounds/pinene_sans/'+name]}
            for name in ['blaster_charge','blaster_fire','gravity_cue','slam_impact','bone_emerge']}})
    icon = write_models(save, RP)
    write_ray(save, RP)
    save(RP / 'entity/sans.entity.json', client('pinene_sans:sans', 'geometry.pinene_sans.sans',
                                              'animation.pinene_sans.idle', ['#2696d2', '#f1efe5']))
    save(RP / 'entity/bone.entity.json', client('pinene_sans:bone', 'geometry.pinene_sans.bone',
                                              'animation.pinene_sans.bone'))
    save(RP / 'entity/blaster.entity.json', client('pinene_sans:blaster', 'geometry.pinene_sans.blaster',
                                                 'animation.pinene_sans.blaster'))

    (RP / 'textures/particle').mkdir(parents=True, exist_ok=True)
    from PIL import Image
    pixel = Image.new('RGBA', (8, 8), (255, 255, 255, 255))
    pixel.save(RP / 'textures/particle/sans_pixel.png')
    for identifier, color, size, life, count in [
        ('warning', [0.1, 0.7, 1, 0.8], 0.12, 0.3, 1),
        ('beam', [0.75, 0.95, 1, 1], 0.5, 0.15, 1),
        ('warp', [0.1, 0.75, 1, 0.8], 0.16, 0.25, 12),
        ('karma', [0.7, 0.12, 0.95, 1], 0.10, 0.35, 3),
    ]:
        save(RP / f'particles/{identifier}.particle.json', particle('pinene_sans:' + identifier,
                                                                  color, size, life, count))
    save(RP / 'texts/languages.json', ['en_US', 'ja_JP'])
    for locale, name in [('en_US', 'Sans'), ('ja_JP', 'サンズ')]:
        (RP / f'texts/{locale}.lang').write_text(
            f'entity.pinene_sans:sans.name={name}\nitem.spawn_egg.entity.pinene_sans:sans.name={name}のスポーンエッグ\n',
            encoding='utf-8')
    for pack in [BP, RP]: icon.save(pack / 'pack_icon.png')

    output = ROOT / ('dist/Pinene_Sans_Boss_v' + '.'.join(map(str,VERSION)) + '.mcaddon')
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        for pack in [BP, RP]:
            for path in sorted(pack.rglob('*')):
                if path.is_file(): archive.write(path, f'Pinene_Sans_{pack.name}/{path.relative_to(pack).as_posix()}')
    print(output)

if __name__ == '__main__':
    build()

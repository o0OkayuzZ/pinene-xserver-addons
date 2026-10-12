"""Build original cube models/atlases and a distributable Bedrock addon.

All geometry is authored here; no downloaded Undertale models or audio are used.
Requires Python 3 and Pillow. Run from any directory.
"""
from pathlib import Path
import json
import zipfile
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
BP, RP = ROOT / 'BP', ROOT / 'RP'
BP_UUID = 'd3ee4106-29e6-5c94-b502-cb49346e75b2'
RP_UUID = '7243b118-8a4c-56de-a52b-4ae014f52d5a'
VERSION = [0, 1, 0]

def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def cube(origin, size, tile=0, front=None, inflate=None):
    faces = {face: {'uv': [tile * 16, 0], 'uv_size': [16, 16]}
             for face in ['north', 'south', 'east', 'west', 'up', 'down']}
    if front is not None:
        faces['north'] = {'uv': [front * 16, 16], 'uv_size': [16, 16]}
    result = {'origin': origin, 'size': size, 'uv': faces}
    if inflate is not None:
        result['inflate'] = inflate
    return result

def geometry(identifier, bones, width=3, height=3):
    return {'format_version': '1.12.0', 'minecraft:geometry': [{
        'description': {'identifier': identifier, 'texture_width': 128,
                        'texture_height': 64, 'visible_bounds_width': width,
                        'visible_bounds_height': height, 'visible_bounds_offset': [0, 1, 0]},
        'bones': bones,
    }]}

def bone(name, cubes, parent=None, pivot=None):
    result = {'name': name, 'pivot': pivot or [0, 0, 0], 'cubes': cubes}
    if parent:
        result['parent'] = parent
    return result

def client(identifier, geo, animation=None, egg=None):
    desc = {'identifier': identifier, 'materials': {'default': 'entity_alphatest'},
            'textures': {'default': 'textures/entity/sans_atlas'},
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
        'header': {'name': 'Pinene Sans Boss BP', 'description': 'Sans: warp fatigue, bone walls and Gaster Blasters.',
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
                            'properties': {'pinene_sans:tired': {'type': 'float', 'range': [0, 1],
                                                                  'default': 0, 'client_sync': True}}},
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
    save(BP / 'entities/bone.json', prop_entity('pinene_sans:bone', {
        'pinene_sans:height': {'type': 'float', 'range': [0.1, 3], 'default': 1, 'client_sync': True}}))
    save(BP / 'entities/blaster.json', prop_entity('pinene_sans:blaster', {
        'pinene_sans:firing': {'type': 'bool', 'default': False, 'client_sync': True}}))

    # One atlas with palette tiles and hand-drawn skull faces.
    atlas = Image.new('RGBA', (128, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(atlas)
    palette = ['#eeeade', '#268dcc', '#10131a', '#343d4c', '#ffffff', '#00d8ff', '#c9d6de', '#1c628d']
    for i, color in enumerate(palette):
        draw.rectangle([i * 16, 0, i * 16 + 15, 15], fill=color)
    # Sans face: huge sockets, tiny pupils, cheekbones and a toothed grin.
    draw.rectangle([0, 16, 15, 31], fill=palette[0])
    draw.rectangle([2, 20, 6, 23], fill=palette[2])
    draw.rectangle([9, 20, 13, 23], fill=palette[2])
    draw.point([4, 22], fill=palette[4]); draw.point([11, 22], fill=palette[5])
    draw.rectangle([7, 24, 8, 25], fill=palette[2])
    draw.rectangle([2, 26, 13, 29], fill=palette[2])
    draw.rectangle([3, 27, 12, 28], fill=palette[4])
    for x in [5, 8, 11]: draw.line([x, 27, x, 28], fill=palette[2])
    # Gaster Blaster sockets.
    draw.rectangle([16, 16, 31, 31], fill=palette[0])
    draw.polygon([(18, 19), (22, 21), (22, 24), (18, 23)], fill=palette[2])
    draw.polygon([(29, 19), (25, 21), (25, 24), (29, 23)], fill=palette[2])
    draw.rectangle([20, 21, 21, 22], fill=palette[5])
    draw.rectangle([26, 21, 27, 22], fill=palette[5])
    draw.rectangle([23, 25, 24, 27], fill=palette[2])
    (RP / 'textures/entity').mkdir(parents=True, exist_ok=True)
    atlas.save(RP / 'textures/entity/sans_atlas.png')
    save(RP / 'textures/entity/sans_atlas.texture_set.json', {
        'format_version': '1.16.100', 'minecraft:texture_set': {
            'color': 'sans_atlas', 'metalness_emissive_roughness': [0, 0, 255]}})

    sans_bones = [
        bone('root', []),
        bone('body', [cube([-4, 8, -2.5], [8, 8, 5], 1),
                      cube([-2.5, 8.5, -2.8], [5, 6.5, 0.4], 4),
                      cube([-4.5, 15, -3], [9, 2, 6], 1),
                      cube([-3.8, 13.8, -3.1], [1.5, 2.5, 0.5], 4),
                      cube([2.3, 13.8, -3.1], [1.5, 2.5, 0.5], 4)], 'root', [0, 12, 0]),
        bone('head', [cube([-5, 16, -3.5], [10, 7.5, 7], 0, front=0)], 'body', [0, 16, 0]),
        bone('left_arm', [cube([-6.5, 8.5, -2], [2.5, 7, 4], 1),
                          cube([-6.2, 8, -2.1], [2.4, 1.5, 4.2], 0)], 'body', [-4, 15, 0]),
        bone('right_arm', [cube([4, 8.5, -2], [2.5, 7, 4], 1),
                           cube([3.8, 8, -2.1], [2.4, 1.5, 4.2], 0)], 'body', [4, 15, 0]),
        bone('legs', [cube([-3.7, 4.5, -2.4], [3.4, 4, 4.8], 2),
                      cube([0.3, 4.5, -2.4], [3.4, 4, 4.8], 2),
                      cube([-3.1, 2, -1.4], [2.2, 2.6, 2.8], 0),
                      cube([0.9, 2, -1.4], [2.2, 2.6, 2.8], 0),
                      cube([-4, 0, -3.2], [4, 2, 5.5], 4),
                      cube([0, 0, -3.2], [4, 2, 5.5], 4)], 'root'),
    ]
    save(RP / 'models/entity/sans.geo.json', geometry('geometry.pinene_sans.sans', sans_bones))
    save(RP / 'models/entity/bone.geo.json', geometry('geometry.pinene_sans.bone', [
        bone('root', [cube([-1, 2, -1], [2, 20, 2], 0),
                      cube([-2.5, 0, -1.5], [5, 3, 3], 0),
                      cube([-2.5, 21, -1.5], [5, 3, 3], 0)])], 1, 5))
    skull = [cube([-6, 0, -4], [12, 7, 9], 0, front=1),
             cube([-4.5, 5, -2], [9, 3, 7], 0),
             cube([-5, -2, -5], [10, 3, 3], 0),
             cube([-6, 5, 2], [2, 5, 3], 0), cube([4, 5, 2], [2, 5, 3], 0),
             cube([-3.5, -0.5, -4.4], [7, 2.5, 0.3], 2)]
    save(RP / 'models/entity/blaster.geo.json', geometry('geometry.pinene_sans.blaster', [
        bone('root', []), bone('skull', skull, 'root'),
        bone('jaw', [cube([-5, -4, -5], [10, 2, 8], 0),
                     *[cube([x, -2, -5], [1.5, 2, 1.5], 4) for x in [-4.5, -1.7, 1.1, 3.3]]], 'root', [0, -2, 3]),
    ], 3, 3))
    save(RP / 'entity/sans.entity.json', client('pinene_sans:sans', 'geometry.pinene_sans.sans',
                                              'animation.pinene_sans.idle', ['#268dcc', '#eeeade']))
    save(RP / 'entity/bone.entity.json', client('pinene_sans:bone', 'geometry.pinene_sans.bone',
                                              'animation.pinene_sans.bone'))
    save(RP / 'entity/blaster.entity.json', client('pinene_sans:blaster', 'geometry.pinene_sans.blaster',
                                                 'animation.pinene_sans.blaster'))
    save(RP / 'render_controllers/sans.render_controllers.json', {
        'format_version': '1.8.0', 'render_controllers': {'controller.render.pinene_sans': {
            'geometry': 'Geometry.default', 'materials': [{'*': 'Material.default'}],
            'textures': ['Texture.default']}}})
    save(RP / 'animations/sans.animation.json', {
        'format_version': '1.8.0', 'animations': {
            'animation.pinene_sans.idle': {'loop': True, 'animation_length': 2,
                'bones': {'body': {'position': [0, 'math.sin(query.life_time * 150) * 0.15', 0]},
                          'head': {'rotation': [0, 0, 'math.sin(query.life_time * 70) * 2']}}},
            'animation.pinene_sans.bone': {'loop': True, 'bones': {
                'root': {'scale': [1, "query.property('pinene_sans:height')", 1]}}},
            'animation.pinene_sans.blaster': {'loop': True, 'bones': {
                'jaw': {'rotation': ["query.property('pinene_sans:firing') ? 32 : 8", 0, 0]},
                'root': {'scale': "query.property('pinene_sans:firing') ? 1.1 : 1.0"}}},
        }})

    (RP / 'textures/particle').mkdir(parents=True, exist_ok=True)
    pixel = Image.new('RGBA', (8, 8), (255, 255, 255, 255))
    pixel.save(RP / 'textures/particle/sans_pixel.png')
    for identifier, color, size, life, count in [
        ('warning', [0.1, 0.7, 1, 0.8], 0.12, 0.3, 1),
        ('beam', [0.75, 0.95, 1, 1], 0.5, 0.15, 1),
        ('warp', [0.1, 0.75, 1, 0.8], 0.16, 0.25, 12),
    ]:
        save(RP / f'particles/{identifier}.particle.json', particle('pinene_sans:' + identifier,
                                                                  color, size, life, count))
    save(RP / 'texts/languages.json', ['en_US', 'ja_JP'])
    for locale, name in [('en_US', 'Sans'), ('ja_JP', 'サンズ')]:
        (RP / f'texts/{locale}.lang').write_text(
            f'entity.pinene_sans:sans.name={name}\nitem.spawn_egg.entity.pinene_sans:sans.name={name}のスポーンエッグ\n',
            encoding='utf-8')
    icon = Image.new('RGB', (128, 128), '#121923')
    d = ImageDraw.Draw(icon)
    d.rectangle([24, 74, 104, 124], fill='#268dcc')
    d.rectangle([48, 78, 80, 124], fill='#ffffff')
    icon.paste(atlas.crop((0, 16, 16, 32)).resize((80, 64), Image.Resampling.NEAREST), (24, 12))
    for pack in [BP, RP]: icon.save(pack / 'pack_icon.png')

    output = ROOT / 'dist/Pinene_Sans_Boss_v0.1.0.mcaddon'
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        for pack in [BP, RP]:
            for path in sorted(pack.rglob('*')):
                if path.is_file(): archive.write(path, f'Pinene_Sans_{pack.name}/{path.relative_to(pack).as_posix()}')
    print(output)

if __name__ == '__main__':
    build()

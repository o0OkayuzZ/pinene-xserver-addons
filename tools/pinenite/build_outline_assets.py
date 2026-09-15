"""Build Pinenite's additive model outlines. Run with --samples <official sample root>.

The compatibility RP snapshots effective client definitions without changing any
original pack. Original controllers stay intact; added controllers use an inflated
copy of the same bones, UVs, visibility rules and geometry selection expressions.
"""
import argparse
import copy
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'resource_packs/pinenite_outline'
UUID = 'c91096f3-71a0-4e44-9fa6-c9e359017ac7'
THICKNESS = 0.06  # model pixels, 0.00375 blocks; no collision changes
TOKEN = re.compile(r'"(?:\\.|[^"\\])*"|//[^\n]*|/\*[\s\S]*?\*/')


def read(path):
    text = path.read_text(encoding='utf-8-sig')
    text = TOKEN.sub(lambda m: m[0] if m[0].startswith('"') else '', text)
    return json.loads(re.sub(r',\s*([}\]])', r'\1', text))


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes((json.dumps(data, ensure_ascii=False, indent=2) + '\n').encode())


def name(value):
    return re.sub(r'[^a-z0-9_]', '_', value.lower())


def join_molang_sections(expressions):
    """A pre_animation entry is parsed separately; scopes cannot cross entries."""
    result, pending, depth = [], [], 0
    for expression in expressions:
        pending.append(expression)
        code = re.sub(r"'[^']*'", '', expression)
        depth += code.count('{') - code.count('}')
        if depth < 0:
            raise ValueError('Unmatched Molang closing brace')
        if depth == 0:
            result.append(' '.join(pending))
            pending = []
    if pending:
        raise ValueError('Unclosed Molang section')
    return result


def inflated(geo, identifier):
    result = copy.deepcopy(geo)
    result['description']['identifier'] = identifier
    for bone in result.get('bones', []):
        # Bone inheritance, UV transparency and animation pivots are unchanged.
        for cube in bone.get('cubes', []):
            cube['inflate'] = cube.get('inflate', bone.get('inflate', 0)) + THICKNESS
    return result


def build(samples):
    entities, geometries, controllers, living = {}, {}, {}, set()
    materials = {'version': '1.0.0'}
    versions = read(ROOT / 'world_resource_packs.json')
    packs = {read(p / 'manifest.json')['header']['uuid']: p for p in (ROOT / 'resource_packs').iterdir()
             if (p / 'manifest.json').exists() and p != OUT}
    # First world registration has highest priority. Never snapshot Zombie Gear.
    layers = [samples / 'resource_pack'] + [packs[v['pack_id']] for v in reversed(versions)
              if v['pack_id'] in packs]
    bp_layers = [samples / 'behavior_pack'] + list((ROOT / 'behavior_packs').iterdir())
    for pack in bp_layers:
        for path in sorted((pack / 'entities').rglob('*.json')):
            data = read(path).get('minecraft:entity', {})
            if 'minecraft:health' in json.dumps(data):
                living.add(data.get('description', {}).get('identifier'))
    living.add('minecraft:player')
    for pack in layers:
        material_file = pack / 'materials/entity.material'
        if material_file.exists(): materials.update(read(material_file)['materials'])
        provenance = 'Mojang/bedrock-samples@v1.26.40.05' if pack == layers[0] else pack.relative_to(ROOT).as_posix()
        layer_entities = {}
        for path in sorted((pack / 'entity').rglob('*.json')):
            data = read(path)
            desc = data.get('minecraft:client_entity', {}).get('description', {})
            if 'identifier' in desc:
                minimum = tuple(int(n) for n in desc.get('min_engine_version', '0.0.0').split('.'))
                old = layer_entities.get(desc['identifier'])
                if old is None or minimum > old[0]:
                    layer_entities[desc['identifier']] = (minimum, data, provenance + '/' + path.relative_to(pack).as_posix())
        entities.update({key: (entry[1], entry[2]) for key, entry in layer_entities.items()})
        for path in sorted((pack / 'models').rglob('*.json')):
            data = read(path)
            for geo in data.get('minecraft:geometry', []):
                geometries[geo['description']['identifier'].lower()] = geo
            for key, geo in data.items():
                if key.startswith('geometry.'):
                    desc = {k: v for k, v in geo.items() if k != 'bones'}
                    desc['identifier'] = key
                    desc['texture_width'] = desc.pop('texturewidth', 64)
                    desc['texture_height'] = desc.pop('textureheight', 32)
                    geometries[key.lower()] = {'description': desc, 'bones': geo.get('bones', [])}
        for path in sorted((pack / 'render_controllers').rglob('*.json')):
            controllers.update({k.lower(): v for k, v in read(path).get('render_controllers', {}).items()})

    output_geos, output_rc, report = {}, {}, {'source': 'cd53e576', 'samples': 'v1.26.40.05', 'entities': [], 'excluded': []}
    # This vanilla built-in pass is not exported in the official samples. The
    # added pass uses the golem's default body; the crack pass stays untouched.
    controllers.setdefault('controller.render.iron_golem', {
        'geometry': 'Geometry.default', 'materials': [{'*': 'Material.default'}], 'textures': ['Texture.default']})
    def resolve(identifier):
        key = identifier.lower()
        if key in geometries:
            return geometries[key]
        inherited = next((k for k in geometries if k.split(':')[0] == key), None)
        if inherited:
            parents = inherited.split(':')[1:]
            result = copy.deepcopy(resolve(parents[-1]))
            for parent in reversed(parents[:-1]):
                result['bones'].extend(copy.deepcopy(resolve(parent)['bones']))
            own = geometries[inherited]
            by_name = {b['name']: b for b in result['bones']}
            for bone in own['bones']:
                by_name[bone['name']] = {**by_name.get(bone['name'], {}), **copy.deepcopy(bone)}
            result['bones'] = list(by_name.values())
            result['description'].update(own['description'])
            return result
        raise ValueError('missing geometry: ' + identifier)

    for identifier, (source, provenance) in sorted(entities.items()):
        if identifier not in living:
            continue
        if '/rp_07_' in provenance or 'zombiegear' in identifier.lower():
            report['excluded'].append({'id': identifier, 'reason': 'Zombie Gear is protected'})
            continue
        data = copy.deepcopy(source)
        data['format_version'] = '1.10.0'
        desc = data['minecraft:client_entity']['description']
        compatibility_original = {key: copy.deepcopy(desc[key]) for key in ('scripts', 'animations', 'animation_controllers') if key in desc}
        if 'held_item_scale' in desc or 'hide_held_items' in desc.get('scripts', {}):
            data['format_version'] = source['format_version']
        for key in ('pre_animation', 'initialize'):
            if key in desc.get('scripts', {}):
                desc['scripts'][key] = join_molang_sections(desc['scripts'][key])
        # The official export contains both the legacy list and migrated aliases
        # for some vanilla mobs. 1.10 accepts only animations + scripts.animate.
        for entry in desc.pop('animation_controllers', []):
            for old_alias, controller in entry.items():
                animations = desc.setdefault('animations', {})
                alias = next((a for a, value in animations.items() if value == controller), None)
                if alias is None:
                    alias = 'pn_legacy_' + old_alias
                    animations[alias] = controller
                animate = desc.setdefault('scripts', {}).setdefault('animate', [])
                if not any(alias == a or isinstance(a, dict) and alias in a for a in animate): animate.append(alias)
        if identifier == 'minecraft:player':
            desc.setdefault('scripts', {}).setdefault('pre_animation', []).append(
                "variable.first_person_item_rotation_factor = math.sin((1 - variable.attack_time) * 180.0);")
            desc.setdefault('scripts', {}).setdefault('pre_animation', []).append(
                "variable.melee_spear_equipped = query.equipped_item_any_tag('slot.weapon.mainhand', 'minecraft:is_spear');")
        if identifier in ('dungeons:illusioner', 'dungeons:royal_guard'):
            desc.setdefault('animations', {}).setdefault('riding.body', 'animation.humanoid.riding.body')
        aliases, additions, local_rc, local_geos = {}, [], {}, {}
        try:
            for alias, geo_id in desc.get('geometry', {}).items():
                geo = resolve(geo_id)
                if any('poly_mesh' in bone for bone in geo.get('bones', [])):
                    raise ValueError('poly_mesh requires a separate normal-based outline')
                outline_id = 'geometry.pinenite_outline.' + name(geo_id)
                aliases[alias] = outline_id
                local_geos[outline_id] = inflated(geo, outline_id)
            if identifier == 'minecraft:player':
                slim_id = aliases['default'] + '_slim'
                slim = copy.deepcopy(local_geos[aliases['default']])
                slim['description']['identifier'] = slim_id
                for bone in slim['bones']:
                    if bone['name'].lower() in ('leftarm', 'leftsleeve', 'rightarm', 'rightsleeve'):
                        bone['pivot'][1] = 21.5
                        for cube in bone.get('cubes', []):
                            cube['size'][0] = 3
                            if bone['name'].lower().startswith('right'):
                                cube['origin'][0] += 1
                local_geos[slim_id] = slim
                aliases['slim'] = slim_id
            for index, entry in enumerate(desc.get('render_controllers', [])):
                key, condition = (entry, '1') if isinstance(entry, str) else next(iter(entry.items()))
                if identifier == 'minecraft:player' and ('first_person' in key or '.map' in key or 'spectator' in key):
                    continue
                if key.lower() not in controllers:
                    raise ValueError('missing render controller: ' + key)
                rc = copy.deepcopy(controllers[key.lower()])
                if 'geometry' not in rc:
                    continue
                def remap(value):
                    if isinstance(value, str):
                        return re.sub(r'\bgeometry\.([\w]+)', lambda m: 'Geometry.pn_outline_' + m[1], value, flags=re.I)
                    if isinstance(value, list): return [remap(v) for v in value]
                    if isinstance(value, dict): return {k: remap(v) for k, v in value.items()}
                    return value
                rc = remap(rc)
                if identifier == 'minecraft:player':
                    rc['geometry'] = '(variable.short_arm_offset_left ?? 0) == 0.5 ? Geometry.pn_outline_slim : Geometry.pn_outline_default'
                rc['materials'] = [{'*': 'Material.pn_outline'}]
                # Keep texture selection/UV animation and alpha cutouts; tint only
                # the added hull. No stencil, shader replacement or wall vision.
                rc['textures'] = rc.get('textures', ['Texture.default'])[:1]
                rc['overlay_color'] = {'r': 57 / 255, 'g': 197 / 255, 'b': 187 / 255, 'a': 1}
                rc['color'] = {'r': 1, 'g': 1, 'b': 1, 'a': 'variable.pinenite_outline ?? 0'}
                rc['ignore_lighting'] = True
                rc.pop('is_hurt_color', None)
                rc.pop('on_fire_color', None)
                rc_id = 'controller.render.pinenite_outline.' + name(identifier) + '_' + str(index)
                local_rc[rc_id] = rc
                gate = '(variable.pinenite_outline ?? 0) > 0 && query.life_time < (variable.pinenite_outline_until ?? 0)'
                additions.append({rc_id: f'({condition}) && ({gate})'})
            if not additions:
                raise ValueError('no model render pass')
        except ValueError as error:
            report['excluded'].append({'id': identifier, 'reason': str(error), 'source': provenance})
            continue
        desc.setdefault('materials', {})['pn_outline'] = 'pinenite_outline'
        if identifier == 'minecraft:player':
            desc.setdefault('scripts', {}).setdefault('variables', {}).update({
                'variable.pinenite_outline': 'public', 'variable.pinenite_outline_until': 'public'})
        desc['geometry'].update({'pn_outline_' + k: v for k, v in aliases.items()})
        desc['render_controllers'].extend(additions)
        output_geos.update(local_geos)
        output_rc.update(local_rc)
        relative = 'entity/' + name(identifier) + '.entity.json'
        write(OUT / relative, data)
        report['entities'].append({'id': identifier, 'source': provenance, 'file': relative,
                                   'sourceFormat': source['format_version'], 'compatibilityOriginal': compatibility_original,
                                   'sourceSha256': hashlib.sha256(json.dumps(source, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest(),
                                   'addedControllers': len(additions)})
    armor_rp = ROOT / 'resource_packs/rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b'
    for part in ('helmet', 'chestplate', 'leggings', 'boots'):
        data = read(armor_rp / f'attachables/deathnerite/pinenite/pinenite_{part}.json')
        desc = data['minecraft:attachable']['description']
        geo = read(armor_rp / f'models/entity/pinenite/{part}.geo.json')['minecraft:geometry'][0]
        geo_id = 'geometry.pinenite_outline.armor_' + part
        output_geos[geo_id] = inflated(geo, geo_id)
        desc['geometry']['pn_outline'] = geo_id
        desc['materials']['pn_outline'] = 'pinenite_outline'
        desc['render_controllers'] = ['controller.render.true_dn.pinenite_armor', 'controller.render.pinenite_outline.armor']
        write(OUT / f'attachables/pinenite_{part}.json', data)
    output_rc['controller.render.pinenite_outline.armor'] = {
        'geometry': 'Geometry.pn_outline', 'textures': ['Texture.default'],
        'materials': [{'*': 'Material.pn_outline'}], 'ignore_lighting': True,
        'part_visibility': [{'*': '!query.is_first_person && (variable.pinenite_outline ?? 0) > 0 && query.life_time < (variable.pinenite_outline_until ?? 0)'}],
        'overlay_color': {'r': 57 / 255, 'g': 197 / 255, 'b': 187 / 255, 'a': 1},
        'color': {'r': 1, 'g': 1, 'b': 1, 'a': 'variable.pinenite_outline ?? 0'}}
    write(OUT / 'animations/pinenite_sync.animation.json', read(armor_rp / 'animations/pinenite_sync.animation.json'))
    modern, legacy = [], {'format_version': '1.8.0'}
    for key, geo in output_geos.items():
        # Some inherited models mix legacy visibility with modern cube rotation.
        # A hidden bone still transforms its children; remove only its own cubes.
        modern_cubes = any(isinstance(c.get('uv'), dict) or 'rotation' in c or 'pivot' in c
                           for b in geo.get('bones', []) for c in b.get('cubes', []))
        if modern_cubes and any('neverRender' in b for b in geo.get('bones', [])):
            assert not any('reset' in b or 'bind_pose_rotation' in b for b in geo['bones']), key
            geo = copy.deepcopy(geo)
            for bone in geo['bones']:
                if bone.pop('neverRender', False): bone.pop('cubes', None)
        if not any(any(field in bone for field in ('neverRender', 'bind_pose_rotation', 'reset')) for bone in geo.get('bones', [])):
            modern.append(geo)
            continue
        desc = copy.deepcopy(geo['description'])
        desc.pop('identifier')
        desc['texturewidth'] = desc.pop('texture_width', 64)
        desc['textureheight'] = desc.pop('texture_height', 32)
        legacy[key] = {**desc, 'bones': geo.get('bones', [])}
    write(OUT / 'models/entity/pinenite_outline.geo.json', {'format_version': '1.21.0', 'minecraft:geometry': modern})
    write(OUT / 'models/entity/pinenite_outline_legacy.geo.json', legacy)
    write(OUT / 'render_controllers/pinenite_outline.json', {'format_version': '1.8.0', 'render_controllers': output_rc})
    materials['pinenite_outline:entity_alphatest'] = {
        '+states': ['InvertCulling', 'Blending'], '-states': ['DisableCulling'], '+defines': ['USE_OVERLAY']}
    # Bedrock loads entity materials from this catalog path. Preserve every
    # lower-pack entry when adding ours so custom Dungeons materials still work.
    write(OUT / 'materials/entity.material', {'materials': materials})
    write(OUT / 'materials/pinenite_outline.material', {'materials': {'version': '1.0.0'}})
    write(OUT / 'manifest.json', {'format_version': 2, 'header': {
        'name': 'Pinenite Model Outlines', 'description': 'Additive model outlines for Pinenite adaptation and symbiosis.',
        'uuid': UUID, 'version': [1, 0, 2], 'min_engine_version': [1, 26, 40]},
        'modules': [{'type': 'resources', 'uuid': '7f8a080c-bbb5-4d36-84fd-8b5f6920761f', 'version': [1, 0, 2]}]})
    (OUT / 'VANILLA_LICENSE.md').write_bytes((samples / 'LICENSE.md').read_bytes())
    write(ROOT / 'docs/pinenite/outline_coverage.json', report)
    print(json.dumps({'supported': len(report['entities']), 'excluded': report['excluded'], 'geometries': len(output_geos)}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--samples', type=Path, required=True)
    build(parser.parse_args().samples)

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const read = p => JSON.parse(readFileSync(root + p, 'utf8').replace(/^\uFEFF/, ''));
const pack = 'resource_packs/pinenite_outline/';
const coverage = read('docs/pinenite/outline_coverage.json');
const geometries = read(pack + 'models/entity/pinenite_outline.geo.json')['minecraft:geometry'];
const controllers = read(pack + 'render_controllers/pinenite_outline.json').render_controllers;
const sorted = value => Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(k => [k, sorted(value[k])])) : value;
test('all compatibility entities retain the full original client definition', () => {
    assert.ok(coverage.entities.length > 200);
    for (const entry of coverage.entities) {
        const data = read(pack + entry.file), desc = data['minecraft:client_entity'].description;
        delete desc.materials.pn_outline;
        for (const key of Object.keys(desc.geometry)) if (key.startsWith('pn_outline_')) delete desc.geometry[key];
        desc.render_controllers.splice(-entry.addedControllers);
        data.format_version = entry.sourceFormat;
        for (const key of ['scripts', 'animations', 'animation_controllers']) {
            delete desc[key];
            if (entry.compatibilityOriginal[key] !== undefined) desc[key] = entry.compatibilityOriginal[key];
        }
        const hash = createHash('sha256').update(JSON.stringify(sorted(data))).digest('hex');
        assert.equal(hash, entry.sourceSha256, entry.id);
    }
});
test('outline geometry aliases and render passes resolve, including small variants and player', () => {
    const legacy = read(pack + 'models/entity/pinenite_outline_legacy.geo.json');
    const ids = new Set([...geometries.map(g => g.description.identifier.toLowerCase()), ...Object.keys(legacy).filter(k => k.startsWith('geometry.'))]);
    for (const entry of coverage.entities) {
        const desc = read(pack + entry.file)['minecraft:client_entity'].description;
        const aliases = new Set(Object.keys(desc.geometry).map(k => k.toLowerCase()));
        for (const [alias, id] of Object.entries(desc.geometry))
            if (alias.startsWith('pn_outline_')) assert.ok(ids.has(id.toLowerCase()), id);
        for (const addition of desc.render_controllers.slice(-entry.addedControllers)) {
            const [key, gate] = Object.entries(addition)[0];
            assert.ok(controllers[key], key); assert.match(gate, /pinenite_outline_until/);
            const rc = controllers[key];
            for (const match of JSON.stringify(rc).matchAll(/\bGeometry\.([\w]+)/gi))
                assert.ok(aliases.has(match[1].toLowerCase()), entry.id + ': ' + match[0]);
            assert.equal(rc.ignore_lighting, true);
            assert.deepEqual(rc.overlay_color, { r: 57 / 255, g: 197 / 255, b: 187 / 255, a: 1 });
        }
    }
    for (const id of ['minecraft:player', 'minecraft:zombie', 'minecraft:creeper', 'minecraft:spider', 'minecraft:ender_dragon'])
        assert.ok(coverage.entities.some(e => e.id === id), id);
});
test('wearer armor outline includes every original cube with identical bones and UVs', () => {
    for (const part of ['helmet', 'chestplate', 'leggings', 'boots']) {
        const original = read(`resource_packs/rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b/models/entity/pinenite/${part}.geo.json`)['minecraft:geometry'][0];
        const actual = geometries.find(g => g.description.identifier === 'geometry.pinenite_outline.armor_' + part);
        const expected = structuredClone(original);
        expected.description.identifier = actual.description.identifier;
        for (const bone of expected.bones) for (const cube of bone.cubes ?? []) cube.inflate = (cube.inflate ?? bone.inflate ?? 0) + .06;
        assert.deepEqual(actual, expected);
    }
});
test('all Zombie Gear files remain unchanged', () => {
    const changed = execFileSync('git', ['diff', '--name-only', 'cd53e576'], { cwd: root, encoding: 'utf8' }).trim().split('\n');
    assert.deepEqual(changed.filter(p => /bp_09_|rp_07_|zombiegear/i.test(p)), []);
    assert.ok(!coverage.entities.some(e => e.source.includes('/rp_07_')));
});
test('outline material retains depth testing and texture alpha, with no global material override', () => {
    const material = read(pack + 'materials/entity.material').materials;
    assert.ok(material['entity_static']);
    assert.ok(material['dungeons_glowing:entity_nocull']);
    const def = material['pinenite_outline:entity_alphatest'];
    assert.ok(def['+states'].includes('InvertCulling'));
    assert.equal(def.depthFunc, undefined);
    assert.ok(!JSON.stringify(def).includes('Stencil'));
});

test('client schema supports conditional render passes and contains no obsolete controller list', () => {
    for (const entry of coverage.entities) {
        const data = read(pack + entry.file), desc = data['minecraft:client_entity'].description;
        assert.equal(data.format_version, '1.10.0', entry.id);
        assert.equal(desc.animation_controllers, undefined, entry.id);
        for (const previous of entry.compatibilityOriginal.animation_controllers ?? [])
            for (const controller of Object.values(previous)) {
                const alias = Object.keys(desc.animations).find(k => desc.animations[k] === controller);
                assert.ok(alias, controller);
                assert.ok(desc.scripts.animate.some(a => a === alias || typeof a === 'object' && alias in a), alias);
            }
    }
});
test('legacy-only bone fields are never emitted in modern geometry', () => {
    for (const geo of geometries) for (const bone of geo.bones ?? [])
        for (const field of ['neverRender', 'bind_pose_rotation', 'reset'])
            assert.equal(bone[field], undefined, geo.description.identifier + ': ' + field);
    const legacy = read(pack + 'models/entity/pinenite_outline_legacy.geo.json');
    assert.equal(legacy.format_version, '1.8.0');
    assert.ok(Object.values(legacy).some(g => g.bones?.some(b => b.neverRender)));
});
test('sync animation omits the invalid empty bones object in both active packs', () => {
    for (const rp of [pack, 'resource_packs/rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b/']) {
        const animation = read(rp + 'animations/pinenite_sync.animation.json').animations['animation.true_dn.pinenite_sync'];
        assert.equal(animation.bones, undefined);
        assert.ok(animation.animation_length > 0);
    }
});
test('player initializes the spear flag used by the loaded root animation controller', () => {
    const desc = read(pack + 'entity/minecraft_player.entity.json')['minecraft:client_entity'].description;
    assert.ok(desc.scripts.pre_animation.some(s => /variable.melee_spear_equipped\s*=\s*query.equipped_item_any_tag/.test(s)));
});

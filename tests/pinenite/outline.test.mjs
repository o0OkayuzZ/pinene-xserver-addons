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
        if (entry.id === 'minecraft:player') {
            delete desc.scripts.variables['variable.pinenite_outline'];
            delete desc.scripts.variables['variable.pinenite_outline_until'];
        }
        const hash = createHash('sha256').update(JSON.stringify(sorted(data))).digest('hex');
        assert.equal(hash, entry.sourceSha256, entry.id);
    }
});
test('outline geometry aliases and render passes resolve, including small variants and player', () => {
    const ids = new Set(geometries.map(g => g.description.identifier.toLowerCase()));
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
test('existing RP assets and all Zombie Gear files remain unchanged', () => {
    const changed = execFileSync('git', ['diff', '--name-only', 'cd53e576'], { cwd: root, encoding: 'utf8' }).trim().split('\n');
    assert.deepEqual(changed.filter(p => p.startsWith('resource_packs/') && !p.startsWith(pack)), []);
    assert.deepEqual(changed.filter(p => /bp_06_|rp_07_|zombiegear/i.test(p)), []);
    assert.ok(!coverage.entities.some(e => e.source.includes('/rp_07_')));
});
test('outline material retains depth testing and texture alpha, with no global material override', () => {
    const material = read(pack + 'materials/pinenite_outline.material').materials;
    assert.deepEqual(Object.keys(material).sort(), ['pinenite_outline:entity_alphatest', 'version']);
    const def = material['pinenite_outline:entity_alphatest'];
    assert.ok(def['+states'].includes('InvertCulling'));
    assert.equal(def.depthFunc, undefined);
    assert.ok(!JSON.stringify(def).includes('Stencil'));
});

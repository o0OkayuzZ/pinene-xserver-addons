import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const rp = 'resource_packs/rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b/';
const outline = 'resource_packs/pinenite_outline/';
const desc = p => read(p)['minecraft:client_entity'].description;

test('ordinary creeper compatibility preserves the installed addon model and charged appearance', () => {
    const source = desc(rp + 'entity/vanilla/creeper.entity.json');
    const actual = desc(outline + 'entity/minecraft_creeper.entity.json');
    assert.deepEqual(actual.textures, source.textures);
    assert.equal(actual.geometry.default, source.geometry.default);
    assert.deepEqual(actual.animations, source.animations);
    assert.deepEqual(actual.scripts, source.scripts);
    assert.deepEqual(actual.render_controllers.slice(0, 2), source.render_controllers);
    assert.equal(actual.materials.enchanted, source.materials.enchanted);
});

test('ordinary and charged creeper passes resolve every material, texture and geometry alias', () => {
    const actual = desc(outline + 'entity/minecraft_creeper.entity.json');
    const controllers = {
        ...read(rp + 'render_controllers/creeper.rc.json').render_controllers,
        ...read(rp + 'render_controllers/creeper_charged.rc.json').render_controllers,
        ...read(outline + 'render_controllers/pinenite_outline.json').render_controllers,
    };
    for (const entry of actual.render_controllers) {
        const id = typeof entry === 'string' ? entry : Object.keys(entry)[0];
        assert.ok(controllers[id], id);
        for (const match of JSON.stringify(controllers[id]).matchAll(/\b(Geometry|Material|Texture)\.([\w]+)/gi)) {
            const aliases = actual[{geometry: 'geometry', material: 'materials', texture: 'textures'}[match[1].toLowerCase()]];
            assert.ok(Object.keys(aliases).some(key => key.toLowerCase() === match[2].toLowerCase()), `${id}: ${match[0]}`);
        }
    }
    const geometries = read(outline + 'models/entity/pinenite_outline.geo.json')['minecraft:geometry'];
    const hull = geometries.find(g => g.description.identifier === actual.geometry.pn_outline_default);
    const source = read(rp + 'models/entity/icy_creeper.geo.json')['minecraft:geometry'][0];
    assert.deepEqual(hull.bones.map(b => [b.name, b.pivot]), source.bones.map(b => [b.name, b.pivot]));
});

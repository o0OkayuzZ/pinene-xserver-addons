import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const rp = 'resource_packs/rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b/';
const outline = 'resource_packs/pinenite_outline/';
const desc = p => read(p)['minecraft:client_entity'].description;

test('normal creeper uses the exact current vanilla image and its matching material map', () => {
    const proof = read('docs/pinenite/creeper_vanilla_assets.json');
    assert.equal(proof.tag, 'v1.26.50.4');
    const directory = outline + 'textures/entity/creeper/';
    for (const [name, hash] of Object.entries(proof.files))
        assert.equal(createHash('sha256').update(readFileSync(new URL(directory + name, root))).digest('hex'), hash, name);
    assert.equal(proof.files['creeper.png'], 'de7cb032dc9a81732535c66aaf55dba03e29a4463219403d6d9573018191790a');
    const latest = readFileSync(new URL(directory + 'creeper.png', root));
    const addon = readFileSync(new URL(rp + 'textures/entity/creeper/creeper.png', root));
    assert.notDeepEqual(latest, addon, 'the old lower-pack texture must be overridden');
    assert.equal(desc(outline + 'entity/minecraft_creeper.entity.json').textures.default, 'textures/entity/creeper/creeper');
    const material = read(directory + 'creeper.texture_set.json')['minecraft:texture_set'];
    assert.equal(material.color, 'creeper');
    assert.equal(material.metalness_emissive_roughness_subsurface, 'creeper_mers');
    const map = readFileSync(new URL(directory + 'creeper_mers.tga', root));
    assert.equal(map.readUInt16LE(12), latest.readUInt32BE(16));
    assert.equal(map.readUInt16LE(14), latest.readUInt32BE(20));
});

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

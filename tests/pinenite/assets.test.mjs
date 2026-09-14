import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const bp = 'behavior_packs/bp_05_90f045c3-0718-4981-a1ff-180976002a93';
const rp = 'resource_packs/rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b';
const base = '196d0921f74dabf52f5692d5cb5251c1a733c13d';
const parts = ['helmet', 'chestplate', 'leggings', 'boots'];
const read = p => JSON.parse(readFileSync(root + p, 'utf8').replace(/^\uFEFF/, ''));
const git = (...args) => execFileSync('git', args, { cwd: root });
test('all armor values and complete Parcanite components inherited, IDs preserved', () => {
    parts.forEach((part, i) => {
        const item = read(`${bp}/items/Deathnerite-Add-On/pinenite/armor/pinenite_${part}.json`)['minecraft:item'];
        const inherited = read(`${bp}/items/Deathnerite-Add-On/parcanite/armor/parcanite_${part}.json`)['minecraft:item'].components;
        assert.equal(item.description.identifier, `true_dn:pinenite_${part}`);
        assert.equal(item.components['minecraft:wearable'].protection, [8, 14, 11, 8][i]);
        for (const [key, value] of Object.entries(inherited))
            if (!['minecraft:icon', 'minecraft:wearable'].includes(key)) assert.deepEqual(item.components[key], value);
    });
});
test('original four geometries and eight PNGs preserved against investigated main', () => {
    for (const part of parts) {
        const geo = `${rp}/models/entity/pinenite/${part}.geo.json`;
        assert.deepEqual(read(geo), JSON.parse(git('show', `${base}:${geo}`).toString()));
        for (const folder of ['items', 'models/armor']) {
            const png = `${rp}/textures/${folder}/pinenite_${part}.png`;
            assert.deepEqual(readFileSync(root + png), git('show', `${base}:${png}`));
        }
    }
});
test('glow is additive core/crystal subset with original UVs, pivots and textures', () => {
    const labels = read('docs/pinenite/design/cube_labels.json');
    for (const part of parts) {
        const baseGeo = read(`${rp}/models/entity/pinenite/${part}.geo.json`)['minecraft:geometry'][0];
        const glow = read(`${rp}/models/entity/pinenite/${part}_glow.geo.json`)['minecraft:geometry'][0];
        assert.equal(glow.description.identifier, baseGeo.description.identifier + '_glow');
        let count = 0;
        for (const bone of glow.bones) {
            const original = baseGeo.bones.find(b => b.name === bone.name);
            assert.deepEqual(bone.pivot, original.pivot);
            const entries = labels[part].filter(l => l.bone === bone.name);
            const expected = original.cubes.filter((_, i) => ['core', 'crystal'].includes(entries[i].material))
                .map(c => ({ ...c, inflate: .005 }));
            assert.deepEqual(bone.cubes, expected); count += expected.length;
        }
        assert.ok(count > 0);
        const attach = read(`${rp}/attachables/deathnerite/pinenite/pinenite_${part}.json`)['minecraft:attachable'].description;
        assert.equal(attach.geometry.default, baseGeo.description.identifier);
        assert.equal(attach.geometry.glow, glow.description.identifier);
    }
});
test('original packs are preserved; entity additions belong only to the approved outline RP', () => {
    const particle = read(`${rp}/particles/pinenite_frame.particle.json`).particle_effect;
    assert.equal(particle.description.identifier, 'true_dn:pinenite_frame');
    assert.equal(particle.components['minecraft:particle_lifetime_expression'].max_lifetime, .12);
    assert.ok(read(`${rp}/animations/pinenite_sync.animation.json`).animations['animation.true_dn.pinenite_sync']);
    const changes = git('diff', '--name-only', 'cd53e576').toString().trim().split('\n').filter(p => !p.startsWith('resource_packs/pinenite_outline/'));
    assert.equal(changes.some(p => /^(behavior_packs\/[^/]+\/entities|resource_packs\/[^/]+\/entity)\//.test(p) || /zombie/i.test(p)), false);
    const added = git('ls-files', '--others', '--exclude-standard').toString().split('\n');
    assert.equal(added.some(p => !p.startsWith('resource_packs/pinenite_outline/') && /\/(?:entities|entity)\/.*\.entity\.json$/.test(p)), false);
});
test('BP requires stable 2.6.0 and 26.40; original API consumers and shared renderer untouched', () => {
    const manifest = read(`${bp}/manifest.json`);
    assert.equal(manifest.dependencies.find(d => d.module_name === '@minecraft/server').version, '2.6.0');
    assert.deepEqual(manifest.header.min_engine_version, [1, 26, 40]);
    const changes = git('diff', '--name-only', base).toString().trim().split('\n');
    assert.equal(changes.some(p => p.startsWith(bp + '/scripts/') && p !== `${bp}/scripts/main.js` && !p.startsWith(`${bp}/scripts/pinenite/`)), false);
    const renderer = read(`${rp}/render_controllers/pinenite.render_controllers.json`).render_controllers;
    const original = JSON.parse(git('show', `${base}:${rp}/render_controllers/pinenite.render_controllers.json`).toString()).render_controllers;
    assert.deepEqual(renderer['controller.render.true_dn.pinenite_armor'], original['controller.render.true_dn.pinenite_armor']);
});

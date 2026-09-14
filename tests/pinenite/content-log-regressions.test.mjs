import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const root = new URL('../../', import.meta.url);
const text = p => readFileSync(new URL(p, root), 'utf8');
const read = p => JSON.parse(text(p).replace(/^\uFEFF/, ''));
const rp = 'resource_packs/rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b/';
const pine = 'behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/';

test('Dungeons crossbow controller resolves every model, material and texture alias', () => {
    const name = 'controller.render.pinenite_compat.dungeons_crossbow';
    const controller = read(rp + 'render_controllers/pinenite_compat_crossbow.json').render_controllers[name];
    for (const file of ['crossbow_harp', 'crossbow_harp_lightning', 'crossbow_scatter', 'dualcrossbow', 'dualcrossbow_baby', 'dualcrossbow_spellbound']) {
        const desc = read(rp + `attachables/ranged/${file}.json`)['minecraft:attachable'].description;
        assert.deepEqual(desc.render_controllers, [name]);
        for (const [, kind, alias] of JSON.stringify(controller).matchAll(/\b(Geometry|Texture|Material)\.([\w]+)/g))
            assert.ok(desc[{Geometry:'geometry',Texture:'textures',Material:'materials'}[kind]][alias], `${file}: ${kind}.${alias}`);
    }
});

test('both blue diamond recipes have unlock conditions without changing their output', () => {
    for (const name of ['blue_diamond_apple', 'enchanted_blue_diamond_apple']) {
        const recipe = read(pine + `recipes/${name}.recipe.json`)['minecraft:recipe_shaped'];
        assert.ok(recipe.unlock.length > 0);
        assert.equal(recipe.result.item, 'myname:' + name);
    }
});

test('all native Pine CDs participate in the music-disc recipe tag', () => {
    const folder = 'behavior_packs/bp_04_b29dadb1-6c0e-42f6-a56e-f52e01dff8e9/items/';
    const files = readdirSync(new URL(folder, root)).filter(p => /^compat_pinecd_cd_.*\.item.json$/.test(p));
    assert.equal(files.length, 19);
    for (const file of files) assert.ok(read(folder + file)['minecraft:item'].components['minecraft:tags'].tags.includes('minecraft:music_disc'));
    for (const file of ['onso_from_all_cds_any_mix_shapeless', 'onso_from_all_cds_shaped', 'onso_from_all_cds_tag']) {
        const tags = [...text(pine + `recipes/onso/${file}.recipe.json`).matchAll(/"tag"\s*:\s*"([^"]+)"/g)].map(m => m[1]);
        assert.ok(tags.length > 0);
        assert.ok(tags.every(t => t === 'minecraft:music_disc'));
    }
});

test('effect events for unloaded players never read dynamic properties', () => {
    const code = text('behavior_packs/bp_02_ef6e99cf-077d-4b55-9e11-f86bb9e66880/scripts/golden_foods/main.js').replace(/^import .*;\r?\n/gm, '');
    let onEffect;
    const noop = {subscribe(){}};
    runInNewContext(code, {
        system:{beforeEvents:{startup:noop}},
        world:{beforeEvents:{effectAdd:{subscribe(fn){onEffect=fn;}}},afterEvents:{playerLeave:noop},getAbsoluteTime(){return 0;}},
        counterState(){throw Error('Invalid entity must never reach property access');},
        console:{warn(){throw Error('Unexpected warning');}}
    });
    onEffect({entity:{isValid:false,get typeId(){throw Error('Unloaded entity');}}});
});

test('figure pickup calls the active tag helper, not the removed raid prototype', () => {
    const code = text(pine + 'scripts/main.js').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/\bsafeHasTag\s*\(/.test(code));
    assert.match(code, /function pineHasTag\s*\(/);
    assert.match(code, /pineHasTag\(entity, PICKUP_MARKER_TAG\)/);
});

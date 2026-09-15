import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'));

test('parcanite sword uses native hand animation with its authored icon and damage', () => {
    const item = read('behavior_packs/bp_05_90f045c3-0718-4981-a1ff-180976002a93/items/Deathnerite-Add-On/parcanite/tools/parcanite_sword.json')['minecraft:item'];
    assert.equal(item.components['minecraft:hand_equipped'], true);
    assert.equal(item.components['minecraft:damage'], 11);
    assert.equal(item.components['minecraft:icon'].textures.default, 'parcanite_sword');
    for (const pack of ['rp_02_3d6a685e-83f1-4a8a-b6a6-27d8d9a3db7a', 'rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b']) {
        assert.equal(existsSync(new URL(`resource_packs/${pack}/attachables/deathnerite/parcanite/tools/parcanite_sword.json`, root)), false);
        assert.ok(existsSync(new URL(`resource_packs/${pack}/textures/items/parcanite_sword.png`, root)));
    }
});

test('player outline supplies both legacy and current first person swing factors', () => {
    const scripts = read('resource_packs/pinenite_outline/entity/minecraft_player.entity.json')['minecraft:client_entity'].description.scripts;
    for (const name of ['first_person_rotation_factor', 'first_person_item_rotation_factor']) {
        assert.ok(scripts.pre_animation.includes(`variable.${name} = math.sin((1 - variable.attack_time) * 180.0);`));
    }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const read = p => JSON.parse(readFileSync(root + p, 'utf8').replace(/^\uFEFF/, '')
  .replace(/("(?:\\.|[^"\\])*"\s*)|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (_, quoted) => quoted ?? '')
  .replace(/,\s*([}\]])/g, '$1'));
const outline = 'resource_packs/pinenite_outline/';

test('each Molang expression has complete scopes and preserves original statements', () => {
  const coverage = read('docs/pinenite/outline_coverage.json');
  for (const entry of coverage.entities) {
    const desc = read(outline + entry.file)['minecraft:client_entity'].description;
    for (const key of ['pre_animation', 'initialize']) {
      for (const expression of desc.scripts?.[key] ?? []) {
        let depth = 0;
        for (const c of expression.replace(/'[^']*'/g, '')) {
          if (c === '{') depth++;
          if (c === '}') depth--;
          assert.ok(depth >= 0, entry.id + ': ' + expression);
        }
        assert.equal(depth, 0, entry.id + ': ' + expression);
      }
      const original = entry.compatibilityOriginal.scripts?.[key];
      if (original?.some(s => s.includes('{'))) {
        assert.equal(desc.scripts[key].join('').replace(/\s/g, ''), original.join('').replace(/\s/g, ''), entry.id);
      }
    }
  }
});

test('invisible repair vault has resolving render and geometry references', () => {
  const pack = 'resource_packs/rp_20_ef57c45f-1b60-42a3-8d26-4998db1b5055/';
  const desc = read(pack + 'entity/repair_vault.entity.json')['minecraft:client_entity'].description;
  const controllers = read(pack + 'render_controllers/repair_vault.render_controllers.json').render_controllers;
  const geometries = read(pack + 'models/entity/repair_vault.geo.json')['minecraft:geometry'];
  assert.ok(desc.render_controllers.length);
  for (const name of desc.render_controllers) assert.ok(controllers[name]);
  const geo = geometries.find(g => g.description.identifier === desc.geometry.default);
  assert.ok(geo);
  assert.equal(geo.bones.reduce((n, b) => n + (b.cubes?.length ?? 0), 0), 0);
});

test('normal block sounds and monstrosity reload resolve', () => {
  const sounds = read(outline + 'sounds.json').block_sounds.normal;
  assert.equal(sounds.events.break.sound, 'dig.stone');
  assert.equal(sounds.events.place.sound, 'place.stone');
  const pack = 'resource_packs/rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b/';
  const reload = read(pack + 'sounds/sound_definitions.json').sound_definitions['mob.monstrosity.reload'];
  for (const sound of reload.sounds) assert.ok(existsSync(root + pack + (typeof sound === 'string' ? sound : sound.name) + '.ogg'));
});

test('all Mycology item icons and appraiser model assets exist', () => {
  const pack = 'resource_packs/rp_02_3d6a685e-83f1-4a8a-b6a6-27d8d9a3db7a/';
  const icons = Object.entries(read(pack + 'textures/item_texture.json').texture_data).filter(([k]) => k.startsWith('pinene_myco_'));
  assert.equal(icons.length, 36);
  for (const [, icon] of icons) assert.ok(existsSync(root + pack + icon.textures + '.png'), icon.textures);
  const desc = read(pack + 'entity/mushroom_appraiser.entity.json')['minecraft:client_entity'].description;
  const geos = read(pack + 'models/entity/mushroom_appraiser.geo.json')['minecraft:geometry'];
  assert.ok(geos.some(g => g.description.identifier === desc.geometry.default));
  assert.ok(existsSync(root + pack + desc.textures.default + '.png'));
});

test('dragon relic uses its modern block material without a legacy texture override', () => {
  const legacy = read('resource_packs/rp_20_ef57c45f-1b60-42a3-8d26-4998db1b5055/blocks.json')['pinene_pvp:dragon_relic_block'];
  const block = read('behavior_packs/bp_17_c65bcd04-4708-4716-86bf-bbd6ab936fd3/blocks/dragon_relic.block.json')['minecraft:block'];
  assert.equal(legacy.sound, 'amethyst_block');
  assert.ok(!Object.hasOwn(legacy, 'textures'));
  assert.equal(block.components['minecraft:material_instances']['*'].texture, 'pinene_pvp_dragon_relic_anchor');
});

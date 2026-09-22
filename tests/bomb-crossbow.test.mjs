import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BP = path.join(ROOT, "behavior_packs/bp_09_7c8ac348-47ad-4f71-8503-dc40a6f813f1");
const RP = path.join(ROOT, "resource_packs/rp_07_4ab7ea5c-8d31-44e6-b3d6-42cc32ad2f10");

const json = (p) => JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));

test("Bomb Crossbow item uses only dedicated bomb bolts", () => {
  const item = json(path.join(BP, "items/bomb_crossbow.item.json"))["minecraft:item"];
  assert.equal(item.description.identifier, "pinene:bomb_crossbow");
  assert.equal(item.components["minecraft:durability"].max_durability, 465);
  assert.equal(item.components["minecraft:shooter"].max_draw_duration, 1.8);
  assert.deepEqual(
    item.components["minecraft:shooter"].ammunition.map((x) => x.item),
    ["pinene:bomb_bolt"]
  );
});

test("Bomb bolt projectile and recipes keep v0.1 balance contract", () => {
  const ammo = json(path.join(BP, "items/bomb_bolt.item.json"))["minecraft:item"];
  assert.equal(ammo.components["minecraft:projectile"].projectile_entity, "pinene:bomb_bolt_projectile");
  assert.equal(ammo.components["minecraft:max_stack_size"], 16);

  const projectile = json(path.join(BP, "entities/bomb_bolt.entity.json"))["minecraft:entity"];
  assert.equal(projectile.description.identifier, "pinene:bomb_bolt_projectile");
  assert.equal(projectile.components["minecraft:projectile"].on_hit.impact_damage.damage, 6);

  const boltRecipe = json(path.join(BP, "recipes/bomb_bolt.recipe.json"))["minecraft:recipe_shaped"];
  assert.deepEqual(boltRecipe.pattern, [" A ", "ATA", " A "]);
  assert.equal(boltRecipe.result.count, 4);

  const crossbowRecipe = json(path.join(BP, "recipes/bomb_crossbow.recipe.json"))["minecraft:recipe_shaped"];
  assert.equal(crossbowRecipe.result.item, "pinene:bomb_crossbow");
  assert.equal(crossbowRecipe.key.T.item, "minecraft:tnt");
});

test("Bomb blast is entity-only and respects PvP setting", () => {
  const source = fs.readFileSync(path.join(BP, "scripts/bomb_crossbow.js"), "utf8");
  assert.match(source, /EXPLOSION_RADIUS = 4/);
  assert.match(source, /MAX_EXPLOSION_DAMAGE = 12/);
  assert.match(source, /MIN_EXPLOSION_DAMAGE = 4/);
  assert.match(source, /world\.gameRules\.pvp === false/);
  assert.doesNotMatch(source, /createExplosion/);
});

test("RP registration reuses System Crossbow visuals without duplicating textures", () => {
  const atlas = json(path.join(RP, "textures/item_texture.json")).texture_data;
  assert.equal(atlas.bomb_crossbow.textures, "textures/items/explosive_crossbow_standby");
  assert.equal(atlas.bomb_bolt.textures, "textures/items/arrow/tnt_arrow");

  const attachable = json(path.join(RP, "attachables/crossbow/bomb_crossbow.json"))["minecraft:attachable"];
  assert.equal(attachable.description.identifier, "pinene:bomb_crossbow");

  const client = json(path.join(RP, "entity/bomb_bolt.json"))["minecraft:client_entity"];
  assert.equal(client.description.identifier, "pinene:bomb_bolt_projectile");
});

test("Bomb Crossbow pack versions and dependency stay synchronized", () => {
  const bp = json(path.join(BP, "manifest.json"));
  const rp = json(path.join(RP, "manifest.json"));
  assert.deepEqual(bp.header.version, [1, 2, 11]);
  assert.deepEqual(rp.header.version, [1, 2, 12]);
  const dep = rp.dependencies.find((x) => x.uuid === bp.header.uuid);
  assert.deepEqual(dep.version, bp.header.version);
});

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const bp = resolve(here, "..");
const repo = resolve(bp, "..", "..");
const rp = join(repo, "resource_packs", "rp_19_c6529ee0-0a34-4f28-b5ff-66d335fee9bc");

const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const texture = join(rp, "textures", "entity", "infinite_castle_fine_background_v1.png");

test("legacy sky backdrop runtime and client assets are restored as one coherent stack", () => {
  const main = readFileSync(join(bp, "scripts", "main.js"), "utf8");
  assert.match(main, /castleSkyBackdrop\.js/);

  for (const p of [
    join(bp, "entities", "sky_backdrop.json"),
    join(bp, "scripts", "infinite_castle", "castleSkyBackdrop.js"),
    join(rp, "entity", "sky_backdrop.entity.json"),
    join(rp, "models", "entity", "sky_backdrop.geo.json"),
    join(rp, "render_controllers", "sky_backdrop.render_controllers.json"),
    texture,
  ]) assert.ok(existsSync(p), p);

  const client = json(join(rp, "entity", "sky_backdrop.entity.json"))["minecraft:client_entity"].description;
  assert.equal(client.identifier, "infinite_castle:sky_backdrop");
  assert.equal(client.textures.default, "textures/entity/infinite_castle_fine_background_v1");
  assert.equal(client.geometry.default, "geometry.infinite_castle_sky");
  assert.ok(client.render_controllers.includes("controller.render.infinite_castle_sky"));
});

test("restored backdrop is the exact refined 4096 atlas recovered from production", () => {
  const data = readFileSync(texture);
  assert.equal(data.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(data.readUInt32BE(16), 4096);
  assert.equal(data.readUInt32BE(20), 4096);
  assert.equal(createHash("sha256").update(data).digest("hex"),
    "45296bc513d146389bacc2bb02f409bb4df27a3bffceb0c66622f07a34914c28");
});

test("Infinite Castle BP/RP version registrations match restored backdrop release", () => {
  const bpManifest = json(join(bp, "manifest.json"));
  const rpManifest = json(join(rp, "manifest.json"));
  assert.deepEqual(bpManifest.header.version, [0, 2, 17]);
  assert.deepEqual(rpManifest.header.version, [0, 1, 9]);
  const dep = bpManifest.dependencies.find((x) => x.uuid === rpManifest.header.uuid);
  assert.deepEqual(dep.version, [0, 1, 9]);

  for (const [rel, id, version] of [
    ["world_behavior_packs.json", bpManifest.header.uuid, [0, 2, 17]],
    [join("worlds", "Bedrock level", "world_behavior_packs.json"), bpManifest.header.uuid, [0, 2, 17]],
    ["world_resource_packs.json", rpManifest.header.uuid, [0, 1, 9]],
    [join("worlds", "Bedrock level", "world_resource_packs.json"), rpManifest.header.uuid, [0, 1, 9]],
  ]) {
    const rows = json(join(repo, rel));
    assert.deepEqual(rows.find((x) => x.pack_id === id)?.version, version, rel);
  }
});

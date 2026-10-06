import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const pack = resolve(here, "..");
const repo = resolve(pack, "..", "..");
const source = readFileSync(join(pack, "scripts", "infinite_castle", "castleBackgroundRestore.js"), "utf8");

test("background restore uses a fresh one-time key and keeps a manual force path", () => {
  assert.match(source, /background_restore_20261007_v2/);
  assert.doesNotMatch(source, /background_restore_20260927_v1/);
  assert.match(source, /infinite_castle:restore_background/);
  assert.match(source, /tryRestoreCastleBackground\(player, \{ force: true \}\)/);
  assert.match(source, /\(!force && restoreComplete\(\)\)/);
});

test("Infinite Castle BP version is synchronized to the current backdrop release", () => {
  const manifest = JSON.parse(readFileSync(join(pack, "manifest.json"), "utf8"));
  assert.deepEqual(manifest.header.version, [0, 2, 17]);
  for (const module of manifest.modules) assert.deepEqual(module.version, [0, 2, 17]);

  for (const rel of [
    "world_behavior_packs.json",
    join("worlds", "Bedrock level", "world_behavior_packs.json"),
  ]) {
    const rows = JSON.parse(readFileSync(join(repo, rel), "utf8"));
    const row = rows.find((x) => x.pack_id === manifest.header.uuid);
    assert.ok(row, rel);
    assert.deepEqual(row.version, [0, 2, 17], rel);
  }
});

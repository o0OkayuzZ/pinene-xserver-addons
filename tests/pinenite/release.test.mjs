import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const tool = fileURLToPath(new URL('../../tools/apply_addon_release.py', import.meta.url));
for (const badVersion of [false, true]) test(`release preflight handles a new RP (${badVersion ? 'rejects mismatched registration' : 'validates without writes'})`, () => {
    const temp = mkdtempSync(join(tmpdir(), 'pinenite-release-test-'));
    try {
        const root = join(temp, 'world'), stage = join(temp, 'stage');
        mkdirSync(root); mkdirSync(join(stage, 'files/resource_packs/new'), { recursive: true });
        for (const name of ['world_behavior_packs.json', 'world_resource_packs.json']) writeFileSync(join(root, name), '[]');
        const rel = 'resource_packs/new/manifest.json';
        const bytes = Buffer.from(JSON.stringify({ header: { uuid: 'new', name: 'Test', version: [1, 0, 0] } }));
        writeFileSync(join(stage, 'files', rel), bytes);
        const hash = createHash('sha256').update(bytes).digest('hex');
        writeFileSync(join(stage, 'manifest.json'), JSON.stringify({ root, world: root, backup: join(temp, 'backup'), server: false,
            prefixes: ['resource_packs/new'], updates: [rel], before: { [rel]: null }, desired: { [rel]: { sha: hash, normalized: hash } },
            referencesBefore: { 'world_behavior_packs.json': [], 'world_resource_packs.json': [] },
            references: { 'world_behavior_packs.json': [], 'world_resource_packs.json': [{ pack_id: 'new', version: [1, 0, badVersion ? 1 : 0] }] } }));
        const result = spawnSync('python', [tool, join(stage, 'manifest.json'), '--validate-only'], { encoding: 'utf8' });
        if (badVersion) { assert.notEqual(result.status, 0); assert.match(result.stderr, /Manifest registration version/); }
        else assert.equal(result.status, 0, result.stderr);
        assert.equal(existsSync(join(root, rel)), false); assert.equal(existsSync(join(temp, 'backup')), false);
    } finally { rmSync(temp, { recursive: true, force: true }); }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../../behavior_packs/bp_05_90f045c3-0718-4981-a1ff-180976002a93/scripts/pinenite/rules.js', import.meta.url), 'utf8');
const R = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const full = [true, true, true, true];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
function linked(p, id = 'boss', tick = 0) {
    const s = R.targetState(p, id, tick);
    s.analysisHits = 6; s.adaptationHits = 4; R.touch(s, tick, true);
    return s;
}
test('base health and armor spec', () => {
    assert.deepEqual(R.BONUS_HP, [0, 4, 8, 12, 20]);
    assert.deepEqual(R.PROTECTION, [8, 14, 11, 8]);
    assert.equal(R.PROTECTION.reduce((a, b) => a + b), 41);
});
test('analysis thresholds apply on hits 2, 4, 6, cap at 1.30', () => {
    const p = R.newPlayerState(), s = R.targetState(p, 'a', 0);
    [1, 1.1, 1.1, 1.2, 1.2, 1.3, 1.3].forEach((value, tick) => near(R.attack(s, tick, true, false), value));
    assert.equal(R.analysisStage(R.targetState(p, 'b', 7)), 0);
});
test('only direct player-owned source causes qualify; DOT and synthetic excluded', () => {
    for (const cause of ['entityAttack', 'projectile']) assert.ok(R.direct({ cause, damagingEntity: {} }));
    for (const cause of ['fire', 'fireTick', 'magic', 'wither', 'poison', 'fall', 'override', 'thorns'])
        assert.equal(R.direct({ cause, damagingEntity: {} }), false);
    assert.equal(R.direct({ cause: 'projectile' }), false);
});
test('adaptation 0/10/20/30 percent; cooldown throttles learning only', () => {
    const p = R.newPlayerState(), s = R.targetState(p, 'a', 0);
    for (const [tick, expected] of [[0, 1], [1, 1], [14, 1], [15, .9], [16, .9], [30, .8], [45, .7], [46, .7]])
        near(R.incoming(p, s, tick, full, 20, () => 1).multiplier, expected);
    assert.equal(p.regen.length, 8);
    assert.equal(s.adaptationHits, 4);
});
test('learning cooldown is independent for attackers', () => {
    const p = R.newPlayerState();
    for (const id of ['a', 'b']) R.incoming(p, R.targetState(p, id, 0), 0, full, 10, () => 1);
    assert.equal(p.targets.get('a').adaptationHits, 1);
    assert.equal(p.targets.get('b').adaptationHits, 1);
});
test('memory remains through 30s; steps at 40/50/60s; repeated decay is idempotent', () => {
    const p = R.newPlayerState(), s = linked(p); s.symbiosisUntil = 0;
    for (const [tick, stage] of [[600, 3], [799, 3], [800, 2], [999, 2], [1000, 1], [1199, 1], [1200, 0]]) {
        R.decay(s, tick); R.decay(s, tick);
        assert.equal(R.analysisStage(s), stage); assert.equal(R.adaptationStage(s), stage);
    }
});
test('combat refreshes decay; one remaining hit also disappears at 60s', () => {
    const p = R.newPlayerState(), s = R.targetState(p, 'a', 0);
    R.attack(s, 0, true, false); R.touch(s, 600, false);
    R.decay(s, 1200); assert.equal(s.analysisHits, 1);
    R.decay(s, 1800); assert.equal(s.analysisHits, 0);
});
test('symbiosis requires full equipment and both stage III, no duplicate multiplier', () => {
    const p = R.newPlayerState(), s = R.targetState(p, 'a', 0);
    s.adaptationHits = 4;
    for (let i = 0; i < 6; i++) R.attack(s, i, true, false);
    assert.equal(s.symbiosisUntil, 0);
    near(R.attack(s, 6, true, true), 1.3);
    assert.equal(s.symbiosisUntil, 306);
    near(R.incoming(p, s, 7, full, 20, () => 1).multiplier, .7);
});
test('unlimited independent entity IDs (including same type), 15 second expiry; proximity never refreshes', () => {
    const p = R.newPlayerState();
    for (let i = 0; i < 1000; i++) linked(p, `target${i}`);
    R.touch(p.targets.get('target0'), 20, true);
    assert.equal(p.targets.size, 1000);
    assert.ok(R.symbiotic(p.targets.get('target0'), 300, true));
    assert.equal(R.symbiotic(p.targets.get('target1'), 300, true), false);
    assert.equal(R.symbiotic(p.targets.get('target0'), 320, true), false);
});
test('decay pauses while linked, damage refresh does not require learning cooldown', () => {
    const p = R.newPlayerState(), s = linked(p); s.symbiosisUntil = 1500;
    R.decay(s, 1200); assert.equal(R.analysisStage(s), 3);
    s.learnUntil = 2000;
    R.incoming(p, s, 1201, full, 20, () => 1);
    assert.equal(s.symbiosisUntil, 1501);
});
test('raw 20 gives normal regen 5 even when adaptation reduces to 14', () => {
    const p = R.newPlayerState(), s = R.targetState(p, 'a', 0); s.adaptationHits = 4;
    const hit = R.incoming(p, s, 0, full, 20, () => 1);
    near(hit.multiplier, .7); near(hit.regeneration, 5);
});
test('linked raw 20 gives 7; reflects raw 30, zero incoming and no new regen', () => {
    const p = R.newPlayerState(), s = linked(p);
    near(R.incoming(p, s, 1, full, 20, () => .1).regeneration, 7);
    const result = R.incoming(p, s, 2, full, 30, () => .099999);
    assert.deepEqual(result, { multiplier: 0, reflected: 30, regeneration: 0 });
    assert.equal(p.regen.length, 1);
});
test('deterministic uniform trials hit precisely 10 percent boundary', () => {
    let reflected = 0;
    for (let i = 0; i < 1000; i++) {
        const p = R.newPlayerState();
        if (R.incoming(p, linked(p), 1, full, 30, () => i / 1000).reflected) reflected++;
    }
    assert.equal(reflected, 100);
});
test('six second linear regen finishes; total pending is unbounded', () => {
    const p = R.newPlayerState();
    for (let i = 0; i < 2000; i++) R.incoming(p, undefined, 0, full, 20);
    assert.equal(p.regen.reduce((sum, q) => sum + q.remaining, 0), 10000);
    let hp = 1;
    for (let i = 0; i < 120; i++) hp = R.regenerate(p, hp, 20000, false);
    near(hp, 10001); assert.equal(p.regen.length, 0);
});
test('low HP linked speed doubles ALL existing reservations; changes back above half', () => {
    const p = R.newPlayerState(); R.incoming(p, undefined, 0, full, 48); // 12 normal reservation
    near(R.regenerate(p, 20, 40, true), 20.2);
    near(R.regenerate(p, 20.2, 40, true), 20.3);
    near(R.regenerate(p, 10, 40, false), 10.1);
    near(p.regen[0].remaining, 11.6);
});
test('overheal consumed immediately, never returned after later damage', () => {
    const p = R.newPlayerState(); R.incoming(p, undefined, 0, full, 20);
    for (let i = 0; i < 120; i++) assert.equal(R.regenerate(p, 40, 40, false), 40);
    assert.equal(R.regenerate(p, 10, 40, false), 10);
});
test('missing parts cannot use their abilities', () => {
    const p = R.newPlayerState(), s = linked(p);
    assert.equal(R.attack(s, 1, false, false), 1);
    const result = R.incoming(p, s, 2, [true, false, false, true], 20, () => 0);
    assert.deepEqual(result, { multiplier: 1, reflected: 0, regeneration: 0 });
});
test('synthetic guard covers reentry, delayed override, exceptions, then permits genuine hit', () => {
    const guard = new R.SyntheticGuard(), real = { cause: 'entityAttack', damagingEntity: {} };
    assert.throws(() => guard.run(() => { assert.ok(guard.blocks(real)); throw Error('engine'); }));
    assert.equal(guard.blocks(real), false);
    assert.ok(guard.blocks({ cause: 'override' }));
});
test('frame samples actual bounding box edges for arbitrary dimensions', () => {
    const box = { center: { x: 10, y: 20, z: 30 }, extent: { x: 2, y: 4, z: 1 } };
    const points = R.framePoints(box);
    assert.ok(points.length > 100);
    for (const p of points) {
        for (const axis of ['x', 'y', 'z']) assert.ok(Math.abs(p[axis] - box.center[axis]) <= box.extent[axis] + .036);
        assert.equal(['x', 'y', 'z'].filter(axis => Math.abs(Math.abs(p[axis] - box.center[axis]) - box.extent[axis] - .035) < 1e-8).length, 2);
    }
});
test('leap requires grounded sneak, seven second cooldown and no airborne reuse', () => {
    const s = R.newPlayerState();
    assert.ok(R.leapReady(s, 0, true, true));
    assert.equal(R.leapReady(s, 0, false, true), false);
    assert.equal(R.leapReady(s, 0, true, false), false);
    s.leapUntil = 140;
    assert.equal(R.leapReady(s, 139, true, true), false);
    assert.ok(R.leapReady(s, 140, true, true));
    s.airborneUsed = true;
    assert.equal(R.leapReady(s, 200, true, true), false);
});

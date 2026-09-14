// Event adapter tests use a mock engine. They do NOT establish Bedrock's armor ordering/cap.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const dir = new URL('../../behavior_packs/bp_05_90f045c3-0718-4981-a1ff-180976002a93/scripts/pinenite/', import.meta.url);
function harness({ delayedReflection = false } = {}) {
    const events = {}, jobs = [], intervals = [], entities = new Map();
    const signal = name => ({ subscribe(fn) { (events[name] ??= []).push(fn); } });
    const emit = (name, ev) => { for (const fn of events[name] ?? []) fn(ev); };
    const system = { currentTick: 0, run(fn) { jobs.push(fn); }, runInterval(fn) { intervals.push(fn); } };
    const context = vm.createContext({ console, Math: Object.create(Math),
        world: { beforeEvents: { entityHurt: signal('before') }, afterEvents: Object.fromEntries(
            ['entityHurt', 'entityDie', 'playerLeave', 'playerDimensionChange', 'playerButtonInput'].map(n => [n, signal(n)])),
        getPlayers: () => [...entities.values()].filter(p => p.typeId === 'minecraft:player'),
        getEntity: id => entities.get(id) }, system,
        EquipmentSlot: { Head: 'head', Chest: 'chest', Legs: 'legs', Feet: 'feet' },
        InputButton: { Jump: 'Jump' }, ButtonState: { Pressed: 'Pressed' }, EntityDamageCause: { override: 'override' },
        MolangVariableMap: class { setColorRGBA() {} setFloat() {} }
    });
    context.Math.random = () => 1;
    vm.runInContext(readFileSync(new URL('rules.js', dir), 'utf8').replaceAll('export ', '') + '\n' +
        readFileSync(new URL('main.js', dir), 'utf8').replace(/^import[\s\S]*?;\r?\n/gm, ''), context);
    const get = id => vm.runInContext(`players.get(${JSON.stringify(id)})`, context);
    function entity(id, gear = [], typeId = 'minecraft:player') {
        const health = { currentValue: 100, effectiveMax: 100, setCurrentValue(v) { this.currentValue = v; } };
        const effects = new Map();
        const p = { id, typeId, gear, isValid: true, isOnGround: true, isSneaking: false,
            location: { x: 0, y: 1, z: 0 }, dimension: { id: 'overworld', spawnParticle() {} },
            getAABB: () => ({ center: { x: 0, y: 2, z: 0 }, extent: { x: .3, y: 1, z: .3 } }),
            getComponent(name) {
                if (name === 'minecraft:health') return health;
                if (name === 'minecraft:equippable') return { getEquipment(slot) {
                    const i = ['head', 'chest', 'legs', 'feet'].indexOf(slot);
                    return p.gear[i] ? { typeId: `true_dn:pinenite_${['helmet', 'chestplate', 'leggings', 'boots'][i]}` } : undefined;
                } };
            },
            getEffect: name => effects.get(name),
            addEffect(name, duration, options) { effects.set(name, { duration, ...options }); },
            removeEffect(name) { effects.delete(name); },
            playAnimation() {}, getViewDirection: () => ({ x: 1, y: 0, z: 0 }), applyImpulse(v) { this.impulse = v; },
            applyDamage(amount, source) {
                const run = () => hit(p, undefined, amount, source.cause);
                if (delayedReflection) jobs.push(run); else run();
                return true;
            }, health, effects
        };
        entities.set(id, p); return p;
    }
    function hit(victim, attacker, amount, cause = 'entityAttack', { cancelled = false, armor = 1, after = true } = {}) {
        const ev = { hurtEntity: victim, damageSource: { damagingEntity: attacker, cause }, damage: amount, cancel: cancelled };
        emit('before', ev);
        if (!ev.cancel && after) {
            const actual = ev.damage * armor;
            victim.health.currentValue -= actual;
            emit('entityHurt', { ...ev, damage: actual });
        }
        return ev;
    }
    function tick(n = 1) { for (let i = 0; i < n; i++) { system.currentTick++; for (const fn of intervals) fn(); } }
    function link(p, target) {
        context.testPlayer = p; context.targetId = target.id;
        vm.runInContext('targetState(state(testPlayer), targetId, system.currentTick)', context);
        const s = get(p.id).targets.get(target.id);
        s.analysisHits = 6; s.adaptationHits = 4; s.symbiosisUntil = system.currentTick + 300;
        return s;
    }
    return { context, system, entities, entity, hit, tick, get, link, emit, flush() {
        let count = 0;
        while (jobs.length) { if (++count > 10) throw Error('recursive reflection'); jobs.shift()(); }
        return count;
    } };
}
const full = [true, true, true, true];
test('runtime stores pre-adaptation value, mock armor does not contaminate reservations', () => {
    const h = harness(), p = h.entity('p', full), mob = h.entity('m', [], 'minecraft:zombie');
    h.link(p, mob).symbiosisUntil = 0;
    const ev = h.hit(p, mob, 20, 'entityAttack', { armor: .4 });
    assert.equal(ev.damage, 14);
    assert.equal(h.get('p').regen[0].remaining, 5);
    assert.equal(p.health.currentValue, 94.4);
});
for (const delayedReflection of [false, true]) test(`two fully linked players: no reflection recursion (${delayedReflection ? 'delayed' : 'synchronous'})`, () => {
    const h = harness({ delayedReflection }), a = h.entity('a', full), b = h.entity('b', full);
    h.link(a, b); h.link(b, a); h.context.Math.random = () => 0;
    const ev = h.hit(a, b, 30);
    assert.ok(ev.cancel); assert.equal(a.health.currentValue, 100);
    h.flush();
    assert.equal(b.health.currentValue, 61); // raw attack includes opponent's 1.30 analysis once
    for (const id of ['a', 'b']) {
        const s = h.get(id);
        assert.equal(s.regen.length, 0);
        assert.equal(s.targets.values().next().value.adaptationHits, 4);
    }
    h.context.Math.random = () => 1;
    h.hit(a, b, 10);
    assert.equal(h.get('a').regen.length, 1); // same tick genuine hit remains enabled
});
test('reflection on an unarmored attacker sends original 30, not adapted 21', () => {
    const h = harness(), p = h.entity('p', full), mob = h.entity('m', [], 'minecraft:zombie');
    h.link(p, mob); h.context.Math.random = () => 0;
    h.hit(p, mob, 30); h.flush();
    assert.equal(mob.health.currentValue, 70); assert.equal(p.health.currentValue, 100);
    assert.equal(h.get('p').regen.length, 0);
});
test('cancelled, zero and unconfirmed hits cannot learn or regenerate', () => {
    const h = harness(), p = h.entity('p', full), m = h.entity('m', [], 'minecraft:zombie');
    h.hit(p, m, 0); h.hit(p, m, 20, 'entityAttack', { cancelled: true });
    assert.equal(h.get('p'), undefined);
    h.hit(p, m, 20, 'entityAttack', { after: false });
    assert.equal(h.get('p').targets.size, 0); h.tick();
    h.hit(p, m, 20); assert.equal(h.get('p').targets.get('m').adaptationHits, 1);
});
test('interleaved before/after from different attackers preserves both targets and regen reservations', () => {
    const h = harness(), p = h.entity('p', full), a = h.entity('a', [], 'minecraft:zombie'), b = h.entity('b', [], 'minecraft:zombie');
    const ea = h.hit(p, a, 20, 'entityAttack', { after: false });
    const eb = h.hit(p, b, 40, 'entityAttack', { after: false });
    h.emit('entityHurt', ea); h.emit('entityHurt', eb);
    assert.equal(h.get('p').targets.size, 2);
    assert.equal(h.get('p').regen.reduce((sum, q) => sum + q.remaining, 0), 15);
});
test('projectile direct owner counts; summon, DOT and synthetic cannot advance analysis', () => {
    const h = harness(), p = h.entity('p', [true]), m = h.entity('m', [], 'minecraft:zombie');
    h.hit(m, p, 5, 'projectile');
    h.hit(m, p, 5, 'wither'); h.hit(m, undefined, 5, 'override');
    h.hit(m, h.entity('summon', [], 'custom:summon'), 5);
    assert.equal(h.get('p').targets.get('m').analysisHits, 1);
});
test('attributed boss explosion learns adaptation but cannot count as direct analysis; DOT cannot refresh', () => {
    const h = harness(), p = h.entity('p', full), boss = h.entity('boss', [], 'custom:boss');
    h.hit(p, boss, 10, 'entityExplosion');
    assert.equal(h.get('p').targets.get('boss').adaptationHits, 1);
    h.tick(15); h.hit(p, boss, 10, 'magic');
    assert.equal(h.get('p').targets.get('boss').adaptationHits, 2);
    h.tick(); h.hit(p, boss, 1, 'wither');
    assert.equal(h.get('p').targets.get('boss').lastCombat, 15);
});
test('lethal hit never queues regeneration or revives', () => {
    const h = harness(), p = h.entity('p', full), m = h.entity('m', [], 'minecraft:zombie');
    p.health.currentValue = 1; h.hit(p, m, 20); h.tick(120);
    assert.ok(p.health.currentValue <= 0); assert.equal(h.get('p').regen.length, 0);
});
test('max HP effect level follows 4/8/12/20 and is removed on unequip', () => {
    const h = harness(), p = h.entity('p');
    for (let count = 1; count <= 4; count++) {
        p.gear = full.map((_, i) => i < count); h.tick();
        assert.equal(p.effects.get('health_boost').amplifier, [0, 1, 2, 4][count - 1]);
    }
    p.gear = [true]; h.tick(); assert.equal(p.effects.get('health_boost').amplifier, 0);
    p.gear = []; h.tick(); assert.equal(p.effects.has('health_boost'), false);
});
test('removing chest or helmet clears relevant memory and symbiosis; leggings clear regen', () => {
    const h = harness(), p = h.entity('p', full), m = h.entity('m', [], 'minecraft:zombie');
    h.link(p, m); h.hit(p, m, 10);
    p.gear = [false, false, false, true]; h.tick();
    const s = h.get('p');
    assert.equal(s.targets.get('m').analysisHits, 0); assert.equal(s.targets.get('m').adaptationHits, 0);
    assert.equal(s.targets.get('m').symbiosisUntil, 0); assert.equal(s.regen.length, 0);
});
test('death, leave, invalid target and dimension change clean independent state', () => {
    const h = harness(), a = h.entity('a', full), b = h.entity('b', full);
    h.link(a, b); h.link(b, a);
    h.emit('playerDimensionChange', { player: a }); assert.equal(h.get('a').targets.size, 0);
    h.emit('playerLeave', { playerId: a.id }); assert.equal(h.get('a'), undefined);
    assert.equal(h.get('b').targets.size, 0);
    h.link(b, a); a.isValid = false; h.tick(); assert.equal(h.get('b').targets.size, 0);
    h.emit('entityDie', { deadEntity: b }); assert.equal(h.get('b'), undefined);
});
test('jump input uses impulse (engine collision), cannot repeat in air', () => {
    const h = harness(), p = h.entity('p', full); p.isSneaking = true;
    h.emit('playerButtonInput', { player: p, button: 'Jump', newButtonState: 'Pressed' });
    assert.ok(p.impulse.x > 0); assert.equal(h.get('p').leapUntil, 140);
    p.impulse = undefined; p.isOnGround = false; h.tick(150);
    h.emit('playerButtonInput', { player: p, button: 'Jump', newButtonState: 'Pressed' });
    assert.equal(p.impulse, undefined);
});
test('wearer pulse has a 30 tick period, no target stacking, and a 10 tick fade', () => {
    const h = harness(), p = h.entity('p', full), a = h.entity('a', [], 'minecraft:zombie'), b = h.entity('b', [], 'minecraft:zombie');
    h.link(p, a); h.tick(); const one = h.get('p').glow;
    h.link(p, b); h.tick(30); assert.ok(Math.abs(h.get('p').glow - one) < 1e-9);
    h.get('p').targets.clear(); h.tick(); const start = h.get('p').glow;
    h.tick(5); assert.ok(Math.abs(h.get('p').glow - start / 2) < 1e-9);
    h.tick(5); assert.equal(h.get('p').glow, 0);
});

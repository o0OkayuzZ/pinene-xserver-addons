// FINAL v1.0. Pure rules; time is always in server ticks (20 / second).
export const BONUS_HP = [0, 4, 8, 12, 20];
export const PARTS = ['helmet', 'chestplate', 'leggings', 'boots'];
export const PROTECTION = [8, 14, 11, 8];
export function newPlayerState() {
    return { targets: new Map(), regen: [], leapUntil: 0, airborneUsed: false };
}
export function targetState(player, id, tick) {
    let state = player.targets.get(id);
    if (!state) {
        state = { analysisHits: 0, adaptationHits: 0, learnUntil: 0,
            lastCombat: tick, decaySteps: 0, symbiosisUntil: 0 };
        player.targets.set(id, state);
    }
    decay(state, tick);
    return state;
}
export const analysisStage = s => Math.min(3, Math.floor(s.analysisHits / 2));
export const adaptationStage = s => Math.max(0, Math.min(3, s.adaptationHits - 1));
export const symbiotic = (s, tick, full) => full && s.symbiosisUntil > tick;
export function decay(s, tick) {
    if (s.symbiosisUntil > tick) return;
    const idle = tick - s.lastCombat;
    const steps = idle >= 1200 ? 3 : idle >= 1000 ? 2 : idle >= 800 ? 1 : 0;
    const drop = Math.max(0, steps - s.decaySteps);
    if (drop) {
        s.analysisHits = Math.max(0, s.analysisHits - 2 * drop);
        s.adaptationHits = Math.max(0, s.adaptationHits - drop);
        s.decaySteps = steps;
    }
    if (idle >= 1200) s.analysisHits = s.adaptationHits = s.symbiosisUntil = 0;
}
export function touch(s, tick, full) {
    s.lastCombat = tick;
    s.decaySteps = 0;
    if (full && analysisStage(s) === 3 && adaptationStage(s) === 3)
        s.symbiosisUntil = tick + 300;
    else if (!full) s.symbiosisUntil = 0;
}
export function attack(s, tick, helmet, full) {
    if (helmet) s.analysisHits = Math.min(6, s.analysisHits + 1);
    touch(s, tick, full);
    return helmet ? 1 + analysisStage(s) * 0.1 : 1;
}
export function incoming(player, s, tick, gear, originalDamage, random = Math.random) {
    // Immutable caller snapshot: never derive regeneration/reflection from reduced damage.
    const full = gear.every(Boolean);
    const linked = !!s && symbiotic(s, tick, full);
    if (linked && random() < 0.1) {
        touch(s, tick, full);
        return { multiplier: 0, reflected: originalDamage, regeneration: 0 };
    }
    // The current eligible hit learns before selecting its stage: hit 2 gets 10%.
    if (s && gear[1] && tick >= s.learnUntil) {
        s.adaptationHits = Math.min(4, s.adaptationHits + 1);
        s.learnUntil = tick + 15;
    }
    const regeneration = gear[2] ? originalDamage * (linked ? 0.35 : 0.25) : 0;
    if (regeneration > 0) player.regen.push({ total: regeneration, remaining: regeneration, symbiotic: linked });
    if (s) touch(s, tick, full);
    return { multiplier: s && gear[1] ? 1 - adaptationStage(s) * 0.1 : 1,
        reflected: 0, regeneration };
}
export function regenerate(player, hp, maximum, linked, ticks = 1) {
    // Every tranche keeps its original rate, not remaining/120 (which never finishes).
    const fast = linked && hp <= maximum * 0.5;
    let healing = 0;
    for (const q of player.regen) {
        const amount = Math.min(q.remaining, q.total * ticks / (fast ? 60 : 120));
        q.remaining -= amount;
        healing += amount;
    }
    player.regen = player.regen.filter(q => q.remaining > 1e-9);
    return Math.min(maximum, hp + healing); // Overheal is spent, never banked.
}
export function direct(source) {
    return !!source?.damagingEntity && (source.cause === 'entityAttack' || source.cause === 'projectile');
}
const indirectCauses = new Set(['fire', 'fireTick', 'wither', 'poison', 'lava', 'fall',
    'drowning', 'suffocation', 'starve', 'freezing', 'void', 'override', 'thorns', 'magma']);
export function attributed(source) {
    return !!source?.damagingEntity && !indirectCauses.has(source.cause);
}
export class SyntheticGuard {
    constructor() { this.depth = 0; }
    run(action) {
        this.depth++;
        try { return action(); } finally { this.depth--; }
    }
    blocks(source) {
        // Dedicated cause + no attacker also covers delayed engine delivery, across players.
        return this.depth > 0 || (source?.cause === 'override' && !source.damagingEntity);
    }
}
export function framePoints(box) {
    const c = box.center, h = box.extent;
    const points = [];
    for (let axis = 0; axis < 3; axis++) {
        const names = ['x', 'y', 'z'], other = names.filter((_, i) => i !== axis);
        for (const a of [-1, 1]) for (const b of [-1, 1]) {
            const n = Math.max(1, Math.ceil(2 * h[names[axis]] / 0.3));
            for (let i = 0; i <= n; i++) {
                const p = { ...c };
                p[other[0]] += a * (h[other[0]] + 0.035);
                p[other[1]] += b * (h[other[1]] + 0.035);
                p[names[axis]] += (i / n * 2 - 1) * h[names[axis]];
                points.push(p);
            }
        }
    }
    return points;
}
export function leapReady(state, tick, sneaking, grounded) {
    return sneaking && grounded && !state.airborneUsed && tick >= state.leapUntil;
}

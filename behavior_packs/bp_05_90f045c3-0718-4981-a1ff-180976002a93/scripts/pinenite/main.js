import './probe.js';
import { world, system, EquipmentSlot, InputButton, ButtonState, MolangVariableMap, EntityDamageCause } from '@minecraft/server';
import { BONUS_HP, PARTS, newPlayerState, targetState, attack, incoming, regenerate,
    adaptationStage, decay, symbiotic, direct, attributed, SyntheticGuard, leapReady } from './rules.js';

const slots = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet];
const players = new Map(), pending = new Map(), guard = new SyntheticGuard();
const warned = new Set();
// Visual requests are merged once per tick. Combat memories remain per wearer.
const rendered = new Map(), flashes = new Map();
function outline(requests, entity, alpha) {
    if (alpha > 0) requests.set(entity.id, { entity, alpha: Math.max(alpha, requests.get(entity.id)?.alpha ?? 0) });
}
function flushOutlines(requests, tick) {
    for (const [id, entry] of flashes) {
        if (entry.until <= tick || !entry.entity.isValid) flashes.delete(id);
        else outline(requests, entry.entity, 1);
    }
    for (const [id, entity] of rendered) if (!requests.has(id) && entity.isValid) requests.set(id, { entity, alpha: 0 });
    rendered.clear();
    for (const { entity, alpha } of requests.values()) {
        if (!entity.isValid) continue;
        try {
            // One-shot assignments plus a client-side lease prevent stale glow
            // after unload, disconnect or script interruption.
            entity.playAnimation('animation.true_dn.pinenite_sync', {
                controller: 'pinenite_model_outline', blendOutTime: 0,
                stopExpression: `variable.pinenite_outline = ${alpha.toFixed(4)}; variable.pinenite_outline_until = query.life_time + 0.3; return 1;`
            });
            if (alpha > 0) rendered.set(entity.id, entity);
        } catch (e) { warn('outline', e); }
    }
}
function warn(key, error) {
    if (!warned.has(key)) { warned.add(key); console.warn(`[Pinenite] ${key}: ${error}`); }
}
function equipment(p) {
    const eq = p.getComponent('minecraft:equippable');
    return PARTS.map((part, i) => eq?.getEquipment(slots[i])?.typeId === `true_dn:pinenite_${part}`);
}
function state(p) {
    let s = players.get(p.id);
    if (!s) { s = newPlayerState(); players.set(p.id, s); }
    return s;
}
function clone(s) {
    return { ...s, targets: new Map([...s.targets].map(([id, t]) => [id, { ...t }])),
        regen: [], touchedTarget: undefined };
}
function key(ev) { return `${ev.hurtEntity.id}|${ev.damageSource.damagingEntity?.id ?? ''}|${ev.damageSource.cause}`; }
function commit(p, draft) {
    // Preserve movement/visual state that can change between before/after delivery.
    const live = state(p);
    if (draft.touchedTarget !== undefined) live.targets.set(draft.touchedTarget, draft.targets.get(draft.touchedTarget));
    live.regen.push(...draft.regen);
}
function particle(dimension, position, alpha = 1, size = 0.025) {
    const vars = new MolangVariableMap();
    vars.setColorRGBA('variable.pinenite_color', { red: 57 / 255, green: 197 / 255, blue: 187 / 255, alpha });
    vars.setFloat('variable.pinenite_size', size);
    try { dimension.spawnParticle('true_dn:pinenite_frame', position, vars); }
    catch (e) { warn('particle', e); }
}
function flash(p, target) {
    state(p).flashUntil = system.currentTick + 4;
    if (target?.isValid) {
        target.dimension.spawnParticle('true_dn:pinenite_reflect', target.getAABB().center);
        flashes.set(target.id, { entity: target, until: system.currentTick + 4 });
    }
}

world.beforeEvents.entityHurt.subscribe(ev => {
    if (ev.cancel || !(ev.damage > 0) || guard.blocks(ev.damageSource)) return;
    const tick = system.currentTick, victim = ev.hurtEntity, source = ev.damageSource;
    const attacker = source.damagingEntity;
    const valid = direct(source) && attacker?.id !== victim.id;
    const validIncoming = attributed(source) && attacker?.id !== victim.id;
    let outgoing, defending, ownerGear;
    let multiplier = 1;
    if (valid && attacker.typeId === 'minecraft:player') {
        ownerGear = equipment(attacker);
        if (ownerGear.some(Boolean)) {
            outgoing = clone(state(attacker));
            outgoing.touchedTarget = victim.id;
            multiplier = attack(targetState(outgoing, victim.id, tick), tick, ownerGear[0], ownerGear.every(Boolean));
        }
    }
    // Snapshot before ANY Pinenite defensive modification. Engine armor/Resistance
    // ordering is an explicit runtime acceptance gate; never reverse-estimate it.
    const originalDamage = ev.damage * multiplier;
    let result = { multiplier: 1, reflected: 0 };
    if (victim.typeId === 'minecraft:player') {
        const gear = equipment(victim);
        if (gear.some(Boolean)) {
            defending = clone(state(victim));
            if (validIncoming) defending.touchedTarget = attacker.id;
            const target = validIncoming ? targetState(defending, attacker.id, tick) : undefined;
            result = incoming(defending, target, tick, gear, originalDamage);
        }
    }
    if (!outgoing && !defending) return;
    if (result.reflected > 0) {
        ev.cancel = true;
        // A reflected hit refreshes existing symbiosis but grants no analysis,
        // adaptation or regeneration to either endpoint.
        commit(victim, defending);
        system.run(() => {
            if (!attacker?.isValid || !victim.isValid) return;
            try {
                guard.run(() => attacker.applyDamage(result.reflected, { cause: EntityDamageCause.override }));
                flash(victim, attacker);
            } catch (e) { warn('reflection', e); }
        });
        return;
    }
    ev.damage = originalDamage * result.multiplier;
    // Only after a successful real hit do learning/regen/timers become visible.
    const id = key(ev), queue = pending.get(id) ?? [];
    queue.push({ tick, victim, attacker, outgoing, defending, originalDamage });
    pending.set(id, queue);
});
world.afterEvents.entityHurt.subscribe(ev => {
    if (guard.blocks(ev.damageSource)) return;
    const id = key(ev), queue = pending.get(id);
    if (!queue?.length) return;
    const item = queue.shift();
    if (!queue.length) pending.delete(id);
    if (!(ev.damage > 0) || item.tick !== system.currentTick) return;
    if (item.outgoing && item.attacker.isValid) commit(item.attacker, item.outgoing);
    const health = item.victim.getComponent('minecraft:health');
    if (item.defending && health?.currentValue > 0) commit(item.victim, item.defending);
});

function updateHealth(p, s, gear) {
    const count = gear.filter(Boolean).length, bonus = BONUS_HP[count];
    const current = p.getEffect('health_boost');
    const amp = bonus / 4 - 1;
    // Health Boost is the engine-supported max-HP mechanism without player.json.
    // Leave external stronger effects intact. Their non-additivity is documented.
    if (bonus && (!current || current.amplifier <= amp)) {
        if (!current || current.amplifier !== amp || current.duration < 20) {
            p.addEffect('health_boost', 40, { amplifier: amp, showParticles: false });
            s.healthAmp = amp;
        }
    } else if (s.healthAmp !== undefined && current?.amplifier === s.healthAmp) {
        p.removeEffect('health_boost');
        s.healthAmp = undefined;
        if (bonus) { p.addEffect('health_boost', 40, { amplifier: amp, showParticles: false }); s.healthAmp = amp; }
    }
}
function visual(p, s, tick, full, requests) {
    let linked = false;
    const pulse = 0.5 - 0.5 * Math.cos(tick * Math.PI * 2 / 30);
    for (const [id, t] of s.targets) {
        const entity = world.getEntity(id);
        if (!entity?.isValid || entity.dimension.id !== p.dimension.id) { s.targets.delete(id); continue; }
        decay(t, tick);
        if (!full) t.symbiosisUntil = 0;
        const active = symbiotic(t, tick, full);
        linked ||= active;
        if (tick - t.lastCombat >= 1200 && !active) { s.targets.delete(id); continue; }
        const stage = adaptationStage(t);
        // Render distance limits visuals only; target memory has no count limit.
        if (Math.hypot(entity.location.x - p.location.x, entity.location.y - p.location.y,
            entity.location.z - p.location.z) > 64) continue;
        if (!stage || (stage === 1 && tick % 20 >= 8) || (stage === 2 && tick % 20 >= 18)) continue;
        const alpha = active ? 0.65 + 0.35 * pulse : [0, 0.22, 0.55, 0.9][stage];
        outline(requests, entity, alpha);
    }
    if (!linked && s.wasLinked) { s.fadeFrom = s.glow ?? 0; s.fadeStarted = tick; }
    const intensity = linked ? 0.4 + 0.6 * pulse : (s.fadeFrom ?? 0) * Math.max(0, 1 - (tick - (s.fadeStarted ?? tick)) / 10);
    s.wasLinked = linked;
    s.glow = intensity;
    // Armor and body share the same requested outline intensity. Existing
    // animations and geometry transforms remain owned by the entity renderer.
    outline(requests, p, (s.flashUntil ?? 0) > tick ? 1 : intensity);
    s.wasGlowing = intensity > 0;
    return linked;
}

world.afterEvents.playerButtonInput.subscribe(ev => {
    if (ev.button !== InputButton.Jump || ev.newButtonState !== ButtonState.Pressed) return;
    const p = ev.player, s = state(p), tick = system.currentTick;
    if (!equipment(p)[3] || !leapReady(s, tick, p.isSneaking, p.isOnGround)) return;
    const look = p.getViewDirection(), length = Math.hypot(look.x, look.z);
    if (length < 0.01) return;
    s.airborneUsed = true;
    s.leapUntil = tick + 140;
    // Native swept movement collides with walls and retains gravity/fall damage.
    p.applyImpulse({ x: look.x / length * 0.6, y: 0, z: look.z / length * 0.6 });
    for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6;
        particle(p.dimension, { x: p.location.x + 0.35 * Math.cos(a), y: p.location.y + 0.05,
            z: p.location.z + 0.35 * Math.sin(a) }, 1, 0.045);
    }
});
system.runInterval(() => {
    const tick = system.currentTick, requests = new Map();
    for (const [id, queue] of pending) {
        const fresh = queue.filter(item => item.tick >= tick);
        if (fresh.length) pending.set(id, fresh); else pending.delete(id);
    }
    for (const p of world.getPlayers()) {
        try {
            const gear = equipment(p);
            if (!gear.some(Boolean) && !players.has(p.id)) continue;
            const s = state(p), health = p.getComponent('minecraft:health');
            if (!health || health.currentValue <= 0) continue;
            if (p.isOnGround && tick > s.leapUntil - 135) s.airborneUsed = false;
            updateHealth(p, s, gear);
            if (!gear[0]) for (const t of s.targets.values()) t.analysisHits = 0;
            if (!gear[1]) for (const t of s.targets.values()) t.adaptationHits = 0;
            const linked = visual(p, s, tick, gear.every(Boolean), requests);
            if (!gear[2]) s.regen = [];
            if (s.regen.length) health.setCurrentValue(regenerate(s, health.currentValue, health.effectiveMax, linked));
            if (!gear.some(Boolean) && !s.wasGlowing) players.delete(p.id);
        } catch (e) { warn('update', e); }
    }
    flushOutlines(requests, tick);
}, 1);
world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    players.delete(deadEntity.id);
    for (const s of players.values()) s.targets.delete(deadEntity.id);
});
world.afterEvents.playerLeave.subscribe(({ playerId }) => {
    players.delete(playerId);
    for (const s of players.values()) s.targets.delete(playerId);
});
world.afterEvents.playerDimensionChange.subscribe(({ player }) => {
    const s = players.get(player.id);
    if (s) { s.targets.clear(); s.regen = []; }
});

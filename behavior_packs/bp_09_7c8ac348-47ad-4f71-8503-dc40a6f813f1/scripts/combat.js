import { world, system, EntityDamageCause } from "@minecraft/server";
import { infectionAt, damageMultiplier, INFECTION_CD } from "./rules.js";

// Combat leaves nonlethal native armor, enchantment and absorption processing intact.
export function installCombat(gear) {
  const infections = new Map();
  const pairCooldowns = new Map();
  const pending = new Map();
  const replaying = new Set();
  const absorption = new Map();
  const absorptionEffects = new Map();
  const nativeHits = new Map();

  function absorptionLeft(entity) {
    const effect = entity.getEffect("absorption");
    if (!effect) { absorption.delete(entity.id); absorptionEffects.delete(entity.id); return 0; }
    const previous = absorptionEffects.get(entity.id);
    if (previous && (effect.amplifier !== previous.amplifier ||
        effect.duration > previous.duration - (system.currentTick - previous.tick) + 1)) {
      rememberAbsorption(entity, 4 * (effect.amplifier + 1));
    }
    absorptionEffects.set(entity.id, {amplifier:effect.amplifier,duration:effect.duration,tick:system.currentTick});
    const saved = entity.getDynamicProperty("zombiegear:absorption_left");
    return absorption.get(entity.id) ?? (typeof saved === "number" ? saved : 4 * (entity.getEffect("absorption").amplifier + 1));
  }
  function rememberAbsorption(entity, amount) {
    absorption.set(entity.id, Math.max(0, amount));
    entity.setDynamicProperty("zombiegear:absorption_left", Math.max(0, amount));
  }
  world.afterEvents.effectAdd.subscribe(ev => {
    let effectId;
    try { effectId = ev.effect.typeId; } catch { return; }
    if (ev.entity.isValid && effectId.replace("minecraft:", "") === "absorption") {
      rememberAbsorption(ev.entity, 4 * (ev.effect.amplifier + 1));
      absorptionEffects.set(ev.entity.id, {amplifier:ev.effect.amplifier,duration:ev.effect.duration,tick:system.currentTick});
    }
  });

  function stage(entity) {
    return entity ? infectionAt(infections.get(entity.id), system.currentTick) : 0;
  }

  function announceInfection(entity, level) {
    if (entity?.typeId !== "minecraft:player" || !entity.isValid) return;
    const text = level ? `§c感染 ${["", "I", "II", "III"][level]} §7| 攻撃−${level*10}%・被ダメージ増加 §f牛乳で治療`
      : "§a感染が治りました";
    entity.onScreenDisplay.setActionBar(text);
  }

  function infect(victim, source) {
    const attacker = source.damagingEntity;
    if (!attacker || source.damagingProjectile || source.cause !== EntityDamageCause.entityAttack ||
        !gear.isFull(attacker)) return;
    let victims = pairCooldowns.get(attacker.id);
    if (!victims) pairCooldowns.set(attacker.id, victims = new Map());
    if ((victims.get(victim.id) ?? -Infinity) > system.currentTick) return;
    victims.set(victim.id, system.currentTick + INFECTION_CD);
    const previous = stage(victim);
    const next = Math.min(3, previous + 1);
    infections.set(victim.id, { stage: next, shownStage: next, lastHit: system.currentTick, entity: victim });
    if (next !== previous) announceInfection(victim, next);
  }

  function markCombat(victim, source) {
    const attacker = source.damagingEntity;
    if (!attacker || attacker.id === victim.id) return;
    gear.markCombat(victim);
    gear.markCombat(attacker);
  }

  // Canceled lethal candidates are replayed only when a transaction cannot recover.
  // Normal and post-revive damage always use the native path (including absorption).
  function replay(victim, hit) {
    replaying.add(victim.id);
    try {
      /** @type {import("@minecraft/server").EntityApplyDamageOptions} */
      // hit.damage is already armor-mitigated by the native before event.
      const options = { cause: EntityDamageCause.override };
      if (hit.source.damagingEntity?.isValid) options.damagingEntity = hit.source.damagingEntity;
      victim.applyDamage(hit.damage, options);
    } finally { replaying.delete(victim.id); }
  }

  function flush(victim) {
    const hits = pending.get(victim.id);
    pending.delete(victim.id);
    if (!victim.isValid || !hits) return;
    for (const hit of hits) {
      const health = victim.getComponent("minecraft:health");
      if (!health || health.currentValue <= 0) break;
      markCombat(victim, hit.source);
      if (hit.damage >= health.currentValue + absorptionLeft(victim) && gear.tryRevive(victim)) {
        const absorbed = absorptionLeft(victim);
        if (absorbed > 0) replay(victim, { damage: absorbed, source: hit.source });
        infect(victim, hit.source);
        gear.knockback.onRevive(victim);
      } else replay(victim, hit);
    }
  }

  world.beforeEvents.entityHurt.subscribe(ev => {
    const victim = ev.hurtEntity;
    if (ev.cancel || ev.damage <= 0) return;
    const health = victim.getComponent("minecraft:health");
    if (!health) return;
    // Bedrock 1.26.45 exposes provisional post-hit HP here, BEFORE absorption.
    const beforeHp = health.currentValue + ev.damage;
    if (replaying.has(victim.id)) {
      nativeHits.set(victim.id, { beforeHp, damage: ev.damage, absorption: absorptionLeft(victim) });
      return;
    }
    const attacker = ev.damageSource.damagingEntity;
    const full = !!attacker && gear.isFull(attacker);
    const corruption = full ? gear.corruption(attacker) : -1;
    const multiplier = damageMultiplier(corruption, stage(attacker), stage(victim), full);
    ev.damage *= multiplier;
    const lethal = ev.damage >= beforeHp + absorptionLeft(victim) && beforeHp > 0 && gear.canRevive(victim);
    if (!pending.has(victim.id) && !lethal) {
      nativeHits.set(victim.id, { beforeHp, damage: ev.damage, absorption: absorptionLeft(victim) });
      return;
    }

    ev.cancel = true;
    let hits = pending.get(victim.id);
    if (!hits) {
      pending.set(victim.id, hits = []);
      system.run(() => flush(victim));
    }
    hits.push({ damage: ev.damage, source: ev.damageSource });
  });

  world.afterEvents.entityHurt.subscribe(ev => {
    const hit = nativeHits.get(ev.hurtEntity.id);
    nativeHits.delete(ev.hurtEntity.id);
    if (hit && ev.hurtEntity.isValid) {
      const afterHp = ev.hurtEntity.getComponent("minecraft:health")?.currentValue;
      if (afterHp !== undefined) {
        const absorbed = Math.min(hit.absorption, Math.max(0, afterHp - (hit.beforeHp - ev.damage)));
        rememberAbsorption(ev.hurtEntity, hit.absorption - absorbed);
      }
    }
    if (ev.damage <= 0) return;
    markCombat(ev.hurtEntity, ev.damageSource);
    infect(ev.hurtEntity, ev.damageSource);
  });

  world.afterEvents.itemCompleteUse.subscribe(ev => {
    if (ev.itemStack.typeId === "minecraft:milk_bucket" && infections.delete(ev.source.id)) announceInfection(ev.source, 0);
  });

  function clear(id) {
    infections.delete(id);
    pending.delete(id);
    absorption.delete(id);
    absorptionEffects.delete(id);
    nativeHits.delete(id);
    pairCooldowns.delete(id);
    for (const victims of pairCooldowns.values()) victims.delete(id);
  }
  world.afterEvents.playerLeave.subscribe(ev => clear(ev.playerId));
  world.afterEvents.entityDie.subscribe(ev => clear(ev.deadEntity.id));
  world.beforeEvents.entityRemove.subscribe(ev => clear(ev.removedEntity.id));
  system.runInterval(() => {
    for (const [id, record] of infections) {
      const current = infectionAt(record, system.currentTick);
      if (record.shownStage !== current) {
        announceInfection(record.entity, current);
        record.shownStage = current;
      }
      if (!current) infections.delete(id);
    }
    for (const [attacker, victims] of pairCooldowns) {
      for (const [victim, until] of victims) if (until <= system.currentTick) victims.delete(victim);
      if (!victims.size) pairCooldowns.delete(attacker);
    }
  }, 20);
  return { infectionStage: stage };
}

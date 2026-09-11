import { world, system, EntityDamageCause } from "@minecraft/server";
import { infectionAt, damageMultiplier, INFECTION_CD, REVIVE_TICKS } from "./rules.js";

// No global entity/player JSON override: this pack coexists with the other addons.
export function installCombat(gear) {
  const infections = new Map();
  const pairCooldowns = new Map();
  const recoveryUntil = new Map();
  const pending = new Map();
  const syntheticDamage = new Set();

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
    gear.markCombat(victim);
    if (source.damagingEntity) gear.markCombat(source.damagingEntity);
  }

  // Used only for the fatal remainder of a canceled hit. The guard covers both
  // before/after callbacks, so it cannot multiply damage or infect a second time.
  function finishFatalDamage(victim, source) {
    syntheticDamage.add(victim.id);
    try {
      const options = { cause: EntityDamageCause.override };
      if (source.damagingEntity?.isValid) options.damagingEntity = source.damagingEntity;
      victim.applyDamage(1000000, options);
    } finally {
      syntheticDamage.delete(victim.id);
    }
  }

  function flush(victim) {
    const hits = pending.get(victim.id);
    pending.delete(victim.id);
    if (!victim.isValid || !hits) return;
    for (const hit of hits) {
      const health = victim.getComponent("minecraft:health");
      if (!health || health.currentValue <= 0) break;
      markCombat(victim, hit.source);
      infect(victim, hit.source);
      if (hit.damage >= health.currentValue && gear.tryRevive(victim)) {
        recoveryUntil.set(victim.id, system.currentTick + REVIVE_TICKS);
      } else if (hit.damage >= health.currentValue) {
        finishFatalDamage(victim, hit.source);
        break;
      } else {
        // Canceling the native hurt avoids knockback. Health still decreases for
        // EVERY queued hit; no resistance, repeated healing, or immunity timer.
        health.setCurrentValue(health.currentValue - hit.damage);
      }
    }
  }

  world.beforeEvents.entityHurt.subscribe(ev => {
    const victim = ev.hurtEntity;
    if (ev.cancel || syntheticDamage.has(victim.id) || ev.damage <= 0) return;
    const attacker = ev.damageSource.damagingEntity;
    const full = !!attacker && gear.isFull(attacker);
    const corruption = full ? gear.corruption(attacker) : -1;
    const multiplier = damageMultiplier(corruption, stage(attacker), stage(victim), full);
    ev.damage *= multiplier;
    const health = victim.getComponent("minecraft:health");
    if (!health) return;
    const recovering = (recoveryUntil.get(victim.id) ?? 0) > system.currentTick && gear.isFull(victim);
    const lethal = ev.damage >= health.currentValue && gear.canRevive(victim);
    if (!pending.has(victim.id) && !recovering && !lethal) return;

    ev.cancel = true;
    let hits = pending.get(victim.id);
    if (!hits) {
      pending.set(victim.id, hits = []);
      system.run(() => flush(victim));
    }
    hits.push({ damage: ev.damage, source: ev.damageSource });
  });

  world.afterEvents.entityHurt.subscribe(ev => {
    if (ev.damage <= 0 || syntheticDamage.has(ev.hurtEntity.id)) return;
    markCombat(ev.hurtEntity, ev.damageSource);
    infect(ev.hurtEntity, ev.damageSource);
  });

  world.afterEvents.itemCompleteUse.subscribe(ev => {
    if (ev.itemStack.typeId === "minecraft:milk_bucket" && infections.delete(ev.source.id)) announceInfection(ev.source, 0);
  });

  function clear(id) {
    infections.delete(id);
    recoveryUntil.delete(id);
    pending.delete(id);
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
    for (const [id, until] of recoveryUntil) if (until <= system.currentTick) recoveryUntil.delete(id);
    for (const [attacker, victims] of pairCooldowns) {
      for (const [victim, until] of victims) if (until <= system.currentTick) victims.delete(victim);
      if (!victims.size) pairCooldowns.delete(attacker);
    }
  }, 20);
  return { infectionStage: stage };
}

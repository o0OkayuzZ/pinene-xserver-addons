import { world, system } from "@minecraft/server";

// Ownership comes from our addEffect call, never from amplifier == 14.
export function installManagedEffects(isFull) {
  const applying = new Set();
  const ownAdds = new Map();
  const waiting = new Set();
  const healthApplied = new Set();
  const names = ["strength", "health_boost"];
  const key = (entity, name) => `${entity.id}/${name}`;
  const property = name => `zombiegear:managed_${name}`;
  function load(entity, name) {
    try { return JSON.parse(entity.getDynamicProperty(property(name)) ?? "null"); }
    catch { return null; }
  }
  function save(entity, name, record) {
    const value = record ? JSON.stringify(record) : undefined;
    if (entity.getDynamicProperty(property(name)) !== value) entity.setDynamicProperty(property(name), value);
  }
  function snapshot(effect) {
    return effect ? { amplifier: effect.amplifier, end: Date.now() + effect.duration * 50 } : null;
  }
  function add(entity, name, duration, amplifier) {
    const id = key(entity, name);
    applying.add(id);
    try {
      // Remove the previous owned level so weaker replacement effects can apply.
      const oldHp = name === "health_boost" ? entity.getComponent("minecraft:health")?.currentValue : undefined;
      if (entity.getEffect(name)?.amplifier !== amplifier) entity.removeEffect(name);
      const tokens = ownAdds.get(id) ?? [];
      const token = { amplifier, duration, tick: system.currentTick };
      tokens.push(token); ownAdds.set(id, tokens);
      entity.addEffect(name, duration, { amplifier, showParticles: false });
      if (oldHp !== undefined) {
        const hp = entity.getComponent("minecraft:health");
        hp.setCurrentValue(Math.min(hp.effectiveMax, oldHp));
      }
    } finally { applying.delete(id); }
  }
  function sync(entity, name, full) {
    if (waiting.has(key(entity, name))) return;
    let record = load(entity, name);
    const current = entity.getEffect(name);
    // Bedrock sends effectAdd only for new effects, not replacement updates.
    // Observe successful native replacements before refreshing our short lease.
    if (name === "strength" && record && current &&
        (current.duration > 80 || current.amplifier !== Math.min(255, (record.base?.amplifier ?? -1) + 1))) {
      record.base = snapshot(current); save(entity, name, record);
    }
    if (!full) {
      if (!record) return;
      // Clear ownership before restoring, so the restoration is external again.
      save(entity, name, null);
      entity.removeEffect(name);
      if (record.base?.end > Date.now()) {
        entity.addEffect(name, Math.max(1, Math.ceil((record.base.end - Date.now()) / 50)),
          { amplifier: record.base.amplifier, showParticles: true });
      }
      return;
    }
    if (!record) {
      // Migrate the old explicit ownership marker; equal-valued external effects are saved.
      const legacyOwned = entity.getDynamicProperty(`zombiegear:${name === "strength" ? "strength_boost" : "health_boost"}_owned`);
      let base = snapshot(current);
      if (legacyOwned) {
        base = null;
        if (name === "health_boost") {
          try { base = JSON.parse(entity.getDynamicProperty("zombiegear:prior_health_boost") ?? "null"); } catch { /* legacy invalid data */ }
        }
      }
      record = { base };
      save(entity, name, record);
      entity.setDynamicProperty(`zombiegear:${name === "strength" ? "strength_boost" : "health_boost"}_owned`, undefined);
      if (name === "health_boost") entity.setDynamicProperty("zombiegear:prior_health_boost", undefined);
    }
    if (record.base?.end <= Date.now()) { record.base = null; save(entity, name, record); }
    const amplifier = name === "health_boost" ? 14 : Math.min(255, (record.base?.amplifier ?? -1) + 1);
    // Short owned leases; external effects keep their original absolute expiry.
    if (!current || current.amplifier !== amplifier || current.duration < 40) add(entity, name, 80, amplifier);
  }
  world.beforeEvents.effectAdd.subscribe(ev => {
    const name = String(ev.effectType).replace("minecraft:", "");
    if (ev.cancel || !isFull(ev.entity)) return;
    // 1.26.45 returns the localized display name, including a Roman level suffix.
    if (/^(regeneration|instant_health|Regeneration|Instant Health|再生能力|即時回復)(?:$| )/.test(name)) { ev.cancel = true; return; }
    if (!names.includes(name) || applying.has(key(ev.entity, name))) return;
    // Do not cancel or guess an amplifier: the after event contains the actual effect.
  });
  world.afterEvents.effectAdd.subscribe(ev => {
    let name;
    try { name = String(ev.effect.typeId).replace("minecraft:", ""); }
    catch { return; } // The effect may have been removed before its deferred after event.
    if (!names.includes(name)) return;
    if (name === "health_boost") return; // Read the live effect in syncHealth, then suspend it.
    const id = key(ev.entity, name), tokens = ownAdds.get(id) ?? [];
    const ownIndex = tokens.findIndex(t => system.currentTick - t.tick <= 1 &&
      t.amplifier === ev.effect.amplifier && Math.abs(t.duration - ev.effect.duration) <= 1);
    if (ownIndex >= 0) {
      tokens.splice(ownIndex, 1);
      if (!tokens.length) ownAdds.delete(id);
      return;
    }
    if (!isFull(ev.entity)) return;
    const owned = load(ev.entity, name);
    if (owned && ev.effect.duration <= 80 && ev.effect.amplifier === Math.min(255, (owned.base?.amplifier ?? -1) + 1)) return;
    save(ev.entity, name, { base: snapshot(ev.effect) });
    waiting.add(id);
    system.run(() => {
      waiting.delete(id);
      if (ev.entity.isValid) sync(ev.entity, name, isFull(ev.entity));
    });
  });
  world.afterEvents.itemCompleteUse.subscribe(ev => {
    if (ev.itemStack.typeId !== "minecraft:milk_bucket") return;
    for (const name of names) {
      const record = load(ev.source, name);
      if (record) save(ev.source, name, {...record, base: null});
    }
  });
  world.afterEvents.playerLeave.subscribe(ev => {
    healthApplied.delete(ev.playerId);
    for (const name of names) { ownAdds.delete(`${ev.playerId}/${name}`); waiting.delete(`${ev.playerId}/${name}`); }
  });
  world.afterEvents.playerSpawn.subscribe(ev => healthApplied.delete(ev.player.id));
  system.runInterval(() => {
    for (const [id, tokens] of ownAdds) {
      const live = tokens.filter(t => system.currentTick - t.tick <= 1);
      if (live.length) ownAdds.set(id, live); else ownAdds.delete(id);
    }
  }, 20);
  return {
    syncHealth(entity, full) {
      let record = load(entity, "health_boost");
      let external = entity.getEffect("health_boost");
      const hp = entity.getComponent("minecraft:health");
      const oldHp = hp?.currentValue;
      if (!record && entity.getDynamicProperty("zombiegear:health_boost_owned")) {
        let base = null;
        try { base = JSON.parse(entity.getDynamicProperty("zombiegear:prior_health_boost") ?? "null"); } catch { /* invalid legacy metadata */ }
        record = {base, native:false};
      }
      if (record && !record.native) { entity.removeEffect("health_boost"); external = undefined; }
      for (const legacy of ["zombiegear:health_boost_owned", "zombiegear:prior_health_boost"])
        if (entity.getDynamicProperty(legacy) !== undefined) entity.setDynamicProperty(legacy, undefined);
      if (full) {
        if (!record) {
          record = { base: snapshot(external), native: true };
        } else if (!record.native) {
          // Migrate our previous effect-based lease without misidentifying an external amp14.
          record.native = true;
        } else if (external) record.base = snapshot(external);
        save(entity, "health_boost", record);
        if (external) entity.removeEffect("health_boost");
        if (!healthApplied.has(entity.id)) {
          entity.triggerEvent("zombiegear:health80"); healthApplied.add(entity.id);
          system.run(() => {
            if (!entity.isValid || oldHp === undefined) return;
            const health = entity.getComponent("minecraft:health");
            if (health.currentValue === health.effectiveMax) health.setCurrentValue(Math.min(oldHp, health.effectiveMax));
          });
        }
      } else if (record || healthApplied.has(entity.id)) {
        entity.triggerEvent("zombiegear:health_off"); healthApplied.delete(entity.id);
        save(entity, "health_boost", null);
        if (!external && record?.base?.end > Date.now()) entity.addEffect("health_boost",
          Math.max(1, Math.ceil((record.base.end - Date.now()) / 50)), { amplifier: record.base.amplifier, showParticles: true });
      }
      if (hp && oldHp !== undefined && hp.currentValue !== Math.min(oldHp, hp.effectiveMax)) hp.setCurrentValue(Math.min(oldHp, hp.effectiveMax));
      if (hp && hp.currentValue > hp.effectiveMax) hp.setCurrentValue(hp.effectiveMax);
    },
    syncStrength: (entity, full) => sync(entity, "strength", full)
  };
}

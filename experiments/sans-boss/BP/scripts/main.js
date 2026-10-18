import { world, system, EntityDamageCause } from "@minecraft/server";
import {
  CONFIG, hitChance, shouldDodge, add, subtract, scale, normalize,
  distanceSquared, boneTouchesPlayer, beamTouchesPlayer, accumulatedDamage, healthAfterTick,
  addKarmaDebt, karmaPulse, blasterHover, blastWidth, blastRecoil, blasterRingPlan, bonePose,
} from "./combat.js";

const SANS = "pinene_sans:sans";
const BONE = "pinene_sans:bone";
const BLASTER = "pinene_sans:blaster";
const RAY = "pinene_sans:ray";
const WARP_COUNT = "pinene_sans:warps";
const OWNER = "pinene_sans:owner";
const EXPIRES = "pinene_sans:expires";
const bosses = new Map();
const karmaDebts = new Map();
const attackCauses = new Set([
  "entityAttack", "projectile", "magic", "entityExplosion", "blockExplosion",
  "thorns", "sonicBoom", "maceSmash", "fireworks", "ramAttack", "none",
]);
let tick = 0;
let particleBudget = 0;
let warned = false;

function valid(entity) {
  try { return entity?.isValid === true; } catch { return false; }
}

function guard(fn) {
  try { return fn(); } catch { return undefined; }
}

function particle(dimension, id, position) {
  if (particleBudget-- > 0) guard(() => dimension.spawnParticle(id, position));
}

function sound(dimension, id, position, pitch = 1) {
  guard(() => dimension.playSound(id, position, { volume: 0.65, pitch }));
}

function removeVisual(entity) {
  if (valid(entity)) guard(() => entity.remove());
}

function cleanup(state) {
  for (const hazard of state.bones) { removeVisual(hazard.visual); removeVisual(hazard.marker); }
  for (const blaster of state.blasters) {
    removeVisual(blaster.visual);
    removeVisual(blaster.ray);
  }
  state.bones.length = 0;
  state.blasters.length = 0;
  state.blasterQueue.length = 0;
  if (state.casting) {
    state.casting = false;
    guard(() => state.entity.setProperty("pinene_sans:casting", false));
  }
}

function register(entity) {
  if (!valid(entity) || entity.typeId !== SANS || bosses.has(entity.id)) return;
  if (bosses.size >= CONFIG.maxBosses) {
    // Extra summons remain passive and invulnerable until a slot opens.
    return;
  }
  const warps = guard(() => entity.getDynamicProperty(WARP_COUNT)) ?? 0;
  const state = {
    entity, warps: Math.max(0, Math.floor(Number(warps) || 0)),
    nextWarp: tick + CONFIG.warpInterval, nextAttack: tick + 30,
    lastWarp: -100, pendingWarp: false, attackNumber: 0, casting: false,
    bones: [], blasters: [], blasterQueue: [], target: undefined, emptySince: undefined,
  };
  bosses.set(entity.id, state);
  guard(() => entity.setProperty("pinene_sans:casting", false));
  syncDisplay(state);
}

function syncDisplay(state) {
  guard(() => state.entity.setProperty("pinene_sans:tired", Math.min(1, state.warps / 50)));
  guard(() => { state.entity.nameTag = `Sans §7[ワープ ${state.warps} / 被弾 ${Math.round(hitChance(state.warps) * 100)}%]`; });
}

function eligible(player, dimension) {
  if (!valid(player) || player.dimension.id !== dimension.id) return false;
  const mode = guard(() => player.getGameMode());
  return (mode === "Survival" || mode === "Adventure" || mode === "survival" || mode === "adventure")
    && (guard(() => player.getComponent("minecraft:health")?.currentValue) ?? 0) > 0;
}

function nearby(state) {
  const entity = state.entity;
  return (guard(() => entity.dimension.getPlayers({
    location: entity.location, maxDistance: CONFIG.encounterRadius,
  })) ?? []).filter(player => eligible(player, entity.dimension));
}

// Try only loaded, dry, supported spaces. A failed teleport never adds fatigue.
function safeFeet(dimension, x, z, referenceY) {
  const bx = Math.floor(x), bz = Math.floor(z), by = Math.floor(referenceY);
  for (const delta of [0, 1, -1, 2, -2, 3, -3]) {
    const y = by + delta;
    const floor = guard(() => dimension.getBlock({ x: bx, y: y - 1, z: bz }));
    const feet = guard(() => dimension.getBlock({ x: bx, y, z: bz }));
    const head = guard(() => dimension.getBlock({ x: bx, y: y + 1, z: bz }));
    if (floor && !floor.isAir && !floor.isLiquid && !/lava|fire|magma|cactus/.test(floor.typeId)
      && feet?.isAir && head?.isAir) return { x: bx + 0.5, y, z: bz + 0.5 };
  }
  return undefined;
}

function warp(state, target) {
  if (!valid(state.entity) || tick - state.lastWarp < CONFIG.dodgeWarpCooldown) return false;
  const entity = state.entity;
  const center = valid(target) && target.dimension.id === entity.dimension.id ? target.location : entity.location;
  const old = entity.location;
  for (let i = 0; i < 16; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 4 + Math.random() * 5;
    const spot = safeFeet(entity.dimension, center.x + Math.cos(angle) * radius,
      center.z + Math.sin(angle) * radius, center.y);
    if (!spot || distanceSquared(spot, old) < 4) continue;
    const success = guard(() => entity.tryTeleport(spot, { checkForBlocks: true, facingLocation: center }));
    if (!success) continue;
    state.warps++;
    state.lastWarp = tick;
    state.nextWarp = tick + CONFIG.warpInterval;
    entity.setDynamicProperty(WARP_COUNT, state.warps);
    syncDisplay(state);
    particle(entity.dimension, "pinene_sans:warp", add(old, { x: 0, y: 0.7, z: 0 }));
    particle(entity.dimension, "pinene_sans:warp", add(spot, { x: 0, y: 0.7, z: 0 }));
    sound(entity.dimension, "mob.endermen.portal", spot, 1.5);
    return true;
  }
  return false;
}

function queueDodge(state, attacker) {
  if (state.pendingWarp) return;
  state.pendingWarp = true;
  system.run(() => {
    state.pendingWarp = false;
    if (valid(state.entity)) warp(state, attacker ?? state.target);
  });
}

// Cancel BEFORE health is touched: healing in an after-event cannot save a 1 HP boss.
// All actual movement and dynamic-property writes are deferred out of read-only mode.
if (world.beforeEvents.entityHurt) {
  world.beforeEvents.entityHurt.subscribe(event => {
    if (event.hurtEntity.typeId !== SANS) return;
    if (event.damageSource.cause === "selfDestruct" || event.damageSource.cause === "void") return;
    const state = bosses.get(event.hurtEntity.id);
    if (!state || !attackCauses.has(event.damageSource.cause)) {
      event.cancel = true;
      return;
    }
    if (shouldDodge(state.warps, Math.random())) {
      event.cancel = true;
      queueDodge(state, event.damageSource.damagingEntity);
    }
  });
} else {
  // Fail closed on unsupported runtimes instead of pretending the dodge works.
  warned = true;
  console.error("[Sans] Requires stable @minecraft/server 2.7.0 with beforeEvents.entityHurt.");
}

function visual(state, type, position, expires) {
  const entity = guard(() => state.entity.dimension.spawnEntity(type, position));
  if (!entity) return undefined;
  guard(() => entity.setDynamicProperty(OWNER, state.entity.id));
  guard(() => entity.setDynamicProperty(EXPIRES, expires));
  return entity;
}

function boneWall(state, player, angleOffset = 0) {
  const direction = normalize(subtract(player.location, state.entity.location));
  const angle = Math.atan2(direction.z, direction.x) + angleOffset;
  const forward = { x: Math.cos(angle), y: 0, z: Math.sin(angle) };
  const sideways = { x: -forward.z, y: 0, z: forward.x };
  const origin = add(player.location, scale(forward, -7));
  const gap = 2 + Math.floor(Math.random() * 7);
  const height = state.attackNumber % 2 ? 1.0 : 2.6;
  const activeAt = tick + CONFIG.boneWarningTicks;
  const endsAt = activeAt + CONFIG.boneLifeTicks;
  const expires = endsAt + CONFIG.boneRetreatTicks;
  for (let i = 0; i < 12; i++) {
    if (i === gap || i === gap + 1 || state.bones.length >= CONFIG.maxHazardsPerBoss) continue;
    const location = add(origin, scale(sideways, i - 5.5));
    location.y = Math.floor(player.location.y);
    const display = visual(state, BONE, add(location, { x: 0, y: -height, z: 0 }), expires);
    // Collision is created only when its visual exists.
    if (!display) return false;
    guard(() => display.setProperty("pinene_sans:height", height / 1.5));
    const marker = visual(state, RAY, add(location, {x:-forward.x*.36,y:.035,z:-forward.z*.36}),
      activeAt - CONFIG.boneRiseTicks);
    if (marker) guard(() => {
      marker.teleport(marker.location, {facingLocation:add(marker.location,forward)});
      marker.setProperty("pinene_sans:length", .72);
      marker.setProperty("pinene_sans:width", .035);
      marker.setProperty("pinene_sans:firing", false);
    });
    state.bones.push({ visual: display, marker, location, previous: location, height, forward,
      bornAt:tick, activeAt, endsAt, expires });
  }
  sound(state.entity.dimension, "mob.skeleton.step", origin, 0.75);
}

function aimBeam(state, blaster, target) {
  const endpoint = add(target.location, { x: 0, y: target.isSneaking ? 0.75 : 1.0, z: 0 });
  blaster.direction = normalize(subtract(endpoint, blaster.origin));
  // Origin is the mouth center. Skull geometry is rooted at its mouth.
  guard(() => blaster.visual.teleport(blaster.origin, { facingLocation: endpoint }));
  const block = guard(() => state.entity.dimension.getBlockFromRay(blaster.origin, blaster.direction,
    { maxDistance: CONFIG.beamLength, includeLiquidBlocks: false, includePassableBlocks: false }));
  let length = CONFIG.beamLength;
  if (block) {
    const position = add(block.block.location, block.faceLocation);
    length = Math.max(0, Math.sqrt(distanceSquared(blaster.origin, position)) - 0.05);
  }
  blaster.end = add(blaster.origin, scale(blaster.direction, length));
}

function updateRay(state, blaster, firing) {
  const dimension = state.entity.dimension;
  const block = guard(() => dimension.getBlockFromRay(blaster.origin, blaster.direction,
    { maxDistance: CONFIG.beamLength, includeLiquidBlocks: false, includePassableBlocks: false }));
  const length = block ? Math.max(0, Math.sqrt(distanceSquared(blaster.origin,
    add(block.block.location, block.faceLocation))) - 0.05) : CONFIG.beamLength;
  blaster.end = add(blaster.origin, scale(blaster.direction, length));
  if (!valid(blaster.ray)) return false;
  return guard(() => {
    blaster.ray.teleport(blaster.origin, { facingLocation: add(blaster.origin, blaster.direction) });
    blaster.ray.setProperty("pinene_sans:length", length);
    blaster.ray.setProperty("pinene_sans:width", firing ? blastWidth(tick - blaster.firesAt) : CONFIG.warningLineWidth);
    blaster.ray.setProperty("pinene_sans:firing", firing);
    return true;
  }) === true;
}

function summonBlasters(state, player, count) {
  const available = CONFIG.maxBlastersPerBoss - state.blasters.length - state.blasterQueue.length;
  const baseAngle = Math.atan2(state.entity.location.z - player.location.z,
    state.entity.location.x - player.location.x);
  for (const slot of blasterRingPlan(player.location, baseAngle, Math.min(count, available))) {
    state.blasterQueue.push({ origin: slot.origin, at: tick + slot.delay });
  }
}

function spawnQueuedBlasters(state, player) {
  state.blasterQueue = state.blasterQueue.filter(slot => {
    if (tick < slot.at) return true;
    const origin = slot.origin;
    if (!(guard(() => state.entity.dimension.getBlock(origin))?.isAir)) return false;
    const firesAt = tick + CONFIG.blasterWarningTicks;
    const fireEndsAt = firesAt + CONFIG.blasterFireTicks;
    const expires = fireEndsAt + CONFIG.blasterDepartureTicks;
    const display = visual(state, BLASTER, origin, expires);
    if (!display) return false;
    const ray = visual(state, RAY, origin, fireEndsAt);
    if (!ray) { removeVisual(display); return false; }
    const blaster = { visual: display, ray, origin, anchor: origin, bornAt: tick,
      firesAt, fireEndsAt, expires, direction: undefined, end: undefined };
    aimBeam(state, blaster, player);
    updateRay(state, blaster, false);
    state.blasters.push(blaster);
    sound(state.entity.dimension, "pinene_sans.blaster_charge", origin, 1 + ((tick % 3) - 1) * 0.025);
    return false;
  });
}

function nextAttack(state, player) {
  state.attackNumber++;
  const pattern = state.attackNumber % 4;
  if (pattern === 1) boneWall(state, player);
  else if (pattern === 2) summonBlasters(state, player, 4);
  else if (pattern === 3) {
    boneWall(state, player);
    boneWall(state, player, Math.PI / 2);
  } else {
    summonBlasters(state, player, state.warps >= 15 ? 6 : 4);
    if (state.warps >= 25) boneWall(state, player);
  }
  state.nextAttack = tick + CONFIG.attackInterval;
}

function addDamage(damage, player, amount, source, karma = 0) {
  const previous = damage.get(player.id);
  damage.set(player.id, {
    player, amount: accumulatedDamage(previous?.amount ?? 0, amount), source,
    karma: Math.max(previous?.karma ?? 0, karma),
  });
}

function updateHazards(state, players, damage) {
  const dimension = state.entity.dimension;
  state.bones = state.bones.filter(bone => {
    if (tick >= bone.expires || !valid(bone.visual)) {
      removeVisual(bone.visual); removeVisual(bone.marker); return false;
    }
    const pose = bonePose(tick - bone.bornAt, bone.height);
    if (!pose.warning) removeVisual(bone.marker);
    if (tick < bone.activeAt && tick % 6 === 0)
      particle(dimension, "pinene_sans:warning", add(bone.location, {x:0,y:.1,z:0}));
    bone.previous = bone.location;
    if (pose.damaging) {
      bone.location = add(bone.location, scale(bone.forward, CONFIG.boneSpeed));
      // Moving bones stop at solid blocks and never alter terrain.
      const block = guard(() => dimension.getBlock(add(bone.location, {x:0,y:.25,z:0})));
      if (!block || !block.isAir) { removeVisual(bone.visual); removeVisual(bone.marker); return false; }
    }
    const moved = guard(() => {
      bone.visual.setProperty("pinene_sans:height", pose.height / 1.5);
      bone.visual.teleport(add(bone.location,{x:0,y:pose.offsetY,z:0})); return true;
    });
    if (!moved) { removeVisual(bone.visual); removeVisual(bone.marker); return false; }
    if (!pose.damaging) return true;
    for (const player of players) {
      if (boneTouchesPlayer(bone.previous, bone.location, pose.height, player.location, player.isSneaking ? 1.5 : 1.8))
        addDamage(damage, player, CONFIG.boneDamagePerTick, state.entity);
    }
    return true;
  });
  state.blasters = state.blasters.filter(blaster => {
    if (tick >= blaster.expires || !valid(blaster.visual) || (tick < blaster.fireEndsAt && !valid(blaster.ray))) {
      removeVisual(blaster.visual); removeVisual(blaster.ray); return false;
    }
    const arrival = Math.min(1, (tick - blaster.bornAt) / CONFIG.blasterArrivalTicks);
    guard(() => blaster.visual.setProperty("pinene_sans:arrival", arrival));
    if (tick >= blaster.fireEndsAt) {
      // Only the skull remains during departure: no ray and no direct damage.
      removeVisual(blaster.ray);
      guard(() => {
        blaster.visual.setProperty("pinene_sans:firing", false);
        blaster.visual.setProperty("pinene_sans:recoil", 0);
        blaster.visual.setProperty("pinene_sans:departure",
          (tick - blaster.fireEndsAt + 1) / CONFIG.blasterDepartureTicks);
      });
      return true;
    }
    if (tick < blaster.firesAt) {
      // Track early, then lock aim 8 ticks before firing so a dodge is possible.
      if (tick < blaster.firesAt - CONFIG.blasterAimLockTicks && valid(state.target)) {
        blaster.origin = add(blaster.anchor, blasterHover(tick - blaster.bornAt));
        aimBeam(state, blaster, state.target);
      }
      if (!updateRay(state, blaster, false)) {
        removeVisual(blaster.visual); removeVisual(blaster.ray); return false;
      }
      return true;
    }
    if (tick === blaster.firesAt) {
      guard(() => blaster.visual.setProperty("pinene_sans:firing", true));
      sound(dimension, "pinene_sans.blaster_fire", blaster.origin, 1);
    }
    guard(() => blaster.visual.setProperty("pinene_sans:recoil", blastRecoil(tick - blaster.firesAt)));
    // A solid ray model avoids particle gaps/budget starvation, including when
    // several blasters fire together. The visible and damaging ends are shared.
    if (!updateRay(state, blaster, true)) {
      removeVisual(blaster.visual); removeVisual(blaster.ray); return false;
    }
    for (const player of players) {
      if (beamTouchesPlayer(blaster.origin, blaster.end, player.location, Math.min(CONFIG.beamRadius, blastWidth(tick - blaster.firesAt) / 2), player.isSneaking ? 1.5 : 1.8)) {
        addDamage(damage, player, CONFIG.blasterDamagePerTick, state.entity, CONFIG.karmaPerContactTick);
      }
    }
    return true;
  });
}

function applyTickDamage({ player, amount, source, quiet = false }) {
  if (!eligible(player, source.dimension)) return 0;
  const health = guard(() => player.getComponent("minecraft:health"));
  if (!health || health.currentValue <= 0) return 0;
  const before = health.currentValue;
  const next = healthAfterTick(health.currentValue, amount);
  if (next > 0) {
    // Native applyDamage every tick is throttled by vanilla hurt invulnerability.
    // Non-lethal health drain supplies the requested true 20 Hz damage instead.
    health.setCurrentValue(next);
    if (!quiet && tick % 5 === 0) {
      sound(player.dimension, "pinene_sans.karma_hit", player.location, 1);
      particle(player.dimension, "pinene_sans:beam", add(player.location, { x: 0, y: 1, z: 0 }));
    }
  } else {
    // Keep the lethal hit in the engine so death ownership/totems can run.
    // If vanilla immunity delays it, health stays at <=1 and contact retries.
    if (health.currentValue > 1) health.setCurrentValue(1);
    guard(() => player.applyDamage(Math.max(2, amount), { cause: EntityDamageCause.override, damagingEntity: source }));
  }
  return Math.max(0, before - health.currentValue);
}

function updateKarma(damage) {
  for (const [id, debt] of karmaDebts) {
    if (!valid(debt.source) || !bosses.has(debt.source.id) || !eligible(debt.player, debt.source.dimension)) {
      karmaDebts.delete(id); continue;
    }
    const health = debt.player.getComponent("minecraft:health");
    debt.amount = addKarmaDebt(debt.amount, 0, health.currentValue);
    if (debt.amount <= 0) { karmaDebts.delete(id); continue; }
    if (tick < debt.nextAt) continue;
    const capacity = Math.max(0, CONFIG.maxDamagePerTick - (damage.get(id)?.applied ?? 0));
    const amount = karmaPulse(debt.amount, health.currentValue, capacity);
    if (amount <= 0) continue;
    const applied = guard(() => applyTickDamage({ player: debt.player, amount, source: debt.source, quiet: true })) ?? 0;
    debt.amount = Math.max(0, debt.amount - applied);
    debt.nextAt = tick + CONFIG.karmaDrainInterval;
    if (applied > 0) particle(debt.player.dimension, "pinene_sans:karma", add(debt.player.location, { x: 0, y: 1, z: 0 }));
    if (debt.amount <= 0) karmaDebts.delete(id);
  }
}

world.afterEvents.entitySpawn.subscribe(event => {
  if (event.entity.typeId === SANS) register(event.entity);
});
world.afterEvents.entityLoad.subscribe(event => {
  if (event.entity.typeId === SANS) register(event.entity);
  else if (event.entity.typeId === BONE || event.entity.typeId === BLASTER || event.entity.typeId === RAY) {
    // Hazards do not survive a reload/unload: their encounter clock is in memory.
    system.run(() => removeVisual(event.entity));
  }
});
world.afterEvents.entityDie.subscribe(event => {
  karmaDebts.delete(event.deadEntity.id);
  const state = bosses.get(event.deadEntity.id);
  if (state) { cleanup(state); bosses.delete(event.deadEntity.id); }
});
world.afterEvents.playerLeave.subscribe(event => karmaDebts.delete(event.playerId));
system.runInterval(() => {
  tick++;
  particleBudget = 120;
  if (warned) return;
  // Recover already-loaded bosses after script reload and fill free slots.
  // Query only dimensions occupied by players, once a second, never every tick.
  if (tick === 1 || tick % 20 === 0) {
    const dimensions = new Map(world.getAllPlayers().map(player => [player.dimension.id, player.dimension]));
    for (const dimension of dimensions.values()) {
      for (const entity of guard(() => dimension.getEntities({ type: SANS })) ?? []) register(entity);
      for (const type of [BONE, BLASTER, RAY]) {
        for (const entity of guard(() => dimension.getEntities({ type })) ?? []) {
          const owner = guard(() => entity.getDynamicProperty(OWNER));
          const expires = guard(() => entity.getDynamicProperty(EXPIRES));
          const state = bosses.get(owner);
          const tracked = state && [...state.bones, ...state.blasters].some(hazard =>
            hazard.visual?.id === entity.id || hazard.ray?.id === entity.id || hazard.marker?.id === entity.id);
          if (!tracked || typeof expires !== "number" || expires <= tick) removeVisual(entity);
        }
      }
    }
  }
  const damage = new Map();
  for (const [id, state] of bosses) {
    if (!valid(state.entity)) { cleanup(state); bosses.delete(id); continue; }
    const players = nearby(state);
    if (!players.length) {
      cleanup(state);
      state.target = undefined;
      state.emptySince ??= tick;
      // Leaving a fight does not reset accumulated fatigue.
      state.nextAttack = tick + 30;
      state.nextWarp = tick + CONFIG.warpInterval;
      continue;
    }
    state.emptySince = undefined;
    state.target = players.reduce((closest, player) =>
      distanceSquared(player.location, state.entity.location) < distanceSquared(closest.location, state.entity.location)
        ? player : closest);
    if (tick % 10 === 0) guard(() => state.entity.teleport(state.entity.location, { facingLocation: state.target.location }));
    if (tick >= state.nextWarp) {
      if (!warp(state, state.target)) state.nextWarp = tick + 10;
    }
    if (tick >= state.nextAttack) nextAttack(state, state.target);
    spawnQueuedBlasters(state, state.target);
    updateHazards(state, players, damage);
    const casting = state.bones.length > 0 || state.blasters.length > 0 || state.blasterQueue.length > 0;
    if (casting !== state.casting) {
      state.casting = casting;
      guard(() => state.entity.setProperty("pinene_sans:casting", casting));
    }
  }
  for (const entry of damage.values()) {
    entry.applied = guard(() => applyTickDamage(entry)) ?? 0;
    if (entry.karma > 0 && valid(entry.source) && eligible(entry.player, entry.source.dimension)) {
      const previous = karmaDebts.get(entry.player.id);
      const health = entry.player.getComponent("minecraft:health").currentValue;
      const amount = addKarmaDebt(previous?.amount ?? 0, entry.karma, health);
      if (amount > 0) karmaDebts.set(entry.player.id, { player: entry.player, source: entry.source,
        amount, nextAt: tick + CONFIG.karmaGraceTicks });
    }
  }
  updateKarma(damage);
}, 1);

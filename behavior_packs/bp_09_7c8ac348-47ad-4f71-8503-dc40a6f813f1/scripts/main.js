import "./bomb_crossbow.js";
import "./sniper_crossbow.js";
import { world, system, EquipmentSlot, ItemStack } from "@minecraft/server";
import { installManagedEffects } from "./effects.js";
import { installDiet } from "./diet.js";
import { installKnockback } from "./knockback.js";
import { installCombat } from "./combat.js";
import { installGearControls } from "./controls.js";
import { MAX_REVIVES, REVIVE_TICKS, REVIVE_SPEED_AMPLIFIER, clampStage, reviveCap } from "./rules.js";



const ZOMBIE_ITEMS = {
  stemCell: "pinematerials:zonbikansaibou",
  armor: {
    helmet: [
      "zombiegear:zombie_helmet",
      "zombiegear:zombie_helmet_c1",
      "zombiegear:zombie_helmet_c2",
      "zombiegear:zombie_helmet_c3",
      "zombiegear:zombie_helmet_c4"
    ],
    chestplate: [
      "zombiegear:zombie_chestplate",
      "zombiegear:zombie_chestplate_c1",
      "zombiegear:zombie_chestplate_c2",
      "zombiegear:zombie_chestplate_c3",
      "zombiegear:zombie_chestplate_c4"
    ],
    leggings: [
      "zombiegear:zombie_leggings",
      "zombiegear:zombie_leggings_c1",
      "zombiegear:zombie_leggings_c2",
      "zombiegear:zombie_leggings_c3",
      "zombiegear:zombie_leggings_c4"
    ],
    boots: [
      "zombiegear:zombie_boots",
      "zombiegear:zombie_boots_c1",
      "zombiegear:zombie_boots_c2",
      "zombiegear:zombie_boots_c3",
      "zombiegear:zombie_boots_c4"
    ]
  }
};

const ARMOR_SLOT_KEYS = {
  head: "helmet",
  chest: "chestplate",
  legs: "leggings",
  feet: "boots"
};

function getHealth(player) {
  return player.getComponent("health");
}

function getEquippable(player) {
  if (!player?.isValid) return undefined;
  return player.getComponent("equippable");
}

function getArmor(player) {
  const eq = getEquippable(player);
  if (!eq) {
    return {};
  }
  return {
    head: eq.getEquipment(EquipmentSlot.Head),
    chest: eq.getEquipment(EquipmentSlot.Chest),
    legs: eq.getEquipment(EquipmentSlot.Legs),
    feet: eq.getEquipment(EquipmentSlot.Feet)
  };
}

function getArmorTypeIds(slotKey) {
  const armorKey = ARMOR_SLOT_KEYS[slotKey];
  if (!armorKey) {
    return [];
  }
  return ZOMBIE_ITEMS.armor[armorKey] ?? [];
}

function isZombieArmorItemForSlot(slotKey, item) {
  return !!item && getArmorTypeIds(slotKey).includes(item.typeId);
}

function isFullZombieArmor(player) {
  const armor = getArmor(player);
  return !!armor.head && !!armor.chest && !!armor.legs && !!armor.feet &&
    isZombieArmorItemForSlot("head", armor.head) &&
    isZombieArmorItemForSlot("chest", armor.chest) &&
    isZombieArmorItemForSlot("legs", armor.legs) &&
    isZombieArmorItemForSlot("feet", armor.feet);
}

function objective(name) {
  return world.scoreboard.getObjective(name);
}

function ensureObjectives() {
  const names = Object.values(SCORE);
  const overworld = world.getDimension("overworld");
  for (const name of names) {
    if (!objective(name)) {
      try {
        overworld.runCommand(`scoreboard objectives add ${name} dummy`);
      } catch (e) {
        // Ignore when command races with another initialization.
      }
    }
  }
}

function getScore(player, name) {
  const obj = objective(name);
  if (!obj) {
    return 0;
  }
  try {
    const value = obj.getScore(player);
    return typeof value === "number" ? value : 0;
  } catch (e) {
    return 0;
  }
}

function setScore(player, name, value) {
  const obj = objective(name);
  if (!obj) {
    return;
  }
  try {
    obj.setScore(player, value);
  } catch (e) {
    // Player identity can disappear during logout/death ticks.
  }
}

function inCombat(player) {
  return getScore(player, SCORE.combatEnd) > system.currentTick;
}

function setCombatNow(player) {
  setScore(player, SCORE.combatEnd, system.currentTick + COMBAT_TICKS);
}

function isCharging(player) {
  return getScore(player, SCORE.charging) === 1;
}

function startCharging(player) {
  setScore(player, SCORE.charging, 1);
  setScore(player, SCORE.chargeEnd, system.currentTick + CHARGE_TICKS);
}

function stopCharging(player) {
  setScore(player, SCORE.charging, 0);
  setScore(player, SCORE.chargeEnd, 0);
}

function consumeOneSelectedItem(player, expectedTypeId) {
  const inventoryComp = player.getComponent("inventory");
  const inv = inventoryComp ? inventoryComp.container : undefined;
  if (!inv) {
    return false;
  }
  const slot = player.selectedSlotIndex;
  const stack = inv.getItem(slot);
  if (!stack || stack.typeId !== expectedTypeId || stack.amount < 1) {
    return false;
  }

  const remaining = stack.amount - 1;
  if (remaining === 0) {
    inv.setItem(slot, undefined);
  } else {
    stack.amount -= 1;
    inv.setItem(slot, stack);
  }
  const written = inv.getItem(slot);
  if (remaining === 0 ? !!written : written?.typeId !== expectedTypeId || written.amount !== remaining) {
    throw new Error("Stem cell write did not succeed");
  }
  return true;
}

function isStemCellItem(typeId) {
  return typeId === ZOMBIE_ITEMS.stemCell;
}

function applyBonusNaturalRegen(player) {
  if (!isFullZombieArmor(player)) {
    return;
  }

  if (isDaytime()) {
    return;
  }

  try {
    const hunger = player.getComponent("minecraft:player.hunger");
    if (!hunger || hunger.currentValue < BONUS_REGEN_MIN_FOOD) {
      return;
    }
  } catch (e) {
    return;
  }

  const health = getHealth(player);
  if (!health || health.currentValue <= 0 || health.currentValue >= health.effectiveMax) {
    return;
  }

  heal(player, BONUS_REGEN_HEAL);
}

function isDaytime() {
  try {
    const t = world.getTimeOfDay();
    return t >= 0 && t < 13000;
  } catch (e) {
    return false;
  }
}

function isInDirectSunlight(player) {
  try {
    const head = {
      x: player.location.x,
      y: player.location.y + 1.62,
      z: player.location.z
    };

    // Any hit above the head means the player is shaded.
    const hit = player.dimension.getBlockFromRay(head, { x: 0, y: 1, z: 0 }, {
      maxDistance: 256,
      includeLiquidBlocks: true,
      includePassableBlocks: false
    });

    return !hit;
  } catch (e) {
    return false;
  }
}

function repairArmor(player, percent) {
  const eq = getEquippable(player);
  if (!eq) {
    return;
  }

  const slots = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet];
  for (const slot of slots) {
    const item = eq.getEquipment(slot);
    if (!item) {
      continue;
    }
    const slotKey = slot === EquipmentSlot.Head ? "head"
      : slot === EquipmentSlot.Chest ? "chest"
      : slot === EquipmentSlot.Legs ? "legs"
      : "feet";
    if (!isZombieArmorItemForSlot(slotKey, item)) {
      continue;
    }
    const durability = item.getComponent("durability");
    if (!durability) {
      continue;
    }
    const repair = Math.max(1, Math.floor(durability.maxDurability * percent));
    durability.damage = Math.max(0, durability.damage - repair);
    eq.setEquipment(slot, item);
  }
}

function damageArmor(player, amount) {
  const eq = getEquippable(player);
  if (!eq) {
    return;
  }

  const slots = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet];
  for (const slot of slots) {
    const item = eq.getEquipment(slot);
    if (!item) {
      continue;
    }
    const slotKey = slot === EquipmentSlot.Head ? "head"
      : slot === EquipmentSlot.Chest ? "chest"
      : slot === EquipmentSlot.Legs ? "legs"
      : "feet";
    if (!isZombieArmorItemForSlot(slotKey, item)) {
      continue;
    }
    const durability = item.getComponent("durability");
    if (!durability) {
      continue;
    }
    durability.damage = Math.min(durability.maxDurability, durability.damage + amount);
    eq.setEquipment(slot, item);
  }
}

function applySunPenalty(player) {
  if (!isFullZombieArmor(player)) {
    return;
  }
  if (player.dimension.id !== "minecraft:overworld") {
    return;
  }
  if (!isDaytime()) {
    return;
  }
  if (!isInDirectSunlight(player)) {
    return;
  }

  player.setOnFire(4, true);
  damageArmor(player, 2);
}

// Persistent player resources are independent from the armor's corruption IDs.
// zs_corruption is a diagnostic mirror; the equipped items are authoritative.
const SCORE = {
  combatEnd: "zs_combat_end", charging: "zs_charging", chargeEnd: "zs_charge_end",
  revives: "zs_revives", corruption: "zs_corruption", migrated: "zs_v4_migrated"
};
const CHARGE_TICKS = 160;
const COMBAT_TICKS = 400;
const MAX_CHARGE = MAX_REVIVES;
const BONUS_REGEN_HEAL = 1;
const BONUS_REGEN_MIN_FOOD = 8;
const ROTTEN_FLESH_HEAL = 8;
const ROTTEN_FLESH_REPAIR_FRACTION = 0.10;
const STRENGTH_EFFECT_TICKS = 80;
const chargeSnapshots = new Map();

function corruption(player) {
  const armor = getArmor(player);
  const stages = Object.entries(ARMOR_SLOT_KEYS).map(([key]) => getArmorTypeIds(key).indexOf(armor[key]?.typeId));
  return stages.every(n => n >= 0) ? Math.min(...stages) : -1;
}

function initializePlayer(player) {
  if (getScore(player, SCORE.migrated)) return;
  // Preserve the old equipped, uniform charge count once, without rewriting IDs.
  // Inventory/unequipped cN items now mean corruption and do not grant resources.
  setScore(player, SCORE.revives, Math.min(reviveCap(corruption(player)), Math.max(0, corruption(player))));
  setScore(player, SCORE.migrated, 1);
  stopCharging(player);
  setScore(player, SCORE.combatEnd, 0);
  if (player.hasTag("zs_revive_strength_boost")) {
    for (const effect of ["strength", "speed", "jump_boost", "haste", "resistance"]) player.removeEffect(effect);
    player.removeTag("zs_revive_strength_boost");
  }
  player.removeTag("zs_zombie_aura");
  player.removeTag("zs_zombie_heal_bypass");
}

const managedEffects = installManagedEffects(isFullZombieArmor);
function forceMaxHpState(player) { managedEffects.syncHealth(player, isFullZombieArmor(player)); }
function syncStrengthBoost(player, full) { managedEffects.syncStrength(player, full); }

function revives(player) {
  return Math.min(clampStage(getScore(player, SCORE.revives)), reviveCap(corruption(player)));
}

function createArmorVariantItem(sourceItem, targetTypeId) {
  const next = new ItemStack(targetTypeId, sourceItem.amount);
  const srcDurability = sourceItem.getComponent("minecraft:durability");
  const dstDurability = next.getComponent("minecraft:durability");
  if (srcDurability && dstDurability) dstDurability.damage = Math.min(dstDurability.maxDurability, srcDurability.damage);
  next.nameTag = sourceItem.nameTag;
  next.setLore(sourceItem.getLore());
  next.keepOnDeath = sourceItem.keepOnDeath;
  next.lockMode = sourceItem.lockMode;
  next.setCanDestroy(sourceItem.getCanDestroy());
  next.setCanPlaceOn(sourceItem.getCanPlaceOn());
  for (const id of sourceItem.getDynamicPropertyIds()) next.setDynamicProperty(id, sourceItem.getDynamicProperty(id));
  const srcEnchant = sourceItem.getComponent("minecraft:enchantable");
  const enchantments = srcEnchant?.getEnchantments() ?? [];
  if (enchantments.length) {
    const dstEnchant = next.getComponent("minecraft:enchantable");
    if (!dstEnchant) throw new Error("Target armor cannot preserve enchantments");
    dstEnchant.addEnchantments(enchantments);
  }
  return next;
}

function setCorruption(player, value) {
  if (corruption(player) < 0) return false;
  const eq = getEquippable(player);
  const slots = [[EquipmentSlot.Head, "head"], [EquipmentSlot.Chest, "chest"],
    [EquipmentSlot.Legs, "legs"], [EquipmentSlot.Feet, "feet"]];
  const originals = slots.map(([slot]) => eq.getEquipment(slot));
  try {
    // Construct all four BEFORE replacing any: metadata errors must not eat gear.
    const next = slots.map(([, key], i) => {
      const id = getArmorTypeIds(key)[clampStage(value)];
      return originals[i].typeId === id ? originals[i].clone() : createArmorVariantItem(originals[i], id);
    });
    for (let i = 0; i < slots.length; i++) {
      if (!eq.setEquipment(slots[i][0], next[i])) throw new Error("setEquipment failed");
    }
    setScore(player, SCORE.corruption, clampStage(value));
    return true;
  } catch (error) {
    for (let i = 0; i < slots.length; i++) {
      try {
        if (!eq.setEquipment(slots[i][0], originals[i])) throw new Error("Rollback equipment write rejected");
      } catch (rollbackError) {
        console.error(`[ZombieGear] armor rollback failed: ${rollbackError}`);
      }
    }
    console.error(`[ZombieGear] corruption swap failed; revive not consumed: ${error}`);
    return false;
  }
}

function canRevive(player) {
  return player.typeId === "minecraft:player" && corruption(player) >= 0 && revives(player) > 0;
}

function playReviveSound(player, id, options) {
  const location = player.location ?? { x: 0, y: 0, z: 0 };
  try { player.dimension?.playSound(id, location, options); } catch (error) {
    // Some sound ids are runtime/version dependent; keep revive logic independent.
  }
  try { player.playSound(id, options); } catch (error) {
    // Player-local playback is best-effort and improves audibility when dimension sound is quiet.
  }
}

function playReviveSounds(player) {
  const sounds = [
    { id: "mob.zombie.say", options: { volume: 4.6, pitch: 0.45 } },
    { id: "mob.zombie.death", options: { volume: 4.0, pitch: 0.55 } },
    { id: "mob.zombie.say", options: { volume: 3.2, pitch: 0.75 } },
    { id: "mob.warden.heartbeat", options: { volume: 5.0, pitch: 0.62 } },
    { id: "mob.warden.heartbeat", options: { volume: 4.2, pitch: 0.88 } },
    { id: "random.totem", options: { volume: 3.2, pitch: 0.85 } }
  ];
  for (const sound of sounds) {
    playReviveSound(player, sound.id, sound.options);
  }
}

function applyReviveVision(player) {
  try {
    player.camera?.fade({
      fadeColor: { red: 0.55, green: 0.04, blue: 0.02 },
      fadeTime: { fadeInTime: 0.05, holdTime: 0, fadeOutTime: 2.4 }
    });
  } catch (error) {
    // Camera fade can be unavailable in some runtime contexts; revive must still succeed.
  }
}

function armorSnapshot(player) {
  const eq = getEquippable(player);
  return [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet]
    .map(slot => [slot, eq.getEquipment(slot)]);
}

function rollbackArmor(player, originals) {
  const eq = getEquippable(player);
  for (const [slot, item] of originals) {
    if (!eq.setEquipment(slot, item)) throw new Error(`Armor rollback failed: ${slot}`);
  }
  setScore(player, SCORE.corruption, corruption(player));
}

function tryRevive(player) {
  const h = getHealth(player);
  // Dead entities must never consume resources, even if isValid remains true.
  if (!player.isValid || !h || h.currentValue <= 0 || !canRevive(player)) return false;
  const stock = revives(player), target = Math.min(4, corruption(player) + 1);
  const originals = armorSnapshot(player), previousHp = h.currentValue;
  if (!setCorruption(player, target)) return false;
  try {
    forceMaxHpState(player);
    h.setCurrentValue(Math.min(h.effectiveMax, 40));
    if (h.currentValue < Math.min(h.effectiveMax, 40)) throw new Error("HP recovery did not succeed");
    const nextStock = Math.min(stock - 1, reviveCap(target));
    setScore(player, SCORE.revives, nextStock);
    if (getScore(player, SCORE.revives) !== nextStock) throw new Error("Revive stock write failed");
  } catch (error) {
    rollbackArmor(player, originals);
    setScore(player, SCORE.revives, stock);
    h.setCurrentValue(previousHp);
    console.error(`[ZombieGear] revive rolled back: ${error}`);
    return false;
  }
  stopCharging(player);
  chargeSnapshots.delete(player.id);
  knockback.onRevive(player);
  try {
    player.extinguishFire(true);
    player.addEffect("speed", REVIVE_TICKS, { amplifier: REVIVE_SPEED_AMPLIFIER, showParticles: true });
    playReviveSounds(player);
    applyReviveVision(player);
    player.sendMessage(`[ZombieGear] 蘇生: 残り${revives(player)}/${reviveCap(target)}・腐敗${target}/4`);
  } catch (error) { console.warn(`[ZombieGear] revive feedback: ${error}`); }
  return true;
}

function heal(player, amount) {
  const health = getHealth(player);
  if (health) health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + amount));
}

function markCombat(entity) {
  if (entity.typeId !== "minecraft:player") return;
  setCombatNow(entity);
  if (isCharging(entity)) {
    stopCharging(entity);
    chargeSnapshots.delete(entity.id);
    entity.sendMessage("[ZombieGear] 戦闘によりチャージ中断");
  }
}

function chargeSignature(player) {
  return JSON.stringify(armorSnapshot(player).map(([slot, item]) => [slot, item?.typeId,
    item?.nameTag, item?.getLore(), item?.getDynamicPropertyIds().map(id => [id, item.getDynamicProperty(id)]),
    item?.getComponent("minecraft:enchantable")?.getEnchantments().map(e => [e.type.id, e.level])]));
}

function holdingStemCell(player) {
  return isStemCellItem(player.getComponent("minecraft:inventory")?.container?.getItem(player.selectedSlotIndex)?.typeId);
}

function tickChargeCompletion(player) {
  if (!isCharging(player)) return;
  const snapshot = chargeSnapshots.get(player.id);
  if (!snapshot || !player.isSneaking || !holdingStemCell(player) || !isFullZombieArmor(player) || inCombat(player) ||
      snapshot.slot !== player.selectedSlotIndex || chargeSignature(player) !== snapshot.armor) {
    stopCharging(player); chargeSnapshots.delete(player.id); return;
  }
  if (system.currentTick < getScore(player, SCORE.chargeEnd)) return;
  stopCharging(player); chargeSnapshots.delete(player.id);
  const stage = corruption(player), stock = revives(player);
  if (stage === 0 && stock >= MAX_REVIVES) return;
  const originals = armorSnapshot(player), target = Math.max(0, stage - 1);
  const inventory = player.getComponent("minecraft:inventory")?.container;
  const slot = player.selectedSlotIndex, cell = inventory?.getItem(slot)?.clone();
  if (!cell) return;
  if (!setCorruption(player, target)) return;
  try {
    if (!consumeOneSelectedItem(player, ZOMBIE_ITEMS.stemCell)) throw new Error("Stem cell is no longer selected");
    const nextStock = Math.min(stock + 1, reviveCap(target));
    setScore(player, SCORE.revives, nextStock);
    if (getScore(player, SCORE.revives) !== nextStock) throw new Error("Charge stock write failed");
  } catch (error) {
    rollbackArmor(player, originals);
    inventory.setItem(slot, cell);
    setScore(player, SCORE.revives, stock);
    console.warn(`[ZombieGear] charge rolled back: ${error}`);
    return;
  }
  player.sendMessage(`[ZombieGear] 浄化・チャージ完了: 腐敗${target} / 蘇生${revives(player)}/${reviveCap(target)}`);
}

const knockback = installKnockback({ corruption, getArmor });
const combat = installCombat({ isFull: isFullZombieArmor, corruption, canRevive, tryRevive, markCombat, knockback });

function beginCharge(player) {
  initializePlayer(player);
  if (!player.isSneaking || !isFullZombieArmor(player) || inCombat(player) || isCharging(player) ||
      (corruption(player) === 0 && revives(player) >= MAX_REVIVES) || !holdingStemCell(player)) return;
  startCharging(player);
  chargeSnapshots.set(player.id, { slot: player.selectedSlotIndex, armor: chargeSignature(player) });
}

installGearControls({
  state(player) {
    return {
      full: isFullZombieArmor(player), corruption: corruption(player), revives: revives(player),
      maxRevives: reviveCap(corruption(player)), infection: combat.infectionStage(player), charging: isCharging(player),
      chargeEnd: getScore(player, SCORE.chargeEnd), combat: inCombat(player), holdingStemCell: holdingStemCell(player)
    };
  },
  start: beginCharge,
  cancel(player) { stopCharging(player); chargeSnapshots.delete(player.id); }
});

installDiet({ isFull: isFullZombieArmor, heal, repairArmor });

// Death is cleanup only; recovery must happen before native death is committed.
world.afterEvents.entityDie.subscribe(ev => {
  if (ev.deadEntity.typeId !== "minecraft:player") return;
  chargeSnapshots.delete(ev.deadEntity.id);
});

world.afterEvents.playerSpawn.subscribe(ev => {
  system.run(() => {
    if (!ev.player.isValid) return;
    ensureObjectives();
    initializePlayer(ev.player);
    stopCharging(ev.player);
    setScore(ev.player, SCORE.combatEnd, 0);
    forceMaxHpState(ev.player);
  });
});
world.afterEvents.playerLeave.subscribe(ev => { chargeSnapshots.delete(ev.playerId); });

// Completion and resource clamping run every tick, independently of the 1-second aura.
system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    try {
      initializePlayer(player);
      const stock = revives(player);
      if (stock !== getScore(player, SCORE.revives)) setScore(player, SCORE.revives, stock);
      tickChargeCompletion(player);
      knockback.sync(player);
      forceMaxHpState(player);
      syncStrengthBoost(player, isFullZombieArmor(player));
    } catch (error) { if (player.isValid) console.warn(`[ZombieGear] tick failed: ${error}`); }
  }
}, 1);

system.run(() => {
  ensureObjectives();
  for (const player of world.getAllPlayers()) initializePlayer(player);
  console.info("[ZombieGear] FINAL gameplay boot OK; server API 2.6.0");
});

let tick20 = 0;
system.runInterval(() => {
  tick20++;
  for (const player of world.getAllPlayers()) {
    try {
      initializePlayer(player);
      forceMaxHpState(player);
      const full = isFullZombieArmor(player);
      const current = corruption(player);
      setScore(player, SCORE.corruption, current);


      syncStrengthBoost(player, full);
      if (!full) continue;
      applyBonusNaturalRegen(player);
      const hunger = player.getEffect("hunger");
      if (!hunger || hunger.duration < 30) player.addEffect("hunger", 60, { amplifier: 1, showParticles: false });
      for (const id of ["regeneration", "instant_health"]) if (player.getEffect(id)) player.removeEffect(id);
      if (tick20 % 2 === 0) applySunPenalty(player);
    } catch (error) {
      console.error(`[ZombieGear] player update failed: ${error}`);
    }
  }
}, 20);

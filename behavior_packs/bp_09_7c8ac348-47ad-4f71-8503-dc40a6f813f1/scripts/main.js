import { world, system, EquipmentSlot, ItemStack } from "@minecraft/server";
import { installCombat } from "./combat.js";
import { installGearControls } from "./controls.js";
import { MAX_REVIVES, REVIVE_TICKS, REVIVE_SPEED_AMPLIFIER, clampStage } from "./rules.js";

// バニラ食料IDセット（スクリプティングAPIはバニラItemのfoodコンポーネントを返さないため手動リスト）
const VANILLA_FOOD_IDS = new Set([
  "minecraft:apple", "minecraft:golden_apple", "minecraft:enchanted_golden_apple",
  "minecraft:bread", "minecraft:cookie", "minecraft:pumpkin_pie",
  "minecraft:carrot", "minecraft:golden_carrot", "minecraft:potato",
  "minecraft:baked_potato", "minecraft:poisonous_potato",
  "minecraft:beef", "minecraft:cooked_beef",
  "minecraft:porkchop", "minecraft:cooked_porkchop",
  "minecraft:chicken", "minecraft:cooked_chicken",
  "minecraft:mutton", "minecraft:cooked_mutton",
  "minecraft:rabbit", "minecraft:cooked_rabbit",
  "minecraft:cod", "minecraft:cooked_cod",
  "minecraft:salmon", "minecraft:cooked_salmon",
  "minecraft:tropical_fish", "minecraft:pufferfish",
  "minecraft:melon_slice", "minecraft:sweet_berries", "minecraft:glow_berries",
  "minecraft:beetroot", "minecraft:beetroot_soup",
  "minecraft:mushroom_stew", "minecraft:rabbit_stew",
  "minecraft:suspicious_stew", "minecraft:dried_kelp",
  "minecraft:honey_bottle", "minecraft:milk_bucket",
  "minecraft:spider_eye", "minecraft:chorus_fruit",
  "minecraft:egg" // チキンジョッキー用（食べられる）
]);

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
    const value = obj.getScore(player.scoreboardIdentity);
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
    obj.setScore(player.scoreboardIdentity, value);
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

  if (stack.amount === 1) {
    inv.setItem(slot, undefined);
  } else {
    stack.amount -= 1;
    inv.setItem(slot, stack);
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
  if (!health || health.currentValue >= health.effectiveMax) {
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
const mismatchWarnings = new Set();
const ownedHealthBoost = new Map();
const ownedStrengthBase = new Map();
const strengthApplying = new Set();
const chargeSnapshots = new Map();
const foodSnapshots = new Map();

function corruption(player) {
  const armor = getArmor(player);
  const stages = Object.entries(ARMOR_SLOT_KEYS).map(([key]) => getArmorTypeIds(key).indexOf(armor[key]?.typeId));
  return stages[0] >= 0 && stages.every(n => n === stages[0]) ? stages[0] : -1;
}

function initializePlayer(player) {
  if (getScore(player, SCORE.migrated)) return;
  // Preserve the old equipped, uniform charge count once, without rewriting IDs.
  // Inventory/unequipped cN items now mean corruption and do not grant resources.
  setScore(player, SCORE.revives, Math.max(0, corruption(player)));
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

function isFoodItem(stack) {
  if (!stack || stack.typeId === "minecraft:milk_bucket") return false;
  if (stack.typeId === "minecraft:rotten_flesh") return true;
  return VANILLA_FOOD_IDS.has(stack.typeId) || !!stack.getComponent("minecraft:food");
}

function getFoodComponent(player, componentName) {
  try {
    return player.getComponent(componentName);
  } catch (error) {
    return undefined;
  }
}

function snapshotFoodState(player, itemStack) {
  if (!isFullZombieArmor(player) || !isFoodItem(itemStack) || itemStack.typeId === "minecraft:rotten_flesh") return;
  foodSnapshots.set(player.id, {
    typeId: itemStack.typeId,
    hunger: getFoodComponent(player, "minecraft:player.hunger")?.currentValue,
    saturation: getFoodComponent(player, "minecraft:player.saturation")?.currentValue
  });
}

function restoreFoodValue(player, componentName, value) {
  if (typeof value !== "number") return;
  const component = getFoodComponent(player, componentName);
  if (!component) return;
  try {
    component.currentValue = value;
  } catch (error) {
    try {
      component.setCurrentValue(value);
    } catch (ignored) {
      // Some runtime builds expose the food values as read-only.
    }
  }
}

function applyFullSetFoodAftermath(player, itemStack) {
  if (!isFullZombieArmor(player) || !isFoodItem(itemStack) || itemStack.typeId === "minecraft:rotten_flesh") return;
  const snapshot = foodSnapshots.get(player.id);
  foodSnapshots.delete(player.id);
  restoreFoodValue(player, "minecraft:player.hunger", snapshot?.hunger);
  restoreFoodValue(player, "minecraft:player.saturation", snapshot?.saturation);
}

function rememberExternalStrength(player, effect) {
  if (!effect) {
    ownedStrengthBase.delete(player.id);
    return;
  }
  const duration = Number.isFinite(effect.duration) ? Math.max(1, effect.duration) : STRENGTH_EFFECT_TICKS;
  const amplifier = Number.isFinite(effect.amplifier) ? effect.amplifier : 0;
  ownedStrengthBase.set(player.id, { amplifier, endTick: system.currentTick + duration });
}

function currentExternalStrength(player) {
  const base = ownedStrengthBase.get(player.id);
  if (!base) return undefined;
  if (base.endTick <= system.currentTick) {
    ownedStrengthBase.delete(player.id);
    return undefined;
  }
  return base;
}

function addManagedStrength(player, duration, amplifier) {
  strengthApplying.add(player.id);
  try {
    player.addEffect("strength", duration, { amplifier, showParticles: false });
    player.setDynamicProperty("zombiegear:strength_boost_owned", true);
  } finally {
    strengthApplying.delete(player.id);
  }
}

function syncStrengthBoost(player, full) {
  const owned = !!player.getDynamicProperty("zombiegear:strength_boost_owned");
  const current = player.getEffect("strength");
  if (!full) {
    if (owned) {
      player.removeEffect("strength");
      const base = currentExternalStrength(player);
      if (base) player.addEffect("strength", Math.max(1, base.endTick - system.currentTick), { amplifier: base.amplifier, showParticles: true });
    }
    ownedStrengthBase.delete(player.id);
    player.setDynamicProperty("zombiegear:strength_boost_owned", undefined);
    return;
  }
  if (current && !owned) rememberExternalStrength(player, current);
  const base = currentExternalStrength(player);
  const desiredAmplifier = (base ? base.amplifier : -1) + 1;
  const desiredDuration = base ? Math.max(STRENGTH_EFFECT_TICKS, base.endTick - system.currentTick) : STRENGTH_EFFECT_TICKS;
  if (!current || current.amplifier !== desiredAmplifier || current.duration < 40 || !owned) {
    addManagedStrength(player, desiredDuration, desiredAmplifier);
  }
}

function effectAddId(ev) {
  const raw = ev.effectType?.id ?? ev.effectType ?? ev.effect?.typeId ?? ev.effect?.type?.id ?? "";
  return String(raw).replace("minecraft:", "");
}

function effectAddSnapshot(ev) {
  return {
    amplifier: Number.isFinite(ev.amplifier) ? ev.amplifier : Number.isFinite(ev.effect?.amplifier) ? ev.effect.amplifier : 0,
    duration: Number.isFinite(ev.duration) ? ev.duration : Number.isFinite(ev.effect?.duration) ? ev.effect.duration : STRENGTH_EFFECT_TICKS
  };
}


function revives(player) {
  return clampStage(getScore(player, SCORE.revives));
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
      try { eq.setEquipment(slots[i][0], originals[i]); } catch (rollbackError) {
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

function playReviveSounds(player) {
  const location = player.location ?? { x: 0, y: 0, z: 0 };
  const sounds = [
    { id: "mob.zombie.say", options: { volume: 2.8, pitch: 0.55 } },
    { id: "mob.warden.heartbeat", options: { volume: 2.4, pitch: 0.75 } },
    { id: "random.totem", options: { volume: 2.6, pitch: 0.85 } }
  ];
  for (const sound of sounds) {
    try {
      player.dimension?.playSound(sound.id, location, sound.options);
    } catch (error) {
      try { player.playSound(sound.id, sound.options); } catch (ignored) { /* sound id may be unavailable on some runtimes */ }
    }
  }
}

function applyReviveVision(player) {
  try {
    player.camera?.fade({
      fadeColor: { red: 0.75, green: 0.02, blue: 0.02 },
      fadeTime: { fadeInTime: 0.15, holdTime: 2.2, fadeOutTime: 0.75 }
    });
  } catch (error) {
    // Camera fade can be unavailable in some runtime contexts; revive must still succeed.
  }
}

function tryRevive(player) {
  if (!canRevive(player)) return false;
  if (!setCorruption(player, Math.min(4, corruption(player) + 1))) return false;
  setScore(player, SCORE.revives, revives(player) - 1);
  forceMaxHpState(player);
  const h = getHealth(player);
  h.setCurrentValue(Math.min(h.effectiveMax, 40));
  player.extinguishFire(true);
  player.addEffect("speed", REVIVE_TICKS, { amplifier: REVIVE_SPEED_AMPLIFIER, showParticles: true });
  playReviveSounds(player);
  applyReviveVision(player);
  player.sendMessage(`[ZombieGear] 蘇生: 残り${revives(player)}/4・腐敗${corruption(player)}/4`);
  return true;
}

function tryEmergencyRevive(player, reason) {
  if (player?.typeId !== "minecraft:player" || !player.isValid || !canRevive(player)) return false;
  const health = getHealth(player);
  if (!health || health.currentValue > 0) return false;
  stopCharging(player);
  chargeSnapshots.delete(player.id);
  const revived = tryRevive(player);
  if (revived) {
    setCombatNow(player);
    player.addEffect("resistance", REVIVE_TICKS, { amplifier: 4, showParticles: false });
    console.warn(`[ZombieGear] emergency revive recovered ${player.id} after ${reason}`);
  }
  return revived;
}

function forceMaxHpState(player) {
  if (isFullZombieArmor(player)) {
    const effect = player.getEffect("health_boost");
    if (!ownedHealthBoost.has(player.id)) {
      // Save a pre-existing boost so unequipping does not erase another addon.
      const alreadyOwned = player.getDynamicProperty("zombiegear:health_boost_owned");
      const saved = player.getDynamicProperty("zombiegear:prior_health_boost");
      let prior = null;
      if (alreadyOwned && typeof saved === "string") {
        try { prior = JSON.parse(saved); } catch (error) { /* discard invalid legacy metadata */ }
      } else if (!alreadyOwned && effect && effect.amplifier !== 14) {
        prior = { amplifier: effect.amplifier, end: Date.now() + effect.duration * 50 };
      }
      ownedHealthBoost.set(player.id, prior);
      player.setDynamicProperty("zombiegear:prior_health_boost", prior ? JSON.stringify(prior) : undefined);
      player.setDynamicProperty("zombiegear:health_boost_owned", true);
    }
    if (!effect || effect.amplifier !== 14 || effect.duration < 100) {
      player.addEffect("health_boost", 600, { amplifier: 14, showParticles: false });
    }
  } else if (ownedHealthBoost.has(player.id) || player.getDynamicProperty("zombiegear:health_boost_owned")) {
    let prior = ownedHealthBoost.get(player.id);
    if (!ownedHealthBoost.has(player.id)) {
      try { prior = JSON.parse(player.getDynamicProperty("zombiegear:prior_health_boost") ?? "null"); } catch (error) { prior = null; }
    }
    if (player.getEffect("health_boost")?.amplifier === 14) {
      player.removeEffect("health_boost");
      if (prior && prior.end > Date.now()) {
        player.addEffect("health_boost", Math.max(1, Math.ceil((prior.end - Date.now()) / 50)), { amplifier: prior.amplifier, showParticles: false });
      }
    }
    ownedHealthBoost.delete(player.id);
    player.setDynamicProperty("zombiegear:health_boost_owned", undefined);
    player.setDynamicProperty("zombiegear:prior_health_boost", undefined);
    const h = getHealth(player);
    if (h && h.currentValue > h.effectiveMax) h.setCurrentValue(h.effectiveMax);
  }
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

function tickChargeCompletion(player) {
  if (!isCharging(player)) return;
  if (!isFullZombieArmor(player) || inCombat(player) ||
      JSON.stringify(Object.values(getArmor(player)).map(i => i?.typeId)) !== chargeSnapshots.get(player.id)) {
    stopCharging(player);
    chargeSnapshots.delete(player.id);
    return;
  }
  if (system.currentTick < getScore(player, SCORE.chargeEnd)) return;
  stopCharging(player);
  chargeSnapshots.delete(player.id);
  if (revives(player) >= MAX_REVIVES || !consumeOneSelectedItem(player, ZOMBIE_ITEMS.stemCell)) {
    player.sendMessage("[ZombieGear] チャージ失敗: ゾンビ幹細胞を手に持ち続けてください");
    return;
  }
  setScore(player, SCORE.revives, revives(player) + 1);
  player.sendMessage(`[ZombieGear] チャージ完了: ${revives(player)}/4`);
}

const combat = installCombat({ isFull: isFullZombieArmor, corruption, canRevive, tryRevive, markCombat });

function beginCharge(player) {
  initializePlayer(player);
  if (!isFullZombieArmor(player) || inCombat(player) || isCharging(player) || revives(player) >= MAX_REVIVES ||
      !isStemCellItem(player.getComponent("minecraft:inventory")?.container?.getItem(player.selectedSlotIndex)?.typeId)) return;
  startCharging(player);
  chargeSnapshots.set(player.id, JSON.stringify(Object.values(getArmor(player)).map(i => i?.typeId)));
}

installGearControls({
  state(player) {
    return {
      full: isFullZombieArmor(player), corruption: corruption(player), revives: revives(player),
      infection: combat.infectionStage(player), charging: isCharging(player),
      chargeEnd: getScore(player, SCORE.chargeEnd), combat: inCombat(player),
      holdingTotem: isStemCellItem(player.getComponent("minecraft:inventory")?.container?.getItem(player.selectedSlotIndex)?.typeId)
    };
  },
  start: beginCharge,
  cancel(player) { stopCharging(player); chargeSnapshots.delete(player.id); }
});

// Full sets may eat normal food for item buffs only; rotten flesh keeps its normal food recovery.
world.beforeEvents.itemUse.subscribe(ev => {
  snapshotFoodState(ev.source, ev.itemStack);
});

world.afterEvents.itemCompleteUse.subscribe(ev => {
  if (!isFullZombieArmor(ev.source)) return;
  applyFullSetFoodAftermath(ev.source, ev.itemStack);
  if (ev.itemStack.typeId !== "minecraft:rotten_flesh") return;
  heal(ev.source, ROTTEN_FLESH_HEAL);
  repairArmor(ev.source, ROTTEN_FLESH_REPAIR_FRACTION);
});

world.afterEvents.entityHurt.subscribe(ev => {
  const entity = ev.hurtEntity;
  if (entity?.typeId !== "minecraft:player") return;
  tryEmergencyRevive(entity, "post-hurt lethal damage");
});

world.beforeEvents.effectAdd.subscribe(ev => {
  const entity = ev.entity;
  if (!isFullZombieArmor(entity)) return;
  const id = effectAddId(ev);
  if (["regeneration", "instant_health"].includes(id)) ev.cancel = true;
  if (id === "strength" && !strengthApplying.has(entity.id)) {
    ev.cancel = true;
    rememberExternalStrength(entity, effectAddSnapshot(ev));
    system.run(() => { if (entity.isValid) syncStrengthBoost(entity, true); });
  }
});

world.afterEvents.entityDie.subscribe(ev => {
  const entity = ev.deadEntity;
  if (entity?.typeId !== "minecraft:player") return;
  tryEmergencyRevive(entity, "death event");
  system.run(() => { if (entity.isValid) tryEmergencyRevive(entity, "deferred death event"); });
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
world.afterEvents.playerLeave.subscribe(ev => {
  ownedHealthBoost.delete(ev.playerId);
  ownedStrengthBase.delete(ev.playerId);
  strengthApplying.delete(ev.playerId);
  chargeSnapshots.delete(ev.playerId);
  foodSnapshots.delete(ev.playerId);
  mismatchWarnings.delete(ev.playerId);
});

system.run(() => {
  ensureObjectives();
  for (const player of world.getAllPlayers()) initializePlayer(player);
  console.info("[ZombieGear] v4 HD gameplay boot OK; server API 2.6.0");
});

let tick20 = 0;
system.runInterval(() => {
  tick20++;
  for (const player of world.getAllPlayers()) {
    try {
      initializePlayer(player);
      forceMaxHpState(player);
      tickChargeCompletion(player);
      const full = isFullZombieArmor(player);
      const current = corruption(player);
      setScore(player, SCORE.corruption, current);
      if (full && current < 0) {
        if (!mismatchWarnings.has(player.id)) {
          mismatchWarnings.add(player.id);
          console.warn(`[ZombieGear] mismatched corruption for ${player.id}: multiplier/revive disabled; items unchanged`);
        }
      } else mismatchWarnings.delete(player.id);
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

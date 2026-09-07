import { world, system, EquipmentSlot, ItemStack } from "@minecraft/server";

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
  stemCell: "minecraft:totem_of_undying",
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

const SCORE = {
  combatEnd: "zs_combat_end",
  charging: "zs_charging",
  chargeEnd: "zs_charge_end"
};

const CHARGE_TICKS = 20 * 8;
const COMBAT_TICKS = 20 * 20;
const MAX_CHARGE = 4;
const BONUS_REGEN_TICKS = 20;
const BONUS_REGEN_HEAL = 1;
const BONUS_REGEN_MIN_FOOD = 8;
const REVIVE_BOOST_TICKS = 20 * 30;
const REVIVE_HEAL_TARGET = 40;
const REVIVE_STRENGTH_TAG = "zs_revive_strength_boost";
// ゾンビ装備由来のエフェクト付与をダメージ変換からスキップさせる一時タグ
// 使い方: addEffectの直前にaddTag→次のtickでremoveTagすること
const ZOMBIE_HEAL_BYPASS_TAG = "zs_zombie_heal_bypass";
// ゾンビ装備由来のheal()の許可分を記録して「想定外HP増加检知」から除外する
const allowedHealMap = new Map(); // playerId -> 許可済み増加量
const BOOT_MSG = "[ZombieGear] Script boot OK (2026-05-02c)";
const DEBUG_RUNTIME = false;

function getHealth(player) {
  return player.getComponent("health");
}

// ノックバックなしでHPを直接減少させる（位置補正が起きない）
function reduceHp(entity, amount) {
  try {
    const h = entity.getComponent("health");
    if (!h) return;
    const newHp = Math.max(0.5, h.currentValue - amount);
    h.setCurrentValue(newHp);
  } catch (e) {
    // applyDamageはノックバック・位置補正を引き起こすため使用しない
  }
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

function isZombieArmorTypeId(typeId) {
  if (!typeId) {
    return false;
  }
  for (const ids of Object.values(ZOMBIE_ITEMS.armor)) {
    if (ids.includes(typeId)) {
      return true;
    }
  }
  return false;
}

function isZombieArmorItemForSlot(slotKey, item) {
  return !!item && getArmorTypeIds(slotKey).includes(item.typeId);
}

function getArmorSlotKeyByTypeId(typeId) {
  if (!typeId) {
    return undefined;
  }
  for (const [slotKey, armorKey] of Object.entries(ARMOR_SLOT_KEYS)) {
    const ids = ZOMBIE_ITEMS.armor[armorKey] ?? [];
    if (ids.includes(typeId)) {
      return slotKey;
    }
  }
  return undefined;
}

function getDesiredArmorTypeId(slotKey, chargeValue) {
  const ids = getArmorTypeIds(slotKey);
  if (ids.length === 0) {
    return undefined;
  }
  const charge = Math.max(0, Math.min(MAX_CHARGE, chargeValue));
  return ids[charge] ?? ids[0];
}

function createArmorVariantItem(sourceItem, targetTypeId) {
  const next = new ItemStack(targetTypeId, 1);

  const srcDurability = sourceItem.getComponent("durability");
  const dstDurability = next.getComponent("durability");
  if (srcDurability && dstDurability) {
    dstDurability.damage = Math.min(dstDurability.maxDurability, srcDurability.damage);
  }

  return next;
}

function hasAnyZombieArmor(player) {
  const armor = getArmor(player);
  return [armor.head, armor.chest, armor.legs, armor.feet].some((item) => item && isZombieArmorTypeId(item.typeId));
}

function isFullZombieArmor(player) {
  const armor = getArmor(player);
  return !!armor.head && !!armor.chest && !!armor.legs && !!armor.feet &&
    isZombieArmorItemForSlot("head", armor.head) &&
    isZombieArmorItemForSlot("chest", armor.chest) &&
    isZombieArmorItemForSlot("legs", armor.legs) &&
    isZombieArmorItemForSlot("feet", armor.feet);
}

function debugRuntimeFlags() {
  const be = world.beforeEvents;
  const ae = world.afterEvents;
  return `hurtAE=${!!(ae && ae.entityHurt)} playerDieBE=${!!(be && be.playerDie)} hurtBE=${!!(be && be.entityHurt)} itemUseBE=${!!(be && be.itemUse)} effectBE=${!!(be && be.effectAdd)} itemCompleteAE=${!!(ae && ae.itemCompleteUse)}`;
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

// typeIdc0c4[CHAR]
function getChargeFromItem(item, slotKey) {
  if (!item) return 0;
  const ids = getArmorTypeIds(slotKey);
  const idx = ids.indexOf(item.typeId);
  return idx >= 0 ? idx : 0;
}

function getCharges(player) {
  const eq = getEquippable(player);
  if (!eq) return { head: 0, chest: 0, legs: 0, feet: 0 };
  return {
    head:  getChargeFromItem(eq.getEquipment(EquipmentSlot.Head),  "head"),
    chest: getChargeFromItem(eq.getEquipment(EquipmentSlot.Chest), "chest"),
    legs:  getChargeFromItem(eq.getEquipment(EquipmentSlot.Legs),  "legs"),
    feet:  getChargeFromItem(eq.getEquipment(EquipmentSlot.Feet),  "feet"),
  };
}

function setAllCharges(player, value) {
  const eq = getEquippable(player);
  if (!eq) return;
  const charge = Math.max(0, Math.min(MAX_CHARGE, value));
  const slotMap = [
    { slot: EquipmentSlot.Head,  key: "head" },
    { slot: EquipmentSlot.Chest, key: "chest" },
    { slot: EquipmentSlot.Legs,  key: "legs" },
    { slot: EquipmentSlot.Feet,  key: "feet" },
  ];
  for (const { slot, key } of slotMap) {
    const item = eq.getEquipment(slot);
    if (!item || !isZombieArmorItemForSlot(key, item)) continue;
    const desired = getDesiredArmorTypeId(key, charge);
    if (desired && item.typeId !== desired) {
      try { eq.setEquipment(slot, createArmorVariantItem(item, desired)); } catch (e) {}
    }
  }
}

function decrementAllCharges(player) {
  const eq = getEquippable(player);
  if (!eq) return;
  const slotMap = [
    { slot: EquipmentSlot.Head,  key: "head" },
    { slot: EquipmentSlot.Chest, key: "chest" },
    { slot: EquipmentSlot.Legs,  key: "legs" },
    { slot: EquipmentSlot.Feet,  key: "feet" },
  ];
  for (const { slot, key } of slotMap) {
    const item = eq.getEquipment(slot);
    if (!item || !isZombieArmorItemForSlot(key, item)) continue;
    const current = getChargeFromItem(item, key);
    const desired = getDesiredArmorTypeId(key, Math.max(0, current - 1));
    if (desired && item.typeId !== desired) {
      try { eq.setEquipment(slot, createArmorVariantItem(item, desired)); } catch (e) {}
    }
  }
}

function chargesAreUniformAndPositive(player) {
  const c = getCharges(player);
  return c.head === c.chest && c.chest === c.legs && c.legs === c.feet && c.head > 0;
}

function uniformChargeValue(player) {
  const c = getCharges(player);
  if (c.head === c.chest && c.chest === c.legs && c.legs === c.feet) {
    return c.head;
  }
  return -1;
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

function heal(player, amount) {
  const health = getHealth(player);
  if (!health) {
    return;
  }
  const before = health.currentValue;
  const next = Math.min(health.effectiveMax, before + amount);
  health.setCurrentValue(next);
  // 実際に増加した分だけ許可登録
  const actual = next - before;
  if (actual > 0) {
    allowedHealMap.set(player.id, (allowedHealMap.get(player.id) ?? 0) + actual);
  }
}

function applyBonusNaturalRegen(player) {
  if (!isFullZombieArmor(player)) {
    return;
  }

  // [CHAR]
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

const forceMaxHpCache = new Map(); // playerId -> "full"|"partial"

function forceMaxHpState(player) {
  const full = isFullZombieArmor(player);
  const state = full ? "full" : "partial";
  const prev = forceMaxHpCache.get(player.id);

  if (full) {
    // 状態変化 or エフェクト残り少ない時だけ更新
    if (prev === state) {
      const eff = player.getEffect("health_boost");
      if (eff && eff.duration > 100) return; // まだ余裕あり
    }
    forceMaxHpCache.set(player.id, state);
    player.addEffect("health_boost", 600, { amplifier: 14, showParticles: false });
  } else {
    if (prev === state) return;
    forceMaxHpCache.set(player.id, state);
    player.removeEffect("health_boost");
    const health = getHealth(player);
    if (health && health.currentValue > 20) {
      health.setCurrentValue(20);
    }
  }
}

// applyContinuousEffects のキャッシュ（変化時のみ addEffect を呼ぶ）
const contEffectsCache = new Map(); // playerId -> "none"|"any"|"full"

function applyContinuousEffects(player) {
  const hasAny = hasAnyZombieArmor(player);
  const full = isFullZombieArmor(player);
  const state = !hasAny ? "none" : full ? "full" : "any";
  const prev = contEffectsCache.get(player.id);

  if (!hasAny) {
    if (prev !== "none") {
      contEffectsCache.set(player.id, "none");
      player.removeTag("zs_zombie_aura");
      player.removeTag(REVIVE_STRENGTH_TAG);
      player.removeEffect("strength");
      player.removeEffect("hunger");
    }
    return;
  }

  player.addTag("zs_zombie_aura");

  // hunger は60tick(3秒)で切れるため毎20tick更新が必要。ただし強度が変わらない場合は上書きのみ
  // strength は状態変化時のみ更新（毎回addEffectするとエンティティ状態更新でカクつく）
  if (prev !== state) {
    contEffectsCache.set(player.id, state);
    if (full) {
      if (!player.hasTag(REVIVE_STRENGTH_TAG)) {
        player.addEffect("strength", 60, { amplifier: 0, showParticles: false });
      }
    } else {
      player.removeTag(REVIVE_STRENGTH_TAG);
      player.removeEffect("strength");
    }
  }

  // hunger: 残り少ない時だけ更新（毎20tick addEffect しない）
  const hungerEff = player.getEffect("hunger");
  if (!hungerEff || hungerEff.duration < 100 || hungerEff.amplifier !== (full ? 1 : 0)) {
    player.addEffect("hunger", 240, { amplifier: full ? 1 : 0, showParticles: false });
  }
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
  if (!hasAnyZombieArmor(player)) {
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

function canUseRevive(player) {
  return isFullZombieArmor(player) && chargesAreUniformAndPositive(player);
}


function reviveLikeTotem(player) {
  // HP[CHAR]
  const forceHeal = () => {
    try {
      const h = getHealth(player);
      if (!h) return;
      const before = h.currentValue;
      const target = Math.min(h.effectiveMax, REVIVE_HEAL_TARGET);
      h.setCurrentValue(target);
      const actual = target - before;
      if (actual > 0) allowedHealMap.set(player.id, (allowedHealMap.get(player.id) ?? 0) + actual);
    } catch (e) {}
  };
  forceHeal();
  player.extinguishFire(true);

  // [CHAR]
  system.run(function () {
    forceHeal();

    try {
      const hunger = player.getComponent("minecraft:player.hunger");
      if (hunger) hunger.setCurrentValue(hunger.effectiveMax);
    } catch (e) {}
    try {
      const saturation = player.getComponent("minecraft:player.saturation");
      if (saturation) saturation.setCurrentValue(saturation.effectiveMax);
    } catch (e) {}

    // 2[CHAR]
    system.run(() => { forceHeal(); });

    // 30strengthstrength[CHAR]
    player.addTag(REVIVE_STRENGTH_TAG);
    player.addEffect("resistance",  16,               { amplifier: 4, showParticles: false }); // 0.8[CHAR]
    // I[CHAR]
    system.runTimeout(() => {
      try {
        player.addEffect("resistance", REVIVE_BOOST_TICKS - 16, { amplifier: 0, showParticles: true }); // I [CHAR]
      } catch (e) {}
    }, 16);
    // 独自再生: バニラregeneration（ダメージ変換対象）を使わず直接heal()でtick再生
    // 再生IV相当: 50tick(2.5秒)ごとに+1ハート、REVIVE_BOOST_TICKS(600tick=30秒)で最大12回
    const REVIVE_REGEN_INTERVAL = 50;
    let regenTick = 0;
    const regenId = system.runInterval(() => {
      regenTick += REVIVE_REGEN_INTERVAL;
      try { heal(player, 2); } catch (e) {}
      if (regenTick >= REVIVE_BOOST_TICKS) system.clearRun(regenId);
    }, REVIVE_REGEN_INTERVAL);
    player.addEffect("speed",      REVIVE_BOOST_TICKS, { amplifier: 3, showParticles: true }); // [CHAR]IV
    player.addEffect("strength",   REVIVE_BOOST_TICKS, { amplifier: 3, showParticles: true }); // [CHAR]IV
    player.addEffect("jump_boost", REVIVE_BOOST_TICKS, { amplifier: 3, showParticles: true }); // [CHAR]IV
    player.addEffect("haste",      REVIVE_BOOST_TICKS, { amplifier: 3, showParticles: true }); // [CHAR]IV
    system.runTimeout(() => {
      try {
        player.removeTag(REVIVE_STRENGTH_TAG);
      } catch (e) {}
    }, REVIVE_BOOST_TICKS);
    // 130lub-dub : 2[CHAR]
    let beat = 0;
    const hbBeats = REVIVE_BOOST_TICKS / 20; // 30[CHAR]
    const hbId = system.runInterval(function () {
      beat++;
      try { player.playSound("mob.warden.heartbeat", { volume: 1.0, pitch: 1.0 }); } catch (e) {
        // : note.bd[CHAR]
        try { player.playSound("note.bd", { volume: 1.5, pitch: 0.5 }); } catch (e2) {}
        system.runTimeout(() => {
          try { player.playSound("note.bd", { volume: 1.2, pitch: 0.4 }); } catch (e2) {}
        }, 3);
      }
      if (beat >= hbBeats) system.clearRun(hbId);
    }, 20);
  });
}

function tickChargeCompletion(player) {
  if (!isCharging(player)) {
    return;
  }

  const endTick = getScore(player, SCORE.chargeEnd);
  if (system.currentTick < endTick) {
    return;
  }

  if (!isFullZombieArmor(player)) {
    stopCharging(player);
    player.sendMessage("[ZombieGear] フル装備でないためチャージ失敗");
    return;
  }

  if (inCombat(player)) {
    stopCharging(player);
    player.sendMessage("[ZombieGear] 戦闘状態のためチャージ失敗");
    return;
  }

  const current = uniformChargeValue(player);
  if (current < 0) {
    stopCharging(player);
    player.sendMessage("[ZombieGear] 各部位チャージ数が不一致のため失敗");
    return;
  }

  if (current >= MAX_CHARGE) {
    stopCharging(player);
    player.sendMessage("[ZombieGear] 既に最大チャージです");
    return;
  }

  setAllCharges(player, current + 1);
  stopCharging(player);
  player.sendMessage(`[ZombieGear] チャージ完了: ${current + 1}/${MAX_CHARGE}`);
}

if (world.afterEvents && world.afterEvents.worldInitialize) {
  world.afterEvents.worldInitialize.subscribe(function () {
    ensureObjectives();
  });
} else {
  // worldInitialize[CHAR]
  system.run(function () {
    ensureObjectives();
  });
}

system.run(function () {
  try {
    world.sendMessage(BOOT_MSG);
  } catch (e) {
    // Ignore when no player is online yet.
  }
  try {
    console.info(BOOT_MSG);
  } catch (e) {}
});

if (DEBUG_RUNTIME && world.afterEvents && world.afterEvents.playerSpawn) {
  world.afterEvents.playerSpawn.subscribe(function (ev) {
    const p = ev.player;
    if (!p) {
      return;
    }
    try {
      p.sendMessage(`[ZombieGear][DBG] ${debugRuntimeFlags()}`);
    } catch (e) {}
  });
}

// KBR はアイテムJSONの minecraft:attribute_modifiers で付与（1ピース0.2、フルセット0.8）
// スクリプトでの runCommand は不要のため削除
const kbrCache = new Map(); // 互換のため残すが使用しない
function updatePlayerKBR(_player) {} // no-op
const HEAL_BLOCK_EFFECTS = ["regeneration", "absorption", "instant_health"];

system.runInterval(function () {
  try {
    for (const player of world.getAllPlayers()) {
      updatePlayerKBR(player);
      // ゾンビ装備中は回復系エフェクトを毎20tickで強制削除（typeId=""バグの完全回避）
      if (!player.hasTag("zs_zombie_aura")) continue;
      if (player.hasTag(REVIVE_STRENGTH_TAG)) continue;
      if (player.hasTag(ZOMBIE_HEAL_BYPASS_TAG)) continue;
      for (const eid of HEAL_BLOCK_EFFECTS) {
        try {
          const eff = player.getEffect(eid);
          if (eff) player.removeEffect(eid);
        } catch (e) {}
      }
    }
  } catch (e) {}
}, 20);

// entityHurt:  + [CHAR]
if (world.afterEvents && world.afterEvents.entityHurt) {
  world.afterEvents.entityHurt.subscribe(function (ev) {
    const player = ev.hurtEntity;
    if (!player || player.typeId !== "minecraft:player") return;

    setCombatNow(player);
    if (isCharging(player)) {
      stopCharging(player);
      player.sendMessage("[ZombieGear] 被弾によりチャージ中断");
    }
    if (DEBUG_RUNTIME) {
      const health = getHealth(player);
      const c = getCharges(player);
      const full = isFullZombieArmor(player);
      if (health) player.sendMessage(`[DBG] HP:${health.currentValue.toFixed(1)} full:${full} ch:${c.head}/${c.chest}/${c.legs}/${c.feet}`);
    }
  });
}

if (world.beforeEvents && world.beforeEvents.effectAdd) {
  world.beforeEvents.effectAdd.subscribe((ev) => {
    try {
      const entity = ev.entity;
      if (!entity || entity.typeId !== "minecraft:player") return;
      try { if (!entity.isValid) return; } catch (e) { return; }
      if (!hasAnyZombieArmor(entity)) return;
      if (entity.hasTag && entity.hasTag(REVIVE_STRENGTH_TAG)) return;
      if (entity.hasTag && entity.hasTag(ZOMBIE_HEAL_BYPASS_TAG)) return;

      let typeId = "";
      let amplifier = 0;
      let duration = 600;
        if (ev.effect && ev.effect.typeId) {
          typeId    = ev.effect.typeId;
          amplifier = ev.effect.amplifier ?? 0;
          duration  = ev.effect.duration  ?? 600;
        } else if (ev.effectType && ev.effectType.id) {
          typeId = ev.effectType.id;
        } else if (ev.effect) {
          // typeIdが空文字の場合、別プロパティを試みる
          typeId    = ev.effect.id ?? ev.effect.name ?? ev.effect.getName?.() ?? "";
          amplifier = ev.effect.amplifier ?? 0;
          duration  = ev.effect.duration  ?? 600;
        }

      if (DEBUG_RUNTIME) {
        system.run(() => {
          try { entity.sendMessage(`[ZG effectAdd] typeId="${typeId}" amp=${amplifier} dur=${duration}`); } catch (e) {}
        });
      }

      if (typeId !== "instant_health" && typeId !== "regeneration" && typeId !== "absorption" &&
          typeId !== "minecraft:instant_health" && typeId !== "minecraft:regeneration" && typeId !== "minecraft:absorption") return;

      // typeIdの正規化（minecraft:プレフィックスを除去）
      const bareId = typeId.replace("minecraft:", "");

      // トーテム発動検出: HP≤1のときregen/absorptionはスキップ
      if (typeId === "regeneration" || typeId === "absorption") {
        const h = entity.getComponent("health");
        if (h && h.currentValue <= 1) return;
      }

      // エフェクトをキャンセルして、本来の回復量に相当するダメージを直接付与
      ev.cancel = true;

      let healAmt = 0;
      let label = "";
      if (bareId === "instant_health") {
        healAmt = (amplifier + 1) * 4;
        label = `即時回復Lv${amplifier + 1}`;
      } else if (bareId === "regeneration") {
        // 再生は持続回復なのでキャンセルのみ。先払いダメージを与えない（カクつき防止）
        // すり抜けた分はHP監視ループが1tickずつ相殺する
        label = `再生Lv${amplifier + 1}`;
        system.run(() => {
          try { entity.sendMessage(`[ZombieGear] ${label}は腐敗により無効化`); } catch (e) {}
        });
        // ここでreturnしてダメージ処理をスキップ
        return;
      } else if (bareId === "absorption") {
        healAmt = (amplifier + 1) * 4;
        label = `吸収Lv${amplifier + 1}`;
      }

      const dmg = healAmt * 2;
      system.run(() => {
        try {
          if (DEBUG_RUNTIME) {
            try { entity.sendMessage(`[ZG dmg] bareId=${bareId} healAmt=${healAmt} dmg=${dmg}`); } catch (e2) {}
          }
          reduceHp(entity, dmg);
        } catch (e) {}
        try { entity.sendMessage(`[ZombieGear] ${label}は腐敗によりダメージ化 (+${healAmt}→-${healAmt})`); } catch (e) {}
      });
    } catch (e) {}
  });
}

// afterEvents.effectAdd: cancelをすり抜けた場合のエフェクト削除。ダメージはHP監視ループに任せる
if (world.afterEvents && world.afterEvents.effectAdd) {
  world.afterEvents.effectAdd.subscribe((ev) => {
    try {
      const entity = ev.entity;
      if (!entity || entity.typeId !== "minecraft:player") return;
      if (!hasAnyZombieArmor(entity)) return;
      if (entity.hasTag && entity.hasTag(REVIVE_STRENGTH_TAG)) return;
      if (entity.hasTag && entity.hasTag(ZOMBIE_HEAL_BYPASS_TAG)) return;
      const typeId = ev.effect ? ev.effect.typeId : "";
      const bareId2 = typeId.replace("minecraft:", "");
      // typeId="" バグ対策: bareId2が空の場合はgetEffects()でスキャン
      const targets = new Set(["instant_health", "regeneration", "absorption"]);
      if (bareId2 && !targets.has(bareId2)) return;
      if (bareId2 === "regeneration" || bareId2 === "absorption" || bareId2 === "") {
        const h = entity.getComponent("health");
        if (h && h.currentValue <= 1) return;
      }
      // エフェクトを削除してたこ耳などのティック回復を止める
      system.run(() => {
        try {
          if (bareId2) {
            entity.removeEffect(bareId2);
          } else {
            // typeId="" の場合: getEffectsでスキャンして対象を削除
            const effects = entity.getEffects ? entity.getEffects() : [];
            for (const eff of effects) {
              const eid = (eff.typeId || "").replace("minecraft:", "");
              if (targets.has(eid)) entity.removeEffect(eid);
            }
          }
        } catch (e) {}
      });
    } catch (e) {
      // エラーサイレント
    }
  });
}

if (world.afterEvents && world.afterEvents.itemUse) {
  world.afterEvents.itemUse.subscribe((ev) => {
    const player = ev.source;
    const item = ev.itemStack;
    if (!player || player.typeId !== "minecraft:player" || !item) {
      return;
    }

    if (item.typeId !== ZOMBIE_ITEMS.stemCell) {
      return;
    }

    if (!isFullZombieArmor(player)) {
      player.sendMessage("[ZombieGear] チャージには4部位装備が必要です");
      return;
    }

    if (inCombat(player)) {
      player.sendMessage("[ZombieGear] 戦闘状態中はチャージできません");
      return;
    }

    if (isCharging(player)) {
      player.sendMessage("[ZombieGear] 既にチャージ中です");
      return;
    }

    const current = uniformChargeValue(player);
    if (current < 0) {
      player.sendMessage("[ZombieGear] 各部位のチャージ数を揃えてください");
      return;
    }

    if (current >= MAX_CHARGE) {
      player.sendMessage("[ZombieGear] 既に最大チャージです");
      return;
    }

    if (!consumeOneSelectedItem(player, ZOMBIE_ITEMS.stemCell)) {
      player.sendMessage("[ZombieGear] 不死のトーテムを手に持って使用してください");
      return;
    }

    startCharging(player);
    player.sendMessage("[ZombieGear] チャージ開始 (8秒)");
  });
}

if (world.afterEvents && world.afterEvents.itemCompleteUse) {
  world.afterEvents.itemCompleteUse.subscribe((ev) => {
    const player = ev.source;
    const item = ev.itemStack;
    if (!player || player.typeId !== "minecraft:player" || !item) {
      return;
    }

    if (item.typeId !== "minecraft:rotten_flesh") {
      return;
    }

    if (!hasAnyZombieArmor(player)) {
      return;
    }

    heal(player, 4);
    repairArmor(player, 0.10);
    // 満腹度+5・隠し満腹度+1.2（バニラ腐肉は満腹度+4・隠し満腹度+0.6）
    try {
      player.addEffect("saturation", 2, { amplifier: 0, showParticles: false });
    } catch (e) {}
    player.sendMessage("[ZombieGear] 腐肉で回復した (耐久+10%)");
  });
}

if (world.beforeEvents && world.beforeEvents.itemUse) {
  world.beforeEvents.itemUse.subscribe((ev) => {
    try {
      const player = ev.source ?? ev.player;
      const item = ev.itemStack;
      if (!player || player.typeId !== "minecraft:player" || !item) return;
      if (!hasAnyZombieArmor(player)) return;
      if (item.typeId === "minecraft:rotten_flesh") return;

      // バニラ食料: IDセットで判定（スクリプティングAPIはバニラのfoodコンポーネントを返さない）
      // カスタム食料: getComponentで判定
      const isVanillaFood = VANILLA_FOOD_IDS.has(item.typeId);
      const isCustomFood = !!(item.getComponent("food") ?? item.getComponent("minecraft:food"));
      if (!isVanillaFood && !isCustomFood) return;

      ev.cancel = true;
      if (DEBUG_RUNTIME) {
        system.run(() => {
          try { player.sendMessage(`[ZG food cancel] ${item.typeId}`); } catch (e) {}
        });
      }
    } catch (e) {}
  });
}

// 20tick統合ループ
let _tick20 = 0;
system.runInterval(() => {
  ensureObjectives();
  _tick20++;
  for (const player of world.getAllPlayers()) {
    if (!player || !player.isValid) continue;
    forceMaxHpState(player);
    applyContinuousEffects(player);
    tickChargeCompletion(player);
    applyBonusNaturalRegen(player);          // 元々20tick間隔
    if (_tick20 % 2 === 0) applySunPenalty(player); // 元々40tick間隔
  }
}, 20);

if (DEBUG_RUNTIME) {
  system.runInterval(function () {
    for (const player of world.getAllPlayers()) {
      if (!player || !player.isValid) continue;
      try {
        const hp = getHealth(player);
        const hpText = hp ? `${hp.currentValue.toFixed(1)}/${hp.effectiveMax.toFixed(1)}` : "n/a";
        const full = isFullZombieArmor(player) ? "Y" : "N";
        const hasAura = player.hasTag("zs_zombie_aura") ? "Y" : "N";
        const allowed = allowedHealMap.get(player.id) ?? 0;
        player.onScreenDisplay.setActionBar(`[ZG] full=${full} aura=${hasAura} hp=${hpText} allowed=${allowed.toFixed(1)}`);
      } catch (e) {}
    }
  }, 100);
}

// applySunPenalty と applyBonusNaturalRegen は統合ループ内で処理

//  tick  HP  ([CHAR])
const prevHpMap = new Map();

// ゾンビ装備プレイヤーの想定外HP増加を検出して相殺
// hasAnyZombieArmor()（スロット4つ読み取り）は重いため、
// applyContinuousEffects()が20tickで管理するzs_zombie_auraタグで代替する
// damagingMap: 自分で与えたダメージによるHP減少を許可済みとしてマーク（無限ループ防止）
const damagingMap = new Map(); // playerId -> 予定ダメージ量（次tickのhpPrev補正用）

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    if (!player || !player.isValid) continue;
    
    const h = getHealth(player);
    if (!h) continue;
    const hpNow  = h.currentValue;
    const hpPrev = prevHpMap.get(player.id) ?? hpNow;
    prevHpMap.set(player.id, hpNow);

    if (!player.hasTag("zs_zombie_aura")) continue;
    if (player.hasTag(REVIVE_STRENGTH_TAG)) continue;
    if (player.hasTag(ZOMBIE_HEAL_BYPASS_TAG)) continue;

    const gained = hpNow - hpPrev;
    if (gained <= 0) continue;

    // 自分のheal()で許可登録した分を差し引く
    const allowed = allowedHealMap.get(player.id) ?? 0;
    const excess  = gained - allowed;
    if (allowed > 0) allowedHealMap.set(player.id, Math.max(0, allowed - gained));

    // 大型の突発的回復のみ相殺（瞬時回復ポーション等）。再生・自然回復は20tickのremoveEffectで対処
    if (excess <= 3.0) continue;

    if (DEBUG_RUNTIME) {
      player.sendMessage(`[ZG HP] gained=${gained.toFixed(2)} excess=${excess.toFixed(2)} (slip-through)`);
    }

    // slip-through分の想定外大型回復を相殺
    const totalDmg = excess * 2;
    reduceHp(player, totalDmg);
  }
}, 2);

// ===== [CHAR] =====
if (world.afterEvents && world.afterEvents.entityHurt) {
  world.afterEvents.entityHurt.subscribe((ev) => {
    const player = ev.hurtEntity;
    if (!player || player.typeId !== "minecraft:player") return;

    const health = getHealth(player);
    if (!health) return;

    const hpNow  = health.currentValue;
    const hpPrev = prevHpMap.get(player.id) ?? hpNow;
    const damage = ev.damage ?? 0;

    const isLethalHit = damage > 0 && damage >= hpPrev;
    const isNearDeath = hpNow > 0 && hpNow <= damage;

    if (!isNearDeath && !isLethalHit) return;
    if (!canUseRevive(player)) {
      if (DEBUG_RUNTIME) {
        const c = getCharges(player);
        player.sendMessage(`[ReviveDBG] 蘇生不可 full=${isFullZombieArmor(player)} ch=${c.head} hp=${hpNow.toFixed(1)} dmg=${damage.toFixed(1)}`);
      }
      return;
    }

    if (DEBUG_RUNTIME) {
      player.sendMessage(`[ReviveDBG] 発動 hp=${hpNow.toFixed(1)} prev=${hpPrev.toFixed(1)} dmg=${damage.toFixed(1)}`);
    }

    decrementAllCharges(player);
    player.sendMessage(`§c[ZombieGear] ゾンビ蘇生発動！ (残チャージ: ${uniformChargeValue(player)}/${MAX_CHARGE})`);
    reviveLikeTotem(player);
  });
}

// Strength[CHAR]
// : +2(+1)(REVIVE_STRENGTH_TAG): +6(+3[CHAR])
const NIGHT_BONUS_DMG_NORMAL = 2;
const NIGHT_BONUS_DMG_REVIVE = 6;

if (world.afterEvents && world.afterEvents.entityHitEntity) {
  world.afterEvents.entityHitEntity.subscribe((ev) => {
    const attacker = ev.damagingEntity;
    if (!attacker || attacker.typeId !== "minecraft:player") return;
    if (!isFullZombieArmor(attacker)) return;
    if (isDaytime()) return;

    const bonus = attacker.hasTag(REVIVE_STRENGTH_TAG)
      ? NIGHT_BONUS_DMG_REVIVE
      : NIGHT_BONUS_DMG_NORMAL;

    try {
      ev.hitEntity.applyDamage(bonus, { damagingEntity: attacker });
    } catch (e) {}
  });
}

// =====================================================================
// [自動防止・回復策] ZombieGear セルフヒール防止 & 状態整合チェック
// 以下のバグ/不具合を自動検出・修正する:
//
// [A] プレイヤー退出時 Map メモリリーク
//     allowedHealMap / prevHpMap / contEffectsCache / forceMaxHpCache
//     / kbrCache に退出プレイヤーのエントリが残り続ける問題。
//     → playerLeave イベントで全 Map からエントリを削除。
//
// [B] effectAdd typeId="" バグ（Bedrock 1.21.6x 既知バグ）
//     effectAdd イベントで typeId が常に "" を返すため
//     beforeEvents.cancel / afterEvents.removeEffect が機能しない。
//     → 20tick ポーリングで getEffect() により直接確認・削除済み（HEAL_BLOCK_EFFECTS）。
//     ここでは「ポーリングより先に検出できるよう」afterEvents 側も補完する。
//
// [C] health_boost 切れ時 HP > 20 のゾンビ装備なし状態
//     装備を外した瞬間 health_boost が消え、HP が 30 等のまま残るケース。
//     → forceMaxHpState キャッシュをクリアして次の 20tick で強制修正させる。
//
// [D] 蘇生タグ（zs_revive_strength_boost）残留
//     蘇生処理中にスクリプトがクラッシュした場合、タグが永続する。
//     → 装備なし状態で蘇生タグが残っていたら自動削除。
//
// [E] チャージスコアボード不整合
//     アドオン再ロード直後にスコアが不正値になる場合がある。
//     → プレイヤースポーン時に ensureObjectives を再実行。
// =====================================================================

// [A] プレイヤー退出時のメモリクリーンアップ
if (world.afterEvents && world.afterEvents.playerLeave) {
  world.afterEvents.playerLeave.subscribe((ev) => {
    const id = ev.playerId;
    if (!id) return;
    allowedHealMap.delete(id);
    prevHpMap.delete(id);
    contEffectsCache.delete(id);
    forceMaxHpCache.delete(id);
    kbrCache.delete(id);
  });
}

// [C][D] プレイヤースポーン時の状態整合チェック
if (world.afterEvents && world.afterEvents.playerSpawn) {
  world.afterEvents.playerSpawn.subscribe((ev) => {
    const player = ev.player;
    if (!player) return;

    // ensureObjectives を再実行 [E]
    system.run(() => {
      try { ensureObjectives(); } catch (e) {}
    });

    // 2tick後に装備状態を確認して整合修正
    system.runTimeout(() => {
      try {
        if (!player.isValid) return;
        const hasAny = hasAnyZombieArmor(player);

        // [D] 蘇生タグ残留チェック
        if (!hasAny && player.hasTag(REVIVE_STRENGTH_TAG)) {
          player.removeTag(REVIVE_STRENGTH_TAG);
          player.removeEffect("strength");
        }

        // [C] health_boost キャッシュをリセットして次の20tickで再評価
        forceMaxHpCache.delete(player.id);
        contEffectsCache.delete(player.id);

        // [C] 装備なしなのにHP>20の場合は即修正
        if (!hasAny) {
          const h = getHealth(player);
          if (h && h.currentValue > 20) h.setCurrentValue(20);
          player.removeEffect("health_boost");
        }
      } catch (e) {}
    }, 2);
  });
}

// [B] afterEvents.effectAdd 補完（typeId=""バグ対策の二重保険）
// getEffects()で全エフェクトをスキャンして回復系を削除
// ※ typeId="" の場合は bareId2 が "" になり通常の条件分岐を抜けてしまうため
if (world.afterEvents && world.afterEvents.effectAdd) {
  world.afterEvents.effectAdd.subscribe((ev) => {
    try {
      const entity = ev.entity;
      if (!entity || entity.typeId !== "minecraft:player") return;
      if (!entity.hasTag("zs_zombie_aura")) return;
      if (entity.hasTag(REVIVE_STRENGTH_TAG)) return;
      if (entity.hasTag(ZOMBIE_HEAL_BYPASS_TAG)) return;

      const typeId = (ev.effect && ev.effect.typeId) ? ev.effect.typeId : "";
      const bareId = typeId.replace("minecraft:", "");

      // typeId が正常に取得できている場合のみここで処理（=""バグは20tickループに任せる）
      if (!bareId) return;
      if (!["regeneration", "absorption", "instant_health"].includes(bareId)) return;

      const h = entity.getComponent("health");
      if (h && h.currentValue <= 1) return; // 蘇生判定のため1HP以下はスキップ

      system.run(() => {
        try { entity.removeEffect(bareId); } catch (e) {}
      });
    } catch (e) {}
  });
}

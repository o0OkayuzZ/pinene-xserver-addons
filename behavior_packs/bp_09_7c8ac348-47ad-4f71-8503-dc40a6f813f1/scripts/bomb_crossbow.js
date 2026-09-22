import { world, system, ItemStack } from "@minecraft/server";

const PROJECTILE_ID = "pinene:bomb_bolt_projectile";
const SOUL_ID = "pinematerials:zyunzentarucrossbownotamashii";
const AWAKEN_NEXT = Object.freeze({
  "pinene:bomb_crossbow": "pinene:bomb_crossbow_awakened_1",
  "pinene:bomb_crossbow_awakened_1": "pinene:bomb_crossbow_awakened_2",
  "pinene:bomb_crossbow_awakened_2": "pinene:bomb_crossbow_awakened_3"
});

const EXPLOSION_PROFILES = Object.freeze({
  "pinene:bomb_crossbow": { depth: 0, radius: 4 },
  "pinene:bomb_crossbow_awakened_1": { depth: 1, radius: 5 },
  "pinene:bomb_crossbow_awakened_2": { depth: 2, radius: 6 },
  "pinene:bomb_crossbow_awakened_3": { depth: 3, radius: 7 }
});

const PROFILE_BY_DEPTH = Object.freeze([
  EXPLOSION_PROFILES["pinene:bomb_crossbow"],
  EXPLOSION_PROFILES["pinene:bomb_crossbow_awakened_1"],
  EXPLOSION_PROFILES["pinene:bomb_crossbow_awakened_2"],
  EXPLOSION_PROFILES["pinene:bomb_crossbow_awakened_3"]
]);

const exploded = new Set();

function weaponProfile(owner) {
  if (!owner?.isValid || owner.typeId !== "minecraft:player") return PROFILE_BY_DEPTH[0];
  try {
    const held = owner.getComponent("minecraft:equippable")?.getEquipment("Mainhand");
    return EXPLOSION_PROFILES[held?.typeId] ?? PROFILE_BY_DEPTH[0];
  } catch {
    return PROFILE_BY_DEPTH[0];
  }
}

function projectileProfile(projectile) {
  const raw = Number(projectile.getDynamicProperty("pinene:bomb_depth") ?? 0);
  const depth = Number.isFinite(raw) ? Math.max(0, Math.min(3, Math.trunc(raw))) : 0;
  return PROFILE_BY_DEPTH[depth];
}

function findSoulSlot(player) {
  const inventory = player.getComponent("minecraft:inventory")?.container;
  if (!inventory) return undefined;
  for (let slot = 0; slot < inventory.size; slot++) {
    const item = inventory.getItem(slot);
    if (item?.typeId === SOUL_ID && item.amount > 0) return slot;
  }
  return undefined;
}

function consumeSoul(player, slot) {
  const inventory = player.getComponent("minecraft:inventory")?.container;
  if (!inventory) return false;
  const soul = inventory.getItem(slot);
  if (!soul || soul.typeId !== SOUL_ID || soul.amount < 1) return false;
  if (soul.amount === 1) inventory.setItem(slot, undefined);
  else {
    soul.amount -= 1;
    inventory.setItem(slot, soul);
  }
  return true;
}

function copyCrossbowState(source, targetId) {
  const target = new ItemStack(targetId, 1);

  const srcDurability = source.getComponent("minecraft:durability");
  const dstDurability = target.getComponent("minecraft:durability");
  if (srcDurability && dstDurability) {
    dstDurability.damage = Math.min(dstDurability.maxDurability, srcDurability.damage);
  }

  target.nameTag = source.nameTag;
  target.setLore(source.getLore());
  target.keepOnDeath = source.keepOnDeath;
  target.lockMode = source.lockMode;
  target.setCanDestroy(source.getCanDestroy());
  target.setCanPlaceOn(source.getCanPlaceOn());

  for (const id of source.getDynamicPropertyIds()) {
    target.setDynamicProperty(id, source.getDynamicProperty(id));
  }

  const enchantments = source.getComponent("minecraft:enchantable")?.getEnchantments() ?? [];
  if (enchantments.length) {
    const dstEnchantable = target.getComponent("minecraft:enchantable");
    if (!dstEnchantable) throw new Error("Awakened Bomb Crossbow is not enchantable");
    dstEnchantable.addEnchantments(enchantments);
  }
  return target;
}

function awakenAtSmithingTable(player, expectedTypeId) {
  if (!player?.isValid) return;
  const targetId = AWAKEN_NEXT[expectedTypeId];
  if (!targetId) {
    player.sendMessage("§8[爆弾クロスボウ] §cすでに深度IIIです。");
    return;
  }

  const inventory = player.getComponent("minecraft:inventory")?.container;
  if (!inventory) return;
  const selectedSlot = player.selectedSlotIndex;
  const source = inventory.getItem(selectedSlot);
  if (!source || source.typeId !== expectedTypeId) return;

  const soulSlot = findSoulSlot(player);
  if (soulSlot === undefined) {
    player.sendMessage("§8[爆弾クロスボウ] §7覚醒には「純然たるクロスボウの魂」が1個必要です。");
    return;
  }

  let upgraded;
  try {
    upgraded = copyCrossbowState(source, targetId);
  } catch (error) {
    console.warn(`[BombCrossbow] awakening copy failed: ${error}`);
    player.sendMessage("§8[爆弾クロスボウ] §c覚醒に失敗しました。アイテムは消費されていません。");
    return;
  }

  if (!consumeSoul(player, soulSlot)) return;
  try {
    inventory.setItem(selectedSlot, upgraded);
    player.dimension.playSound("random.levelup", player.location, { volume: 1.0, pitch: 0.75 });
    const depth = EXPLOSION_PROFILES[targetId]?.depth ?? 0;
    player.sendMessage(`§8[爆弾クロスボウ] §d覚醒成功：深度${depth}`);
  } catch (error) {
    // Best-effort rollback: restore both source weapon and the consumed soul.
    inventory.setItem(selectedSlot, source);
    const current = inventory.getItem(soulSlot);
    if (!current) inventory.setItem(soulSlot, new ItemStack(SOUL_ID, 1));
    else if (current.typeId === SOUL_ID && current.amount < current.maxAmount) {
      current.amount += 1;
      inventory.setItem(soulSlot, current);
    }
    console.warn(`[BombCrossbow] awakening write failed and rolled back: ${error}`);
  }
}

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const player = event.player;
  const item = event.itemStack;
  if (!player?.isValid || !player.isSneaking) return;
  if (event.block?.typeId !== "minecraft:smithing_table") return;
  if (!item || !(item.typeId in AWAKEN_NEXT) && item.typeId !== "pinene:bomb_crossbow_awakened_3") return;

  // Sneak + interact reserves the smithing table for Bomb Crossbow awakening.
  event.cancel = true;
  const expectedTypeId = item.typeId;
  system.run(() => awakenAtSmithingTable(player, expectedTypeId));
});

// Capture awakening depth at launch, not at impact. Switching weapons after firing
// must never change the projectile's explosion power.
world.afterEvents.entitySpawn.subscribe((event) => {
  const projectile = event.entity;
  if (!projectile?.isValid || projectile.typeId !== PROJECTILE_ID) return;
  const owner = projectile.getComponent("minecraft:projectile")?.owner;
  const profile = weaponProfile(owner);
  projectile.setDynamicProperty("pinene:bomb_depth", profile.depth);
});

function detonate(projectile, location, dimension) {
  if (!projectile?.isValid || projectile.typeId !== PROJECTILE_ID) return;
  const projectileId = projectile.id;
  if (exploded.has(projectileId)) return;
  exploded.add(projectileId);

  const profile = projectileProfile(projectile);
  const owner = projectile.getComponent("minecraft:projectile")?.owner;
  const safeOwner = owner?.isValid ? owner : undefined;

  // Real Bedrock explosion:
  // - terrain destruction ON
  // - fire generation explicitly OFF
  // - explosion radius scales with awakening depth
  try {
    const options = {
      breaksBlocks: true,
      causesFire: false
    };
    if (safeOwner) options.source = safeOwner;
    dimension.createExplosion(location, profile.radius, options);
  } catch (error) {
    console.warn(`[BombCrossbow] explosion failed at depth ${profile.depth}: ${error}`);
  }

  system.run(() => {
    try {
      if (projectile.isValid) projectile.remove();
    } finally {
      exploded.delete(projectileId);
    }
  });
}

world.afterEvents.projectileHitBlock.subscribe((event) => {
  const projectile = event.projectile;
  if (projectile?.typeId !== PROJECTILE_ID) return;
  detonate(projectile, event.location, event.dimension);
});

world.afterEvents.projectileHitEntity.subscribe((event) => {
  const projectile = event.projectile;
  if (projectile?.typeId !== PROJECTILE_ID) return;
  const hit = event.getEntityHit()?.entity;
  const dimension = hit?.dimension ?? projectile.dimension;
  detonate(projectile, event.location, dimension);
});

console.info("[BombCrossbow] v0.2 awakening-depth terrain explosion runtime loaded");

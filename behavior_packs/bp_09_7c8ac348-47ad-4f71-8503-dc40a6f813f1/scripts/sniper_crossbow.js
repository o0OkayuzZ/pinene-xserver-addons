import {
  world,
  system,
  ItemStack,
  HudElement,
  HudVisibility
} from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

const SOUL_ID = "pinematerials:zyunzentarucrossbownotamashii";
const SCOPE_MARKER = "__PINENE_SNIPER_SCOPE__";
const SCOPE_FOV = 30;
const SNIPER_SPEED = 8.0;
const SNIPER_PROJECTILE_ID = "pinene:sniper_bolt_projectile";
const BOMB_PROJECTILE_ID = "pinene:bomb_bolt_projectile";

const STATE = Object.freeze({
  "minecraft:crossbow": { sniper: false, tnt: false, depth: 0 },

  "pinene:bomb_crossbow": { sniper: false, tnt: true, depth: 0 },
  "pinene:bomb_crossbow_awakened_1": { sniper: false, tnt: true, depth: 1 },
  "pinene:bomb_crossbow_awakened_2": { sniper: false, tnt: true, depth: 2 },
  "pinene:bomb_crossbow_awakened_3": { sniper: false, tnt: true, depth: 3 },

  "pinene:sniper_crossbow": { sniper: true, tnt: false, depth: 0 },
  "pinene:sniper_crossbow_awakened_1": { sniper: true, tnt: false, depth: 1 },
  "pinene:sniper_crossbow_awakened_2": { sniper: true, tnt: false, depth: 2 },
  "pinene:sniper_crossbow_awakened_3": { sniper: true, tnt: false, depth: 3 },

  "pinene:sniper_tnt_crossbow": { sniper: true, tnt: true, depth: 0 },
  "pinene:sniper_tnt_crossbow_awakened_1": { sniper: true, tnt: true, depth: 1 },
  "pinene:sniper_tnt_crossbow_awakened_2": { sniper: true, tnt: true, depth: 2 },
  "pinene:sniper_tnt_crossbow_awakened_3": { sniper: true, tnt: true, depth: 3 }
});

const SNIPER_DIRECT = Object.freeze([14, 18, 22, 26]);
const SNIPER_TNT_DIRECT = Object.freeze([10, 13, 16, 19]);

const TARGET = Object.freeze({
  sniper_plain: [
    "pinene:sniper_crossbow",
    "pinene:sniper_crossbow_awakened_1",
    "pinene:sniper_crossbow_awakened_2",
    "pinene:sniper_crossbow_awakened_3"
  ],
  sniper_tnt: [
    "pinene:sniper_tnt_crossbow",
    "pinene:sniper_tnt_crossbow_awakened_1",
    "pinene:sniper_tnt_crossbow_awakened_2",
    "pinene:sniper_tnt_crossbow_awakened_3"
  ],
  bomb: [
    "pinene:bomb_crossbow",
    "pinene:bomb_crossbow_awakened_1",
    "pinene:bomb_crossbow_awakened_2",
    "pinene:bomb_crossbow_awakened_3"
  ]
});

const COST = Object.freeze({
  sniper: [
    { typeId: "minecraft:spyglass", count: 1, label: "望遠鏡" },
    { typeId: "minecraft:iron_ingot", count: 1, label: "鉄インゴット" }
  ],
  tnt: [
    { typeId: "minecraft:tnt", count: 1, label: "TNT" },
    { typeId: "minecraft:iron_ingot", count: 3, label: "鉄インゴット" },
    { typeId: "minecraft:string", count: 2, label: "糸" }
  ],
  awaken: [
    { typeId: SOUL_ID, count: 1, label: "純然たるクロスボウの魂" }
  ]
});

const scopedPlayers = new Map();
const projectileDirectDamage = new Map();

function stateOf(typeId) {
  return STATE[typeId];
}

function targetFor({ sniper, tnt, depth }) {
  if (sniper && tnt) return TARGET.sniper_tnt[depth];
  if (sniper) return TARGET.sniper_plain[depth];
  if (tnt) return TARGET.bomb[depth];
  return depth === 0 ? "minecraft:crossbow" : undefined;
}

function heldItem(player) {
  try {
    return player.getComponent("minecraft:equippable")?.getEquipment("Mainhand");
  } catch {
    return undefined;
  }
}

function copyCrossbowState(source, targetId) {
  const target = new ItemStack(targetId, 1);

  const srcDurability = source.getComponent("minecraft:durability");
  const dstDurability = target.getComponent("minecraft:durability");
  if (srcDurability && dstDurability) {
    const ratio = srcDurability.maxDurability > 0
      ? srcDurability.damage / srcDurability.maxDurability
      : 0;
    dstDurability.damage = Math.min(
      dstDurability.maxDurability,
      Math.round(dstDurability.maxDurability * ratio)
    );
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
    if (!dstEnchantable) throw new Error(`Target ${targetId} is not enchantable`);
    dstEnchantable.addEnchantments(enchantments);
  }
  return target;
}

function countItem(inventory, typeId, excludedSlot) {
  let total = 0;
  for (let slot = 0; slot < inventory.size; slot++) {
    if (slot === excludedSlot) continue;
    const item = inventory.getItem(slot);
    if (item?.typeId === typeId) total += item.amount;
  }
  return total;
}

function missingRequirements(inventory, requirements, excludedSlot) {
  return requirements
    .map(req => ({ ...req, have: countItem(inventory, req.typeId, excludedSlot) }))
    .filter(req => req.have < req.count);
}

function consumeRequirements(inventory, requirements, excludedSlot) {
  const snapshots = new Map();

  for (const req of requirements) {
    let remaining = req.count;
    for (let slot = 0; slot < inventory.size && remaining > 0; slot++) {
      if (slot === excludedSlot) continue;
      const stack = inventory.getItem(slot);
      if (!stack || stack.typeId !== req.typeId) continue;

      if (!snapshots.has(slot)) snapshots.set(slot, stack.clone());
      const take = Math.min(remaining, stack.amount);
      remaining -= take;

      if (stack.amount === take) {
        inventory.setItem(slot, undefined);
      } else {
        stack.amount -= take;
        inventory.setItem(slot, stack);
      }
    }

    if (remaining > 0) {
      for (const [slot, snapshot] of snapshots) inventory.setItem(slot, snapshot);
      return undefined;
    }
  }

  return snapshots;
}

function restoreRequirements(inventory, snapshots) {
  if (!snapshots) return;
  for (const [slot, snapshot] of snapshots) inventory.setItem(slot, snapshot);
}

function actionCandidates(sourceId) {
  const state = stateOf(sourceId);
  if (!state) return [];
  const actions = [];

  if (!state.sniper) {
    const targetId = targetFor({ sniper: true, tnt: state.tnt, depth: state.depth });
    if (targetId) {
      actions.push({
        key: "sniper",
        title: "§bスナイパー化",
        detail: "望遠鏡×1 + 鉄インゴット×1",
        targetId,
        requirements: COST.sniper
      });
    }
  }

  if (!state.tnt) {
    const targetId = targetFor({ sniper: state.sniper, tnt: true, depth: state.depth });
    if (targetId) {
      actions.push({
        key: "tnt",
        title: "§6TNTクロスボウ化",
        detail: "TNT×1 + 鉄インゴット×3 + 糸×2",
        targetId,
        requirements: COST.tnt
      });
    }
  }

  if (state.depth < 3 && (state.sniper || state.tnt)) {
    const targetId = targetFor({ sniper: state.sniper, tnt: state.tnt, depth: state.depth + 1 });
    if (targetId) {
      actions.push({
        key: "awaken",
        title: `§d覚醒：深度${state.depth + 1}`,
        detail: "純然たるクロスボウの魂×1",
        targetId,
        requirements: COST.awaken
      });
    }
  }

  return actions;
}

function stateLabel(state) {
  const parts = [];
  if (state.sniper) parts.push("スナイパー");
  if (state.tnt) parts.push("TNT");
  if (!parts.length) parts.push("通常");
  parts.push(`深度${state.depth}`);
  return parts.join(" / ");
}

async function openCrossbowForge(player, sourceTypeId, slot) {
  if (!player?.isValid) return;
  const inventory = player.getComponent("minecraft:inventory")?.container;
  if (!inventory) return;

  const source = inventory.getItem(slot);
  if (!source || source.typeId !== sourceTypeId) return;

  const state = stateOf(sourceTypeId);
  const actions = actionCandidates(sourceTypeId);
  if (!state || !actions.length) {
    player.sendMessage("§8[クロスボウ改造] §7これ以上適用できる改造はありません。");
    return;
  }

  const form = new ActionFormData()
    .title("クロスボウ改造")
    .body(`現在: ${stateLabel(state)}\n§7改造順は自由です。状態・エンチャント・耐久を引き継ぎます。`);

  for (const action of actions) {
    form.button(`${action.title}\n§8${action.detail}`);
  }

  let response;
  try {
    response = await form.show(player);
  } catch (error) {
    console.warn(`[SniperCrossbow] forge UI failed: ${error}`);
    return;
  }
  if (response.canceled || response.selection === undefined) return;

  const action = actions[response.selection];
  if (!action) return;

  const current = inventory.getItem(slot);
  if (!current || current.typeId !== sourceTypeId) {
    player.sendMessage("§8[クロスボウ改造] §c武器が変更されたためキャンセルしました。");
    return;
  }

  const missing = missingRequirements(inventory, action.requirements, slot);
  if (missing.length) {
    player.sendMessage("§8[クロスボウ改造] §c素材不足: " +
      missing.map(x => `${x.label} ${x.have}/${x.count}`).join(" / "));
    return;
  }

  let result;
  try {
    result = copyCrossbowState(current, action.targetId);
  } catch (error) {
    console.warn(`[SniperCrossbow] transform copy failed: ${error}`);
    player.sendMessage("§8[クロスボウ改造] §c変換に失敗しました。素材は消費されていません。");
    return;
  }

  const snapshots = consumeRequirements(inventory, action.requirements, slot);
  if (!snapshots) {
    player.sendMessage("§8[クロスボウ改造] §c素材の消費に失敗しました。");
    return;
  }

  try {
    inventory.setItem(slot, result);
    const written = inventory.getItem(slot);
    if (!written || written.typeId !== action.targetId) throw new Error("weapon write rejected");
    player.dimension.playSound("smithing_table.use", player.location, { volume: 1, pitch: 1 });
    player.sendMessage(`§8[クロスボウ改造] §a完了: ${action.title.replace(/§./g, "")}`);
  } catch (error) {
    inventory.setItem(slot, current);
    restoreRequirements(inventory, snapshots);
    console.warn(`[SniperCrossbow] transform rolled back: ${error}`);
    player.sendMessage("§8[クロスボウ改造] §c書き込みに失敗したため元に戻しました。");
  }
}

world.beforeEvents.playerInteractWithBlock.subscribe(event => {
  const player = event.player;
  const item = event.itemStack;
  if (!player?.isValid || !player.isSneaking) return;
  if (event.block?.typeId !== "minecraft:smithing_table") return;
  if (!item || !stateOf(item.typeId)) return;

  event.cancel = true;
  const sourceTypeId = item.typeId;
  const slot = player.selectedSlotIndex;
  system.run(() => openCrossbowForge(player, sourceTypeId, slot));
});

function enterScope(player) {
  if (scopedPlayers.has(player.id)) return;
  let crosshairWasHidden = false;
  try {
    crosshairWasHidden = player.onScreenDisplay.getHiddenHudElements().includes(HudElement.Crosshair);
  } catch {}

  try {
    player.camera.setFov({ fov: SCOPE_FOV });
  } catch (error) {
    console.warn(`[SniperCrossbow] FOV enter failed: ${error}`);
  }

  if (!crosshairWasHidden) {
    try {
      player.onScreenDisplay.setHudVisibility(HudVisibility.Hide, [HudElement.Crosshair]);
    } catch {}
  }

  scopedPlayers.set(player.id, { crosshairWasHidden });
}

function exitScope(player) {
  const state = scopedPlayers.get(player.id);
  if (!state) return;

  try {
    player.camera.setFov();
  } catch {}

  if (!state.crosshairWasHidden) {
    try {
      player.onScreenDisplay.setHudVisibility(HudVisibility.Reset, [HudElement.Crosshair]);
    } catch {}
  }

  try {
    player.onScreenDisplay.setActionBar("");
  } catch {}

  scopedPlayers.delete(player.id);
}

function isScopedWeapon(item) {
  return !!item && stateOf(item.typeId)?.sniper === true;
}

system.runInterval(() => {
  const liveIds = new Set();

  for (const player of world.getAllPlayers()) {
    liveIds.add(player.id);
    try {
      const active = player.isSneaking && isScopedWeapon(heldItem(player));
      if (active) {
        enterScope(player);
        player.onScreenDisplay.setActionBar(SCOPE_MARKER);
      } else {
        exitScope(player);
      }
    } catch (error) {
      console.warn(`[SniperCrossbow] scope tick failed: ${error}`);
    }
  }

  for (const playerId of scopedPlayers.keys()) {
    if (!liveIds.has(playerId)) scopedPlayers.delete(playerId);
  }
}, 4);

world.afterEvents.playerSpawn.subscribe(event => {
  if (!event.player?.isValid) return;
  system.run(() => exitScope(event.player));
});

function normalizedVelocity(entity, fallbackDirection) {
  try {
    const v = entity.getVelocity();
    const length = Math.hypot(v.x, v.y, v.z);
    if (length > 0.001) {
      return {
        x: v.x / length * SNIPER_SPEED,
        y: v.y / length * SNIPER_SPEED,
        z: v.z / length * SNIPER_SPEED
      };
    }
  } catch {}
  return {
    x: fallbackDirection.x * SNIPER_SPEED,
    y: fallbackDirection.y * SNIPER_SPEED,
    z: fallbackDirection.z * SNIPER_SPEED
  };
}

function tagBombSniperProjectile(projectile, owner, weaponState) {
  const damage = SNIPER_TNT_DIRECT[weaponState.depth];
  projectile.setDynamicProperty("pinene:sniper_tnt", true);
  projectile.setDynamicProperty("pinene:sniper_direct_damage", damage);
  projectileDirectDamage.set(projectile.id, damage);
  projectile.setDynamicProperty("pinene:bomb_depth", weaponState.depth);

  const component = projectile.getComponent("minecraft:projectile");
  if (component && owner?.isValid) {
    const velocity = normalizedVelocity(projectile, owner.getViewDirection());
    component.owner = owner;
    component.shoot(velocity);
  }
}

function replaceVanillaArrowWithSniper(arrow, owner, weaponState) {
  const dimension = arrow.dimension;
  const location = { ...arrow.location };
  const velocity = normalizedVelocity(arrow, owner.getViewDirection());
  const directDamage = SNIPER_DIRECT[weaponState.depth];

  let sniper;
  try {
    sniper = dimension.spawnEntity(SNIPER_PROJECTILE_ID, location);
    const projectile = sniper.getComponent("minecraft:projectile");
    if (!projectile) throw new Error("sniper projectile component missing");
    projectile.owner = owner;
    sniper.setDynamicProperty("pinene:sniper_depth", weaponState.depth);
    sniper.setDynamicProperty("pinene:sniper_direct_damage", directDamage);
    projectileDirectDamage.set(sniper.id, directDamage);
    projectile.shoot(velocity);
  } catch (error) {
    try { if (sniper?.isValid) sniper.remove(); } catch {}
    console.warn(`[SniperCrossbow] projectile replacement failed: ${error}`);
    return;
  }

  try {
    if (arrow.isValid) arrow.remove();
  } catch {}
}

world.afterEvents.entitySpawn.subscribe(event => {
  const projectile = event.entity;
  if (!projectile?.isValid) return;
  if (projectile.typeId !== "minecraft:arrow" && projectile.typeId !== BOMB_PROJECTILE_ID) return;

  const component = projectile.getComponent("minecraft:projectile");
  const owner = component?.owner;
  if (!owner?.isValid || owner.typeId !== "minecraft:player") return;

  const weapon = heldItem(owner);
  const weaponState = stateOf(weapon?.typeId);
  if (!weaponState?.sniper) return;

  if (projectile.typeId === "minecraft:arrow" && !weaponState.tnt) {
    replaceVanillaArrowWithSniper(projectile, owner, weaponState);
  } else if (projectile.typeId === BOMB_PROJECTILE_ID && weaponState.tnt) {
    tagBombSniperProjectile(projectile, owner, weaponState);
  }
});

function canDamagePlayerTarget(target, owner) {
  if (target?.typeId !== "minecraft:player") return true;
  if (!owner?.isValid || owner.typeId !== "minecraft:player") return true;
  if (target === owner) return true;
  return world.gameRules.pvp !== false;
}

world.beforeEvents.entityHurt.subscribe(event => {
  const projectile = event.damageSource.damagingProjectile;
  if (!projectile?.isValid) return;
  if (projectile.typeId !== SNIPER_PROJECTILE_ID && projectile.typeId !== BOMB_PROJECTILE_ID) return;

  const desired = projectileDirectDamage.get(projectile.id) ??
    Number(projectile.getDynamicProperty("pinene:sniper_direct_damage"));
  if (!Number.isFinite(desired) || desired < 0) return;

  const owner = projectile.getComponent("minecraft:projectile")?.owner;
  if (!canDamagePlayerTarget(event.hurtEntity, owner)) {
    event.cancel = true;
    return;
  }
  event.damage = desired;
});

world.afterEvents.projectileHitEntity.subscribe(event => {
  const projectile = event.projectile;
  if (!projectile?.isValid) return;
  if (projectile.typeId !== SNIPER_PROJECTILE_ID && projectile.typeId !== BOMB_PROJECTILE_ID) return;

  const projectileId = projectile.id;
  system.run(() => {
    projectileDirectDamage.delete(projectileId);
    if (projectile.typeId === SNIPER_PROJECTILE_ID) {
      try { if (projectile.isValid) projectile.remove(); } catch {}
    }
  });
});

world.afterEvents.projectileHitBlock.subscribe(event => {
  const projectile = event.projectile;
  if (!projectile?.isValid) return;
  if (projectile.typeId !== SNIPER_PROJECTILE_ID && projectile.typeId !== BOMB_PROJECTILE_ID) return;
  const projectileId = projectile.id;
  system.run(() => projectileDirectDamage.delete(projectileId));
});

console.info("[SniperCrossbow] v0.1 scope / forge / precision projectile runtime loaded");

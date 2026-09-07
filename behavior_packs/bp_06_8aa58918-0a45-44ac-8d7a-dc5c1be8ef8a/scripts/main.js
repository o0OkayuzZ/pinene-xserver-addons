import { world, EntityEquippableComponent, EquipmentSlot, ItemStack, system } from "@minecraft/server";
import { addItem, config_default, getEquip, setScore, hitEvent, dead_event, config, playerKey, visualTombsConfig } from './functions.js';
const w = world.getDimension("overworld");
const entityHitSignal = world.afterEvents.entityHitEntity ?? world.afterEvents.entityHit;



world.afterEvents.worldInitialize.subscribe(() => {
  w.runCommandAsync(`gamerule sendCommandFeedback false`);
  w.runCommandAsync(`gamerule keepInventory true`);
  w.runCommandAsync(`gamerule showTags false`);
  w.runCommandAsync(`gamerule showcoordinates true`);
  w.runCommandAsync(`gamerule playersSleepingPercentage 1`);
});

system.runInterval(() =>{
  for(let p of world.getPlayers()){
    config_default(p)
    getEquip(p)
  }
})

world.afterEvents.playerSpawn.subscribe(spawn => {
  const p = spawn.player;

  const playerUUID = p.id;

  if(!p.hasTag("addScores")){
    p.addTag("addScores")
	  p.runCommandAsync(`scoreboard objectives add modelTombs dummy`)
	  p.runCommandAsync(`scoreboard objectives add colorNameStatus dummy`)
	  p.runCommandAsync(`scoreboard players set @s modelTombs 0`)
	  p.runCommandAsync(`scoreboard players set @s colorNameStatus 0`)
    addItem(p, "new:visual_config", true, "none", [
      "\n§d墓の見た目設定を変更できます",
      "§r§cこのアイテムは死亡時に失われません。§r"
      ]);
  }
  if (world.getDynamicProperty("owner_uuid") === undefined) {
    world.setDynamicProperty("owner_uuid", playerUUID);
    p.sendMessage("§aあなたがこのワールドの所有者になりました。");
  }

  if (p.hasTag("dead")) {
    let cords, dim;

    p.getTags().forEach(tag => {
      if (tag.startsWith("cords:")) cords = tag.replace("cords:", "");
      if (tag.startsWith("dim:")) dim = tag.replace("dim:", "");
    });

    if (cords && dim) {
      playerKey(p, cords, dim);
      p.removeTag("dead");
      p.removeTag(`cords:${cords}`);
      p.removeTag(`dim:${dim}`);
    }
  }

  if (spawn.initialSpawn && !p.hasTag("key_config")) {
    const defaultProperties = {
      key_status: 0,
      owner_restriction: true,
      show_cords_item: true,
      show_cords_chat: true,
      lose_key: false,
      tombs_name: true,
      empty_inv: false,
      spawn_zombie: false,
      spawn_bones: false
    };

    Object.entries(defaultProperties).forEach(([key, value]) => {
      if (world.getDynamicProperty(key) === undefined) {
        world.setDynamicProperty(key, value);
      }
    });

    if (world.getDynamicProperty("owner_uuid") === playerUUID) {
      addItem(p, "new:config_key", true, "none", [
        "\n§d墓の設定を変更できます",
        "§r§cこのアイテムは死亡時に失われません。§r"
      ]);
      p.addTag("key_config");
    } else {
      p.sendMessage("§c墓の設定は所有者のみ変更できます。設定アイテムは付与されませんでした。");
    }
  }
});

world.afterEvents.entityDie.subscribe(dead => {
  const p = dead.deadEntity;
  if (!p.hasTag('dead')) {
    if(!world.getDynamicProperty("empty_inv")){
      if(!p.hasTag("empty") || p.hasTag("getHead") || p.hasTag("getChest") || p.hasTag("getLegs") || p.hasTag("getFFeet") || p.hasTag("getOff")){
        dead_event(p)
      }
      if(p.hasTag("empty") && !p.hasTag("getHead") && !p.hasTag("getChest") && !p.hasTag("getLegs") && !p.hasTag("getFFeet") && !p.hasTag("getOff")){
        p.sendMessage({translate: "action.graves.empty"})
      }
    }
    if(world.getDynamicProperty("empty_inv")){
     dead_event(p)
   }
 }
}, { entityTypes: ['minecraft:player'] });
function stripLoreFormatting(value) {
  return String(value ?? "")
    .replace(/§[0-9a-fk-or]/gi, "")
    .replace(/ﾂｧ[0-9a-fk-or]/gi, "")
    .trim();
}

function getKeyDestination(itemStack) {
  const lore = itemStack?.getLore?.() ?? [];
  if (lore.length < 3) return undefined;

  const coordinates = stripLoreFormatting(lore[1]).match(/[-+]?(?:\d+\.?\d*|\.\d+)/g);
  if (!coordinates || coordinates.length < 3) return undefined;

  const dimensionLine = stripLoreFormatting(lore[2]);
  const separator = dimensionLine.indexOf(": ");
  const parts = dimensionLine.split(/\s+/);
  const dimensionId = (separator >= 0
    ? dimensionLine.slice(separator + 2)
    : parts[parts.length - 1]
  ).trim();
  if (!dimensionId) return undefined;

  return {
    x: Number(coordinates[0]),
    y: Number(coordinates[1]),
    z: Number(coordinates[2]),
    dimensionId
  };
}

world.afterEvents.itemUse.subscribe((data) => {
  const p = data.source;
  const itemStack = data.itemStack;
  if(world.getDynamicProperty("show_cords_item")){
    if (itemStack.typeId == "new:key") {
      const destination = getKeyDestination(itemStack);
      if (destination) {
        try {
          p.teleport(
            { x: destination.x + 0.5, y: destination.y + 1, z: destination.z + 0.5 },
            { dimension: world.getDimension(destination.dimensionId) }
          );
        } catch {
          p.sendMessage("§c鍵の行き先を読み取れませんでした。");
        }
      } else {
        p.sendMessage("§c鍵の座標情報が壊れています。");
      }
    }
  }
  if(!world.getDynamicProperty("show_cords_item")){
    if (itemStack.typeId == "new:key") {
      p.getTags().forEach(t =>{
        if(t.startsWith(":§6")){
          let tp = t.replace(":§6", "")
          w.runCommandAsync(`tp "${p.name}" ${tp}`);
        }
      })
    }
  }
  if(itemStack.typeId == "new:config_key"){
    config(p)
  }
  if(itemStack.typeId == "new:visual_config"){
    visualTombsConfig(p)
  }
});
entityHitSignal?.subscribe(ev => {
  const hit = ev.hitEntity;
  const entity = ev.damagingEntity ?? ev.entity;
  if (!hit || !entity) return;
  const equip = entity.getComponent(EntityEquippableComponent.componentId);
  const hand = equip?.getEquipment(EquipmentSlot.Mainhand);
  const item = new ItemStack("minecraft:air")
  if(hit.typeId === 'new:tumba' && entity.typeId === 'minecraft:player'){
    if(hand){
      if(!hand.typeId.includes('new:key')){
        entity.sendMessage({translate: "action.players.no_key"})
      }
      if(world.getDynamicProperty("owner_restriction") && world.getDynamicProperty("tombs_name")){
        if (hand.typeId === 'new:key_multi') {
          equip.setEquipment(EquipmentSlot.Mainhand, item)
          hitEvent(hit);
        }
        else if (hit.nameTag.includes(entity.name) && hand.typeId.includes('new:key')) {
          equip.setEquipment(EquipmentSlot.Mainhand, item)
          hitEvent(hit);
        }
        else if (!hit.nameTag.includes(entity.name) && hit.typeId === 'new:tumba') {
          if (hand.typeId === 'new:key2' || hand.typeId === 'new:key') {
            entity.runCommandAsync(`tellraw @s {"rawtext":[{"translate":"action.players.warn"},{"text": "${hit.nameTag}"}]}`)
          }
        }
      }
      if(!world.getDynamicProperty("show_cords_item")){
        if (hand.typeId.includes("new:key")) {
          entity.getTags().forEach(t =>{
            if(t.startsWith(":§6")){
              entity.removeTag(t)
            }
          })
        }
      }
      if(world.getDynamicProperty("owner_restriction") && !world.getDynamicProperty("tombs_name")){
        if (hand.typeId === 'new:key_multi') {
          equip.setEquipment(EquipmentSlot.Mainhand, item)
          hitEvent(hit);
        }
        hit.getTags().forEach(t =>{
          if(!t.startsWith(`${entity.nameTag}`)){
            if (hand.typeId === 'new:key2' || hand.typeId === 'new:key') {
              entity.sendMessage({translate: "action.players.warn2"})
            }
          }
          if(t.startsWith(`${entity.nameTag}`)){
           if (hand.typeId === 'new:key2' || hand.typeId === 'new:key') {
            equip.setEquipment(EquipmentSlot.Mainhand, item)
            hitEvent(hit);
          }
        }
      })
      }
      if(!world.getDynamicProperty("owner_restriction")){
        if (hand.typeId === 'new:key' || hand.typeId === 'new:key2' || hand.typeId === 'new:key_multi') {
          equip.setEquipment(EquipmentSlot.Mainhand, item)
          hitEvent(hit);
        }
      }
    }
    if(hand == undefined){
      entity.sendMessage({translate: "action.players.no_key"})
    }
  }
});

// Figure items are spread across two active behavior packs. Keep their placement
// and pickup logic in this already-scripted pack so no extra script pack is needed.
const FIGURE_PLACE_MAP = {
  "myname:figure_fossil": "myname:figure_fossil_placed",
  "myname:figure_spiral": "myname:figure_spiral_placed",
  "myname:figure_oyu": "myname:figure_oyu_placed",
  "myname:utyuuneko": "myname:utyuuneko_placed",
  "myname:jack": "myname:jack_placed",
  "myname:mimikkyu": "myname:mimikkyu_placed",
  "myname:soubraze": "myname:soubraze_placed",
  "myname:goamagara": "myname:goamagara_placed",
  "myname:shini": "myname:shini_placed",
  "myname:hitomoshi": "myname:hitomoshi_placed",
  "myname:gengar": "myname:gengar_placed",
  "myname:metamon": "myname:metamon_placed",
  "myname:meltan": "myname:meltan_placed"
};

const FIGURE_PICKUP_MAP = {};
for (const itemId in FIGURE_PLACE_MAP) {
  FIGURE_PICKUP_MAP[FIGURE_PLACE_MAP[itemId]] = itemId;
}

const figurePickupClaims = new Set();

function normalizeYaw(yaw) {
  const value = yaw % 360;
  return value < 0 ? value + 360 : value;
}

function getFigureYaw(player, location) {
  const rotation = player.getRotation?.();
  const view = player.getViewDirection?.();
  const rawYaw = rotation && typeof rotation.y === "number"
    ? rotation.y
    : view ? (Math.atan2(-view.x, view.z) * 180) / Math.PI : 0;
  const snapped = Math.round(rawYaw / 45) * 45;
  const bucket = Math.abs((Math.floor(location.x) * 734287 + Math.floor(location.z) * 912271) % 4);
  return normalizeYaw(snapped + [-10, -4, 4, 10][bucket]);
}

function consumeHeldFigure(player, itemId) {
  const equip = player.getComponent(EntityEquippableComponent.componentId);
  const held = equip?.getEquipment(EquipmentSlot.Mainhand);
  if (!held || held.typeId !== itemId) return false;

  if (held.amount > 1) {
    held.amount -= 1;
    equip.setEquipment(EquipmentSlot.Mainhand, held);
  } else {
    equip.setEquipment(EquipmentSlot.Mainhand, new ItemStack("minecraft:air"));
  }
  return true;
}

function placeFigure(player, itemId, location) {
  const entityId = FIGURE_PLACE_MAP[itemId];
  if (!entityId || player?.typeId !== "minecraft:player") return;

  system.run(() => {
    if (!consumeHeldFigure(player, itemId)) return;
    try {
      const entity = player.dimension.spawnEntity(entityId, location);
      entity.setRotation?.({ x: 0, y: getFigureYaw(player, location) });
    } catch (error) {
      try {
        player.dimension.spawnItem(new ItemStack(itemId, 1), location);
      } catch {
      }
      player.sendMessage("§cフィギュアの設置に失敗しました: " + String(error));
    }
  });
}

function pickupFigure(entity, removeEntity = true) {
  let typeId;
  let entityId;
  try {
    typeId = entity?.typeId;
    entityId = entity?.id;
  } catch {
    return false;
  }

  const itemId = FIGURE_PICKUP_MAP[typeId];
  if (!itemId || !entityId || figurePickupClaims.has(entityId)) return false;
  figurePickupClaims.add(entityId);

  try {
    const location = { ...entity.location };
    entity.dimension.spawnItem(new ItemStack(itemId, 1), location);
    if (removeEntity) entity.remove();
    system.runTimeout(() => figurePickupClaims.delete(entityId), 20);
    return true;
  } catch {
    figurePickupClaims.delete(entityId);
    return false;
  }
}

world.afterEvents.itemUseOn?.subscribe(event => {
  const itemId = event.itemStack?.typeId;
  if (!FIGURE_PLACE_MAP[itemId]) return;
  const block = event.block;
  placeFigure(event.source, itemId, {
    x: block.location.x + 0.5,
    y: block.location.y + 0.98,
    z: block.location.z + 0.5
  });
});

entityHitSignal?.subscribe(event => {
  const attacker = event.damagingEntity ?? event.entity;
  if (attacker?.typeId !== "minecraft:player" || !event.hitEntity) return;
  pickupFigure(event.hitEntity);
});

world.afterEvents.entityHurt?.subscribe(event => {
  if (event.damageSource?.damagingEntity?.typeId !== "minecraft:player") return;
  pickupFigure(event.hurtEntity);
});

world.afterEvents.entityDie.subscribe(event => {
  pickupFigure(event.deadEntity, false);
});

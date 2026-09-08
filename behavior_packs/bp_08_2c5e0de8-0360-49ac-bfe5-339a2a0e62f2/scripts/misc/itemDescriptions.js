import {
  world,
  system
} from "@minecraft/server";


world.afterEvents.playerInventoryItemChange.subscribe((e) => {
  const item = e.itemStack;
  const player = e.player;
  if (!item || !player) return;
  if (item.getLore().length !== 0) return;
  var lore = undefined
  if (item.hasTag("dungeons:melee_lore") || item.hasTag("dungeons:bow_lore")) {
    lore = [{ translate: item.typeId.replace("dungeons:", "dungeons.desc.") }]
  } else if (item.hasTag("dungeons:armor_lore")) {
    lore = [{ translate: "dungeons.desc.armour.full_set" }, { translate: item.typeId.replace("dungeons:", "dungeons.desc.armour.").replace("_boots", "").replace("_chestplate", "").replace("_leggings", "").replace("_helmet", "") }]
  } else if (item.getComponent("dungeons:artefact_cooldown")) {
    lore = [{ translate: "dungeons.desc.artefact.on_use" }, { translate: item.typeId.replace("dungeons:", "dungeons.desc.") }]
  }
  if (lore == undefined) return
  item.setLore(lore)
  var slot = e.slot
  const inventory = player.getComponent("minecraft:inventory");
  if (inventory === undefined || inventory.container === undefined) {
    return;
  }
  inventory.container.setItem(slot, item);
})


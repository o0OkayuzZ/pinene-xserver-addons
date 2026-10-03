import {
  world,
  system
} from "@minecraft/server";

let loaded = false;
system.runTimeout(() => {
  loaded = true;
}, 100);

world.afterEvents.playerInventoryItemChange.subscribe((e) => {
  if (!loaded) return;

  const item = e.itemStack;
  const player = e.player;
  if (!item || !player) return;
  system.run(() => {

    var skip = false
    const toughness = item.getComponent("dungeons:toughness")
    if(toughness) {
      var value = Math.ceil(toughness.customComponentParameters.params.toughness)
      const gottenLore = item.getLore()
      if(gottenLore.length == 0) {
        skip = true
        item.setLore([{rawtext:[{text: `§r§9+${value} `},{translate: "attribute.name.generic.armorResilience"}]}])
      } else if (gottenLore[0].includes("attribute.name.generic.armorResilience") == false) {
        var newLore = [{rawtext:[{text: `§r§9+${value} `},{translate: "attribute.name.generic.armorResilience"}]}]
        for(const loreT of gottenLore) if(!loreT.includes("attribute.name.generic.armorResilience")) newLore.push(loreT)
        skip = true
        item.setLore(newLore)
      }
      if(!item.hasTag("dungeons:armor_lore")) {
          var slot = e.slot
          const inventory = player.getComponent("minecraft:inventory");
          if (inventory === undefined || inventory.container === undefined) {
            return;
          }
          inventory.container.setItem(slot, item);
          return;
      }
    } else {
      const gottenLore = item.getLore()
      if(gottenLore.length > 0) {
        var fix = false
        for(const loreT of gottenLore) if(loreT.includes("attribute.name.generic.armorResilience")) fix = true
        
        if(fix) { 
          const newLore = []
          for(const loreT of gottenLore) if(!loreT.includes("attribute.name.generic.armorResilience")) newLore.push(loreT)
          item.setLore(newLore)
          var slot = e.slot
          const inventory = player.getComponent("minecraft:inventory");
          if (inventory === undefined || inventory.container === undefined) {
            return;
          }
          inventory.container.setItem(slot, item);
          inventory.container.setItem(slot, item);
          return;
        }
      }

    }
    if (item.getLore().length !== 0 && skip == false) return;
    var lore = undefined
    if (item.hasTag("dungeons:melee_lore") || item.hasTag("dungeons:bow_lore")) {
      lore = [{ translate: item.typeId.replace("dungeons:", "dungeons.desc.") }]
    } else if (item.hasTag("dungeons:armor_lore")) {
      if(toughness) {
        var value = toughness.customComponentParameters.params.toughness
        lore = [{rawtext:[{text: `§r§9+${value} `},{translate: "attribute.name.generic.armorResilience"}]},{ translate: "dungeons.desc.armour.full_set" }, { translate: item.typeId.replace("dungeons:", "dungeons.desc.armour.").replace("_boots", "").replace("_chestplate", "").replace("_leggings", "").replace("_helmet", "") }]
      
      } else {
        lore = [{ translate: "dungeons.desc.armour.full_set" }, { translate: item.typeId.replace("dungeons:", "dungeons.desc.armour.").replace("_boots", "").replace("_chestplate", "").replace("_leggings", "").replace("_helmet", "") }]
      }
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
})
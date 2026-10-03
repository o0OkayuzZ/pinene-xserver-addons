import { world, system, ItemStack } from "@minecraft/server";

import {
  colourList,
  effectsList,
  debuffsList,
} from "components/armour/mystery.js";

import { armourGilds } from "misc/gilds.js";

world.afterEvents.entitySpawn.subscribe((e) => {
  const entity = e.entity;
  if (!entity || !entity.isValid || entity.typeId !== "minecraft:item") return;
  const itemStackComp = entity.getComponent("item");
  if (itemStackComp.itemStack.typeId !== "dungeons:drop_mystery_armour") return;
  dropMysteryArmour(entity.location, entity.dimension, false);
  entity.remove();
});

world.afterEvents.entitySpawn.subscribe((e) => {
  const entity = e.entity;
  if (!entity || !entity.isValid || entity.typeId !== "minecraft:item") return;
  const itemStackComp = entity.getComponent("item");
  if (itemStackComp.itemStack.typeId !== "dungeons:drop_mystery_armour_gilded")
    return;
  dropMysteryArmour(entity.location, entity.dimension, true);
  entity.remove();
});

function dropMysteryArmour(loc, dim, gilded) {
  var gild = undefined;
  if (gilded) {
    gild = armourGilds[Math.floor(Math.random() * armourGilds.length)];
    if (gild == undefined || gild == "undefined") gild = armourGilds[0];
  }
  var randColour = colourList[Math.floor(Math.random() * colourList.length)];
  var colourId = randColour;
  if (randColour == "green") colourId = undefined;
  var helmet = undefined;
  var chestplate = undefined;
  if (colourId) {
    helmet = new ItemStack("dungeons:mystery_helmet_" + colourId);
    chestplate = new ItemStack("dungeons:mystery_chestplate_" + colourId);
  } else {
    helmet = new ItemStack("dungeons:mystery_helmet");
    chestplate = new ItemStack("dungeons:mystery_chestplate");
  }
  const leggings = new ItemStack("dungeons:mystery_leggings");
  const boots = new ItemStack("dungeons:mystery_boots");
  const items = [helmet, chestplate, leggings, boots];
  const chosenEffects = [];
  for (let i = 0; i < 2; i++) {
    var options = [];
    for (const possibleOption of effectsList)
      if (!chosenEffects.includes(possibleOption)) options.push(possibleOption);
    chosenEffects.push(options[Math.floor(Math.random() * options.length)]);
  }
  if (Math.random() >= 0.75) {
    if (chosenEffects.includes("sprint_speed")) {
      if (!chosenEffects.includes("artefact_cooldown"))
        chosenEffects.push("artefact_slow");
    } else if (chosenEffects.includes("artefact_cooldown")) {
      if (!chosenEffects.includes("sprint_speed"))
        chosenEffects.push("sprint_slow");
    } else {
      chosenEffects.push(
        debuffsList[Math.floor(Math.random() * debuffsList.length)],
      );
    }
  }
  for (const item of items) {
    if (!item) return;
    const loreArray = [];
    loreArray.push({ translate: "dungeons.mystery_colour." + randColour });
    loreArray.push({ translate: "dungeons.desc.armour.full_set" });
    for (const effect of chosenEffects) {
      loreArray.push({ translate: "dungeons.mystery." + effect });
    }
    if (gilded) {
      loreArray.push({
        rawtext: [
          { text: "§g§i§l§d" },
          { text: "\n§r" },
          { translate: "dungeons.desc.gild." + gild },
        ],
      });
    }
    item.setLore(loreArray);
    for (let i = 0; i < chosenEffects.length; i++) {
      item.setDynamicProperty(`dungeons:mystery_effect_${i}`, chosenEffects[i]);
    }
    if (gilded) {
      for (const propertyId of item.getDynamicPropertyIds()) {
        if (propertyId.includes("dungeons:gild"))
          item.setDynamicProperty(propertyId, null);
      }
      item.setDynamicProperty("dungeons:gild_" + gild, 1);
    }
    dim.spawnItem(item, loc).applyImpulse({
        x: (Math.random() * 0.2 - 0.1) / 2,
        y: 0.05,
        z: (Math.random() * 0.2 - 0.1) / 2,
      });
  }
}

system.afterEvents.scriptEventReceive.subscribe((e) => {
  const player = e.sourceEntity;
  const id = e.id;
  if (id == "dungeons:drop_mystery") {
    player
      .getComponent("equippable")
      .setEquipment(
        "Mainhand",
        new ItemStack("dungeons:drop_mystery_armour_gilded", 1),
      );
  }
});

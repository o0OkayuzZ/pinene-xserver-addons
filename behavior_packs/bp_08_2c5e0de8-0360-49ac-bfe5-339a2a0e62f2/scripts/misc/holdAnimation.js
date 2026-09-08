import {
  world,
  system
} from "@minecraft/server";


system.runInterval(() => {
  for (const player of world.getPlayers()) {
    const heldItem = player.getComponent("minecraft:equippable").getEquipment("Mainhand");
    if (player.getComponent("minecraft:equippable").getEquipment("Offhand")) continue;
    if (!heldItem) continue;
    if (heldItem.hasTag("dungeons:two_handed_animation")) {
      if (player.isSwimming) continue;

      if (player.hasTag("dungeons:in_shadow_form")) continue;
      player.playAnimation('animation.player.greatsword_hold', { blendOutTime: 0.3, nextState: 'claymoreHold' })
    }
  }
});
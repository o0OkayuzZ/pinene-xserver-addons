import {
  world,
  system
} from "@minecraft/server";
system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:boots_of_switfness', {
    onUse(e, { params }) {
      const player = e.source;
      const item = e.itemStack;
      const type = params.type

      if (item.hasTag('dungeons:tome_of_duplication')) {
        if (!player.hasTag('tod:used_boots_of_swiftness')) return;
      }

      const loc = player.location
      const dim = player.dimension;
      dim.spawnParticle('dungeons:swiftness', loc)
      dim.playSound('armor.equip_leather', loc, {
        pitch: 1.5,
        volume: 0.5
      });
      dim.playSound("artefact.swiftness_boot.use", loc)

      var duration = 60
      if (type == "rare") duration = 90

      player.addEffect('speed', duration, {
        amplifier: 1
      });
    }
  });

});
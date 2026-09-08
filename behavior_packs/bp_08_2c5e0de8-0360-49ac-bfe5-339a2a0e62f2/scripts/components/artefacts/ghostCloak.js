import {
  system
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:ghost_cloak', {
    onUse(e, { params }) {
      const player = e.source;
      const item = e.itemStack;
      const type = params.type

      if (item.hasTag('dungeons:tome_of_duplication')) {
        if (!player.hasTag('tod:used_ghost_cloak')) return;
      }



      player.dimension.spawnParticle('dungeons:ambush', player.location)
      player.dimension.playSound('armor.equip_leather', player.location, {
        pitch: 1.5
      });

      if (type == "common") {
        player.addEffect('speed', 40, {
          amplifier: 0,
          showParticles: false
        });
      } else {
        player.addEffect('speed', 40, {
          amplifier: 1,
          showParticles: false
        });
      }
      player.addEffect('resistance', 40, {
        amplifier: 1,
        showParticles: true
      });
      player.addEffect('invisibility', 40, {
        amplifier: 0,
        showParticles: false
      });
    }
  });

});
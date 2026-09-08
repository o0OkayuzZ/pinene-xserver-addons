import {
  world,
  system,
  ItemStack
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:iron_hide_amulet', {
    onUse(e, { params }) {
      const player = e.source;
      const item = e.itemStack;
      const type = params.type

      if (item.hasTag('dungeons:tome_of_duplication')) {
        if (!player.hasTag('tod:used_iron_hide_amulet')) return;
      }


      player.dimension.spawnParticle('dungeons:iron_hide_amulet_1', player.location)
      player.dimension.spawnParticle('dungeons:iron_hide_amulet_2', player.location)
      player.dimension.playSound('random.anvil_land', player.location, {
        volume: 0.7,
        pitch: 0.5
      });
      if (type == "common") {
        player.addEffect('resistance', 150, {
          amplifier: 1
        });
      } else {
        player.addEffect('resistance', 250, {
          amplifier: 1
        });
      }
    }
  });
});
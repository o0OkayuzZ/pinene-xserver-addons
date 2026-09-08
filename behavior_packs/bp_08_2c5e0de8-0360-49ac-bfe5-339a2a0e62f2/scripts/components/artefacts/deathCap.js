import {
  system
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:death_cap_mushroom', {
    onUse(e, { params }) {
      const player = e.source;
      const item = e.itemStack;

      if (item.hasTag('dungeons:tome_of_duplication')) {
        if (!player.hasTag('tod:used_death_cap_mushroom')) return;
      }


      player.dimension.playSound("random.eat", player.location, { volume: 0.7, pitch: 0.5 })
      player.dimension.spawnParticle("dungeons:death_cap_mushroom", player.location)
      if (params.type == "common") {
        player.addEffect("strength", 200)
        player.addEffect("speed", 200)
      } else {
        player.addEffect("strength", 300)
        player.addEffect("speed", 300)

      }
    }
  });

});
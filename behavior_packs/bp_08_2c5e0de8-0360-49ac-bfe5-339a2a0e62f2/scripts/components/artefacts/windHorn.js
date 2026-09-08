import {
  world,
  system,
  ItemStack
} from "@minecraft/server";

import { getDirection, makeVector, isValidTarget } from "main.js";

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:wind_horn', {
    onUse(e, { params }) {
      const player = e.source;
      const item = e.itemStack;
      const type = params.type

      if (item.hasTag('dungeons:tome_of_duplication')) {
        if (!player.hasTag('tod:used_wind_horn')) return;
      }


      player.dimension.playSound("artefact.wind_horn", player.location, { volume: 0.8, pitch: 1 })
      player.dimension.spawnParticle("dungeons:wind_horn", player.location)

      var power = 3
      if (type == "rare") power = 4.5

      const targets = player.dimension.getEntities({ location: player.location, maxDistance: 7 })
      for (const target of targets) {
        if (isValidTarget(target) && target !== player) {
          const dir = getDirection(player.location, target.location);
          target.applyKnockback(makeVector(dir, power), 0.5)
          target.addEffect("slowness", power * 20 + 40)

        }
      }
    }
  });

});
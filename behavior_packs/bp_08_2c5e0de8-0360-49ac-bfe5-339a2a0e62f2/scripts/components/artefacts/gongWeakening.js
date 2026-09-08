import {
  system
} from "@minecraft/server";

import { isValidTarget } from "main.js";
import { addVoidedEffect } from "misc/voidedEffect.js"

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:gong_of_weakening', {
    onUse(e, { params }) {
      const player = e.source;
      const item = e.itemStack;
      const type = params.type
      if (item.hasTag('dungeons:tome_of_duplication')) {
        if (!player.hasTag('tod:used_gong_of_weakening')) return;
      }




      player.dimension.playSound("block.bell.hit", player.location, { volume: 1.3, pitch: 0.7 })
      player.dimension.spawnParticle("dungeons:gong_of_weakening_1", player.location)
      player.dimension.spawnParticle("dungeons:gong_of_weakening_2", player.location)
      const targets = player.dimension.getEntities({ location: player.location, maxDistance: 6 })
      for (const target of targets) {
        if (isValidTarget(target) && target !== player) {
          if (type == "common") {
            target.addEffect("weakness", 100, { amplifier: 0 })
            addVoidedEffect(target, 100)
          }
          if (type == "rare") {
            target.addEffect("weakness", 200, { amplifier: 0 })
            addVoidedEffect(target, 200)
          }
        }
      }
    }
  });

});
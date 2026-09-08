import {
  world,
  system,
  ItemStack
} from "@minecraft/server";

import { isValidTarget } from "main.js";

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:shock_powder', {
    onUse(e, { params }) {
      const player = e.source;
      const item = e.itemStack;
      const type = params.type
      var duration = 3.5
      if (type == "rare") duration = 6


      if (item.hasTag('dungeons:tome_of_duplication')) {
        if (!player.hasTag('tod:used_shock_powder')) return;
      }


      const dim = player.dimension
      const loc = player.location
      const damageRange = dim.getEntities({
        location: loc,
        maxDistance: 5,
        excludeFamilies: ['ignore']
      });
      dim.spawnParticle("dungeons:shock_powder_strike", loc)
      dim.spawnParticle("dungeons:shock_powder", { x: loc.x, y: loc.y + 1, z: loc.z })
      dim.playSound("ambient.weather.lightning.impact", loc, { pitch: 2.5 })


      for (const target of damageRange) {
        if (isValidTarget(target) == false) continue;
        if (target === player) continue;
        target.addEffect("weakness", duration * 20, { amplifier: 9, showParticles: false })
        target.addEffect("slowness", duration * 20, { amplifier: 9, showParticles: false })
        target.addEffect("mining_fatigue", duration * 20, { amplifier: 9, showParticles: false })
        target.dimension.spawnParticle("dungeons:stun_" + duration + "s", target.location)
      }
    }
  });

});
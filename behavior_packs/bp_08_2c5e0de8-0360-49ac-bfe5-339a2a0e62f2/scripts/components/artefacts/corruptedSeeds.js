import {
  system,
  EntityDamageCause
} from "@minecraft/server";

import { isValidTarget, specialDamage } from "main.js"


system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:corrupted_seeds', {
    onUse(e) {
      const player = e.source;
      const item = e.itemStack;

      if (item.hasTag('dungeons:tome_of_duplication')) {
        if (!player.hasTag('tod:used_corrupted_seeds')) return;
      }


      player.dimension.playSound("mob.player.hurt_freeze", player.location, { volume: 0.5, pitch: 0.4 })
      player.dimension.spawnParticle("dungeons:corrupted_seeds", player.location)

      const targets = player.dimension.getEntities({ location: player.location, maxDistance: 5 })
      for (const target of targets) {
        if (isValidTarget(target) && target !== player) {
          specialDamage(player, target, 1, EntityDamageCause.wither, ["poison", "artefact"])
          target.applyKnockback({ x: 0, z: 0 }, -0.2)
          target.addEffect("fatal_poison", 160)
          target.addEffect("slowness", 160, { amplifier: 3 })
        }
      }
    }
  });

});
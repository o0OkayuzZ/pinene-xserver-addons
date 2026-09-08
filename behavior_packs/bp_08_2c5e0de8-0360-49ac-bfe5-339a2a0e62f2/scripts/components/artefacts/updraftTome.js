import {
  world,
  system,
  ItemStack,
  EntityDamageCause
} from "@minecraft/server";
import { isValidTarget, specialDamage } from "main.js"

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:updraft_tome', {
    onUse(e) {
      const player = e.source;
      const item = e.itemStack;
      const dim = player.dimension;

      if (item.hasTag('dungeons:tome_of_duplication')) {
        if (!player.hasTag('tod:used_updraft_tome')) return;
      }
      const testTargets = dim.getEntities({
        location: player.location,
        maxDistance: 7.5
      });
      var isAnyTargets = false
      for (const test of testTargets) {
        if (isValidTarget(test) && test !== player) isAnyTargets = true
      }
      if (isAnyTargets == false) {
        player.sendMessage([{ text: "§7§o" }, { translate: "dungeons.warn.no_targets" }])
        let cd = item.getComponent('cooldown');
        player.startItemCooldown(cd.cooldownCategory, 10);
        return;
      }
      dim.playSound('artefact.updraft_tome.use', player.location);
      system.runTimeout(() => {
        dim.playSound('wind_charge.burst', player.location, {
          volume: 0.9,
          pitch: 0.5
        });
        const damageRange = dim.getEntities({
          location: player.location,
          maxDistance: 7.5
        });
        var count = 7
        for (const target of damageRange) {
          if (count == 0) return;
          if (isValidTarget(target) && target !== player) {
            target.dimension.spawnParticle('minecraft:wind_explosion_emitter', { x: target.location.x, y: target.location.y + 1, z: target.location.z });
            dim.playSound('wind_charge.burst', { x: target.location.x, y: target.location.y + 1, z: target.location.z }, {
              volume: 0.9,
              pitch: 1
            });
            const damagedone = specialDamage(player, target, 5, EntityDamageCause.entityExplosion, ["wind", "artefact"])
            if (damagedone) {
              target.applyKnockback({ x: 0, z: 0 }, 1.1);
              count -= 1;
            }
          }
        }
      }, 10)
    }
  });
});
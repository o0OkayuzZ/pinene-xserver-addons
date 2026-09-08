import {
  world,
  system,
  EntityDamageCause
} from "@minecraft/server";


import { isValidTarget, specialDamage } from "main.js"



system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:satchel_of_elements', {
    onUse(e) {
      const player = e.source;
      const item = e.itemStack;
      const dim = player.dimension
      const loc = player.location
      if (item.hasTag('dungeons:tome_of_duplication')) {
        if (!player.hasTag('tod:used_satchel_of_elements')) return;
      }
      const damageRange = dim.getEntities({
        location: loc,
        maxDistance: 8,
        excludeFamilies: ['ignore']
      });
      var isAnyTargets = false
      for (const target of damageRange) {
        if (isValidTarget(target) && target !== player) isAnyTargets = true
      }
      if (isAnyTargets == false) {
        player.sendMessage([{ text: "§7§o" }, { translate: "dungeons.warn.no_targets" }])
        let cd = item.getComponent('cooldown');
        player.startItemCooldown(cd.cooldownCategory, 10);
        return;
      }

      const rand = Math.random()
      var element = ""
      if (rand < 0.33) element = "ice"
      if (rand >= 0.33 && rand < 0.67) element = "fire"
      if (rand >= 0.67) element = "electric"

      if (element == "ice") {
        dim.spawnParticle("dungeons:satchel_elements_use_ice", loc)
        dim.playSound("mob.player.hurt_freeze", loc)
      } else if (element == "fire") {
        dim.spawnParticle("dungeons:satchel_elements_use_fire", loc)
        dim.playSound("mob.ghast.fireball", loc)

      } else {
        dim.spawnParticle("dungeons:satchel_elements_use_electric", loc)
        dim.playSound("ambient.weather.lightning.impact", loc, { pitch: 0.4 })
      }

      for (const target of damageRange) {
        if (isValidTarget(target) == false) continue;
        if (target === player) continue;

        if (element == "ice") {
          target.addEffect("slowness", 160, { amplifier: 2 })
          dim.spawnParticle("dungeons:satchel_elements_ice", target.location)
        } else if (element == "fire") {
          const damageDone = specialDamage(player, target, 2, EntityDamageCause.fire, ["fire", "artefact"])
          if (damageDone) {
            target.setOnFire(5 + Math.random() * 3, true)
            dim.spawnParticle("dungeons:satchel_elements_fire", target.location)
          }
        } else {
          if (target.matches({ families: ["creeper"] })) {
            target.triggerEvent("minecraft:become_charged")
            const damagedone = specialDamage(player, target, 6, EntityDamageCause.lightning, ["lightning", "artefact"])
            if (damagedone) {
              target.applyKnockback({ x: 0, z: 0 }, 0.4)
              target.setOnFire(1)
              dim.spawnParticle("dungeons:lightning_wand_shock", target.location)
              dim.playSound("artefact.lightningwand.strike", target.location)
            }
          } else {
            const damageDone = specialDamage(player, target, 12, EntityDamageCause.lightning, ["lightning", "artefact"])
            if (damageDone) {
              target.setOnFire(1, true)
              dim.spawnParticle("dungeons:lightning_wand_shock", target.location)
              dim.playSound("artefact.lightningwand.strike", target.location)
            }
          }
        }
      }
    }
  });

});
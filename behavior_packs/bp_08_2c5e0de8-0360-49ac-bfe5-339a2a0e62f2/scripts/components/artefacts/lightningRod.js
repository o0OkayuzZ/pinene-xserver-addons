import {
  world,
  system,
  ItemStack,
  EntityDamageCause
} from "@minecraft/server";


import { isValidTarget, specialDamage } from "main.js"



function strikeLightning(owner, dim, location, type) {
  var range = 3.5
  var damage = 15
  if (type == "rare") {
    range = 4.5
    damage = 20
  }

  const floor = dim.getTopmostBlock({ x: location.x, z: location.z }, location.y).above()
  const loc = floor.location
  dim.spawnParticle("dungeons:lightning_rod_area", loc)
  dim.playSound("artefact.lightningwand.use", loc)
  system.runTimeout(() => {
    dim.spawnParticle("dungeons:lightning_wand_shock", loc)
    dim.playSound("artefact.lightningwand.strike", loc)

    const damageRange = dim.getEntities({
      location: location,
      maxDistance: range,
      excludeFamilies: ['ignore']
    });

    for (const target of damageRange) {
      if (isValidTarget(target) == false) continue;
      if (target === owner) continue;
      if (target.matches({ families: ["creeper"] })) {
        target.triggerEvent("minecraft:become_charged")
        const damagedone = specialDamage(owner, target, damage / 2, EntityDamageCause.lightning, ["lightning", "soul", "artefact"])
        if (damagedone) {
          target.applyKnockback({ x: 0, z: 0 }, 0.4)
          target.setOnFire(1)
        }
      } else {
        const damagedone = specialDamage(owner, target, damage, EntityDamageCause.lightning, ["lightning", "soul", "artefact"])
        if (damagedone) {
          target.applyKnockback({ x: 0, z: 0 }, 0.4)
          target.setOnFire(1)
        }
      }

    }
  }, 20)
}

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:lightning_rod', {
    onUse(e, { params }) {
      const player = e.source;
      const item = e.itemStack;
      const type = params.type

      if (item.hasTag('dungeons:tome_of_duplication')) {
        if (!player.hasTag('tod:used_lightning_rod')) return;
      }


      var rayCast = player.getEntitiesFromViewDirection(({
        ignoreBlockCollision: true,
        includePassableBlocks: false,
        includeLiquidBlocks: true,
        maxDistance: 24
      }))
      if (rayCast == undefined || rayCast.length == 0) {
        rayCast = player.getBlockFromViewDirection({
          maxDistance: 24,
          includePassableBlocks: false,
          includeLiquidBlocks: true
        });
        if (!rayCast) {
          const cd = item.getComponent("cooldown")
          player.startItemCooldown(cd.cooldownCategory, 10);
          return;
        } else {
          rayCast = rayCast.block.location;
        }
      } else {
        rayCast = rayCast[0].entity.location
      }

      let soulScore = world.scoreboard.getObjective("soulGauge")
      let soulGauge = soulScore.getScore(player)

      if (soulGauge < 8) {
        player.playSound("mob.evocation_illager.cast_spell", { pitch: 0.6, volume: 0.5 })
        player.sendMessage([{ text: "§7§o" }, { translate: "dungeons.warn.collect_more_souls" }])
        const cd = item.getComponent("cooldown")
        player.startItemCooldown(cd.cooldownCategory, 0);
        return;
      } else {
        soulScore.addScore(player, -8)
      }
      strikeLightning(player, player.dimension, rayCast, type)
    }
  });
});
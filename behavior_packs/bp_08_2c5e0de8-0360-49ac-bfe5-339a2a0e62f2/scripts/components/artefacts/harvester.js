import {
  world,
  system,
  ItemStack,
  EntityDamageCause
} from "@minecraft/server";

import { isValidTarget, specialDamage } from "main.js"



system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:harvester', {
    onUse(e) {
      const player = e.source;
      const item = e.itemStack;
      useArtefact(player, item, false)
    }
  });

});

system.afterEvents.scriptEventReceive.subscribe((e) => {
  const id = e.id;
  if (id !== "dungeons:force_artefact") return;
  const player = e.sourceEntity;
  if (!player) return;
  const itemId = e.message;
  if (!itemId) return;
  const item = new ItemStack(itemId, 1)
  if (!item.getComponent("dungeons:harvester")) return;
  useArtefact(player, item, true)
})

function useArtefact(player, item, finalShout) {
  const params = item.getComponent("dungeons:harvester").customComponentParameters.params
  const dim = player.dimension;
  const type = params.type;
  var range
  var damage
  if (type == "common") {
    range = 5
    damage = 22
  } else if (type == "rare") {
    range = 5.5
    damage = 30
  }
  if (item.hasTag('dungeons:tome_of_duplication')) {
    if (!player.hasTag('tod:used_harvester')) return;
  }


  let soulScore = world.scoreboard.getObjective("soulGauge")
  let soulGauge = soulScore.getScore(player)

  if (soulGauge < 15 && !finalShout) {
    player.playSound("mob.evocation_illager.cast_spell", { pitch: 0.6, volume: 0.5 })
    player.sendMessage([{ text: "§7§o" }, { translate: "dungeons.warn.collect_more_souls" }])
    const cd = item.getComponent("cooldown")
    player.startItemCooldown(cd.cooldownCategory, 10);
    return;
  } else {
    soulScore.addScore(player, -15)
    if (soulGauge - 15 < 0) soulScore.setScore(player, 0)
  }

  dim.playSound('beacon.activate', player.location, {
    volume: 0.5,
    pitch: 1.8
  });

  dim.spawnParticle('dungeons:harvester_blast', player.location);
  dim.spawnParticle('dungeons:harvester_blast2', player.location);
  system.runTimeout(() => {
    dim.spawnParticle('dungeons:harvester_flames', player.location);

    dim.playSound('shriek.sculk.shrieker', player.location, {
      volume: 0.9,
      pitch: 0.8
    });

    dim.playSound('random.explode', player.location, {
      volume: 1.1,
      pitch: 0.7
    });

    const damageRange = dim.getEntities({
      location: player.location,
      maxDistance: range,
      excludeFamilies: ['ignore']
    });

    for (const target of damageRange) {
      if (isValidTarget(target) == false) continue;
      if (target === player) continue;
      var dmgDone = false
      if (target.typeId === 'minecraft:player') {
        var worked1 = specialDamage(player, target, damage * 2 / 3, EntityDamageCause.entityExplosion, ["soul", "artefact"])
        var worked2 = specialDamage(player, target, damage * 1 / 3, EntityDamageCause.entityExplosion, ["soul", "artefact"])
        if(worked1 || worked2) dmgDone = true
      } else {
        dmgDone = specialDamage(player, target, damage, EntityDamageCause.entityExplosion, ["soul", "artefact"])
      }
      if(dmgDone) {
        if(Math.random() < 1/Math.max(1, damageRange.length/1.5)) target.dimension.spawnParticle("dungeons:soul2", target.location)
        if(Math.random() < 1/Math.max(1, damageRange.length/1.5)) player.dimension.spawnParticle("dungeons:soul2", player.location)
      }

    }

  }, 6)
}

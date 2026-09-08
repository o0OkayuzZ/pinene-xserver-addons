

import {
  world,
  system
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:soul_healer', {
    onUse(e, { params }) {
      const player = e.source;
      const item = e.itemStack;
      const type = params.type

      if (item.hasTag('dungeons:tome_of_duplication')) {
        if (!player.hasTag('tod:used_soul_healer')) return;
      }



      let hp = player.getComponent("health")
      if (!hp) return;
      const maxHP = hp.defaultValue
      const currentHP = hp.currentValue;
      if (currentHP == maxHP) {
        player.playSound("mob.evocation_illager.cast_spell", { pitch: 0.6, volume: 0.5 })
        player.sendMessage([{ text: "§7§o" }, { translate: "dungeons.warn.full_health" }])
        const cd = item.getComponent("cooldown")
        player.startItemCooldown(cd.cooldownCategory, 10);
        return;

      }

      let soulScore = world.scoreboard.getObjective("soulGauge")
      let soulGauge = soulScore.getScore(player)

      if (soulGauge < 10) {
        player.playSound("mob.evocation_illager.cast_spell", { pitch: 0.6, volume: 0.5 })
        player.sendMessage([{ text: "§7§o" }, { translate: "dungeons.warn.collect_more_souls" }])
        const cd = item.getComponent("cooldown")
        player.startItemCooldown(cd.cooldownCategory, 10);
        return;
      } else {
        soulScore.addScore(player, -10)
      }
      const dim = player.dimension
      const loc = player.location
      dim.playSound("mob.evocation_illager.cast_spell", loc, { pitch: 1.1 })
      dim.spawnParticle("dungeons:soul_healer", { x: loc.x, y: loc.y + 1, z: loc.z })
      dim.spawnParticle("dungeons:soul_rings", { x: loc.x, y: loc.y + 0.2, z: loc.z })
      dim.spawnParticle("dungeons:soul2", { x: loc.x, y: loc.y + 0.0, z: loc.z })
      dim.spawnParticle("dungeons:soul2", { x: loc.x, y: loc.y + 0.5, z: loc.z })

      var healAmt = 0
      if (type == "common") healAmt = 7
      if (type == "rare") healAmt = 11
      if (healAmt + currentHP > maxHP) {
        var surplus = (healAmt + currentHP) - maxHP
        surplus = Math.ceil(surplus / 2)
        if (surplus > 4) surplus = 4
        soulScore.addScore(player, surplus)
        hp.setCurrentValue(maxHP)
      } else {
        hp.setCurrentValue(currentHP + healAmt)
      }

    }
  });
});

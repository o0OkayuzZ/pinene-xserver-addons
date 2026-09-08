import {
  world,
  system
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:soul_lantern', {
    onUse(e) {
      const player = e.source;
      const item = e.itemStack;

      if (item.hasTag('dungeons:tome_of_duplication')) {
        if (!player.hasTag('tod:used_soul_lantern')) return;
      }


      let soulScore = world.scoreboard.getObjective("soulGauge")
      let soulGauge = soulScore.getScore(player)

      if (soulGauge < 13) {
        player.playSound("mob.evocation_illager.cast_spell", { pitch: 0.6, volume: 0.5 })
        player.sendMessage([{ text: "§7§o" }, { translate: "dungeons.warn.collect_more_souls" }])
        const cd = item.getComponent("cooldown")
        player.startItemCooldown(cd.cooldownCategory, 10);
        return;
      } else {
        soulScore.addScore(player, -13)
      }
      const dim = player.dimension
      const loc = player.location
      dim.playSound("artefact.soul_lantern.use", loc)
      dim.spawnParticle("dungeons:soul_wizard", { x: loc.x + 1, y: loc.y + 0.2, z: loc.z })
      dim.spawnParticle("dungeons:soul_wizard", { x: loc.x - 1, y: loc.y + 0.2, z: loc.z })
      dim.spawnParticle("dungeons:soul_wizard", { x: loc.x, y: loc.y + 0.2, z: loc.z + 1 })
      dim.spawnParticle("dungeons:soul_wizard", { x: loc.x, y: loc.y + 0.2, z: loc.z - 1 })


      const nest = player.dimension.spawnEntity('dungeons:soul_wizard', player.location);

      let tameable = nest.getComponent('minecraft:tameable')
      tameable.tame(player);
    }
  });
});

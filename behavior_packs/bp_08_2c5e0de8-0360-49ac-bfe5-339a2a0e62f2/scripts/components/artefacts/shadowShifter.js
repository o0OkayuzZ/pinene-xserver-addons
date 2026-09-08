import {
  world,
  system
} from "@minecraft/server";

import { addShadowForm } from "misc/shadowForm.js"

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:shadow_shifter', {
    onUse(e, { params }) {
      const player = e.source;
      const item = e.itemStack;
      const type = params.type

      if (item.hasTag('dungeons:tome_of_duplication')) {
        if (!player.hasTag('tod:used_shadow_shifter')) return;
      }


      if (player.hasTag("dungeons:in_shadow_form")) {
        player.playSound("mob.evocation_illager.cast_spell", { pitch: 0.6, volume: 0.5 })
        player.sendMessage([{ text: "§7§o" }, { translate: "dungeons.warn.already_using" }])
        const cd = item.getComponent("cooldown")
        player.startItemCooldown(cd.cooldownCategory, 10);
        return;

      }

      let soulScore = world.scoreboard.getObjective("soulGauge")
      let soulGauge = soulScore.getScore(player)

      if (soulGauge < 12) {
        player.playSound("mob.evocation_illager.cast_spell", { pitch: 0.6, volume: 0.5 })
        player.sendMessage([{ text: "§7§o" }, { translate: "dungeons.warn.collect_more_souls" }])
        const cd = item.getComponent("cooldown")
        player.startItemCooldown(cd.cooldownCategory, 0);
        return;
      } else {
        soulScore.addScore(player, -12)
      }
      const dim = player.dimension
      const loc = player.location
      dim.playSound("mob.endermen.portal", loc, { pitch: 0.65 })
      dim.spawnParticle("dungeons:instant_teleport", { x: loc.x, y: loc.y + 1.8, z: loc.z })
      if (type == "common") addShadowForm(player, 220)
      if (type == "rare") addShadowForm(player, 340)

    }
  });
});
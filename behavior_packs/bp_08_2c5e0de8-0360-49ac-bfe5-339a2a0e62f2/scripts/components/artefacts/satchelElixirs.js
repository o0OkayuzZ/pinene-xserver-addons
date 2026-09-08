import {
  world,
  system,
  ItemStack
} from "@minecraft/server";

import { addShadowForm } from "misc/shadowForm.js"

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:satchel_of_elixirs', {
    onUse(e) {
      const player = e.source;
      const item = e.itemStack;

      if (item.hasTag('dungeons:tome_of_duplication')) {
        if (!player.hasTag('tod:used_satchel_of_elixirs')) return;
      }


      var potion = Math.ceil(Math.random() * 3);
      if (potion <= 1 && player.getEffect("strength")) potion = Math.ceil(Math.random() * 3);
      if (potion == 2 && player.getEffect("speed")) potion = Math.ceil(Math.random() * 3);
      if (potion >= 3 && player.hasTag("dungeons:in_shadow_form")) potion = Math.ceil(Math.random() * 3);
      const dim = player.dimension;
      const loc = player.location;
      dim.playSound('bottle.fill', loc);

      if (potion <= 1) {
        dim.spawnParticle('dungeons:elixir_strength', loc);
        player.addEffect('strength', 400);
      }
      if (potion == 2) {
        dim.spawnParticle('dungeons:elixir_speed', loc);
        player.addEffect('speed', 550);
      }
      if (potion == 3) {
        dim.spawnParticle('dungeons:elixir_shadow', loc);
        dim.spawnParticle('dungeons:instant_teleport', player.getHeadLocation());
        dim.playSound('mob.endermen.portal', loc, { pitch: 0.6 });
        addShadowForm(player, 180)
      }
    }
  });

});
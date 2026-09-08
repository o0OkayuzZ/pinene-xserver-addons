import {
  world,
  system
} from "@minecraft/server";

import { isValidTarget, makeVector } from "main.js";

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:light_feather', {
    onUse(e) {
      const player = e.source;
      const item = e.itemStack;

      if (item.hasTag('dungeons:tome_of_duplication')) {
        if (!player.hasTag('tod:used_light_feather')) return;
      }




      player.dimension.playSound('wind_charge.burst', player.location, {
        pitch: 1.5
      });
      if (world.scoreboard.getObjective('shadowTime').getScore(player) == 0) {
        player.playAnimation('animation.player.roll', {
          blendOutTime: 2,
          nextState: 'lightFeather'
        });
      }
      player.dimension.spawnParticle('minecraft:wind_explosion_emitter', player.location);

      const targets = player.dimension.getEntities({
        location: player.location,
        maxDistance: 3.5,
        excludeFamilies: ['ignore']
      });

      for (const target of targets) {
        if (target === player) continue;
        if (!isValidTarget(target)) continue;

        target.addEffect('slowness', 25, {
          amplifier: 4
        });

      }
      player.addEffect('resistance', 25, {
        amplifier: 5,
        showParticles: false
      });

      const velocity = player.getViewDirection();

      if (player.isGliding) {
        player.applyKnockback(makeVector(velocity, 2.5), 0.25);
      } else {
        player.applyKnockback(makeVector(velocity, 5), 0.5);
      }

    }
  });

});
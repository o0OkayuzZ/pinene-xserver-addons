import {
  world,
  system
} from "@minecraft/server";


system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:corrupted_beacon', {
    onUse(e, { params }) {
      const player = e.source;
      const item = e.itemStack;
      const type = params.type;
      if (item.hasTag('dungeons:tome_of_duplication')) {
        if (!player.hasTag('tod:used_corrupted_beacon')) return;
      }



      var beam = world.scoreboard.getObjective('dungeons:corrupted_beacon')
      if (!beam) {
        world.scoreboard.addObjective('dungeons:corrupted_beacon')
        beam = world.scoreboard.getObjective('dungeons:corrupted_beacon')
      }
      if (beam.getScore(player) > 0) {
        player.playSound("mob.evocation_illager.cast_spell", { pitch: 0.6, volume: 0.5 })
        player.sendMessage([{ text: "§7§o" }, { translate: "dungeons.warn.already_using" }])
        const cd = item.getComponent("cooldown")
        player.startItemCooldown(cd.cooldownCategory, 10);
        return;
      }

      let soulGauge = world.scoreboard.getObjective('soulGauge').getScore(player);

      if (soulGauge < 1) {
        player.playSound("mob.evocation_illager.cast_spell", { pitch: 0.6, volume: 0.5 })
        player.sendMessage([{ text: "§7§o" }, { translate: "dungeons.warn.collect_more_souls" }])
        const cd = item.getComponent("cooldown")
        player.startItemCooldown(cd.cooldownCategory, 10);
        return;
      }

      beam.setScore(player, 5);
      player.addTag('dungeons:using_' + type + '_beacon');
      player.dimension.playSound('beacon.activate', player.location, {
        pitch: 0.5
      });
    }
  });

});

// CORRUPTED BEACON
system.runInterval(() => {
  for (const player of world.getPlayers({ scoreOptions: [{ objective: "dungeons:corrupted_beacon", minScore: 0 }] })) {
    let beam = world.scoreboard.getObjective('dungeons:corrupted_beacon')
    let beamPlayer = beam.getScore(player);
    const item = player.getComponent("minecraft:equippable").getEquipment("Mainhand");
    if (beamPlayer > 0) {
      if (!item) {
        beam.removeParticipant(player);
        player.removeTag('dungeons:using_common_beacon');
        player.removeTag('dungeons:using_rare_beacon');
        player.dimension.playSound('beacon.deactivate', player.location, {
          pitch: 0.5
        });
        return;
      }
      if ((player.hasTag('dungeons:using_common_beacon') && (item.typeId !== 'dungeons:corrupted_beacon' && item.typeId !== 'dungeons:tome_of_duplication')) || (player.hasTag('dungeons:using_rare_beacon') && (item.typeId !== 'dungeons:rare_corrupted_beacon' && item.typeId !== 'dungeons:rare_tome_of_duplication'))) {

        beam.removeParticipant(player);
        player.removeTag('dungeons:using_common_beacon');
        player.removeTag('dungeons:using_rare_beacon');
        player.dimension.playSound('beacon.deactivate', player.location, {
          pitch: 0.5
        });
        return;
      }
      if (beamPlayer == 1) {
        let soulScore = world.scoreboard.getObjective('soulGauge')
        let soulGauge = soulScore.getScore(player);
        if (soulGauge < 1) {
          player.playSound("mob.evocation_illager.cast_spell", { pitch: 0.6, volume: 0.5 })
          player.sendMessage([{ text: "§7§o" }, { translate: "dungeons.warn.collect_more_souls" }])

          beam.removeParticipant(player);
          player.removeTag('dungeons:using_common_beacon');
          player.removeTag('dungeons:using_rare_beacon');
          player.dimension.playSound('beacon.deactivate', player.location, {
            pitch: 0.5
          });
          return;
        } else if (player.hasTag('dungeons:using_common_beacon')) {
          beam.addScore(player, 4);
          soulScore.addScore(player, -1)

        } else if (player.hasTag('dungeons:using_rare_beacon')) {
          beam.addScore(player, 6);
          soulScore.addScore(player, -1)
        }
      }
      player.addEffect('slowness', 10, {
        amplifier: 3,
        showParticles: false
      });
      const ammo = player.dimension.spawnEntity('dungeons:corrupted_beacon_ammo', player.getHeadLocation());
      const proj = ammo.getComponent('projectile');
      proj.owner = player;
      proj.shoot(player.getViewDirection());
      system.runTimeout(() => {
        ammo.remove()
      }, 25);
      beam.addScore(player, -1);
    } else {
      beam.removeParticipant(player);
      player.removeTag('dungeons:using_common_beacon');
      player.removeTag('dungeons:using_rare_beacon');
      player.dimension.playSound('beacon.deactivate', player.location, {
        pitch: 0.5
      });
    }
  }
}, 1);
import {
  world,
  system
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:eye_of_the_guardian', {
    onUse(e, { params }) {
      const player = e.source;
      const item = e.itemStack;
      const type = params.type;

      if (item.hasTag('dungeons:tome_of_duplication')) {
        if (!player.hasTag('tod:used_eye_of_the_guardian')) return;
      }



      var guardianEye = world.scoreboard.getObjective('dungeons:guardian_eye')
      if (!guardianEye) {
        world.scoreboard.addObjective('dungeons:guardian_eye')
        guardianEye = world.scoreboard.getObjective('dungeons:guardian_eye')
      }
      if (guardianEye.getScore(player) > 0) {
        player.playSound("mob.evocation_illager.cast_spell", { pitch: 0.6, volume: 0.5 })
        player.sendMessage([{ text: "§7§o" }, { translate: "dungeons.warn.already_using" }])
        const cd = item.getComponent("cooldown")
        player.startItemCooldown(cd.cooldownCategory, 10);
        return;
      }

      if (type == "common") {
        guardianEye.setScore(player, 70);
        player.addTag('dungeons:using_common_guardian');
        player.dimension.playSound('mob.guardian.death', player.location, { pitch: 1.6 });
      }
      if (type == "rare") {
        guardianEye.setScore(player, 121);
        player.addTag('dungeons:using_rare_guardian');
        player.dimension.playSound('mob.guardian.death', player.location, { pitch: 1.6 });
      }
    }
  });

});


// GUARDIAN EYE PASSIVE
system.runInterval(() => {
  for (const player of world.getPlayers({ scoreOptions: [{ objective: "dungeons:guardian_eye", minScore: 0 }] })) {
    let guardianEye = world.scoreboard.getObjective('dungeons:guardian_eye')
    let guardianEyePlayer = guardianEye.getScore(player);
    const item = player.getComponent("minecraft:equippable").getEquipment("Mainhand");
    if (guardianEyePlayer > 0) {
      if (!item) {
        guardianEye.removeParticipant(player);
        player.removeTag('dungeons:using_common_guardian');
        player.removeTag('dungeons:using_rare_guardian');
        player.dimension.playSound('mob.guardian.death', player.location, {
          pitch: 0.6
        });
        return;
      }
      if ((player.hasTag('dungeons:using_common_guardian') && (item.typeId !== 'dungeons:eye_of_the_guardian' && item.typeId !== 'dungeons:tome_of_duplication')) || (player.hasTag('dungeons:using_rare_guardian') && (item.typeId !== 'dungeons:rare_eye_of_the_guardian' && item.typeId !== 'dungeons:rare_tome_of_duplication'))) {
        guardianEye.removeParticipant(player);
        player.removeTag('dungeons:using_common_guardian');
        player.removeTag('dungeons:using_rare_guardian');
        player.dimension.playSound('mob.guardian.death', player.location, {
          pitch: 0.6
        });
        return;
      }
      player.addEffect('slowness', 10, {
        amplifier: 3,
        showParticles: false
      });
      const ammo = player.dimension.spawnEntity('dungeons:eye_guardian_ammo', player.getHeadLocation());
      const proj = ammo.getComponent('projectile');
      proj.owner = player;
      proj.shoot(player.getViewDirection());
      system.runTimeout(() => {
        ammo.remove()
      }, 25);
      guardianEye.addScore(player, -1);
    } else {
      guardianEye.removeParticipant(player);
      player.removeTag('dungeons:using_common_guardian');
      player.removeTag('dungeons:using_rare_guardian');
      player.dimension.playSound('mob.guardian.death', player.location, {
        pitch: 0.6
      });
    }
  }
}, 1);
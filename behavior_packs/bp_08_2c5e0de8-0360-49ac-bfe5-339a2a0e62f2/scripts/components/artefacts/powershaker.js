import {
  world,
  system,
  ItemStack,
  EntityDamageCause
} from "@minecraft/server";

import { isValidTarget, specialDamage } from "main.js"



system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:powershaker', {
    onUse(e, { params }) {
      const player = e.source;
      const item = e.itemStack;
      const type = params.type


      if (item.hasTag('dungeons:tome_of_duplication')) {
        if (!player.hasTag('tod:used_powershaker')) return;
      }


      var timeLeft = world.scoreboard.getObjective('dungeons:powershaker_t');
      if (!timeLeft) {
        timeLeft = world.scoreboard.addObjective('dungeons:powershaker_t');
      }
      var usesLeft = world.scoreboard.getObjective('dungeons:powershaker_u');
      if (!usesLeft) {
        usesLeft = world.scoreboard.addObjective('dungeons:powershaker_u');
      }

      if (timeLeft.getScore(player) > 0) {
        player.playSound("mob.evocation_illager.cast_spell", { pitch: 0.6, volume: 0.5 })
        player.sendMessage([{ text: "§7§o" }, { translate: "dungeons.warn.already_using" }])
        const cd = item.getComponent("cooldown")
        player.startItemCooldown(cd.cooldownCategory, 10);
        return;
      }

      player.dimension.spawnParticle('dungeons:party_flair', player.location)
      player.dimension.playSound('random.fuse', player.location, {
        volume: 0.7,
        pitch: 2.5
      });

      usesLeft.setScore(player, 5);
      if (type == "common") {
        timeLeft.setScore(player, 300);
      } else {
        timeLeft.setScore(player, 400);

      }
    }
  });
});


// TIMER
system.runInterval(() => {
  for (const player of world.getPlayers()) {
    var timeLeft = world.scoreboard.getObjective('dungeons:powershaker_t');
    var usesLeft = world.scoreboard.getObjective('dungeons:powershaker_u');
    if (!timeLeft) return;
    if (!usesLeft) return;
    if (!player.scoreboardIdentity) continue;
    if (!timeLeft.hasParticipant(player.scoreboardIdentity) || !usesLeft.hasParticipant(player.scoreboardIdentity)) continue;
    let duration = timeLeft.getScore(player);
    if (duration % 15 == 0) {
      player.dimension.spawnParticle("dungeons:powershaker_idle", player.location)
    }
    if (duration > 0) {
      timeLeft.addScore(player, -1);
      player.addEffect('strength', 1);
    }
    if (duration <= 0 || usesLeft.getScore(player) == 0) {
      timeLeft.removeParticipant(player)
      usesLeft.removeParticipant(player)
    }
  }
}, 1);

world.afterEvents.entityHurt.subscribe((event) => {
  const hurtEntity = event.hurtEntity;
  const damageSource = event.damageSource.damagingEntity;
  const cause = event.damageSource.cause
  if (!damageSource) {
    return;
  }
  if (damageSource.typeId !== "minecraft:player") {
    return;
  }
  if (hurtEntity == damageSource) {
    return;
  }
  if (cause != "entityAttack") {
    return;
  }

  if (damageSource.hasTag('powershaker_cooldown')) {
    system.runTimeout(() => {
      damageSource.removeTag('powershaker_cooldown')
    }, 1)
    return;
  }

  var timeLeft = world.scoreboard.getObjective('dungeons:powershaker_t');
  var usesLeft = world.scoreboard.getObjective('dungeons:powershaker_u');
  if (!timeLeft) return;
  if (!usesLeft) return;
  if (!timeLeft.hasParticipant(damageSource.scoreboardIdentity) || !usesLeft.hasParticipant(damageSource.scoreboardIdentity)) return;
  let uses = usesLeft.getScore(damageSource);
  if (uses == 0) {
    timeLeft.removeParticipant(damageSource)
    usesLeft.removeParticipant(damageSource)
    return;
  }

  hurtEntity.dimension.spawnParticle('dungeons:party_boom', hurtEntity.location);
  hurtEntity.dimension.spawnParticle('dungeons:powershaker_ring', hurtEntity.location);
  hurtEntity.dimension.playSound('random.explode', hurtEntity.location, {
    volume: 0.5,
    pitch: 1.5
  });

  const damageRange = hurtEntity.dimension.getEntities({
    location: hurtEntity.location,
    maxDistance: 4,
    excludeFamilies: ['ignore']
  });

  for (const target of damageRange) {
    if (isValidTarget(target) == false) continue;
    if (target === damageSource) continue;
    specialDamage(damageSource, target, 8, EntityDamageCause.entityExplosion, ["artefact"])
  }

  usesLeft.addScore(damageSource, -1);
  damageSource.addTag('powershaker_cooldown');
  system.runTimeout(() => {
    damageSource.removeTag('powershaker_cooldown')
  }, 8)
});
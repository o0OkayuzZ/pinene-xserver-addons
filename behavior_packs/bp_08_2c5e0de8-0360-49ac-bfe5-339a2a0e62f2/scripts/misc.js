import {
  world,
  system,
  EntityDamageCause
} from "@minecraft/server";
// Snareling Web
world.afterEvents.entityHurt.subscribe((event) => {
  const hurtEntity = event.hurtEntity;
  const damageSource = event.damageSource.damagingEntity;
  const damageProjectile = event.damageSource.damagingProjectile;
  if (!damageSource || !damageProjectile) {
    return;
  }
  if (damageSource.typeId === "dungeons:snareling" && damageProjectile.typeId === "dungeons:snareling_ammo") {
    hurtEntity.runCommandAsync('function snareling_web')
  }
});
// Enchanted Sheep
world.afterEvents.entityHurt.subscribe((event) => {
  const damage = event.damage;
  const hurtEntity = event.hurtEntity;
  const damageSource = event.damageSource.damagingEntity;
  if (!damageSource) {
    return;
  }
  if (damageSource.typeId === "dungeons:enchanted_sheep") {
    //0 = red
    if (damageSource.hasTag('sheep_red')) {
      hurtEntity.setOnFire(damage * 2, true)
    }
    //1 = green
    if (damageSource.hasTag('sheep_green')) {
      hurtEntity.addEffect("poison", damage * 18, {
        amplifier: 1,
        showParticles: true
      });
    }
    //2 = blue
    if (damageSource.hasTag('sheep_blue')) {
      hurtEntity.addEffect("slowness", 80, {
        amplifier: damage,
        showParticles: true
      });
    }
  }
});
// Wretched Wraith Death Anim
world.afterEvents.entityDie.subscribe((event) => {
  const deadEntity = event.deadEntity;
  if (deadEntity.typeId === "dungeons:wretched_wraith") {
    const dead = deadEntity.dimension.spawnEntity('dungeons:wretched_wraith_death', deadEntity.location);
    dead.setRotation(deadEntity.getRotation());
    deadEntity.addEffect("invisibility", 80, {
      amplifier: 1,
      showParticles: false
    });
    deadEntity.remove();
    let hp = dead.getComponent('minecraft:health');
    hp.setCurrentValue(1);
  }
});
// Shadow Form
system.runInterval(() => {
  for (const player of world.getPlayers()) {
    if (!player.scoreboardIdentity) continue;
    let shadowTime = world.scoreboard.getObjective('shadowTime')
    let shadowTimePlayer = shadowTime.getScore(player.scoreboardIdentity);
    if (shadowTimePlayer > 0) {
      player.playAnimation('animation.shadow', { nextState: 'shadowForm' });
      player.addEffect("strength", 3, {
        amplifier: 2,
        showParticles: false
      });
      player.addEffect("invisibility", 3, {
        amplifier: 0,
        showParticles: false
      });
      shadowTime.addScore(player.scoreboardIdentity, -1)
    }
  }
});
system.runInterval(() => {
  for (const player of world.getPlayers()) {
    if (!player.scoreboardIdentity) continue;
    let shadowTime = world.scoreboard.getObjective('shadowTime')
    let shadowTimePlayer = shadowTime.getScore(player.scoreboardIdentity);
    if (shadowTimePlayer > 0) {
      player.runCommandAsync('particle dungeons:shadow_idle')
    }
  }
}, 40);
world.afterEvents.entityHurt.subscribe((event) => {
  const hurtEntity = event.hurtEntity;
  const damageSource = event.damageSource.damagingEntity;
  if (!damageSource) {
    return;
  }
  if (damageSource.typeId !== "minecraft:player") {
    return;
  }
  let shadowTime = world.scoreboard.getObjective('shadowTime')
  let shadowTimePlayer = shadowTime.getScore(damageSource);
  if (shadowTimePlayer == 0) return;
  if (hurtEntity == damageSource) {
    return;
  }
  damageSource.runCommandAsync('function exit_shadow')
  shadowTime.setScore(damageSource, 0)
  damageSource.addTag('dungeons:exited_shadow_form');
  system.runTimeout(() => {
    damageSource.removeTag('dungeons:exited_shadow_form');
  }, 5);
});
// WEAPON COOL-DOWNS
system.runInterval(() => {
  for (const player of world.getPlayers()) {
    if (!player.scoreboardIdentity) continue;
    let sweepCD = world.scoreboard.getObjective('sweepCD')
    let sweepCDPlayer = world.scoreboard.getObjective('sweepCD').getScore(player.scoreboardIdentity)
    if (sweepCDPlayer > 0) {
      sweepCD.addScore(player.scoreboardIdentity, -1)
      if (sweepCDPlayer % 4 == 3 && (player.hasTag('dungeons:thief_armour') || player.hasTag('dungeons:spider_armour'))) {
        sweepCD.addScore(player.scoreboardIdentity, -1)
      }
      if (sweepCDPlayer % 2 == 1 && (player.hasTag('dungeons:fox_armour'))) {
        sweepCD.addScore(player.scoreboardIdentity, -1)
      }
    }
  }
});
system.runInterval(() => {
  for (const player of world.getPlayers()) {
    if (!player.scoreboardIdentity) continue;
    let swirlCD = world.scoreboard.getObjective('swirlCD')
    let swirlCDPlayer = world.scoreboard.getObjective('swirlCD').getScore(player.scoreboardIdentity)
    if (swirlCDPlayer > 0) {
      swirlCD.addScore(player.scoreboardIdentity, -1)
      if (swirlCDPlayer % 4 == 3 && (player.hasTag('dungeons:thief_armour') || player.hasTag('dungeons:spider_armour'))) {
        swirlCD.addScore(player.scoreboardIdentity, -1)
      }
      if (swirlCDPlayer % 2 == 1 && (player.hasTag('dungeons:fox_armour'))) {
        swirlCD.addScore(player.scoreboardIdentity, -1)
      }
    }
  }
});
system.runInterval(() => {
  for (const player of world.getPlayers()) {
    if (!player.scoreboardIdentity) continue;
    let shockwaveCD = world.scoreboard.getObjective('shockwaveCD')
    let shockwaveCDPlayer = world.scoreboard.getObjective('shockwaveCD').getScore(player.scoreboardIdentity)
    if (shockwaveCDPlayer > 0) {
      shockwaveCD.addScore(player.scoreboardIdentity, -1)
      if (shockwaveCDPlayer % 4 == 3 && (player.hasTag('dungeons:thief_armour') || player.hasTag('dungeons:spider_armour'))) {
        shockwaveCD.addScore(player.scoreboardIdentity, -1)
      }
      if (shockwaveCDPlayer % 2 == 1 && (player.hasTag('dungeons:fox_armour'))) {
        shockwaveCD.addScore(player.scoreboardIdentity, -1)
      }
    }
  }
});
system.runInterval(() => {
  for (const player of world.getPlayers()) {
    if (!player.scoreboardIdentity) continue;
    let hammerCD = world.scoreboard.getObjective('hammerCD')
    let hammerCDPlayer = world.scoreboard.getObjective('hammerCD').getScore(player.scoreboardIdentity)
    if (hammerCDPlayer > 0) {
      hammerCD.addScore(player.scoreboardIdentity, -1)
      if (hammerCDPlayer % 4 == 3 && (player.hasTag('dungeons:thief_armour') || player.hasTag('dungeons:spider_armour'))) {
        hammerCD.addScore(player.scoreboardIdentity, -1)
      }
      if (hammerCDPlayer % 2 == 1 && (player.hasTag('dungeons:fox_armour'))) {
        hammerCD.addScore(player.scoreboardIdentity, -1)
      }
      player.addEffect("weakness", 2, {
        amplifier: 2,
        showParticles: false
      });
      player.addEffect("mining_fatigue", 2, {
        amplifier: 0,
        showParticles: false
      });
    }
  }
});
system.runInterval(() => {
  for (const player of world.getPlayers()) {
    if (!player.scoreboardIdentity) continue;
    let obsidianCD = world.scoreboard.getObjective('obsidianCD')
    let obsidianCDPlayer = world.scoreboard.getObjective('obsidianCD').getScore(player.scoreboardIdentity)
    if (obsidianCDPlayer > 0) {
      obsidianCD.addScore(player.scoreboardIdentity, -1)
      if (obsidianCDPlayer % 4 == 3 && (player.hasTag('dungeons:thief_armour') || player.hasTag('dungeons:spider_armour'))) {
        obsidianCD.addScore(player.scoreboardIdentity, -1)
      }
      if (obsidianCDPlayer % 2 == 1 && (player.hasTag('dungeons:fox_armour'))) {
        obsidianCD.addScore(player.scoreboardIdentity, -1)
      }
      player.addEffect("weakness", 2, {
        amplifier: 2,
        showParticles: false
      });
      player.addEffect("mining_fatigue", 2, {
        amplifier: 0,
        showParticles: false
      });
    }
  }
});
system.runInterval(() => {
  for (const player of world.getPlayers()) {
    if (!player.scoreboardIdentity) continue;
    let anchorCD = world.scoreboard.getObjective('anchorCD')
    let anchorCDPlayer = world.scoreboard.getObjective('anchorCD').getScore(player.scoreboardIdentity)
    if (anchorCDPlayer > 0) {
      anchorCD.addScore(player.scoreboardIdentity, -1)
      if (anchorCDPlayer % 4 == 3 && (player.hasTag('dungeons:thief_armour') || player.hasTag('dungeons:spider_armour'))) {
        anchorCD.addScore(player.scoreboardIdentity, -1)
      }
      if (anchorCDPlayer % 2 == 1 && (player.hasTag('dungeons:fox_armour'))) {
        anchorCD.addScore(player.scoreboardIdentity, -1)
      }
      //HIGHER LVL WEAKNESS to compensate for higher dmg
      player.addEffect("weakness", 2, {
        amplifier: 3,
        showParticles: false
      });
      player.addEffect("mining_fatigue", 2, {
        amplifier: 0,
        showParticles: false
      });
    }
  }
});
system.runInterval(() => {
  for (const player of world.getPlayers()) {
    if (!player.scoreboardIdentity) continue;
    let sawbladeCD = world.scoreboard.getObjective('sawbladeCD')
    let sawbladeCDPlayer = world.scoreboard.getObjective('sawbladeCD').getScore(player.scoreboardIdentity)
    if (sawbladeCDPlayer > 0) {
      sawbladeCD.addScore(player.scoreboardIdentity, -1)
      if (sawbladeCDPlayer % 4 == 3 && (player.hasTag('dungeons:thief_armour') || player.hasTag('dungeons:spider_armour'))) {
        sawbladeCD.addScore(player.scoreboardIdentity, -1)
      }
      if (sawbladeCDPlayer % 2 == 1 && (player.hasTag('dungeons:fox_armour'))) {
        sawbladeCD.addScore(player.scoreboardIdentity, -1)
      }
      player.addEffect("weakness", 2, {
        amplifier: 2,
        showParticles: false
      });
      player.addEffect("mining_fatigue", 2, {
        amplifier: 0,
        showParticles: false
      });
    }
  }
});
system.runInterval(() => {
  for (const player of world.getPlayers()) {
    if (!player.scoreboardIdentity) continue;
    let glaiveCD = world.scoreboard.getObjective('glaiveCD')
    let glaiveCDPlayer = world.scoreboard.getObjective('glaiveCD').getScore(player.scoreboardIdentity)
    if (glaiveCDPlayer > 0) {
      glaiveCD.addScore(player.scoreboardIdentity, -1)
      if (glaiveCDPlayer % 4 == 3 && (player.hasTag('dungeons:thief_armour') || player.hasTag('dungeons:spider_armour'))) {
        glaiveCD.addScore(player.scoreboardIdentity, -1)
      }
      if (glaiveCDPlayer % 2 == 1 && (player.hasTag('dungeons:fox_armour'))) {
        glaiveCD.addScore(player.scoreboardIdentity, -1)
      }
      player.addEffect("weakness", 2, {
        amplifier: 2,
        showParticles: false
      });
      player.addEffect("mining_fatigue", 2, {
        amplifier: 0,
        showParticles: false
      });
    }
  }
});
system.runInterval(() => {
  for (const player of world.getPlayers()) {
    if (!player.scoreboardIdentity) continue;
    let echoCD = world.scoreboard.getObjective('echoCD')
    let echoCDPlayer = world.scoreboard.getObjective('echoCD').getScore(player.scoreboardIdentity)
    if (echoCDPlayer > 0) {
      echoCD.addScore(player.scoreboardIdentity, -1)
      if (echoCDPlayer % 4 == 3 && (player.hasTag('dungeons:thief_armour') || player.hasTag('dungeons:spider_armour'))) {
        echoCD.addScore(player.scoreboardIdentity, -1)
      }
      if (echoCDPlayer % 2 == 1 && (player.hasTag('dungeons:fox_armour'))) {
        echoCD.addScore(player.scoreboardIdentity, -1)
      }
    }
  }
});
system.runInterval(() => {
  for (const player of world.getPlayers()) {
    if (!player.scoreboardIdentity) continue;
    let tpCD = world.scoreboard.getObjective('tpCD')
    let tpCDPlayer = world.scoreboard.getObjective('tpCD').getScore(player.scoreboardIdentity)
    if (tpCDPlayer > 0) {
      tpCD.addScore(player.scoreboardIdentity, -1)
    }
  }
});
system.runInterval(() => {
  for (const player of world.getPlayers()) {
    if (!player.scoreboardIdentity) continue;
    let cooldownIcon = world.scoreboard.getObjective('cooldownTime')
    let cooldownIconPlayer = cooldownIcon.getScore(player.scoreboardIdentity);
    let max = world.scoreboard.getObjective('cooldownMax')
    let cooldownMax = world.scoreboard.getObjective('cooldownMax').getScore(player.scoreboardIdentity)
    if (cooldownMax > 0 && cooldownIconPlayer > 0) {
      const filled = Math.max(0, Math.min(14, Math.ceil(cooldownIconPlayer * 14 / cooldownMax)));
      player.onScreenDisplay.setActionBar('§b' + '▮'.repeat(filled) + '§7' + '▯'.repeat(14 - filled));
    }
    if (cooldownIconPlayer >= 0) {
      cooldownIcon.addScore(player.scoreboardIdentity, -1)
      if (cooldownIconPlayer % 4 == 3 && (player.hasTag('dungeons:thief_armour') || player.hasTag('dungeons:spider_armour'))) {
        cooldownIcon.addScore(player.scoreboardIdentity, -1)
      }
      if (cooldownIconPlayer % 2 == 1 && (player.hasTag('dungeons:fox_armour'))) {
        cooldownIcon.addScore(player.scoreboardIdentity, -1)
      }
      if (world.scoreboard.getObjective('cooldownTime').getScore(player.scoreboardIdentity) == 0) {
        system.runTimeout(() => {
          player.onScreenDisplay.setActionBar('蘒ｿ')
        }, 3)
      }
    }
  }
});
world.afterEvents.projectileHitBlock.subscribe(event => {
  const blockHit = event.getBlockHit().block;
  const source = event.source;
  if (blockHit.typeId === 'dungeons:redstone_core_block') {
    const entities = blockHit.dimension.getEntitiesAtBlockLocation(blockHit.location);
    for (const entity of entities) {
      if (entity.typeId === 'dungeons:redstone_core' && entity.hasTag('core:ready')) {
        entity.triggerEvent('dungeons:activate_core');
        system.runTimeout(() => {
          const nearbyMobs = blockHit.dimension.getEntities({
            location: blockHit.center(),
            maxDistance: 5,
            excludeFamilies: ['ignore']
          });
          for (const mob of nearbyMobs) {
            const xDif = mob.location.x - blockHit.center().x;
            const zDif = mob.location.z - blockHit.center().z;
            mob.applyKnockback(xDif, zDif, 1.2, 0.6);
            if (!source) {
              if (mob.typeId !== "dungeons:redstone_monstrosity" && mob.typeId !== "dungeons:spooky_monstrosity") {
                mob.applyDamage(30, {
                  cause: EntityDamageCause.entityExplosion,
                  damagingEntity: entity
                });
              } else {
                mob.applyDamage(60, {
                  cause: EntityDamageCause.magic,
                  damagingEntity: entity
                });
              }
            } else {
              if (mob.typeId !== "dungeons:redstone_monstrosity" && mob.typeId !== "dungeons:spooky_monstrosity") {
                mob.applyDamage(30, {
                  cause: EntityDamageCause.entityExplosion,
                  damagingEntity: source
                });
              } else {
                mob.applyDamage(60, {
                  cause: EntityDamageCause.magic,
                  damagingEntity: source
                });
              }
            }
          }
        }, 60) // waits 3 seconds for charge to finish
        return;
      }
      return;
    }
  }
});
//THORNS MOB
world.afterEvents.entityHurt.subscribe((event) => {
  const hurtEntity = event.hurtEntity;
  const damageSource = event.damageSource.damagingEntity;
  const cause = event.damageSource.cause
  const damage = event.damage
  if (!damageSource) {
    return;
  }
  if (!damageSource.isValid()) return;
  if (!hurtEntity.hasTag('dungeons:thorns_enchant')) {
    return;
  }
  if (hurtEntity == damageSource) {
    return;
  }
  if (cause == "thorns") return;
  if (damageSource.typeId === 'minecraft:player') {
    damageSource.playSound('damage.thorns', {
      pitch: 0.5,
      volume: 0.5
    });
  }
  if (damage * 1.25 > 5) {
    damageSource.applyDamage(5, {
      cause: EntityDamageCause.thorns,
      damagingEntity: hurtEntity
    });
  } else {
    damageSource.applyDamage(damage * 1.25, {
      cause: EntityDamageCause.thorns,
      damagingEntity: hurtEntity
    });
  }
});
//ABOMINATION AOE
world.afterEvents.entityHitEntity.subscribe((event) => {
  const hurtEntity = event.hitEntity;
  const damageSource = event.damagingEntity;
  if (damageSource.typeId === "dungeons:jungle_abomination") {
    const nearbyMobs = hurtEntity.dimension.getEntities({
      location: hurtEntity.location,
      maxDistance: 3,
      excludeFamilies: ['monster', 'ignore']
    });
    for (const mob of nearbyMobs) {
      const xDif = mob.location.x - damageSource.location.x;
      const zDif = mob.location.z - damageSource.location.z;
      if (mob !== hurtEntity) {
        mob.applyDamage(10, {
          cause: EntityDamageCause.entityAttack,
          damagingEntity: damageSource
        });
      }
      if (mob.typeId === 'minecraft:player') {
        mob.runCommandAsync('camerashake add @s 0.2 1 positional');
      }
      mob.applyKnockback(xDif, zDif, 2, 0.4);
    }
  }
});

//TEMPEST AOE
world.afterEvents.entityHitEntity.subscribe((event) => {
  const hurtEntity = event.hitEntity;
  const damageSource = event.damagingEntity;
  if (damageSource.typeId === "dungeons:tempest_golem") {
    const nearbyMobs = hurtEntity.dimension.getEntities({
      location: hurtEntity.location,
      maxDistance: 1.5,
      excludeFamilies: ['monster', 'ignore']
    });
    for (const mob of nearbyMobs) {
      const xDif = mob.location.x - damageSource.location.x;
      const zDif = mob.location.z - damageSource.location.z;
      if (mob !== hurtEntity) {
        mob.applyDamage(6, {
          cause: EntityDamageCause.entityAttack,
          damagingEntity: damageSource
        });
      }
      if (mob.typeId === 'minecraft:player') {
        mob.runCommandAsync('camerashake add @s 0.2 1 positional');
      }
      mob.applyKnockback(xDif, zDif, 1.5, 0.6);
    }
  }
});

// TEMPEST SPAWN EGG

world.beforeEvents.itemUseOn.subscribe((event) => {
  const item = event.itemStack;
  const player = event.source;

  if (!item || !player) return;
  if (player.hasTag('dungeons:tempest_warn')) return;

  if (item.typeId === 'dungeons:tempest_golem_resting_spawn_egg') {
    player.sendMessage("ﾂｧ7The Tempest Golem cannot be harmed unless you place the \'wind_totem_left\' and \'wind_totem_right\' entities nearby")

    system.run(() => {
      player.addTag('dungeons:tempest_warn');
    });
  }
})

// ANCIENT GUARDIAN SPAWN EGG

world.beforeEvents.itemUseOn.subscribe((event) => {
  const item = event.itemStack;
  const player = event.source;

  if (!item || !player) return;
  if (player.hasTag('dungeons:guardian_warn')) return;

  if (item.typeId === 'dungeons:ancient_guardian_resting_spawn_egg') {
    player.sendMessage("ﾂｧ7This boss is best suited for underwater locations, if spawned on land it may not work properly!")

    system.run(() => {
      player.addTag('dungeons:guardian_warn');
    });
  }
})

// SPOOKY SPAWN EGG

world.beforeEvents.itemUseOn.subscribe((event) => {
  const item = event.itemStack;
  const player = event.source;

  if (!item || !player) return;
  if (player.hasTag('dungeons:spooky_warn')) return;

  if (item.typeId === 'dungeons:spooky_monstrosity_resting_spawn_egg' || item.typeId === 'dungeons:rolling_flame_spawn_egg') {
    player.sendMessage("ﾂｧ7This mob egg is for a usually-unobtainable mob, it will only be found in survival mode around a specific season, but can be accessed in creative at any time!")

    system.run(() => {
      player.addTag('dungeons:spooky_warn');
    });
  }
})

// VHOE SPAWN EGG

world.beforeEvents.itemUseOn.subscribe((event) => {
  const item = event.itemStack;
  const player = event.source;

  if (!item || !player) return;
  if (player.hasTag('dungeons:vhoe_warn')) return;

  if (item.typeId === 'dungeons:vengeful_heart_of_ender_resting_spawn_egg') {
    player.sendMessage("ﾂｧ7When placed with a spawn egg, this boss will not be able to use its strongest attack! I recommend you head to The End and find the Broken Citadel for a proper fight, good luck!")

    system.run(() => {
      player.addTag('dungeons:vhoe_warn');
    });
  }
})


import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { getDirection, makeVector, isValidTarget } from "main.js"

import { stunnedEffect } from "misc/stunnedEffect.js"

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
  if (e.eventId !== "dungeons:hit") return;
  const entity = e.entity;
  if (entity.typeId !== "dungeons:ice_chunk") return;
  const dim = entity.dimension;
  const loc = entity.location;
  var nearestIceologer = dim.getEntities({maxDistance:32,families:["iceologer"], location:loc, closest: 1})
    if(nearestIceologer.length > 0) nearestIceologer = nearestIceologer[0]
  dim.playSound("mob.iceologer.chunk_fall", loc)

  const damageRange = dim.getEntities({
    location: loc,
    maxDistance: 3,
    excludeFamilies: ['ignore']
  });

  for (const target of damageRange) {
    if (isValidTarget(target) == false && !target.matches({families: ["player"]})) continue;
    if (target.matches({families: ["illager"]})) continue;
    var damageDone = undefined
    if(nearestIceologer.isValid) {
        damageDone = target.applyDamage(11, {cause: EntityDamageCause.entityExplosion, damagingEntity: nearestIceologer})
    } else {
        damageDone = target.applyDamage(11, {cause: EntityDamageCause.entityExplosion})
    }
    if (damageDone) {
      target.applyKnockback({ x: 0, z: 0 }, 0.4)
      const dir = getDirection(loc, target.location);
      target.applyKnockback(makeVector(dir, 2), 0.6)
      system.runTimeout(() => {
        const runInt = system.runInterval(() => {
          if(target.hasTag("dungeons:stunned_effect"))system.clearRun(runInt)
            if(!target.isValid) system.clearRun(runInt)
          if(target.isOnGround || target.isInWater) {
            if(world.getDifficulty() !== "Easy") stunnedEffect(target, 40)
            system.clearRun(runInt)
          } 
        })
        system.runTimeout(() => {
            system.clearRun(runInt)
        },20)
      },2)

    }

  }
  entity.remove()
})

world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    if(entity && entity.isValid && entity.typeId == "dungeons:ice_chunk") {
        const randX = Math.random()*1 - 0.5
        const randZ = Math.random()*1 - 0.5
        entity.tryTeleport({
            x:entity.location.x + randX,
            y:entity.location.y,
            z:entity.location.z + randZ
        })
    }
})

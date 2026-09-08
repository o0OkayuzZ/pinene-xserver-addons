import {
  system,
  world,
  EntityDamageCause
} from "@minecraft/server";

import { isValidTarget, specialDamage } from "main.js"


system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:ice_wand', {
    onUse(e) {
      const player = e.source;
      const item = e.itemStack;

      if (item.hasTag('dungeons:tome_of_duplication')) {
        if (!player.hasTag('tod:used_ice_wand')) return;
      }



      var rayCast = player.getEntitiesFromViewDirection(({
        ignoreBlockCollision: true,
        includePassableBlocks: false,
        includeLiquidBlocks: true,
        maxDistance: 32
      }))
      if (rayCast == undefined || rayCast.length == 0) {
        rayCast = player.getBlockFromViewDirection({
          maxDistance: 32,
          includePassableBlocks: false,
          includeLiquidBlocks: true
        });
        if (!rayCast) {
          const cd = item.getComponent("cooldown")
          player.startItemCooldown(cd.cooldownCategory, 10);
          return;
        } else {
          rayCast = rayCast.block.location;
        }
      } else {
        rayCast = rayCast[0].entity.location
      }
      player.dimension.playSound("artefact.ice_wand", player.location)
      player.dimension.spawnParticle("dungeons:ice_wand", player.location)
      const chunk = player.dimension.spawnEntity('dungeons:ice_chunk_player', rayCast);
      let tameable = chunk.getComponent('minecraft:tameable')
      tameable.tame(player);
    }
  });
});


import { getDirection, makeVector } from "main.js"

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
  if (e.eventId !== "dungeons:hit") return;
  const entity = e.entity;
  if (entity.typeId !== "dungeons:ice_chunk_player") return;
  let tameable = entity.getComponent('minecraft:tameable')
  if (!tameable) {
    entity.remove()
    return;
  }
  let owner = tameable.tamedToPlayer;
  const dim = entity.dimension;
  const loc = entity.location;
  dim.playSound("random.glass", loc)

  const damageRange = dim.getEntities({
    location: loc,
    maxDistance: 3,
    excludeFamilies: ['ignore']
  });

  for (const target of damageRange) {
    if (isValidTarget(target) == false) continue;
    if (target === owner) continue;

    const damagedone = specialDamage(owner, target, 10, EntityDamageCause.freezing, ["ice", "artefact"])
    if (damagedone) {
      target.applyKnockback({ x: 0, z: 0 }, 0.4)
      target.addEffect("slowness", 20, { amplifier: 8 })
      const dir = getDirection(loc, target.location);
      target.applyKnockback(makeVector(dir, 2), 0.6)

    }

  }
  entity.remove()
})

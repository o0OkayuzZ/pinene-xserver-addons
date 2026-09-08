import {
  world,
  system,
  EntityDamageCause
} from "@minecraft/server";

import { isValidTarget, specialDamage } from "main.js";

function clamp(val, min, max) {
  if (val < min) return min
  if (val > max) return max
  return val
}

function shoot(player) {
  var direction = player.getViewDirection();
  player.dimension.playSound("random.bow", player.location, { pitch: 0.25 })
  const ammo = player.dimension.spawnEntity('dungeons:blast_fungus', player.getHeadLocation());
  const proj = ammo.getComponent('projectile');
  proj.owner = player;
  const xOffset = clamp(direction.x + ((Math.random() / 3) - 0.16), -1, 1)
  const yOffset = clamp(direction.y + ((Math.random() / 4)), -0.7, 1)
  const zOffset = clamp(direction.z + ((Math.random() / 2) - 0.16), -1, 1)
  direction = { x: xOffset, y: yOffset, z: zOffset }
  proj.shoot(direction)
}

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent("dungeons:blast_fungus", {
    onUse(e) {
      const player = e.source;
      const item = e.itemStack;

      if (item.hasTag('dungeons:tome_of_duplication')) {
        if (!player.hasTag('tod:used_blast_fungus')) return;
      }

      player.dimension.playSound("artefact.blastfungus.explode", player.location, { volume: 2, pitch: 0.3 })
      shoot(player)
      system.runTimeout(() => {
        shoot(player)
        system.runTimeout(() => {
          shoot(player)
          system.runTimeout(() => {
            shoot(player)
            system.runTimeout(() => {
              shoot(player)
            }, 3)
          }, 3)
        }, 3)
      }, 3)
    }
  });

});



function explosion(loc, dim, owner, entity) {
  dim.spawnParticle("dungeons:blast_fungus", loc)
  dim.spawnParticle("dungeons:blast_fungus_spore", loc)
  dim.playSound("artefact.blastfungus.explode", loc, { volume: 2, pitch: 1 })
  const targets = dim.getEntities({ location: loc, maxDistance: 4 })
  for (const target of targets) {
    if (isValidTarget(target) && target !== owner) {
      const damage = specialDamage(owner, target, 11, EntityDamageCause.entityExplosion, ["artefact"])
      if (damage == true) {
        target.addEffect("nausea", 100)
      }
    }
  }
  system.run(() => {
    entity.remove()
  })
}

world.afterEvents.projectileHitBlock.subscribe((e) => {
  const entity = e.projectile;
  const loc = e.location;
  const dim = e.dimension;
  if (entity.typeId == "dungeons:blast_fungus") {
    const proj = entity.getComponent("minecraft:projectile")
    const owner = proj.owner;
    if (!owner) return;
    explosion(loc, dim, owner, entity)
  }
})
world.afterEvents.projectileHitEntity.subscribe((e) => {
  const entity = e.projectile;
  const hit = e.getEntityHit().entity
  if (!hit) return;
  if (!hit.isValid) return;
  const dim = hit.dimension
  const loc = e.location;
  if (entity.typeId == "dungeons:blast_fungus") {
    const proj = entity.getComponent("minecraft:projectile")
    const owner = proj.owner;
    if (!owner) return;
    explosion(loc, dim, owner, entity)
  }
})
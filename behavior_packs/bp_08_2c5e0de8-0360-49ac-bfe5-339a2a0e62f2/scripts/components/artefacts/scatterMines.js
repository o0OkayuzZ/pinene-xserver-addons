import {
  world,
  system,
  EntityDamageCause
} from "@minecraft/server";

import { isValidTarget, specialDamage } from "main.js"


system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:scatter_mines', {
    onUse(e) {
      const player = e.source;
      const item = e.itemStack;

      if (item.hasTag('dungeons:tome_of_duplication')) {
        if (!player.hasTag('tod:used_scatter_mines')) return;
      }


      const loc1 = player.dimension.getTopmostBlock({ x: player.location.x + 2, z: player.location.z }, player.location.y).bottomCenter();
      const loc2 = player.dimension.getTopmostBlock({ x: player.location.x - 2, z: player.location.z - 2 }, player.location.y).bottomCenter();
      const loc3 = player.dimension.getTopmostBlock({ x: player.location.x - 2, z: player.location.z + 2 }, player.location.y).bottomCenter();

      var locations = [loc1, loc2, loc3]
      var skipCooldown = true
      for (const loc of locations) {
        if (loc.y - player.location.y <= 5 && loc.y - player.location.y >= -5) {
          const mine = player.dimension.spawnEntity('dungeons:player_scatter_mine', { x: loc.x, y: loc.y + 1, z: loc.z });
          let tame = mine.getComponent('minecraft:tameable')
          tame.tame(player);
          skipCooldown = false
        }
      }
      if (skipCooldown == true) {

        const cd = item.getComponent("cooldown")
        player.startItemCooldown(cd.cooldownCategory, 10);
      } else {
        player.dimension.playSound('weapon.enchant.exploding', player.location, {
          pitch: 1.5
        });
      }

    }
  });

});

import { getDirection, makeVector } from "main.js"

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
  if (e.eventId !== "dungeons:explode") return;
  const entity = e.entity;
  if (entity.typeId !== "dungeons:player_scatter_mine") return;
  let tameable = entity.getComponent('minecraft:tameable')
  if (!tameable) {
    entity.remove()
    return;
  }
  let owner = tameable.tamedToPlayer;
  const dim = entity.dimension;
  const loc = entity.location;

  const damageRange = dim.getEntities({
    location: loc,
    maxDistance: 3,
    excludeFamilies: ['ignore']
  });

  for (const target of damageRange) {
    if (isValidTarget(target) == false) continue;
    if (target === owner) continue;

    const damagedone = specialDamage(owner, target, 20, EntityDamageCause.entityExplosion, ["artefact"])
    if (damagedone) {
      const dir = getDirection(loc, target.location);
      target.applyKnockback(makeVector(dir, 2), 1)

    }

  }
  entity.remove()
})

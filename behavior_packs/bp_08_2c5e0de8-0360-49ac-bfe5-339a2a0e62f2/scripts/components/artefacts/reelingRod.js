import {
  world,
  system,
  EntityDamageCause,
  ItemStack
} from "@minecraft/server";


import { isValidTarget, specialDamage } from "main.js"

import { stunnedEffect } from "misc/stunnedEffect.js"


system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:reeling_rod', {
    onUse(e) {
      const player = e.source;
      const item = e.itemStack;
      useArtefact(player, item, false)
    }
  });

});

system.afterEvents.scriptEventReceive.subscribe((e) => {
  const id = e.id;
  if (id !== "dungeons:force_artefact") return;
  const player = e.sourceEntity;
  if (!player) return;
  const itemId = e.message;
  if (!itemId) return;
  const item = new ItemStack(itemId, 1)
  if (!item.getComponent("dungeons:reeling_rod")) return;
  useArtefact(player, item, true)
})

function useArtefact(player, item, finalShout) {
  const dim = player.dimension
  const loc = player.location
  if (item.hasTag('dungeons:tome_of_duplication')) {
    if (!player.hasTag('tod:used_reeling_rod')) return;
  }

  const raycast = player.getEntitiesFromViewDirection({ignoreBlockCollision: false, includeLiquidBlocks:false, includePassableBlocks:false,maxDistance:16})
  var target = undefined
  if(raycast.length >= 1) {
    for(const targetOp of raycast) {
        if(target || !targetOp.entity.isValid) continue;
        if(targetOp.entity.typeId == "minecraft:player" && world.gameRules.pvp == false) continue;
        if(targetOp.entity.matches({families:["gravity_immune"]})) continue;
        if(targetOp.entity.matches({families:["poison_quill_vine"]})) continue;
        if(targetOp.entity.matches({families:["boss"]})) continue;
        if(targetOp.entity.matches({families:["stun_immune"]})) continue;
        target = targetOp.entity
    }
  }

  if (!target) {
    if (!finalShout) player.sendMessage([{ text: "§7§o" }, { translate: "dungeons.warn.no_reel_target" }])
    dim.playSound("artefact.reeling_rod.cast", player.location, {pitch:0.5, volume: 0.5})
    let cd = item.getComponent('cooldown');
    player.startItemCooldown(cd.cooldownCategory, 10);
    return;
  } else {
    dim.playSound("artefact.reeling_rod.cast", player.location)
    const targetLoc = target.location;
    const hitLoc = loc;
    const xDif = targetLoc.x - hitLoc.x
    const yDif = targetLoc.y - hitLoc.y
    const zDif = targetLoc.z - hitLoc.z
    const distanceBetween = Math.hypot(hitLoc.x - targetLoc.x, hitLoc.y - targetLoc.y, hitLoc.z - targetLoc.z)
    var cancel = false;
    for (let i = 1; i < distanceBetween; i++) {
        system.runTimeout(() => {
            if(cancel) return cancel = true;
            if(!target.isValid) return cancel = true;
            if(!player.isValid) return cancel = true;
            const distanceBetween2 = Math.hypot(hitLoc.x - targetLoc.x, hitLoc.y - targetLoc.y, hitLoc.z - targetLoc.z)
            if(distanceBetween2 > (distanceBetween * 1.5 + 2)) return cancel = true;
            const anchorPoint = { x: targetLoc.x - (xDif * (i / distanceBetween)), y: 1 + targetLoc.y - (yDif * (i / distanceBetween)), z: targetLoc.z - (zDif * (i / distanceBetween)) }
            var keepVelocity = target.typeId !== "minecraft:player"
            var teleport = target.tryTeleport({x:anchorPoint.x, y:anchorPoint.y - 0.4, z:anchorPoint.z}, {checkForBlocks: true, keepVelocity:keepVelocity, facingLocation: player.getHeadLocation()})
            if(!teleport) teleport = target.tryTeleport({x:anchorPoint.x, y:anchorPoint.y +1, z:anchorPoint.z}, {checkForBlocks: true, keepVelocity:keepVelocity, facingLocation: player.getHeadLocation()})
            if(!teleport) return cancel = true;
            dim.spawnParticle("dungeons:ricochet_shot", anchorPoint)
        }, i / 2)
    }
    system.runTimeout(() => {
        if(!cancel) {
            dim.playSound("artefact.reeling_rod.stun", target.location)
            stunnedEffect(target, 40)
            if(target.matches({families: ["guardian"]})) player.runCommand("scriptevent dungeons:reeled_guardian")
        }
    },Math.max(1,distanceBetween/2 - 1))
  }
}
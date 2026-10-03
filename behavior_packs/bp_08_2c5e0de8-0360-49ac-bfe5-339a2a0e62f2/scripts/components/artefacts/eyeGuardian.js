import {
  world,
  system,
  ItemStack
} from "@minecraft/server";

import { isValidTarget, specialDamage } from "main.js"

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:eye_of_the_guardian', {
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
  if (!item.getComponent("dungeons:eye_of_the_guardian")) return;
  useArtefact(player, item, true)
})

function useArtefact(player, item, finalShout) {
  const params = item.getComponent("dungeons:eye_of_the_guardian").customComponentParameters.params
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
    if (!finalShout) player.sendMessage([{ text: "§7§o" }, { translate: "dungeons.warn.already_using" }])
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
        player.runCommand("/inputpermission set @s jump enabled")
        player.dimension.playSound('mob.guardian.death', player.location, {
          pitch: 0.6
        });
        return;
      }
      if (player.hasTag("dungeons:stunned_effect") || (player.hasTag('dungeons:using_common_guardian') && (item.typeId !== 'dungeons:eye_of_the_guardian' && item.typeId !== 'dungeons:tome_of_duplication')) || (player.hasTag('dungeons:using_rare_guardian') && (item.typeId !== 'dungeons:rare_eye_of_the_guardian' && item.typeId !== 'dungeons:rare_tome_of_duplication'))) {
        guardianEye.removeParticipant(player);
        player.removeTag('dungeons:using_common_guardian');
        player.removeTag('dungeons:using_rare_guardian');
        player.runCommand("/inputpermission set @s jump enabled")
        player.dimension.playSound('mob.guardian.death', player.location, {
          pitch: 0.6
        });
        return;
      }
      player.addEffect('slowness', 10, {
        amplifier: 2,
        showParticles: false
      });
      player.runCommand("/inputpermission set @s jump disabled")
      guardianEye.addScore(player, -1);
      var raycast = player.getBlockFromViewDirection({ includeLiquidBlocks: true, includePassableBlocks: false, maxDistance: 32 })
      if (!raycast) raycast = {
        block: player.dimension.getBlock({ x: player.getViewDirection().x * 32, y: player.getViewDirection().y * 32, z: player.getViewDirection().z * 32 })
      }
      if (raycast) {
        const block = raycast.block;
        const loc = player.location;
        const dim = player.dimension;
        const blockAt = dim.getBlock(loc)
        var typeId = "dungeons:eye_of_the_guardian_light"
        if (blockAt && (blockAt.typeId == "minecraft:water" || blockAt.isAir || blockAt.typeId == typeId)) blockAt.setType(typeId)
        var distanceBetween = 32
        if (block) {
          distanceBetween = Math.round(Math.hypot(loc.x - block.x, loc.y - block.y, loc.z - block.z))
        }
        const vd = player.getViewDirection()
        var headLoc = player.getHeadLocation()
        headLoc = {
          x: headLoc.x,
          y: headLoc.y - 0.4,
          z: headLoc.z
        }
        var breakAt = undefined
        for (let i = 2; i < distanceBetween * 2; i++) {
          const targetLoc = {
            x: headLoc.x + (vd.x * i / 2),
            y: headLoc.y + (vd.y * i / 2),
            z: headLoc.z + (vd.z * i / 2)
          }
          const hasTotem = dim.getEntities({ type: "dungeons:totem_of_shielding", maxDistance: 4, location: targetLoc })
          if (hasTotem.length > 0) {
            breakAt = i / 2
            break;
          }
          if (dim.isChunkLoaded(targetLoc)) {
            dim.spawnParticle("dungeons:eye_guardian_new", targetLoc)
          }
        }
        const raycastEntities = player.getEntitiesFromViewDirection({ maxDistance: distanceBetween, excludeFamilies: ["ignore"] })
        for (const targetMob of raycastEntities) {
          if (breakAt && targetMob.distance > breakAt) continue;
          const target = targetMob.entity;
          if (isValidTarget(target) == false) continue;
          if (target === player) continue;
          specialDamage(player, target, 6, "magic", ["artefact"])
        }
      }
    } else {
      guardianEye.removeParticipant(player);
      player.removeTag('dungeons:using_common_guardian');
      player.removeTag('dungeons:using_rare_guardian');
      player.runCommand("/inputpermission set @s jump enabled")
      player.dimension.playSound('mob.guardian.death', player.location, {
        pitch: 0.6
      });
    }
  }
}, 1);
import {
  world,
  system,
  ItemStack
} from "@minecraft/server";

import { isValidTarget, specialDamage } from "main.js"

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:corrupted_pumpkin', {
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
  if (!item.getComponent("dungeons:corrupted_pumpkin")) return;
  useArtefact(player, item, true)
})

function useArtefact(player, item, finalShout) {

  if (item.hasTag('dungeons:tome_of_duplication')) {
    if (!player.hasTag('tod:used_corrupted_pumpkin')) return;
  }


  var beam = world.scoreboard.getObjective('dungeons:corrupted_pumpkin')
  if (!beam) {
    world.scoreboard.addObjective('dungeons:corrupted_pumpkin')
    beam = world.scoreboard.getObjective('dungeons:corrupted_pumpkin')
  }


  if (beam.getScore(player) > 0) {
    player.playSound("mob.evocation_illager.cast_spell", { pitch: 0.6, volume: 0.5 })
    if (!finalShout) player.sendMessage([{ text: "§7§o" }, { translate: "dungeons.warn.already_using" }])
    const cd = item.getComponent("cooldown")
    player.startItemCooldown(cd.cooldownCategory, 10);
    return;
  }

  let soulGauge = world.scoreboard.getObjective('soulGauge').getScore(player);

  if (soulGauge < 1 && !finalShout) {
    player.playSound("mob.evocation_illager.cast_spell", { pitch: 0.6, volume: 0.5 })
    player.sendMessage([{ text: "§7§o" }, { translate: "dungeons.warn.collect_more_souls" }])
    const cd = item.getComponent("cooldown")
    player.startItemCooldown(cd.cooldownCategory, 10);
    return;
  }

  beam.setScore(player, 5);
  player.addTag('dungeons:using_corrupted_pumpkin');
  player.dimension.playSound('artefact.corrupted_pumpkin', player.location, {
    pitch: 1
  });
}


// CORRUPTED PUMPKIN PASSIVE
system.runInterval(() => {
  for (const player of world.getPlayers({ scoreOptions: [{ objective: "dungeons:corrupted_pumpkin", minScore: 0 }] })) {
    let beam = world.scoreboard.getObjective('dungeons:corrupted_pumpkin')
    let beamPlayer = beam.getScore(player);
    const item = player.getComponent("minecraft:equippable").getEquipment("Mainhand");
    if (beamPlayer > 0) {
      if (!item) {
        beam.removeParticipant(player);
        player.removeTag('dungeons:using_corrupted_pumpkin');
        player.runCommand("/inputpermission set @s jump enabled")
        player.dimension.playSound('beacon.deactivate', player.location, {
          pitch: 0.5
        });
        return;
      }
      if (player.hasTag("dungeons:stunned_effect") || (player.hasTag('dungeons:using_corrupted_pumpkin') && (item.typeId !== 'dungeons:corrupted_pumpkin' && item.typeId !== 'dungeons:rare_tome_of_duplication' && item.typeId !== 'dungeons:tome_of_duplication'))) {

        beam.removeParticipant(player);
        player.removeTag('dungeons:using_corrupted_pumpkin');
        player.runCommand("/inputpermission set @s jump enabled")
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
          player.removeTag('dungeons:using_corrupted_pumpkin');
          player.runCommand("/inputpermission set @s jump enabled")
          player.dimension.playSound('beacon.deactivate', player.location, {
            pitch: 0.5
          });
          return;
        } else if (player.hasTag('dungeons:using_corrupted_pumpkin')) {
          beam.addScore(player, 6);
          soulScore.addScore(player, -1)
        }

      }
      player.addEffect('slowness', 10, {
        amplifier: 2,
        showParticles: false
      });
      player.runCommand("/inputpermission set @s jump disabled")

      beam.addScore(player, -1);
      var raycast = player.getBlockFromViewDirection({ includeLiquidBlocks: true, includePassableBlocks: false, maxDistance: 32 })
      if (!raycast) raycast = {
        block: player.dimension.getBlock({ x: player.getViewDirection().x * 32, y: player.getViewDirection().y * 32, z: player.getViewDirection().z * 32 })
      }
      if (raycast) {
        const block = raycast.block;
        const loc = player.location;
        const dim = player.dimension;
        const blockAt = dim.getBlock(loc)
        var typeId = "dungeons:corrupted_pumpkin_light"
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
            dim.spawnParticle("dungeons:corrupted_pumpkin_new", targetLoc)
          }
        }
        const raycastEntities = player.getEntitiesFromViewDirection({ maxDistance: distanceBetween, excludeFamilies: ["ignore"] })
        for (const targetMob of raycastEntities) {
          if (breakAt && targetMob.distance > breakAt) continue;
          const target = targetMob.entity;
          if (isValidTarget(target) == false) continue;
          if (target === player) continue;
          specialDamage(player, target, 10, "magic", ["soul", "artefact"])
        }
      }
    } else {
      beam.removeParticipant(player);
      player.removeTag('dungeons:using_corrupted_pumpkin');
      player.runCommand("/inputpermission set @s jump enabled")
      player.dimension.playSound('beacon.deactivate', player.location, {
        pitch: 0.5
      });
    }
  }
}, 1);
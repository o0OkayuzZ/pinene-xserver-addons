import {
  world,
  system
} from "@minecraft/server";
import { isWearingSet } from "components/armour.js"


// Soul Collection

export function grantPlayerSoul(mob, player) {
  let soulGauge = world.scoreboard.getObjective('soulGauge')
  if (soulGauge.getScore(player) < 100) {
    soulGauge.addScore(player, 1)
    return true
  } else {
    return false
  }
}

world.afterEvents.entityDie.subscribe((event) => {
  const deadEntity = event.deadEntity;
  const damageSource = event.damageSource.damagingEntity;
  if (!damageSource) return;
  if (damageSource.typeId !== 'minecraft:player') return;

  var soulCount = 0;
  if (world.scoreboard.getObjective('soulGauge').getScore(damageSource) >= 100) return;
  var multReq = 0
  if (isWearingSet(damageSource, "dungeons:grim_armour")) multReq += 2
  if (isWearingSet(damageSource, "dungeons:teleportation_robes")) multReq += 2
  if (isWearingSet(damageSource, "dungeons:phantom_armour")) multReq += 2
  if (isWearingSet(damageSource, "dungeons:soulrobe_armour")) multReq += 5
  const rand = Math.floor(Math.random() * 5)
  if (rand <= multReq) {
    soulCount += 1;
  }
  if (damageSource.typeId === "minecraft:player" && (deadEntity.matches({
    families: ['monster']
  }))) {
    const heldItem = damageSource.getComponent("minecraft:equippable").getEquipment("Mainhand");
    if (!heldItem) return;
    if (heldItem.hasTag('dungeons:soul_collection')) {
      soulCount += 1
    }
    if (isWearingSet(damageSource, "dungeons:verdant_robes")) soulCount = soulCount * 2

    if (soulCount < 1) return;
    system.runTimeout(() => {
      if (deadEntity.isValid == false) return;
      for (let i = 0; i < soulCount; i++) {
        deadEntity.dimension.spawnParticle('dungeons:soul2', deadEntity.location);
        system.runTimeout(() => {

          grantPlayerSoul(deadEntity, damageSource)
          damageSource.onScreenDisplay.setActionBar(`§s${world.scoreboard.getObjective('soulGauge').getScore(damageSource)}§s ソウル `)

        }, i)
      }
      system.runTimeout(() => {
        damageSource.onScreenDisplay.setActionBar(`§b${world.scoreboard.getObjective('soulGauge').getScore(damageSource)}§s ソウル `)

      }, soulCount + 1)
    }, 18) // waits 0.9 seconds for death to finish

  }
});

world.afterEvents.entityDie.subscribe((event) => {
  const entity = event.deadEntity;
  if (entity.typeId !== 'minecraft:player') return;
  if (world.gameRules.keepInventory === true) return;

  let soulGauge = world.scoreboard.getObjective('soulGauge');
  let soulGaugePlayer = soulGauge.getScore(entity);
  if (soulGaugePlayer < 34) {
    soulGauge.setScore(entity, 0)
  } else {
    soulGauge.addScore(entity, -33)
  }

});

import {
  world,
  system,
  MolangVariableMap
} from "@minecraft/server";
import { isWearingSet, isWearingMysteryArmour } from "components/armour.js"


export function getSoulBarText(player, darken, ignoreFormat, returnArray) {
  let soulGauge = world.scoreboard.getObjective('soulGauge')
  const souls = soulGauge.getScore(player)
  var trail = "§s§o§u§l§r"
  if(ignoreFormat) trail = ""
  var colour = "§b"
  if(darken) colour = "§s"
  if(player.hasTag("dungeons:soul_display_classic")) trail = ""
  var text = {rawtext:[{text: `${trail}${colour}${souls}§s `}, {translate: "dungeons.ui.souls"},{text: " "}]}
  var arrayText = [{text: `${trail}${colour}${souls}§s `}, {translate: "dungeons.ui.souls"},{text: " "}]
  if(player.hasTag("dungeons:soul_display_classic")) {
    text = {rawtext:[{text: `${trail}${colour}${souls}§s `}, {text: "Souls"},{text: " "}]}
    arrayText = [{text: `${trail}${colour}${souls}§s `}, {text: "Souls"},{text: " "}]
  }
  if(player.hasTag("dungeons:soul_display_bar")) {
    var max = 100
    if (isWearingSet(player, "dungeons:bag_o_souls") || souls > 100) max = 200
    var filled = 0
    var barText = ""
    const barMax = 40
    var div = max/barMax
    for(let i = 0; i < Math.ceil(souls/div); i++) {
      filled += 1
      barText += ""
    }
    barText += "§9"
    for(let i = filled; i < barMax; i++) {
      barText += ""
    }
    text = {rawtext:[{text:`${trail}${colour}${barText} `}]}
    arrayText = [{text:`${trail}${colour}${barText} `}]
  }
  if(returnArray) return arrayText
  return text
}
// Soul Collection

export function grantPlayerSoul(mob, player) {
  var max = 100
  if (isWearingSet(player, "dungeons:bag_o_souls")) max = 200
  let soulGauge = world.scoreboard.getObjective('soulGauge')
  if (soulGauge.getScore(player) < max) {
    soulGauge.addScore(player, 1)
    if(soulGauge.getScore(player) >= max) player.runCommand("scriptevent dungeons:max_souls")
    const equippable = player.getComponent("equippable")
    if (equippable) {
      const held = equippable.getEquipment("Mainhand")
      if (held && (held.hasTag("dungeons:anima_conduit") || held.getDynamicProperty("dungeons:anima_conduit".replace("dungeons:", "dungeons:gild_")))) {
        const hp = player.getComponent("health")
        var setTo = hp.currentValue + hp.effectiveMax * 0.02
        if (setTo > hp.effectiveMax) setTo = hp.effectiveMax
        hp.setCurrentValue(setTo)
      }
      if (isWearingSet(player, "dungeons:soul_speed")) {
        const speed = player.getEffect("speed")
        if (!speed) {
          player.addEffect("speed", 60, { amplifier: 0 })
        } else {
          var pwr = speed.amplifier
          if (Math.random() > 0.5) pwr += 1
          if (pwr > 5) pwr = 5
          var dur = speed.duration + 30
          if (dur > 200) dur = 200
          player.addEffect("speed", dur, { amplifier: pwr })
        }
      }
    }
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
  var max = 100
  if (isWearingSet(damageSource, "dungeons:bag_o_souls")) max = 200
  if (world.scoreboard.getObjective('soulGauge').getScore(damageSource) >= max) return;
  var multReq = 0
  if (isWearingSet(damageSource, "dungeons:grim_armour")) multReq += 2
  if (isWearingSet(damageSource, "dungeons:teleportation_robes")) multReq += 2
  if (isWearingSet(damageSource, "dungeons:phantom_armour")) multReq += 2
  if (isWearingMysteryArmour(damageSource, "soul_gathering")) multReq += 2
  if (isWearingSet(damageSource, "dungeons:soulrobe_armour")) multReq += 5
  const rand = Math.floor(Math.random() * 5)
  if (rand <= multReq) {
    soulCount += 1;
  }
  if (damageSource.typeId === "minecraft:player" && (deadEntity.matches({
    families: ['monster'], excludeTags:["dungeons:cannot_drop_soul"]
  }))) {
    const heldItem = damageSource.getComponent("minecraft:equippable").getEquipment("Mainhand");
    if (!heldItem) return;
    if (heldItem.hasTag('dungeons:soul_collection')) {
      soulCount += 1
    }
    if (isWearingSet(damageSource, "dungeons:verdant_robes")) soulCount = soulCount * 2
    if (isWearingSet(damageSource, "dungeons:shadow_surge") && (damageSource.hasTag("dungeons:exited_shadow_form") || damageSource.hasTag("dungeons:shadow_form"))) {
      soulCount += 4
      damageSource.dimension.playSound("armour.shadow_surge", damageSource.location, { pitch: Math.random() / 5 + 0.9 })
    }
    if (soulCount < 1) return;
    system.runTimeout(() => {
      if (deadEntity.isValid == false) return;
      for (let i = 0; i < soulCount; i++) {
        deadEntity.dimension.spawnParticle('dungeons:soul2', deadEntity.location);
        //particle(deadEntity.dimension, deadEntity.location, damageSource.location)
        system.runTimeout(() => {

          grantPlayerSoul(deadEntity, damageSource)
          damageSource.onScreenDisplay.setActionBar(getSoulBarText(damageSource, true))

        }, i)
      }
      system.runTimeout(() => {
        damageSource.onScreenDisplay.setActionBar(getSoulBarText(damageSource, false))

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

function particle(dim, eLoc, tLoc) {
    eLoc = { x: eLoc.x, y: eLoc.y + 1, z: eLoc.z }
    if (dim.isChunkLoaded(eLoc)) {
        const particleSpeed = 6 + Math.random()*3
        tLoc = { x: tLoc.x, y: tLoc.y + 0.7, z: tLoc.z }
        var dx = tLoc.x - eLoc.x
        var dy = tLoc.y - eLoc.y
        var dz = tLoc.z - eLoc.z
        const length = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2) + Math.pow(dz, 2))

        dx = dx / length
        dy = dy / length
        dz = dz / length

        const lifetime = length / particleSpeed

        var map = new MolangVariableMap()
        map.setColorRGB("variable.color", { red: 0.75, green: 0.75, blue: 1 })
        map.setFloat("variable.particle_initial_speed", particleSpeed)
        map.setFloat("variable.max_lifetime", lifetime)
        map.setVector3("variable.direction", { x: dx, y: dy, z: dz })

        var xOffset = Math.random() * 0.4 - 0.2
        var yOffset = Math.random() * 0.4 - 0.2
        var zOffset = Math.random() * 0.4 - 0.2
        dim.spawnParticle("dungeons:trail_soul", { x: eLoc.x + xOffset, y: eLoc.y + yOffset, z: eLoc.z + zOffset }, map)
        return lifetime * 20
    }
    return 1
}
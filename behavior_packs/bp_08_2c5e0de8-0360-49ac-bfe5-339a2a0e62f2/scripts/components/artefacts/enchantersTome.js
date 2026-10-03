import {
  world,
  system,
  MolangVariableMap,
  ItemStack
} from "@minecraft/server";

import {getCooldownMult} from "./artefactCooldown.js"

const particleSpeed = 10

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:enchanters_tome', {
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
  if (!item.getComponent("dungeons:enchanters_tome")) return;
  useArtefact(player, item, true)
})

function useArtefact(player, item, finalShout) {

  if (item.hasTag('dungeons:tome_of_duplication')) {
    if (!player.hasTag('tod:used_enchanters_tome')) return;
  }


  const targets = player.dimension.getEntities({
    location: player.location,
    maxDistance: 16,
    families: ['enchantable_pet']
  });
  if (targets.length == 0) {

    const cd = item.getComponent("cooldown")
    player.startItemCooldown(cd.cooldownCategory, 10);
    return;
  }
  const dim = player.dimension
  player.dimension.playSound('block.enchanting_table.use', player.location);
  for (const mob of targets) {
    const owner = mob.getComponent('minecraft:tameable').tamedToPlayer;
    if (!owner) continue;
    if (owner !== player) continue;
    system.runTimeout(() => {
      dim.playSound("mob.enchanter.beam_on", player.location)
      for (let i = 0; i < 40; i++) {
        system.runTimeout(() => {
          if (!mob.isValid || !player.isValid) return;
          var eLoc = player.location;
          const viewDirection = player.getViewDirection()
          eLoc = { x: eLoc.x + viewDirection.x, y: eLoc.y + 1.5, z: eLoc.z + viewDirection.z }
          if (dim.isChunkLoaded(eLoc)) {
            var tLoc = mob.location;
            tLoc = { x: tLoc.x, y: tLoc.y + 1, z: tLoc.z }
            var dx = tLoc.x - eLoc.x
            var dy = tLoc.y - eLoc.y
            var dz = tLoc.z - eLoc.z
            const length = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2) + Math.pow(dz, 2))

            dx = dx / length
            dy = dy / length
            dz = dz / length

            const lifetime = length / particleSpeed

            var map = new MolangVariableMap()
            map.setColorRGB("variable.color", { red: 1, green: 0, blue: 1 })
            map.setFloat("variable.particle_initial_speed", particleSpeed)
            map.setFloat("variable.max_lifetime", lifetime)
            map.setVector3("variable.direction", { x: dx, y: dy, z: dz })

            var xOffset = Math.random() * 0.4 - 0.2
            var yOffset = Math.random() * 0.4 - 0.2
            var zOffset = Math.random() * 0.4 - 0.2
            dim.spawnParticle("minecraft:creaking_heart_trail", { x: eLoc.x + xOffset, y: eLoc.y + yOffset, z: eLoc.z + zOffset }, map)
          }
        }, i / 2)
      }
      system.runTimeout(() => {
        if (mob.matches({ families: ["enchanted"] })) return;
        if (!mob.isValid || !player.isValid) return;
        dim.spawnParticle("dungeons:enchanted_tome", mob.location)
        dim.playSound("mob.enchanter.enchant", mob.location)
        mob.triggerEvent('dungeons:pet_become_enchanted');
        system.runTimeout(() => {
          var i = 0 
          const runInt = system.runInterval(() => {
            i += 1
            if(!player.isValid || player.getGameMode() == "Spectator") {
              mob.triggerEvent('dungeons:pet_remove_enchanted');
              system.clearRun(runInt)
              return
            }
            if(!mob.isValid) {
              if(mob.isValid) mob.triggerEvent('dungeons:pet_remove_enchanted');
              system.clearRun(runInt)
              return
            }
            if(!mob.matches({families:["enchanted"]})) {
              mob.triggerEvent('dungeons:pet_remove_enchanted');
              return system.clearRun(runInt);
            }
            if(i >= 400) {
              mob.triggerEvent('dungeons:pet_remove_enchanted');
              return system.clearRun(runInt);
            }
            const distanceBetween = Math.round(Math.hypot(mob.location.x - player.location.x, mob.location.y - player.location.y, mob.location.z - player.location.z))
            if(distanceBetween > 24) {
              mob.triggerEvent('dungeons:pet_remove_enchanted');
              return system.clearRun(runInt)
            }
            mob.addTag("dungeons:enchanted_pet_by_tome")
            particle(mob, player, player.dimension)
            particle(mob, player, player.dimension)
          })
        },1)
      }, 20)
    })
  }
}

//removeing
system.run(() => {
  const dims = []
  for(const player of world.getPlayers()) if(!dims.includes(player.dimension)) dims.push(player.dimension)
  for(const dim of dims) {
    for(const target of dim.getEntities({tags: ["dungeons:enchanted_pet_by_tome"]})) if(target && target.isValid) target.triggerEvent("dungeons:pet_remove_enchanted")
  }
})

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
  if(e.eventId == "dungeons:pet_remove_enchanted") {
    const entity = e.entity;
    for(const tag of entity.getTags()) {
      if (tag.includes("dungeons:enchanted")) entity.removeTag(tag)
      }
  }
})


//enchant players oooOOOOoo

system.run(() => {
  for(const player of world.getPlayers()) player.setDynamicProperty("dungeons:enchanted", null)
})

world.afterEvents.playerSpawn.subscribe((e) => {
  e.player.setDynamicProperty("dungeons:enchanted", null)
})
world.afterEvents.entityDie.subscribe((e) => {
  const player = e.deadEntity;
  if(!player || !player.isValid || player.typeId !== "minecraft:player") return;
  player.setDynamicProperty("dungeons:enchanted", null)
})


world.beforeEvents.playerInteractWithEntity.subscribe((e) => {
  const player = e.player;
  if(!player || !player.isValid || player.typeId !== "minecraft:player") return;
  const target = e.target;
  if(!target || !target.isValid || target.typeId !== "minecraft:player") return;

  
  const equippable = player.getComponent("equippable")
  const held = equippable.getEquipment("Mainhand")
  if(!held) return;
  if(!held.getComponent("dungeons:enchanters_tome")) return;
  if(target.getDynamicProperty("dungeons:enchanted")) return;
  
  if(player.getDynamicProperty("dungeons:enchanted")) return;
    const cd = held.getComponent("cooldown")
    const category = cd.cooldownCategory
    const ticks = cd.cooldownTicks * getCooldownMult(player)
    if(player.getItemCooldown(category) > 0) return;
  e.cancel = true;
  enchantPlayer(player, target, category, ticks)
})

world.beforeEvents.entityHurt.subscribe((e) => {
  const hurt = e.hurtEntity;
  if(!hurt || !hurt.isValid || hurt.typeId !== "minecraft:player") return;
  const attacker = e.damageSource.damagingEntity;
  if(!attacker || !attacker.isValid || attacker.typeId !== "minecraft:player") return;
  if(world.gameRules.pvp == false) return
  const equippable = attacker.getComponent("equippable")
  const held = equippable.getEquipment("Mainhand")
  if(!held) return;
  if(!held.getComponent("dungeons:enchanters_tome")) return;
  if(hurt.getDynamicProperty("dungeons:enchanted")) return;
  
  if(attacker.getDynamicProperty("dungeons:enchanted")) return;
    const cd = held.getComponent("cooldown")
    const category = cd.cooldownCategory
    const ticks = cd.cooldownTicks * getCooldownMult(player)
    if(attacker.getItemCooldown(category) > 0) return;
  e.cancel = true;
  enchantPlayer(attacker, hurt, category, ticks)
})

function enchantPlayer(attacker, hurt, category, ticks) {
  
  system.run(() => {
    
  attacker.dimension.playSound('block.enchanting_table.use', attacker.location);
    attacker.startItemCooldown(category, ticks);
    hurt.setDynamicProperty("dungeons:enchanted", attacker.id)
    var i = 0
    const runInt = system.runInterval(() => {
      i += 1

      if(!attacker.isValid || attacker.getGameMode() == "Spectator") {
        hurt.setDynamicProperty("dungeons:enchanted", null)
        system.clearRun(runInt)
        return
      }
      if(!hurt.isValid || hurt.getGameMode() == "Spectator") {
        if(hurt.isValid) hurt.setDynamicProperty("dungeons:enchanted", null)
        system.clearRun(runInt)
        return
      }
            if(i >= 300) {
        hurt.setDynamicProperty("dungeons:enchanted", null)
        system.clearRun(runInt)
        return
      }
    if(!hurt.getDynamicProperty("dungeons:enchanted")) return system.clearRun(runInt);
const distanceBetween = Math.round(Math.hypot(hurt.location.x - attacker.location.x, hurt.location.y - attacker.location.y, hurt.location.z - attacker.location.z))
if(distanceBetween > 16) {
  
        hurt.setDynamicProperty("dungeons:enchanted", null)
  return system.clearRun(runInt)
}
      particle(hurt, attacker, attacker.dimension)
      particle(hurt, attacker, attacker.dimension)
      particle(hurt, attacker, attacker.dimension)
      hurt.addEffect("speed", 301 -i, {amplifier: 1, showParticles:false})
      if(!hurt.getEffect("health_boost")) {
        hurt.addEffect("health_boost", 301 - i, {amplifier: 1, showParticles:false})
      }
      if(i % 20 == 0) {
        const hp = hurt.getComponent("health")
        var setTo = hp.currentValue + 1
        if(setTo > hp.effectiveMax) setTo = hp.effectiveMax;
        hp.setCurrentValue(setTo)
      }
    })
  })
}

function particle(mob, player, dim) {
  
          if (!mob.isValid || !player.isValid) return;
          var eLoc = player.location;
          const viewDirection = player.getViewDirection()
          eLoc = { x: eLoc.x + viewDirection.x, y: eLoc.y + 1.2, z: eLoc.z + viewDirection.z }
          if (dim.isChunkLoaded(eLoc)) {
            var tLoc = mob.location;
            tLoc = { x: tLoc.x, y: tLoc.y + 1, z: tLoc.z }
            var dx = tLoc.x - eLoc.x
            var dy = tLoc.y - eLoc.y
            var dz = tLoc.z - eLoc.z
            const length = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2) + Math.pow(dz, 2))

            dx = dx / length
            dy = dy / length
            dz = dz / length

            var speed = particleSpeed*(length/4)
            if(speed < 1.5) speed = 1.5
            const lifetime = length / speed

            var map = new MolangVariableMap()
            map.setColorRGB("variable.color", { red: 1, green: 0 + Math.random()/3, blue: 1 })
            map.setFloat("variable.particle_initial_speed", speed)
            map.setFloat("variable.max_lifetime", lifetime)
            map.setVector3("variable.direction", { x: dx, y: dy, z: dz })

            var xOffset = Math.random() * 0.4 - 0.2
            var yOffset = Math.random() * 0.4 - 0.2
            var zOffset = Math.random() * 0.4 - 0.2
            dim.spawnParticle("minecraft:creaking_heart_trail", { x: eLoc.x + xOffset, y: eLoc.y + yOffset, z: eLoc.z + zOffset }, map)
          }
}

//particles
system.runInterval(() => {
    const dims = []
    for (const entity of world.getPlayers()) {
      if(!entity.getDynamicProperty("dungeons:enchanted")) continue;
      const dim = entity.dimension;
            if (dim.isChunkLoaded(entity.location)) {
                if (entity.getEffect("invisibility")) continue;
                var enchantCount = 2
                const box = entity.getAABB()
                const h = Math.round(box.extent.y * 100) / 50
                const w = Math.round(box.extent.x * 100) / 50
                var map = new MolangVariableMap()

                map.setFloat("variable.radius", w)
                map.setFloat("variable.height", h)

                for (let i = 0; i < enchantCount; i++) {
                    if (world.getAbsoluteTime() % 4 == 0) dim.spawnParticle("dungeons:enchanted_sparks", entity.location, map)
                    dim.spawnParticle("dungeons:enchanted_smoke", entity.location)
                }
            }
        }
})

//attack boost
world.beforeEvents.entityHurt.subscribe((e) => {
    const damageSource = e.damageSource.damagingEntity;
    if (!damageSource) return;
    if (e.damageSource.cause !== "entityAttack") return;
    if(!damageSource.getDynamicProperty("dungeons:enchanted")) return;
        e.damage = e.damage * 1.25
    

});

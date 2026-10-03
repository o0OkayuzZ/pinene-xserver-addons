import {
  world,
  system,
  ItemStack
} from "@minecraft/server";

import {getCooldownMult} from "./artefactCooldown.js"

const id = "enchanted_grass"
const spawnId = "dungeons:enchanted_sheep"
const petsPerUse = 1
const useSounds = [["artefact.enchanted_grass.use", 1, 1],["mob.sheep.say", 0.4, 0.4]]
const cooldowns = ["enchanted_grass_common", "enchanted_grass_rare"]
const maxSeconds = 300


function findPlayerPet(player, rare) {
  const pets = player.dimension.getEntities({type: spawnId, tags: [`${rare == true ? "dungeons:pet_rare" : "dungeons:pet_common"}`, `dungeons:pet_of_${player.id}`]})
  if(pets.length == 0) return undefined;
  return pets
}



system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:' + id, {
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
  if (!item.getComponent("dungeons:" + id)) return;
  useArtefact(player, item, true)
})

function useArtefact(player, item, finalShout) {
  const params = item.getComponent("dungeons:" + id).customComponentParameters.params
  const type = params.type

  if (item.hasTag('dungeons:tome_of_duplication')) {
    if (!player.hasTag('tod:used_' + id)) return;
  }
  const dim = player.dimension;
  const loc = player.location;

  const petExists = findPlayerPet(player, type == "rare")
  if(!petExists) {
    const playerTag = `dungeons:pet_of_${player.id}`
    const rareTag = `dungeons:pet_${type}`
    const cd = item.getComponent("cooldown")
    player.startItemCooldown(cd.cooldownCategory, 100);
    for(const entry of useSounds) dim.playSound(entry[0], loc, {volume: entry[1], pitch: entry[2]})
    for(let i = 0; i < petsPerUse; i++) {
      const newPet = dim.spawnEntity(spawnId, loc)
      newPet.addTag(playerTag)
      newPet.addTag(rareTag)
      const tameable = newPet.getComponent('minecraft:tameable')
      tameable.tame(player);
    }
  } else {
    if(!player.isOnGround && !player.isInWater) {
      const cd = item.getComponent("cooldown")
      player.startItemCooldown(cd.cooldownCategory, 10);
      return;
    }
    const cd = item.getComponent("cooldown")
    player.startItemCooldown(cd.cooldownCategory, 100);
    for(const pet of petExists) {
      dim.spawnParticle("dungeons:instant_teleport", pet.getHeadLocation())
      pet.teleport(player.location)
      dim.spawnParticle("dungeons:instant_teleport", player.getHeadLocation())
    }
  }
}

function petRemoved(player, type, healthPercentage) {
  var cooldownId = cooldowns[0]
  if(type == "rare") cooldownId = cooldowns[1]
  var itemId = type == "common" ? "dungeons:" + id : "dungeons:rare_" + id
  const itemPlace = new ItemStack(itemId, 1)
  const cooldownTicks = itemPlace.getComponent("cooldown").cooldownTicks
  var mult = 1
  mult = Math.max(0.5, healthPercentage)
  player.startItemCooldown(cooldownId, cooldownTicks * getCooldownMult(player) * mult)
}

world.beforeEvents.entityRemove.subscribe((e) => {
  if(e.removedEntity.typeId !== spawnId) return;
  const entity = e.removedEntity;
  const tameable = entity.getComponent('minecraft:tameable')
  const owner = tameable.tamedToPlayer;
  const type = entity.hasTag("dungeons:pet_rare") ? "rare" : "common"
  const health = entity.getComponent("health")
  const currentHealth = health.currentValue
  const max = health.defaultValue
  const val = 1 - currentHealth/max/2
  if(owner) system.run(() => {
    petRemoved(owner, type, val)
  })
})

world.afterEvents.entityDie.subscribe((e) => {
  const dead = e.deadEntity;
  if(!dead || !dead.isValid || dead.typeId !== spawnId) return;
  const tameable = dead.getComponent('minecraft:tameable')
  const owner = tameable.tamedToPlayer;
  if(!owner) return dead.remove();
  if(!owner.isValid) return dead.remove();
  const type = dead.hasTag("dungeons:pet_rare") ? "rare" : "common"
  var cooldownId = cooldowns[0]
  if(type == "rare") cooldownId = cooldowns[1]
  owner.startItemCooldown(cooldownId, owner.getItemCooldown(cooldownId) + 100)
})

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
  const id = e.eventId;
  if(id !== "dungeons:pet_check") return;
  const entity = e.entity;
  if(entity.typeId !== spawnId) return;
  const tameable = entity.getComponent('minecraft:tameable')
  const owner = tameable.tamedToPlayer;
  if(!owner) return entity.remove();
  if(!owner.isValid) return entity.remove();
  const timer = entity.getDynamicProperty("dungeons:timer")
  if(timer == undefined) {
    entity.setDynamicProperty("dungeons:timer", 1)
  } else {
    if(timer == maxSeconds) {
      entity.triggerEvent("dungeons:shaking")
    } else if (timer >= maxSeconds + 10) {
      return entity.remove()
    } else {
      entity.setDynamicProperty("dungeons:timer", timer + 1)
    }
  }
  if(owner.dimension.typeId !== entity.dimension.typeId) {
    try {
      entity.teleport(owner.location, {dimension: owner.dimension})
    } catch {
      return entity.remove()
    }
  } else {
    const distanceBetween = Math.round(Math.hypot(owner.location.x - entity.location.x, owner.location.y - entity.location.y, owner.location.z - entity.location.z))
    if(distanceBetween > 64) entity.remove()        
  }
})
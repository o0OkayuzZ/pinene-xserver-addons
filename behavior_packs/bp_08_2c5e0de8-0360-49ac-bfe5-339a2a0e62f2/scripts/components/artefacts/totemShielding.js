import {
  world,
  system
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:totem_of_shielding', {
    onUse(e) {
      const player = e.source;
      const item = e.itemStack;
      const dim = player.dimension;
      const loc = player.location

      if (item.hasTag('dungeons:tome_of_duplication')) {
        if (!player.hasTag('tod:used_totem_of_shielding')) return;
      }

      dim.playSound('mob.evocation_illager.cast_spell', loc);
      var spawnLoc = dim.getTopmostBlock({ x: loc.x, z: loc.z }, loc.y)
      if (spawnLoc == undefined) {
        spawnLoc = loc
      } else {
        spawnLoc = spawnLoc.above()
      }
      if (spawnLoc == undefined) spawnLoc = loc
      if (spawnLoc.y + 8 < loc.y) spawnLoc = { x: loc.x, y: loc.y - 4, z: loc.z }
      const totem = player.dimension.spawnEntity('dungeons:totem_of_shielding', { x: loc.x, y: spawnLoc.y, z: loc.z });
      let tameable = totem.getComponent('minecraft:tameable')
      tameable.tame(player);
    }
  });

});

world.afterEvents.dataDrivenEntityTrigger.subscribe((event) => {
  const mob = event.entity;
  const eventId = event.eventId;
  if (eventId !== 'dungeons:shield') {
    return;
  }
  if (mob.typeId !== "dungeons:totem_of_shielding") return;
  const owner = mob.getComponent('minecraft:tameable').tamedToPlayer;
  if (!owner) return;

  const players = mob.dimension.getPlayers({ location: mob.location, maxDistance: 4 })

  for (const player of players) {
    player.addEffect("resistance", 15)
  }

  const entities = mob.dimension.getEntities({ location: mob.location, maxDistance: 7 })
  for (const entity of entities) {
    if (entity.hasTag("dungeons:effected_by_shielding")) continue;
    const proj = entity.getComponent("projectile")
    if (!proj) continue;
    if (proj.owner !== undefined) {
      if (proj.owner == owner) continue;
      if (world.gameRules.pvp == false && proj.owner.typeId == "minecraft:player") continue;
    }
    const v = entity.getVelocity()
    proj.shoot({ x: -v.x * 1.5, y: -0.2, z: -v.z * 1.5 })
    if (entity.isOnGround || Math.floor(entity.location.y) <= Math.floor(mob.location.y)) entity.addTag("dungeons:effected_by_shielding")
  }
});
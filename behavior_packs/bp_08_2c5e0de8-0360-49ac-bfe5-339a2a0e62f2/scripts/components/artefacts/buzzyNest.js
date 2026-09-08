import {
  world,
  system
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:buzzy_nest', {
    onUse(e) {
      const player = e.source;
      const item = e.itemStack;
      const dim = player.dimension;
      const loc = player.location

      if (item.hasTag('dungeons:tome_of_duplication')) {
        if (!player.hasTag('tod:used_buzzy_nest')) return;
      }

      dim.playSound('jump.stone', loc);
      var spawnLoc = dim.getTopmostBlock({ x: loc.x, z: loc.z }, loc.y)
      if (spawnLoc == undefined) {
        spawnLoc = loc
      } else {
        spawnLoc = spawnLoc.above()
      }
      if (spawnLoc == undefined) spawnLoc = loc
      if (spawnLoc.y + 8 < loc.y) spawnLoc = { x: loc.x, y: loc.y - 4, z: loc.z }
      const totem = player.dimension.spawnEntity('dungeons:buzzy_nest', { x: loc.x, y: spawnLoc.y, z: loc.z });
      let tameable = totem.getComponent('minecraft:tameable')
      tameable.tame(player);
    }
  });

});

world.afterEvents.dataDrivenEntityTrigger.subscribe((event) => {
  const mob = event.entity;
  const eventId = event.eventId;
  if (eventId !== 'dungeons:spawn_bee') {
    return;
  }
  const owner = mob.getComponent('minecraft:tameable').tamedToPlayer;
  if (!owner) return;

  const bee = mob.dimension.spawnEntity('dungeons:pet_bee', { x: mob.location.x, y: mob.location.y + 1, z: mob.location.z });

  let tameable = bee.getComponent('minecraft:tameable')
  tameable.tame(owner);

  mob.dimension.spawnParticle("dungeons:busy_bee_spawn", mob.getHeadLocation())
  mob.dimension.playSound("artefact.buzzy_nest.spawn", mob.location)
  mob.playAnimation('animation.buzzy_nest.spawn_bee');
});
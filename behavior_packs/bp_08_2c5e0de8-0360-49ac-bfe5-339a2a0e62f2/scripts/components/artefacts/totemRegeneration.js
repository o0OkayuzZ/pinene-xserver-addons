import {
  world,
  system
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:totem_of_regeneration', {
    onUse(e) {
      const player = e.source;
      const item = e.itemStack;
      const dim = player.dimension;
      const loc = player.location

      if (item.hasTag('dungeons:tome_of_duplication')) {
        if (!player.hasTag('tod:used_totem_of_regeneration')) return;
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
      const totem = player.dimension.spawnEntity('dungeons:totem_of_regeneration', { x: loc.x, y: spawnLoc.y, z: loc.z });
      let tameable = totem.getComponent('minecraft:tameable')
      tameable.tame(player);
    }
  });

});


world.afterEvents.dataDrivenEntityTrigger.subscribe((event) => {
  const mob = event.entity;
  const eventId = event.eventId;
  if (eventId !== 'dungeons:heal') {
    return;
  }
  if (mob.typeId !== "dungeons:totem_of_regeneration") return;
  const owner = mob.getComponent('minecraft:tameable').tamedToPlayer;
  if (!owner) return;

  const players = mob.dimension.getPlayers({ location: mob.location, maxDistance: 4 })

  for (const player of players) {
    var healAmt = 0.4
    if (player.id == owner.id) healAmt + 0.6

    let hp = player.getComponent("health")
    if (!hp) return;

    const maxHP = hp.defaultValue
    const currentHP = hp.currentValue;

    if (healAmt + currentHP > maxHP) {
      hp.setCurrentValue(maxHP)
    } else {
      hp.setCurrentValue(currentHP + healAmt)
    }
  }
});
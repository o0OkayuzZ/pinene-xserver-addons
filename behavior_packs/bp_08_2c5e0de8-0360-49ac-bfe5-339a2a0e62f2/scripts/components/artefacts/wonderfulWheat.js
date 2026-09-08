import {
  world,
  system
} from "@minecraft/server";


system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:wonderful_wheat', {
    onUse(e) {
      const player = e.source;
      const item = e.itemStack;

      if (item.hasTag('dungeons:tome_of_duplication')) {
        if (!player.hasTag('tod:used_wonderful_wheat')) return;
      }



      const dim = player.dimension;
      const loc = player.location;
      dim.playSound("artefact.wonderful_wheat.use", loc)

      const mob = dim.spawnEntity('dungeons:pet_llama', loc);

      let tameable = mob.getComponent('minecraft:tameable')
      tameable.tame(player);
    }
  });

});

//attack boost
world.beforeEvents.entityHurt.subscribe((e) => {
  const damageSource = e.damageSource.damagingEntity;
  if (!damageSource) return;
  if (e.damageSource.cause == "override") return;
  if (damageSource.typeId == "dungeons:pet_llama") {
    const cause = e.damageSource.cause
    if (cause == "lightning") return;
    e.damage = e.damage * 4
  }

});
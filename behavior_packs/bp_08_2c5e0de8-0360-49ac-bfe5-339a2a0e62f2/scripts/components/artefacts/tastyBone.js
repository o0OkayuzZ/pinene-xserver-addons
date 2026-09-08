import {
  system
} from "@minecraft/server";


system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:tasty_bone', {
    onUse(e) {
      const player = e.source;
      const item = e.itemStack;

      if (item.hasTag('dungeons:tome_of_duplication')) {
        if (!player.hasTag('tod:used_tasty_bone')) return;
      }



      const dim = player.dimension;
      const loc = player.location;
      dim.playSound("artefact.tasty_bone.use", loc)

      const mob = dim.spawnEntity('dungeons:pet_wolf', loc);

      let tameable = mob.getComponent('minecraft:tameable')
      tameable.tame(player);
    }
  });

});
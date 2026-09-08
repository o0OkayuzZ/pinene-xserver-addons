import {
  system
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:enchanted_grass', {
    onUse(e) {
      const player = e.source;
      const item = e.itemStack;

      if (item.hasTag('dungeons:tome_of_duplication')) {
        if (!player.hasTag('tod:used_enchanted_grass')) return;
      }

      const dim = player.dimension;
      const loc = player.location;

      dim.playSound("mob.sheep.say", loc, { pitch: 0.4, volume: 0.4 })
      dim.playSound("artefact.enchanted_grass.use", loc)

      const mob = dim.spawnEntity('dungeons:enchanted_sheep', loc);

      let tameable = mob.getComponent('minecraft:tameable')
      tameable.tame(player);
    }
  });

});
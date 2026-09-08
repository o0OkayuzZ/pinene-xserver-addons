import {
  world,
  system,
  ItemStack
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:vexing_chant', {
    onUse(e) {
      const player = e.source;
      const item = e.itemStack;
      const dim = player.dimension
      const playerloc = player.location;

      if (item.hasTag('dungeons:tome_of_duplication')) {
        if (!player.hasTag('tod:used_vexing_chant')) return;
      }



      const loc1 = { x: player.location.x + 2, y: playerloc.y + 1, z: player.location.z }
      const loc2 = { x: player.location.x - 2, y: playerloc.y + 1, z: player.location.z - 2 }
      const loc3 = { x: player.location.x - 2, y: playerloc.y + 1, z: player.location.z + 2 }

      const locations = [loc1, loc2, loc3]

      dim.playSound("artefact.vexing_chant.use", playerloc)

      for (const loc of locations) {
        dim.spawnParticle("dungeons:humanoid_enchant", loc)
        const vex = player.dimension.spawnEntity('dungeons:guardian_vex', loc);
        let tameable = vex.getComponent('minecraft:tameable')
        tameable.tame(player);
      }
    }
  });

});
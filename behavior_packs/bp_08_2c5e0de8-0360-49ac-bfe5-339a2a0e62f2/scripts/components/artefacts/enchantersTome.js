import {
  system,
  MolangVariableMap
} from "@minecraft/server";

const particleSpeed = 10

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:enchanters_tome', {
    onUse(e) {
      const player = e.source;
      const item = e.itemStack;

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
            mob.addEffect('regeneration', 5, { amplifier: 4, showParticles: false });

          }, 20)
        })
      }
    }
  });
});
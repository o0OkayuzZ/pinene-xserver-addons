import {
  world,
  system,
  DimensionTypes
} from "@minecraft/server";

import { isValidTarget, specialDamage } from "main.js";

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent("dungeons:love_medallion", {
    onUse(e) {
      const player = e.source;
      const item = e.itemStack;

      if (item.hasTag('dungeons:tome_of_duplication')) {
        if (!player.hasTag('tod:used_love_medallion')) return;
      }
      const dim = player.dimension
      const loc = player.location
      const range = dim.getEntities({
        location: loc,
        maxDistance: 8,
        families: ['love_medallion_target'],
        excludeTags: ["dungeons:love_medallion_active"]
      });
      var loveTargets = []
      for (const target of range) {
        const tameable = target.getComponent("tameable")
        if (tameable && tameable.isTamed == false) loveTargets.push(target)
      }
      if (loveTargets.length == 0) {
        player.sendMessage([{ text: "§7§o" }, { translate: "dungeons.warn.no_targets" }])
        dim.playSound("artefact.love_medallion.fail", loc, { volume: 1 })
        let cd = item.getComponent('cooldown');
        player.startItemCooldown(cd.cooldownCategory, 10);
        return;
      } else {
        dim.playSound("artefact.love_medallion.success", loc, { volume: 1 })
        dim.spawnParticle("dungeons:love_medallion_use", { x: loc.x, y: loc.y + 1, z: loc.z })
        dim.spawnParticle("dungeons:love_medallion_use_aura", { x: loc.x, y: loc.y + 1, z: loc.z })
        for (let i = 0; i < loveTargets.length && i < 2; i++) {
          const target = loveTargets[i]
          let tameable = target.getComponent('minecraft:tameable')
          dim.spawnParticle("dungeons:love_medallion_aura", target.location)
          dim.spawnParticle("dungeons:love_medallion_aura", target.getHeadLocation())
          tameable.tame(player);
          target.addTag("dungeons:love_medallion_active")
          target.addTag("dungeons:love_medallion_charmed_" + `${player.id}`)
          target.setDynamicProperty("dungeons:love_medallion_ticks", 400)
          target.addEffect("speed", 600, { showParticles: false })
          target.addEffect("slowness", 600, { showParticles: false })
          target.addEffect("regeneration", 40, { amplifier: 2, showParticles: false })
        }
      }
    }
  });
});

system.runInterval(() => {
  for (const dimId of DimensionTypes.getAll()) {
    const dim = world.getDimension(dimId.typeId)
    for (const entity of dim.getEntities({ tags: ["dungeons:love_medallion_active"] })) {
      const ticksLeft = entity.getDynamicProperty("dungeons:love_medallion_ticks")
      if (ticksLeft && ticksLeft > 0) {
        entity.setDynamicProperty("dungeons:love_medallion_ticks", ticksLeft - 1)

        if (dim.isChunkLoaded(entity.location)) {
          dim.spawnParticle("dungeons:love_medallion_aura", entity.location)
        }
      } else {
        if (dim.isChunkLoaded(entity.location)) {
          dim.spawnParticle("dungeons:love_medallion_use_aura", entity.getHeadLocation())
          dim.playSound("random.explode", entity.location, { volume: 0.2, pitch: 0.9 })
        }
        entity.kill()
        entity.remove()
      }
    }
  }
})
//attack boost
world.beforeEvents.entityHurt.subscribe((e) => {
  const damageSource = e.damageSource.damagingEntity;
  if (!damageSource) return;
  if (e.damageSource.cause == "override") return;
  if (damageSource.hasTag("dungeons:love_medallion_active")) {
    const cause = e.damageSource.cause
    if (cause == "lightning") return;
    e.damage = e.damage * 1.2
  }

});
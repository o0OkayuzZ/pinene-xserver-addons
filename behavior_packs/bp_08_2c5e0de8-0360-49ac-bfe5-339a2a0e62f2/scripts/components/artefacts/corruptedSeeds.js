import {
  system,
  EntityDamageCause,
  ItemStack
} from "@minecraft/server";

import { isValidTarget, specialDamage } from "main.js"
import { isWearingSet } from "components/armour.js"


system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:corrupted_seeds', {
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
  if (!item.getComponent("dungeons:corrupted_seeds")) return;
  useArtefact(player, item, true)
})

function useArtefact(player, item, finalShout) {

  if (item.hasTag('dungeons:tome_of_duplication')) {
    if (!player.hasTag('tod:used_corrupted_seeds')) return;
  }


  player.dimension.playSound("mob.player.hurt_freeze", player.location, { volume: 0.5, pitch: 0.4 })
  player.dimension.spawnParticle("dungeons:corrupted_seeds", player.location)

  const targets = player.dimension.getEntities({ location: player.location, maxDistance: 5 })
  for (const target of targets) {
    if (isValidTarget(target) && target !== player) {
      specialDamage(player, target, 1, EntityDamageCause.wither, ["poison", "artefact"])
      target.applyKnockback({ x: 0, z: 0 }, -0.2)
      var amplifier = 0
      if (isWearingSet(player, "dungeons:poison_focus")) amplifier += 1
      target.addEffect("fatal_poison", 160, { amplifier: amplifier })
      target.addEffect("slowness", 160, { amplifier: 3 })
    }
  }
}
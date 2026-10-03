import {
  world,
  system,
  ItemStack
} from "@minecraft/server";

import { isValidTarget } from "main.js";

import { stunnedEffect } from "misc/stunnedEffect.js"

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:shock_powder', {
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
  if (!item.getComponent("dungeons:shock_powder")) return;
  useArtefact(player, item, true)
})

function useArtefact(player, item, finalShout) {
  const params = item.getComponent("dungeons:shock_powder").customComponentParameters.params
  const type = params.type
  var duration = 70
  if (type == "rare") duration = 120


  if (item.hasTag('dungeons:tome_of_duplication')) {
    if (!player.hasTag('tod:used_shock_powder')) return;
  }


  const dim = player.dimension
  const loc = player.location
  const damageRange = dim.getEntities({
    location: loc,
    maxDistance: 5,
    excludeFamilies: ['ignore']
  });
  dim.spawnParticle("dungeons:shock_powder_strike", loc)
  dim.spawnParticle("dungeons:shock_powder", { x: loc.x, y: loc.y + 1, z: loc.z })
  dim.playSound("ambient.weather.lightning.impact", loc, { pitch: 2.5 })


  for (const target of damageRange) {
    if (isValidTarget(target) == false) continue;
    if (target === player) continue;
    stunnedEffect(target, duration)
  }
}
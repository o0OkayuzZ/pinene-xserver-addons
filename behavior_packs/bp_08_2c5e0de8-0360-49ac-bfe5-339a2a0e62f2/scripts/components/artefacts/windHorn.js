import {
  world,
  system,
  ItemStack
} from "@minecraft/server";

import { getDirection, makeVector, isValidTarget } from "main.js";

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:wind_horn', {
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
  if (!item.getComponent("dungeons:wind_horn")) return;
  useArtefact(player, item, true)
})

function useArtefact(player, item, finalShout) {
  const params = item.getComponent("dungeons:wind_horn").customComponentParameters.params
  const type = params.type

  if (item.hasTag('dungeons:tome_of_duplication')) {
    if (!player.hasTag('tod:used_wind_horn')) return;
  }


  player.dimension.playSound("artefact.wind_horn", player.location, { volume: 0.8, pitch: 1 })
  player.dimension.spawnParticle("dungeons:wind_horn", player.location)

  var power = 3
  if (type == "rare") power = 4.5

  const targets = player.dimension.getEntities({ location: player.location, maxDistance: 7 })
  for (const target of targets) {
    if (isValidTarget(target) && target !== player) {
      if (target.typeId == "minecraft:player" && target.getGameMode() == "Spectator") continue;
      const dir = getDirection(player.location, target.location);
      target.applyKnockback(makeVector(dir, power), 0.5)
      target.addEffect("slowness", power * 20 + 40)

    }
  }
}
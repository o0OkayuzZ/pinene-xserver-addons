import {
  world,
  system,
  ItemStack
} from "@minecraft/server";
import { isWearingSet } from "components/armour.js"
system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:boots_of_switfness', {
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
  if (!item.getComponent("dungeons:boots_of_switfness")) return;
  useArtefact(player, item, true)
})

function useArtefact(player, item, finalShout) {
  const params = item.getComponent("dungeons:boots_of_switfness").customComponentParameters.params
  const type = params.type

  if (item.hasTag('dungeons:tome_of_duplication')) {
    if (!player.hasTag('tod:used_boots_of_swiftness')) return;
  }

  const loc = player.location
  const dim = player.dimension;
  dim.spawnParticle('dungeons:swiftness', loc)
  dim.playSound('armor.equip_leather', loc, {
    pitch: 1.5,
    volume: 0.5
  });
  dim.playSound("artefact.swiftness_boot.use", loc)

  var duration = 60
  if (type == "rare") duration = 90
  var amp = 1
  if (isWearingSet(player, "dungeons:speed_synergy")) amp += 1

  player.addEffect('speed', duration, {
    amplifier: amp
  });
}
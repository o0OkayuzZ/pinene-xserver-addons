import {
  system,
  ItemStack
} from "@minecraft/server";
import { isWearingSet } from "components/armour.js"

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:ghost_cloak', {
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
  if (!item.getComponent("dungeons:ghost_cloak")) return;
  useArtefact(player, item, true)
})

function useArtefact(player, item, finalShout) {
  const params = item.getComponent("dungeons:ghost_cloak").customComponentParameters.params
  const type = params.type

  if (item.hasTag('dungeons:tome_of_duplication')) {
    if (!player.hasTag('tod:used_ghost_cloak')) return;
  }



  player.dimension.spawnParticle('dungeons:ambush', player.location)
  player.dimension.playSound('armor.equip_leather', player.location, {
    pitch: 1.5
  });
  var amp = 0
  if (isWearingSet(player, "dungeons:speed_synergy")) amp += 1

  if (type == "common") {
    player.addEffect('speed', 40, {
      amplifier: amp,
      showParticles: false
    });
  } else {
    player.addEffect('speed', 40, {
      amplifier: amp + 1,
      showParticles: false
    });
  }
  player.addEffect('resistance', 40, {
    amplifier: 1,
    showParticles: true
  });
  player.addEffect('invisibility', 40, {
    amplifier: 0,
    showParticles: false
  });
}
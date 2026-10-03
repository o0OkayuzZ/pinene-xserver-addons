import {
  world,
  system,
  ItemStack
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:iron_hide_amulet', {
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
  if (!item.getComponent("dungeons:iron_hide_amulet")) return;
  useArtefact(player, item, true)
})

function useArtefact(player, item, finalShout) {
  const params = item.getComponent("dungeons:iron_hide_amulet").customComponentParameters.params
  const type = params.type

  if (item.hasTag('dungeons:tome_of_duplication')) {
    if (!player.hasTag('tod:used_iron_hide_amulet')) return;
  }


  player.dimension.spawnParticle('dungeons:iron_hide_amulet_1', player.location)
  player.dimension.spawnParticle('dungeons:iron_hide_amulet_2', player.location)
  player.dimension.playSound('random.anvil_land', player.location, {
    volume: 0.7,
    pitch: 0.5
  });
  if (type == "common") {
    player.addEffect('resistance', 150, {
      amplifier: 1
    });
  } else {
    player.addEffect('resistance', 250, {
      amplifier: 1
    });
  }
}
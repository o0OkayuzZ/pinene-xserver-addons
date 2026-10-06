import {
  world,
  system,
  ItemStack
} from "@minecraft/server";

const id = "void_quiver"
const commonCount = 3
const rareCount = 5

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:' + id, {
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
  if (!item.getComponent("dungeons:" + id)) return;
  useArtefact(player, item, true)
})

function useArtefact(player, item, finalShout) {
  const params = item.getComponent("dungeons:" + id).customComponentParameters.params
  const type = params.type

  if (item.hasTag('dungeons:tome_of_duplication')) {
    if (!player.hasTag('tod:used_' + id)) return;
  }
  const dim = player.dimension;
  const loc = player.location;
  const arrowSlot = player.getDynamicProperty("dungeons:arrow_slot")
  const arrowCount = player.getDynamicProperty("dungeons:arrow_count")
  if(arrowCount || arrowSlot) {
    player.playSound("item.crossbow.shoot", { pitch: 0.6, volume: 0.5 })
    if (!finalShout) player.sendMessage([{ text: "§7§o" }, { translate: "dungeons.warn.quiver_loaded" }])
    const cd = item.getComponent("cooldown")
    player.startItemCooldown(cd.cooldownCategory, 10);
    return;
  }
  dim.playSound("artefact." + id + ".use", loc)
  player.setDynamicProperty("dungeons:arrow_slot", id.replace("_quiver",""))
  player.setDynamicProperty("dungeons:arrow_count", type == "rare" ? rareCount : commonCount)
}
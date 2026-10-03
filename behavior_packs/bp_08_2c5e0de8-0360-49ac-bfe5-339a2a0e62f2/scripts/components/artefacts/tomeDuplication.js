import {
  system,
  ItemStack
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:tome_of_duplication', {
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
  if (!item.getComponent("dungeons:tome_of_duplication")) return;
  useArtefact(player, item, true)
})

function useArtefact(player, item, finalShout) {
  var returnquestion = false
  for (const tag of player.getTags()) {
    if (tag.substring(0, 9) === 'tod:used_') {
      returnquestion = true
      system.runTimeout(() => {
        player.removeTag(tag)
      }, 2)
    }
  }
  if (returnquestion == true) {
    const dim = player.dimension;
    const loc = player.location;
    dim.playSound("artefact.tome_of_duplication.use", loc)
    return;
  }
  if (!finalShout) player.sendMessage([{ text: "§7§o" }, { translate: "dungeons.warn.no_artefact_to_copy" }])
  let cd = item.getComponent('cooldown');
  player.startItemCooldown(cd.cooldownCategory, 10);

}

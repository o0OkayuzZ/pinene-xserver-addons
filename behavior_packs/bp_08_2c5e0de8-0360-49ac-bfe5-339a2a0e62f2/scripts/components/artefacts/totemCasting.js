import {
  world,
  system,
  ItemStack
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:totem_of_casting', {
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
  if (!item.getComponent("dungeons:totem_of_casting")) return;
  useArtefact(player, item, true)
})

function useArtefact(player, item, finalShout) {

  if (item.hasTag('dungeons:tome_of_duplication')) {
    if (!player.hasTag('tod:used_totem_of_casting')) return;
  }


  let soulScore = world.scoreboard.getObjective("soulGauge")
  let soulGauge = soulScore.getScore(player)

  if (soulGauge < 12 && !finalShout) {
    player.playSound("mob.evocation_illager.cast_spell", { pitch: 0.6, volume: 0.5 })
    player.sendMessage([{ text: "§7§o" }, { translate: "dungeons.warn.collect_more_souls" }])
    const cd = item.getComponent("cooldown")
    player.startItemCooldown(cd.cooldownCategory, 10);
    return;
  } else {
    soulScore.addScore(player, -12)
    if (soulGauge - 12 < 0) soulScore.setScore(player, 0)
  }
  const dim = player.dimension
  const loc = player.location

  dim.playSound("artefact.totem_of_casting.use", loc)
  var spawnLoc = dim.getTopmostBlock({ x: loc.x, z: loc.z }, loc.y)
  if (spawnLoc == undefined) {
    spawnLoc = loc
  } else {
    spawnLoc = spawnLoc.above()
  }
  if (spawnLoc == undefined) spawnLoc = loc
  if (spawnLoc.y + 8 < loc.y) spawnLoc = { x: loc.x, y: loc.y - 4, z: loc.z }
  const totem = player.dimension.spawnEntity('dungeons:totem_of_casting', { x: loc.x, y: spawnLoc.y, z: loc.z });
  let tameable = totem.getComponent('minecraft:tameable')
  tameable.tame(player);

}

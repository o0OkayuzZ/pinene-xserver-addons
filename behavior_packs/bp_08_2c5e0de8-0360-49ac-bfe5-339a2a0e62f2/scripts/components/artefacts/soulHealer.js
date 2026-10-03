

import {
  world,
  system,
  ItemStack
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:soul_healer', {
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
  if (!item.getComponent("dungeons:soul_healer")) return;
  useArtefact(player, item, true)
})

function useArtefact(player, item, finalShout) {
  const params = item.getComponent("dungeons:soul_healer").customComponentParameters.params
  const type = params.type

  if (item.hasTag('dungeons:tome_of_duplication')) {
    if (!player.hasTag('tod:used_soul_healer')) return;
  }



  let hp = player.getComponent("health")
  if (!hp) return;
  const maxHP = hp.effectiveMax
  const currentHP = hp.currentValue;
  if (currentHP == maxHP) {
    player.playSound("mob.evocation_illager.cast_spell", { pitch: 0.6, volume: 0.5 })
    if (!finalShout) player.sendMessage([{ text: "§7§o" }, { translate: "dungeons.warn.full_health" }])
    const cd = item.getComponent("cooldown")
    player.startItemCooldown(cd.cooldownCategory, 10);
    return;

  }

  let soulScore = world.scoreboard.getObjective("soulGauge")
  let soulGauge = soulScore.getScore(player)

  if (soulGauge < 10 && !finalShout) {
    player.playSound("mob.evocation_illager.cast_spell", { pitch: 0.6, volume: 0.5 })
    player.sendMessage([{ text: "§7§o" }, { translate: "dungeons.warn.collect_more_souls" }])
    const cd = item.getComponent("cooldown")
    player.startItemCooldown(cd.cooldownCategory, 10);
    return;
  } else {
    soulScore.addScore(player, -10)
    if (soulGauge - 10 < 0) soulScore.setScore(player, 0)
  }
  const dim = player.dimension
  const loc = player.location
  dim.playSound("mob.evocation_illager.cast_spell", loc, { pitch: 1.1 })
  dim.spawnParticle("dungeons:soul_healer", { x: loc.x, y: loc.y + 1, z: loc.z })
  dim.spawnParticle("dungeons:soul_rings", { x: loc.x, y: loc.y + 0.2, z: loc.z })
  dim.spawnParticle("dungeons:soul2", { x: loc.x, y: loc.y + 0.0, z: loc.z })
  dim.spawnParticle("dungeons:soul2", { x: loc.x, y: loc.y + 0.5, z: loc.z })

  var healAmt = 0
  if (type == "common") healAmt = 7
  if (type == "rare") healAmt = 11
  if (finalShout) healAmt = healAmt / 3
  if (healAmt + currentHP > maxHP) {
    var surplus = (healAmt + currentHP) - maxHP
    surplus = Math.ceil(surplus / 2)
    if (surplus > 4) surplus = 4
    if (!finalShout) soulScore.addScore(player, surplus)
    hp.setCurrentValue(maxHP)
  } else {
    hp.setCurrentValue(currentHP + healAmt)
  }

}

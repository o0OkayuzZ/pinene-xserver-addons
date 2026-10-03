import {
  world,
  system,
  ItemStack
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:satchel_of_snacks', {
    onUse(e, { params }) {
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
  if (!item.getComponent("dungeons:satchel_of_snacks")) return;
  useArtefact(player, item, true)
})

function useArtefact(player, item, finalShout) {
  const params = item.getComponent("dungeons:satchel_of_snacks").customComponentParameters.params
  const type = params.type

  if (item.hasTag('dungeons:tome_of_duplication')) {
    if (!player.hasTag('tod:used_satchel_of_snacks')) return;
  }


  var healAmt = 0
  var foodRand = 0
  if (type == "common") {
    healAmt = 2 + Math.ceil(Math.random() * 3);
    foodRand = Math.ceil(Math.random() * 3);
  } else {
    healAmt = 2 + Math.ceil(Math.random() * 3);
    foodRand = 3 + Math.ceil(Math.random() * 3);
  }
  if (finalShout) healAmt = healAmt / 3

  const hunger = player.getComponent("minecraft:player.hunger")
  if (!hunger) return;
  const max = hunger.defaultValue
  const current = hunger.currentValue;

  let hp = player.getComponent("health")
  if (!hp) return;

  const maxHP = hp.effectiveMax
  const currentHP = hp.currentValue;

  if (current >= max && currentHP >= maxHP) {
    if (!finalShout) player.sendMessage([{ text: "§7§o" }, { translate: "dungeons.warn.full_health_and_hunger" }])
    const cd = item.getComponent("cooldown")
    player.startItemCooldown(cd.cooldownCategory, 10);
    return;
  }

  if (healAmt + currentHP > maxHP) {
    hp.setCurrentValue(maxHP)
  } else {
    hp.setCurrentValue(currentHP + healAmt)
  }
  player.addEffect('saturation', foodRand, { showParticles: false });
  player.dimension.playSound('random.eat', player.location);
}
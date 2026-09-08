import {
  world,
  system
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:totem_of_soul_protection', {
    onUse(e) {
      const player = e.source;
      const item = e.itemStack;

      if (item.hasTag('dungeons:tome_of_duplication')) {
        if (!player.hasTag('tod:used_totem_of_soul_protection')) return;
      }


      let soulScore = world.scoreboard.getObjective("soulGauge")
      let soulGauge = soulScore.getScore(player)

      if (soulGauge < 5) {
        player.playSound("mob.evocation_illager.cast_spell", { pitch: 0.6, volume: 0.5 })
        player.sendMessage([{ text: "§7§o" }, { translate: "dungeons.warn.collect_more_souls" }])
        const cd = item.getComponent("cooldown")
        player.startItemCooldown(cd.cooldownCategory, 5);
        return;
      } else {
        soulScore.addScore(player, -5)
      }
      const dim = player.dimension
      const loc = player.location

      dim.playSound("artefact.totem_of_soul_protection.use", loc)
      var spawnLoc = dim.getTopmostBlock({ x: loc.x, z: loc.z }, loc.y)
      if (spawnLoc == undefined) {
        spawnLoc = loc
      } else {
        spawnLoc = spawnLoc.above()
      }
      if (spawnLoc == undefined) spawnLoc = loc
      if (spawnLoc.y + 8 < loc.y) spawnLoc = { x: loc.x, y: loc.y - 4, z: loc.z }
      const totem = player.dimension.spawnEntity('dungeons:totem_of_soul_protection', { x: loc.x, y: spawnLoc.y, z: loc.z });
      let tameable = totem.getComponent('minecraft:tameable')
      tameable.tame(player);
    }
  });

});

world.beforeEvents.entityHurt.subscribe((e) => {
  const hurt = e.hurtEntity;
  if (!hurt || !hurt.isValid) return;
  if (hurt.typeId !== "minecraft:player") return;
  const equippable = hurt.getComponent("equippable")
  const mainHand = equippable.getEquipment("Mainhand")
  if (mainHand !== undefined && mainHand.typeId == "minecraft:totem_of_undying") return;
  const offhand = equippable.getEquipment("Offhand")
  if (offhand !== undefined && offhand.typeId == "minecraft:totem_of_undying") return;
  const baseDmg = e.damage;
  if (!baseDmg) return;
  if (baseDmg <= 0) return;

  const totemInRange = hurt.dimension.getEntities({ maxDistance: 3.66, location: hurt.location, type: "dungeons:totem_of_soul_protection" }).length > 0
  if (!totemInRange) return;

  let soulScore = world.scoreboard.getObjective("soulGauge")
  let soulGauge = soulScore.getScore(hurt)

  if (soulGauge < 10) {
    return;
  }

  const hp = hurt.getComponent("health")
  if (hp.currentValue > 0) return;
  e.damage = e.damage * 0.0
  e.cancel = true;
  system.run(() => {
    const dim = hurt.dimension
    const loc = hurt.location
    dim.playSound("random.totem", loc, { pitch: 1.5 })
    dim.playSound("artefact.totem_of_soul_protection.use", loc, { pitch: 0.7 })
    hurt.runCommand("camerashake add @s 0.2 0.3")
    hurt.runCommand("camerashake add @s 0.2 0.5")
    hurt.runCommand("camerashake add @s 0.2 0.7")
    hurt.addEffect("regeneration", 300, { amplifier: 1 })
    hurt.addEffect("resistance", 30, { amplifier: 5 })
    if (hp.currentValue / 2 < 5) {
      hp.setCurrentValue(5)
    } else {
      hp.setCurrentValue(hp.currentValue / 2)
    }
    for (let i = 0; i < 10; i++) {
      system.runTimeout(() => {
        if (soulScore.getScore(hurt) > 0) {
          soulScore.addScore(hurt, -1)
          hurt.onScreenDisplay.setActionBar(`§s${soulScore.getScore(hurt)}§s ソウル `)
        }
      }, i)
    }

    system.runTimeout(() => {
      hurt.onScreenDisplay.setActionBar(`§b${soulScore.getScore(hurt)}§s ソウル `)
    }, 11)
  })
})
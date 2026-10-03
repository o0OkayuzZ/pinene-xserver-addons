import {
  system
} from "@minecraft/server";
import { isWearingSet, isWearingMysteryArmour } from "components/armour.js"

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent("dungeons:artefact_cooldown", {
    onUse(e) {
      const player = e.source;
      const item = e.itemStack;
      usedArtefact(player, item, false)
      if(player.hasTag("adv:survival_skills_active")) {
        player.removeTag("adv:survival_skills_active")
      }
    }
  })
})

export function getCooldownMult(player) {
  var mult = 1;
  if (isWearingSet(player, "dungeons:evocation_robes")) {
    mult = mult * 0.7;
  }

  if (isWearingSet(player, "dungeons:guard_armour")) {
    mult = mult * 0.8;
  }

  if (isWearingSet(player, "dungeons:battle_robes")) {
    mult = mult * 0.8;
  }

  if (isWearingSet(player, "dungeons:cool_down")) {
    mult = mult * 0.8;
  }

  if (isWearingMysteryArmour(player, "artefact_cooldown")) {
    mult = mult * 0.75;
  }

  if (isWearingMysteryArmour(player, "artefact_slow")) {
    mult = mult * 1.3;
  }

  if (isWearingSet(player, "dungeons:reinforced_mail")) {
    mult = mult * 1.3;
  }

  const totemCasting = player.dimension.getEntities({
    location: player.location,
    maxDistance: 5,
    families: ['totem_casting']
  });

  if (totemCasting.length == 1) {
    mult = mult * 0.3;
  } else if (totemCasting.length > 1) {
    mult = mult * (1 / (totemCasting.length * 2.5))
  }

  if (mult < 0.1) {
    mult = 0.1;
  }


  return mult;
}

export function usedArtefact(player, item, finalShout) {
  let cd = item.getComponent('cooldown');
  var mult = getCooldownMult(player);

  if (!item.hasTag('dungeons:tome_of_duplication')) {
    for (const tag of player.getTags()) {
      if (tag.substring(0, 9) === 'tod:used_') {
        player.removeTag(tag)
      }
    }
    var tagId = item.typeId.replace("dungeons:rare_", "tod:used_")
    tagId = tagId.replace("dungeons:", "tod:used_")
    player.addTag(tagId);
  }

  system.runTimeout(() => {
    if (item.getComponent("cooldown").getCooldownTicksRemaining(player) >= 100) {
      player.addTag("dungeons:artefact_synergy")
      player.addTag("dungeons:artefact_charge")
      if (isWearingSet(player, "dungeons:health_synergy")) {
        const hp = player.getComponent("health");
        if (hp.effectiveMax > hp.currentValue) {
          var setTo = hp.currentValue + hp.effectiveMax / 20
          if (setTo > hp.effectiveMax) setTo = hp.effectiveMax
          hp.setCurrentValue(setTo)
          player.dimension.spawnParticle("dungeons:explorer", player.location)
          player.dimension.spawnParticle("dungeons:explorer", player.location)
          player.dimension.spawnParticle("dungeons:explorer", player.location)
        }
      }
      if (isWearingSet(player, "dungeons:speed_synergy")) {
        const speed = player.getEffect("speed");
        if (!speed) {
          const dim = player.dimension
          const loc = player.location
          dim.spawnParticle('dungeons:swiftness', loc)
          dim.playSound("artefact.swiftness_boot.use", loc, { pitch: 1.5 })
          player.addEffect("speed", 100, { amplifier: 1 })
        }
      }
    }
  }, 5)

  player.startItemCooldown(cd.cooldownCategory, Math.floor(cd.cooldownTicks * mult));
  if (finalShout) player.runCommand("scriptevent dungeons:force_artefact " + item.typeId)

  if (player.hasTag('dungeons:debug')) {
    player.sendMessage([{ text: "使用したアイテム: " }, { translate: item.localizationKey }]);
    player.sendMessage(`待機時間: §e${cd.cooldownTicks / 20}s`);
    if (mult !== 1) {
      player.sendMessage(`補正後の待機時間:§e${Math.floor(cd.cooldownTicks * mult) / 20}s`);
      player.sendMessage(`待機時間の倍率:§b${mult}x`);
    }
  }
}
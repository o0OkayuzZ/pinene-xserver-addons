import {
  system
} from "@minecraft/server";
import { isWearingSet } from "components/armour.js"

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent("dungeons:artefact_cooldown", {
    onUse(e) {
      const player = e.source;
      const item = e.itemStack;
      let cd = item.getComponent('cooldown');
      var mult = 1;

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

      if (isWearingSet(player, "dungeons:evocation_robes")) {
        mult = mult * 0.7;
      }

      if (isWearingSet(player, "dungeons:guard_armour")) {
        mult = mult * 0.8;
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

      player.startItemCooldown(cd.cooldownCategory, Math.floor(cd.cooldownTicks * mult));



      if (player.hasTag('dungeons:debug')) {
        player.sendMessage([{ text: "使用したアイテム: " }, { translate: item.localizationKey }]);
        player.sendMessage(`待ち時間:§e${cd.cooldownTicks / 20}s`);
        if (mult !== 1) {
          player.sendMessage(`補正後の待ち時間:§e${Math.floor(cd.cooldownTicks * mult) / 20}s`);
          player.sendMessage(`待ち時間の倍率:§b${mult}x`);
        }
      }
    }
  })
})
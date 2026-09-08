import {
  system
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:tome_of_duplication', {
    onUse(e) {
      const player = e.source;
      const item = e.itemStack;
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
      player.sendMessage([{ text: "§7§o" }, { translate: "dungeons.warn.no_artefact_to_copy" }])
      let cd = item.getComponent('cooldown');
      player.startItemCooldown(cd.cooldownCategory, 10);
    }
  });

});
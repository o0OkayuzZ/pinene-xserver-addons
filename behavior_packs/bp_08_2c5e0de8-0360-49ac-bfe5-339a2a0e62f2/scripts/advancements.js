import { world, system, ItemTypes } from "@minecraft/server";

var advancementsEnabled = false
system.run(() => {
  for(const type of ItemTypes.getAll()) if (type.id == "adv:alyadvancementsareon") advancementsEnabled = true
})
export {advancementsEnabled}

export function grantAdvancement(player, advancement) {
  if(player.isValid) player.runCommand(`scriptevent alylicasadvancements:grant ${advancement}`)
}

world.afterEvents.playerSpawn.subscribe((e) => {
  let player = e.player;
  if (e.initialSpawn === false) return;
  system.runTimeout(() => {
    player.addTag("aly:dungeons_enabled");
  }, 10);
  // Aly advancements compatibility
});

import "advancements/iceologersRevenge.js";
import "advancements/bossKill.js";
import "advancements/metalToMetal.js";
import "advancements/speedOfTheWind.js";
import "advancements/strongestWeapon.js";
import "advancements/thePerfectRun.js";
import "advancements/treason.js";
import "advancements/unknownAllegiance.js";
import "advancements/theHuntIsOn.js";
import "advancements/ancientKill.js";
import "advancements/dimensionHopper.js";
import "advancements/goldRush.js";
import "advancements/thatsAllFolks.js";
import "advancements/tasteOfYourOwnMedicine.js";
import "advancements/goneFishin.js";
import "advancements/neverBackDown.js";
import "advancements/survivalSkills.js";
import "advancements/doYourThingCuz.js";
import "advancements/bangBangBang.js";
import "advancements/bigGameHunter.js";
import "advancements/fullPower.js";
import "advancements/leadTheWay.js";
import "advancements/trialTotem.js";
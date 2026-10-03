

//boss
import "./entityBehaviour/redstoneMonstrosity.js";
import "./entityBehaviour/namelessOne.js";
import "./entityBehaviour/mooshroomMonstrosity.js";
import "./entityBehaviour/wretchedWraith.js";
import "./entityBehaviour/corruptedCauldron.js";
import "./entityBehaviour/jungleAbomination.js";
import "./entityBehaviour/spookyMonstrosity.js";
import "./entityBehaviour/tempestGolem.js";
import "./entityBehaviour/ancientGuardian.js";
import "./entityBehaviour/hoveringInferno.js";
import "./entityBehaviour/vengefulHeartofEnder.js";
import "./entityBehaviour/obsidianMonstrosity.js";
import "./entityBehaviour/archIllager.js";
import "./entityBehaviour/heartOfEnder.js";
//miniboss
import "./entityBehaviour/illusioner.js";
import "./entityBehaviour/endersent.js";
//monster
import "./entityBehaviour/wraith.js";
import "./entityBehaviour/necromancer.js";
import "./entityBehaviour/enchanter.js";
import "./entityBehaviour/snareling.js";
import "./entityBehaviour/watchling.js";
import "./entityBehaviour/blastling.js";
import "./entityBehaviour/icyCreeper.js";
import "./entityBehaviour/geomancer.js";
import "./entityBehaviour/mobSpawner.js";
import "./entityBehaviour/poisonQuillVine.js";
import "./entityBehaviour/enderDragon.js";
import "./entityBehaviour/mountaineer.js";
import "./entityBehaviour/towerGuard.js";
import "./entityBehaviour/tropicalSlime.js";
import "./entityBehaviour/iceologer.js";
import "./entityBehaviour/towerWraith.js";

//other
import "./entityBehaviour/targetDummy.js";
import "./entityBehaviour/enchantedSheep.js";
import "./entityBehaviour/tempestGolemTotem.js";
import "./entityBehaviour/raidMob.js";
import "./entityBehaviour/keyGolem.js";
import "./entityBehaviour/piglinMerchant.js";
import "./entityBehaviour/spookiness.js";


//enchanted
import "./entityBehaviour/enchantedMobs.js";
import "./entityBehaviour/ancientMobs.js";


import { world } from "@minecraft/server";

world.afterEvents.entityHurt.subscribe((e) => {
    const entity = e.hurtEntity;
    if(entity.isValid && entity.matches({families:["cannot_be_killed"],excludeTags:["dungeons:ignore_cannot_kill"]})) e.cancel = true
})
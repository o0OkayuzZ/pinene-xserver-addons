import { world } from "@minecraft/server";
import { advancementsEnabled, grantAdvancement } from "advancements.js"


const monsterHunterTargets = [
    "adv:killed_abominable_weaver",
    "adv:killed_grim_guardian",
    "adv:killed_oozing_menace",
    "adv:killed_ancient_mooshroom",
    "adv:killed_first_enchanter",
    "adv:killed_scuttling_torment",
    "adv:killed_the_unending",
    "adv:killed_solemn_giant",
    "adv:killed_thundering_growth",
    "adv:killed_unbreakable_one",
    "adv:killed_seeking_flame",
    "adv:killed_windbeard",
    "adv:killed_unstoppable_tusk",
    "adv:killed_cursed_presence",
    "adv:killed_watcher_of_the_end",
    "adv:killed_barrage",
    "adv:killed_abyssal_eye",
    "adv:killed_the_tiny_scourge",
    "adv:killed_the_tower",
    "adv:killed_pestilent_conjurer",
    "adv:killed_vigilant_scoundrel",
    "adv:killed_ancient_terror",
    "adv:killed_vengeful_mariner",
    "adv:killed_frostwarden",
    "adv:killed_haunted_caller",
    "adv:killed_the_swarm"
]

world.afterEvents.entityDie.subscribe((e) => {
    const dead = e.deadEntity;
    if(!dead || !dead.isValid) return;
    if(!dead.matches({families:["ancient", "boss"]})) return;
    const attacker = e.damageSource.damagingEntity;
    if(!attacker || !attacker.isValid || attacker.typeId !== "minecraft:player") return;
    if(!advancementsEnabled) return;
    if(attacker.hasTag("adv:dungeons:ancient_hunter") == false) grantAdvancement(attacker, "dungeons:ancient_hunter")
    if(attacker.hasTag("adv:dungeons:ancients_hunted") == false) {
        const deadTag = dead.typeId.replace("dungeons:","adv:killed_")
        attacker.addTag(deadTag)
        for(const tag of monsterHunterTargets) if(attacker.hasTag(tag) == false) return;
        grantAdvancement(attacker, "dungeons:ancients_hunted")
    }
})
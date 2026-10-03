import { system, world } from "@minecraft/server";
import { advancementsEnabled, grantAdvancement } from "advancements.js"


const monsterHunterTargets = [
    "dungeons:abominable_weaver",
    "dungeons:grim_guardian",
    "dungeons:oozing_menace",
    "dungeons:ancient_mooshroom",
    "dungeons:first_enchanter",
    "dungeons:scuttling_torment",
    "dungeons:the_unending",
    "dungeons:solemn_giant",
    "dungeons:thundering_growth",
    "dungeons:unbreakable_one",
    "dungeons:seeking_flame",
    "dungeons:windbeard",
    "dungeons:unstoppable_tusk",
    "dungeons:cursed_presence",
    "dungeons:watcher_of_the_end",
    "dungeons:barrage",
    "dungeons:abyssal_eye",
    "dungeons:the_tiny_scourge",
    "dungeons:the_tower",
    "dungeons:pestilent_conjurer",
    "dungeons:vigilant_scoundrel",
    "dungeons:ancient_terror",
    "dungeons:vengeful_mariner",
    "dungeons:frostwarden",
    "dungeons:haunted_caller",
    "dungeons:the_swarm",
    "dungeons:jungle_abomination",
    "dungeons:enchanted_icy_creeper",
    "dungeons:nameless_one",
    "dungeons:enchanted_vanguard",
    "dungeons:wavewhisperer",
    "dungeons:redstone_monstrosity",
    "dungeons:enchanted_skeleton",
    "dungeons:enchanted_zombie",
    "dungeons:enchanted_parched",
    "dungeons:blastling",
    "dungeons:mooshroom_monstrosity",
    "dungeons:boss_wildfire",
    "dungeons:corrupted_cauldron",
    "dungeons:enchanted_vindicator",
    "dungeons:mountaineer",
    "dungeons:poison_quill_vine",
    "dungeons:vindicator_chef",
    "dungeons:tempest_golem",
    "dungeons:heart_of_ender",
    "dungeons:cauldron_slime",
    "dungeons:vengeful_heart_of_ender",
    "dungeons:enchanted_blaze",
    "dungeons:blight_eye",
    "dungeons:redstone_cube",
    "dungeons:arch_illager",
    "dungeons:ravenous_eye",
    "dungeons:zombified_piglin_brute",
    "dungeons:leapleaf",
    "dungeons:wildfire",
    "dungeons:vanguard",
    "dungeons:piglin_fungus_thrower",
    "dungeons:savage_eye",
    "dungeons:squall_golem",
    "dungeons:wretched_wraith",
    "dungeons:snareling",
    "dungeons:endersent",
    "dungeons:necromancer",
    "dungeons:enchanted_necromancer",
    "dungeons:geomancer",
    "dungeons:zombified_piglin_fungus_thrower",
    "dungeons:enchanted_witch",
    "dungeons:wraith",
    "dungeons:enchanted_jungle_zombie",
    "dungeons:windcaller",
    "dungeons:enchanted_enderman",
    "dungeons:sunken_skeleton",
    "dungeons:enchanted_creeper",
    "dungeons:enchanted_royal_guard",
    "dungeons:tower_guard",
    "dungeons:drowned_necromancer",
    "dungeons:tower_wraith",
    "dungeons:tropical_slime",
    "dungeons:watchling",
    "dungeons:whisperer",
    "dungeons:enchanted_frozen_zombie",
    "dungeons:iceologer",
    "dungeons:icy_creeper",
    "dungeons:jungle_zombie",
    "dungeons:illusioner",
    "dungeons:enchanted_blastling",
    "dungeons:redstone_golem",
    "dungeons:poison_anemone",
    "dungeons:royal_guard",
    "dungeons:frozen_zombie",
    "dungeons:enchanter",
    "dungeons:enchanted_spider",
    "dungeons:enchanted_husk",
    "dungeons:enchanted_cave_spider",
    "dungeons:enchanted_watchling",
    "dungeons:obsidian_monstrosity",
    "dungeons:binding_eye",
    "dungeons:ancient_guardian",
    "dungeons:spiked_eye",
    "dungeons:reaping_eye",
    "dungeons:enchanted_sunken_skeleton",
    "dungeons:enchanted_wither_skeleton",
    "dungeons:enchanted_stray",
    "dungeons:enchanted_silverfish",
    "dungeons:enchanted_pillager",
    "dungeons:enchanted_endermite",
    "dungeons:enchanted_drowned",
    "dungeons:enchanted_bogged",
    "dungeons:enchanted_wraith",
    "dungeons:enchanted_snareling",
    "dungeons:enchanted_mountaineer",
    "dungeons:enchanted_iceologer",
    "dungeons:ancient_hunt_mooshroom",
    "dungeons:enchanted_ancient_hunt_mooshroom"
]

const bigGameTags = []
for(const mob of monsterHunterTargets) bigGameTags.push(mob.replace("dungeons:","adv:killed_"))

world.afterEvents.entityDie.subscribe((e) => {
    const dead = e.deadEntity;
    if(!dead || !dead.isValid) return;
    var deadId = dead.typeId;
    if(dead.typeId == "dungeons:enchanted_ancient_hunt_silverfish") deadId = "dungeons:enchanted_silverfish"
    if(dead.typeId == "dungeons:angry_mooshroom") deadId = "dungeons:ancient_hunt_mooshroom"
    if(!monsterHunterTargets.includes(deadId)) return;
    const attacker = e.damageSource.damagingEntity;
    if(!attacker || !attacker.isValid || attacker.typeId !== "minecraft:player") return;
    if(!advancementsEnabled) return;
    if(attacker.hasTag("adv:dungeons:big_game_hunter") == false) {
        const deadTag = deadId.replace("dungeons:","adv:killed_")
        attacker.addTag(deadTag)
        for(const tag of bigGameTags) if(attacker.hasTag(tag) == false) return;
        grantAdvancement(attacker, "dungeons:big_game_hunter")
    }

})

world.afterEvents.entitySpawn.subscribe((e) => {
    if(!advancementsEnabled) return
    const entity = e.entity;
    if (entity.typeId == "dungeons:arch_illager_death_animation") {
        for (const player of entity.dimension.getPlayers({ maxDistance: 32, location: entity.location, excludeGameModes: ["Spectator"] })) {
            const deadId = "dungeons:arch_illager"
            if(!monsterHunterTargets.includes(deadId)) return;
            if(player.hasTag("adv:dungeons:big_game_hunter") == false) {
                const deadTag = "dungeons:arch_illager".replace("dungeons:","adv:killed_")
                player.addTag(deadTag)
                for(const tag of monsterHunterTargets) if(player.hasTag(tag) == false) return;
                grantAdvancement(player, "dungeons:big_game_hunter")
            }
        }
    }
})
import { world } from "@minecraft/server";
import { advancementsEnabled, grantAdvancement } from "advancements.js"

world.afterEvents.entityDie.subscribe((e) => {
    if(!advancementsEnabled) return;
    const damager = e.damageSource.damagingEntity;
    if (!damager) return;
    if (!damager.isValid) return;
    if (damager.typeId !== "minecraft:player") return;
    if (!damager.hasTag("aly:dungeons_enabled")) return;
    const hurt = e.deadEntity
    if (!hurt) return;
    if (!hurt.isValid) return;
    for (const advancement of advancementData) {
        if (advancement.bosses.includes(hurt.typeId)) {
            grantAdvancement(damager, advancement.id)
        }
    }
})

const advancementData = [
    {
        id: "dungeons:dungeon_crawler",
        bosses: ["dungeons:redstone_monstrosity"]
    },
    {
        id: "dungeons:goodnight_gramps",
        bosses: ["dungeons:nameless_one"]
    },
    {
        id: "dungeons:fungal_feud",
        bosses: ["dungeons:mooshroom_monstrosity"]
    },
    {
        id: "dungeons:let_it_go",
        bosses: ["dungeons:wretched_wraith"]
    },
    {
        id: "dungeons:you_cooked",
        bosses: ["dungeons:corrupted_cauldron"]
    },
    {
        id: "dungeons:tree_feller",
        bosses: ["dungeons:jungle_abomination"]
    },
    {
        id: "dungeons:titan_killer",
        bosses: ["dungeons:tempest_golem"]
    },
    {
        id: "dungeons:thalassophobia",
        bosses: ["dungeons:ancient_guardian"]
    },
    {
        id: "dungeons:firefighter",
        bosses: ["dungeons:boss_wildfire"]
    },
    {
        id: "dungeons:eye_for_an_eye",
        bosses: [
            "dungeons:spiked_eye",
            "dungeons:savage_eye",
            "dungeons:binding_eye",
            "dungeons:blight_eye",
            "dungeons:reaping_eye",
            "dungeons:ravenous_eye"
        ]
    },
    {
        id: "dungeons:heartbreaking",
        bosses: ["dungeons:vengeful_heart_of_ender"]
    },
    {
        id: "dungeons:the_bigger_they_are",
        bosses: ["dungeons:obsidian_monstrosity"]
    },
    {
        id: "dungeons:domination",
        bosses: ["dungeons:heart_of_ender"]
    }
]
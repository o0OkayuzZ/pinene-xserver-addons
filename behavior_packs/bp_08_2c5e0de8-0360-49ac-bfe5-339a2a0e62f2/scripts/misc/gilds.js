

const meleeGilds = [
    "ambush",
    "anima_conduit",
    "artefact_synergy",
    "busy_bee",
    "chains",
    "committed",
    "critical_hit",
    "echo",
    "enigma_resonator",
    "exploding",
    "freezing",
    "guarding_strike",
    "gravity",
    "illagers_bane",
    "leeching",
    "looting",
    "pain_cycle",
    "poison_cloud",
    "prospector",
    "radiance",
    "rampaging",
    "refreshment",
    "sharpened",
    "shockwave",
    "smiting",
    "soul_siphon",
    "stunning",
    "swirling",
    "thundering",
    "unchanting",
    "void_strike",
    "weakening",
]

const armourGilds = [
    "bag_o_souls",
    "beast_boss",
    "beast_surge",
    "burning",
    "chilling",
    "cool_down",
    "cowardice",
    "explorer",
    "final_shout",
    "fire_focus",
    "fire_trail",
    "food_reserves",
    "frenzied",
    "gravity_pulse",
    "health_synergy",
    "lightning_focus",
    "lucky_explorer",
    "luck_of_the_sea",
    "poison_focus",
    "potion_barrier",
    "prospector",
    "protection",
    "reckless",
    "rush",
    "shadow_blast",
    "shadow_surge",
    "snowball",
    "soul_focus",
    "soul_speed",
    "speed_synergy",
    "thorns"
]

const rangedGilds = [
    "artefact_charge",
    "chain_reaction",
    "critical_hit_ranged",
    "cooldown_shot",
    "enigma_resonator_ranged",
    "fuse_shot",
    "gravity_ranged",
    "growing",
    "poison_cloud_ranged",
    "power",
    "radiance_ranged",
    "ricochet",
    "shockweb",
    "supercharge",
    "tempo_theft",
    "unchanting_ranged",
    "void_strike_ranged"
]

export { meleeGilds, rangedGilds, armourGilds }

export function canHave(item) {
    if (item.hasTag("minecraft:is_armor")) return "armor"
    if (item.hasTag("dungeons:bow")) return "ranged"
    if (item.hasTag("dungeons:crossbow")) return "ranged"
    if (item.hasTag("minecraft:is_sword")) return "melee"
    if (item.hasTag("minecraft:is_axe")) return "melee"
    if (item.hasTag("minecraft:is_spear")) return "melee"
    if (item.hasTag("dungeons:gild_melee")) return "melee"
    if (item.hasTag("dungeons:gild_ranged")) return "ranged"
    if (item.hasTag("dungeons:gild_armor")) return "armor"
    return undefined
}
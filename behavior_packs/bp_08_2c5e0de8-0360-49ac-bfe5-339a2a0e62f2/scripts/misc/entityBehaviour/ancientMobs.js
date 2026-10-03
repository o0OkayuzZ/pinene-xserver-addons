import {
    world,
    system,
    DimensionTypes,
    MolangVariableMap,
    ItemStack
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"

/* Enchanted Mob Rules (for the entity file)
    - 2x Health
    - "enchanted" mob family
    - 1.1x scale
    - + 0.2 knockback resistance
*/
/* ANCIENT Mob Rules (for the entity file)
    - All above rules, then after that, apply
    - 10x Health
    - "ancient" mob family
    - "boss" mob family
    - 1.3x scale (instead of 1.1x)
    - + 0.3 knockback resistance
    - Flat 100 exp
    - Remove "in the way" AI such as baby zombies or picking up items
    - Remove despawn potential
    - Unable to target monsters
*/
// Ancient minions also need to be unable to target mobs and never drop loot, as well as add families

const ancientData = [
    {
        id: "grim_guardian",
        enchants: ["quick", "protection", "radiance", "echo"],
        minions: ["heal_allies"]
    },
    {
        id: "abominable_weaver",
        enchants: ["frenzied", "resurrection_aura", "regeneration"],
        minions: ["quick"]
    },
    {
        id: "oozing_menace",
        enchants: ["huge", "poison_cloud", "gravity_pulse"],
        minions: ["shockwave"]
    },
    {
        id: "ancient_mooshroom",
        enchants: ["deflect", "poison_cloud", "leeching", "thorns", "quick", "double_damage"],
        minions: ["weakening"]
    },
    {
        id: "first_enchanter",
        enchants: ["freezing", "critical_hit", "echo", "mob_summon_aura"],
        minions: ["swirling"]
    },
    {
        id: "scuttling_torment",
        enchants: ["cowardice", "fire_trail", "regeneration"],
        minions: ["growing"]
    },
    {
        id: "the_unending",
        enchants: ["burning", "chilling", "heal_allies"],
        minions: ["fire_aspect", "freezing"]
    },
    {
        id: "solemn_giant",
        enchants: ["multishot", "huge", "radiance"],
        minions: ["radiance"]
    },
    {
        id: "thundering_growth",
        enchants: ["deflect", "electrified", "shockwave"],
        minions: ["electrified"]
    },
    {
        id: "unbreakable_one",
        enchants: ["committed", "electrified", "frenzied", "swirling"],
        minions: ["regeneration"]
    },
    {
        id: "seeking_flame",
        enchants: ["huge", "burning", "fire_aspect", "fire_trail"],
        minions: ["chilling"]
    },
    {
        id: "windbeard",
        enchants: ["double_damage", "quick", "regeneration", "fire_trail", "burning"],
        minions: ["regeneration"]
    },
    {
        id: "unstoppable_tusk",
        enchants: ["poison_cloud", "quick", "rampaging", "fire_trail"],
        minions: ["fuse_shot"]
    },
    {
        id: "cursed_presence",
        enchants: ["poison_cloud", "chilling", "gravity_pulse"],
        minions: ["burning"]
    },
    {
        id: "watcher_of_the_end",
        enchants: ["echo", "deflect", "heal_allies"],
        minions: ["radiance"]
    },
    {
        id: "barrage",
        enchants: ["accelerate", "rapid_fire", "multishot", "critical_hit"],
        minions: ["accelerate"]
    },
    {
        id: "abyssal_eye",
        enchants: ["heal_allies", "quick", "frenzied", "electrified"],
        minions: ["double_damage"]
    },
    {
        id: "the_tiny_scourge",
        enchants: ["quick", "fire_aspect", "frenzied", "thorns"],
        minions: ["weakening"]
    },
    {
        id: "the_tower",
        enchants: ["committed", "critical_hit", "thorns"],
        minions: ["electrified"]
    },
    {
        id: "pestilent_conjurer",
        enchants: ["heal_allies", "quick", "frenzied", "deflect"],
        minions: ["multishot"]
    },
    {
        id: "vigilant_scoundrel",
        enchants: ["sharpness", "freezing", "electrified"],
        minions: ["poison_cloud", "tempo_theft"]
    },
    {
        id: "ancient_terror",
        enchants: ["fire_trail", "chilling", "electrified", "burning"],
        minions: ["weakening", "fire_aspect"]
    },
    {
        id: "vengeful_mariner",
        enchants: ["critical_hit", "deflect", "rapid_fire", "gravity_pulse"],
        minions: ["regeneration"]
    },
    {
        id: "frostwarden",
        enchants: ["chilling", "deflect"],
        minions: ["thorns"]
    },
    {
        id: "the_swarm",
        enchants: ["multishot", "gravity_pulse", "resurrection_aura"],
        minions: ["thorns"]
    },
    {
        id: "haunted_caller",
        enchants: ["accelerate", "fire_trail", "gravity_pulse", "rapid_fire"],
        minions: ["cowardice"]
    }
]


//attack boost
world.beforeEvents.entityHurt.subscribe((e) => {
    const damageSource = e.damageSource.damagingEntity;
    if (!damageSource) return;
    if (e.damageSource.cause == "override") return;
    if (damageSource.matches({ families: ["ancient"] })) {
        const cause = e.damageSource.cause
        if (cause == "lightning") return;
        e.damage = e.damage * 2
    }

});

//particles
system.runInterval(() => {
    const dims = []
    for (const player of world.getPlayers()) if (!dims.includes(player.dimension.id)) dims.push(player.dimension.id)
    for (const dimensionType of dims) {
        const dim = world.getDimension(dimensionType)
        for (const entity of dim.getEntities({ families: ["ancient"] })) {
            if (dim.isChunkLoaded(entity.location)) {
                if (entity.getEffect("invisibility")) continue;
                var enchantCount = 1
                if (entity.getDynamicProperty("dungeons:enchant_count") !== undefined) enchantCount = entity.getDynamicProperty("dungeons:enchant_count")
                const box = entity.getAABB()
                const h = Math.round(box.extent.y * 100) / 50
                const w = Math.round(box.extent.x * 100) / 50
                var map = new MolangVariableMap()

                map.setFloat("variable.radius", w)
                map.setFloat("variable.height", h)
                for (let i = 0; i < Math.ceil(enchantCount / 2); i++) {
                    if (world.getAbsoluteTime() % 4 == 0) dim.spawnParticle("dungeons:ancient_enchanted_sparks", entity.location, map)
                    dim.spawnParticle("dungeons:ancient_enchanted_smoke", entity.location)
                }
            }
        }
        for (const entity of dim.getEntities({ families: ["ancient_rider"] })) {
            if (dim.isChunkLoaded(entity.location)) {
                if (entity.getEffect("invisibility")) continue;
                var enchantCount = 1
                if (entity.getDynamicProperty("dungeons:enchant_count") !== undefined) enchantCount = entity.getDynamicProperty("dungeons:enchant_count")
                const box = entity.getAABB()
                const h = Math.round(box.extent.y * 100) / 50
                const w = Math.round(box.extent.x * 100) / 50
                var map = new MolangVariableMap()

                map.setFloat("variable.radius", w)
                map.setFloat("variable.height", h)
                for (let i = 0; i < Math.ceil(enchantCount / 2); i++) {
                    if (world.getAbsoluteTime() % 4 == 0) dim.spawnParticle("dungeons:ancient_enchanted_sparks", entity.location, map)
                    dim.spawnParticle("dungeons:ancient_enchanted_smoke", entity.location)
                }
            }
        }
        for (const entity of dim.getEntities({ families: ["ancient_minion"], excludeFamilies: ["ancient_rider"] })) {
            if (dim.isChunkLoaded(entity.location)) {
                if (entity.getEffect("invisibility")) continue;
                var enchantCount = 1
                if (entity.getDynamicProperty("dungeons:enchant_count") !== undefined) enchantCount = entity.getDynamicProperty("dungeons:enchant_count")
                const box = entity.getAABB()
                const h = Math.round(box.extent.y * 100) / 50
                const w = Math.round(box.extent.x * 100) / 50
                var map = new MolangVariableMap()

                map.setFloat("variable.radius", w)
                map.setFloat("variable.height", h)
                for (let i = 0; i < Math.ceil(enchantCount / 2); i++) {
                    if (world.getAbsoluteTime() % 4 == 0) dim.spawnParticle("dungeons:ancient_minion_enchanted_sparks", entity.location, map)
                    dim.spawnParticle("dungeons:ancient_minion_enchanted_smoke", entity.location)
                }
            }
        }
    }
})
//set enchant
world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    if (!entity.isValid) return;
    if (!entity.matches({ families: ["ancient"] }) && !entity.matches({ families: ["ancient_minion"] })) return;
    var enchantsApply = []
    const searchId = entity.typeId.replace("dungeons:","").replace("_minion","").replace("_rider","")
    const data = ancientData.find(item => item.id === searchId);
    if(!data) {
        if (!entity.typeId.includes("_minion")) console.warn("No data found for ancient mob: " + searchId)
        return;
    }
    if(entity.matches({ families: ["ancient_minion"], excludeFamilies: ["ancient_rider"] })) {
        enchantsApply = data.minions
    } else if(entity.matches({ families: ["ancient"] })){
        enchantsApply = data.enchants
    } else if(entity.matches({ families: ["ancient_rider"] })){
        enchantsApply = data.enchants
    }
    if (enchantsApply.length == 0) return;
    if (enchantsApply.length == 0) return;
    for (const ench of enchantsApply) {
        entity.addTag("dungeons:enchanted_mob_" + ench)
    }
    if (!entity.getDynamicProperty("dungeons:enchant_count")) entity.setDynamicProperty("dungeons:enchant_count", 0)
    entity.setDynamicProperty("dungeons:enchant_count", entity.getDynamicProperty("dungeons:enchant_count") + enchantsApply.length)
})

//origin
world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    if (!entity.isValid) return;
    if (!entity.matches({ families: ["ancient"] }) && !entity.matches({ families: ["ancient_minion"] })) return;
    entity.setDynamicProperty("dungeons:ancient_originloc", entity.location)
    entity.setDynamicProperty("dungeons:ancient_origindim", entity.dimension.id)
})


//dead
world.afterEvents.entityDie.subscribe((e) => {
    const dead = e.deadEntity;
    if (!dead || !dead.isValid) return;
    if (dead.matches({ families: ["ancient", "boss"] }) == false) return;
    var deadTag = undefined
    for (const tag of dead.getTags()) if (tag.includes("dungeons:spawned_at_")) deadTag = tag
    if (!deadTag) return
    const types = [
        dead.typeId + "_minion",
        dead.typeId + "_rider",
        dead.typeId + "_minion_rider"
    ]
    for(const type of types) {
        for (const minion of dead.dimension.getEntities({
            maxDistance: 128,
            location: dead.location,
            type: type,
            tags: [deadTag]
        })) {
            if(minion.typeId == "dungeons:seeking_flame_minion") {
                for(const vex of minion.dimension.getEntities({type: "minecraft:vex", location: minion.location, maxDistance: 32})) if(vex.isValid) vex.remove()
            }
            minion.remove()
        }
    }
})

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    const attacker = e.damageSource.damagingEntity;
    if (!hurt || !attacker || !hurt.isValid) return;
    if (!hurt.matches({ families: ["ancient"] }) && !hurt.matches({ families: ["ancient_minion"] })) return;
    if (attacker.typeId == "dungeons:abominable_weaver_minion") {
        e.cancel = true;
        e.damage = 0
        if (hurt.matches({ families: ["creeper"] })) {
            system.run(() => {
                hurt.triggerEvent("minecraft:stop_exploding")
            })
        }
        return;
    }
    if (!attacker.isValid) return;
    if (!attacker.matches({ families: ["ancient"] }) && !attacker.matches({ families: ["ancient_minion"] })) return;
    e.cancel = true;
})


//loot drops

import { meleeGilds, armourGilds, rangedGilds } from "misc/gilds.js"

world.afterEvents.entityDie.subscribe((e) => {
    const dead = e.deadEntity;
    if (world.gameRules.doEntityDrops == false) return;
    if (!dead || !dead.isValid || !dead.matches({ families: ["ancient", "boss"] })) return;
    const dim = dead.dimension;
    const loc = dead.location
    const lootManager = world.getLootTableManager()
    var lootId = "ancient_hunt/" + dead.typeId.replace("dungeons:", "")
    const lootTable = lootManager.getLootTable(lootId)
    var rerolled = false
    var drops = lootManager.generateLootFromTable(lootTable)
    const attacker = e.damageSource.damagingEntity;
    if (attacker && attacker.typeId == "minecraft:player" && isWearingSet(attacker, "dungeons:luck_of_the_sea")) {

        var hasUnique = false
        for (let drop of drops) {
            if (drop.hasTag("dungeons:unique_item")) hasUnique = true
        }
        if (!hasUnique) {
            drops = lootManager.generateLootFromTable(lootManager.getLootTable("ancient_hunt/" + dead.typeId.replace("dungeons:", "")))
            rerolled = true
        }
    }
    var soundId = "ancient_mob.common_loot"
    const items = []
    var gilds = undefined
    var skipGilding = false
    for (const drop of drops) {
        if (drop.hasTag("dungeons:unique_item")) {
            soundId = "ancient_mob.unique_loot"
        } else {
            rerolled = false
        }
        if(drop.typeId == "dungeons:drop_mystery_armour_gilded") {
            items.push(drop)
            skipGilding = true
            continue;
        } 
        if (drop.hasTag("dungeons:bow") || drop.typeId == "minecraft:bow") {
            gilds = rangedGilds
            items.push(drop)
        } else if (drop.hasTag("dungeons:crossbow") || drop.typeId == "minecraft:crossbow") {
            gilds = rangedGilds
            items.push(drop)
        } else if (drop.hasTag("minecraft:is_sword") || drop.hasTag("minecraft:is_spear")) {
            gilds = meleeGilds
            items.push(drop)
        } else if (drop.typeId.includes("helmet")) {
            gilds = armourGilds
            const chest = new ItemStack(drop.typeId.replace("helmet", "chestplate"), 1)
            const legs = new ItemStack(drop.typeId.replace("helmet", "leggings"), 1)
            const boots = new ItemStack(drop.typeId.replace("helmet", "boots"), 1)
            items.push(drop)
            items.push(chest)
            items.push(legs)
            items.push(boots)
        } else {
            console.warn("§c" + drop.typeId + " §eis an invalid drop")
        }
    }
    if (items.length == 0) return;
    if(skipGilding) {
        dim.spawnItem(items[0], loc).applyImpulse({ x: Math.random() * 0.2 - 0.1, y: 0.1, z: Math.random() * 0.2 - 0.1 })
    } else {
        var finalGilds = []
        for (const tgild of gilds) {
            if (!items[0].hasTag("dungeons:" + tgild)) finalGilds.push(tgild)
        }
        var gild = finalGilds[Math.floor(Math.random() * gilds.length)]
        for (const drop of items) {
            var lore = []
            const toughness = drop.getComponent("dungeons:toughness")
            if(toughness) {
                var value = Math.ceil(toughness.customComponentParameters.params.toughness)

                lore.push({rawtext:[{text: `§r§9+${value} `},{translate: "attribute.name.generic.armorResilience"}]})
            }
            if (drop.hasTag("dungeons:melee_lore") || drop.hasTag("dungeons:bow_lore")) {
                lore.push({ translate: drop.typeId.replace("dungeons:", "dungeons.desc.") })
            } else if (drop.hasTag("dungeons:armor_lore")) {
                lore.push({ translate: "dungeons.desc.armour.full_set" }, { translate: drop.typeId.replace("dungeons:", "dungeons.desc.armour.").replace("_boots", "").replace("_chestplate", "").replace("_leggings", "").replace("_helmet", "") })
            }
            if(gild == undefined || gild == "undefined") {
                gild = finalGilds[0]
            }
            lore.push({ rawtext: [{ text: "§g§i§l§d" }, { text: "\n§r" }, { translate: "dungeons.desc.gild." + gild }] })
            drop.setLore(lore)
            for (const propertyId of drop.getDynamicPropertyIds()) {
                if (propertyId.includes("dungeons:gild")) drop.setDynamicProperty(propertyId, null)
            }
            drop.setDynamicProperty("dungeons:gild_" + gild, 1)
            dim.spawnItem(drop, loc).applyImpulse({ x: Math.random() * 0.2 - 0.1, y: 0.1, z: Math.random() * 0.2 - 0.1 })
        }
    }
    if (rerolled) {
        dim.spawnParticle("dungeons:luck_of_the_sea", dead.location)
        dim.playSound("armour.luck_of_the_sea", attacker.location)
    }
    dim.playSound(soundId, loc, { volume: 2 })
})


//the tower specifically


// and the haunted callers minion
world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity
    if(entity.typeId == "dungeons:the_tower_minion") {
        const dim = entity.dimension
        const loc = entity.location
        var taglink = undefined
        for (const tag of entity.getTags()) if (tag.includes("dungeons:spawned_at_")) taglink = tag
        const rider = dim.spawnEntity("dungeons:the_tower_minion_rider", loc)
        if(taglink) rider.addTag(taglink)
        const rideable = entity.getComponent("rideable")
        const startRide = rideable.addRider(rider)
        if(!startRide) rider.remove()        
    } else if(entity.typeId == "dungeons:the_tower") {
        const dim = entity.dimension
        const loc = entity.location
        var taglink = undefined
        for (const tag of entity.getTags()) if (tag.includes("dungeons:spawned_at_")) taglink = tag
        const zombies = []
        for(let i = 0; i < 6; i++) {
            const rider = dim.spawnEntity("dungeons:the_tower_rider", loc)
            if(taglink) rider.addTag(taglink)
            zombies.push(rider)
        }
        const rideable_tower = entity.getComponent("rideable")
        for(let i = 0; i < zombies.length; i++) {
            const rider = zombies[i]
            if(i == 0) {
                const startRide = rideable_tower.addRider(rider)
                if(!startRide) rider.remove()
            } else {
                const prev = zombies[i-1]
                if(!prev.isValid) {
                    rider.remove()
                    continue;
                }
                const rideable_zombie = prev.getComponent("rideable")
                const startRide = rideable_zombie.addRider(rider)
                if(!startRide) rider.remove()
            }
        }
    } else if(entity.typeId == "dungeons:haunted_caller_minion") {
        const dim = entity.dimension
        const loc = entity.location
        var taglink = undefined
        for (const tag of entity.getTags()) if (tag.includes("dungeons:spawned_at_")) taglink = tag
        const rider = dim.spawnEntity("dungeons:haunted_caller_minion_rider", loc)
        if(taglink) rider.addTag(taglink)
        const rideable = entity.getComponent("rideable")
        const startRide = rideable.addRider(rider)
        if(!startRide) rider.remove()        
    }
})
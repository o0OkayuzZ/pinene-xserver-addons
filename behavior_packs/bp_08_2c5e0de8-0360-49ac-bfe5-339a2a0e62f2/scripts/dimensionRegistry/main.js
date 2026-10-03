import {isHuntsEnabled} from "./huntsEnabled.js"
const hunts = isHuntsEnabled
export {hunts}
import { world, system, BlockVolume, ItemStack, LocationWaypoint, BiomeTypes, EntityDamageCause } from "@minecraft/server";
//import { getPlayerColorGrading, getPlayerAtmospherics, getPlayerLighting } from "@minecraft/server-graphics";
import "./portal_lighting.js";
import "./woodlandMansion.js";
import "./mushroomDimension.js";
import "./obsidianPinnacle.js";
import "./corruptJungle.js";
import "./mistyPeak.js";
import "./forgottenCitadel.js";
import "./ominousCastle.js";
import "./pumpkinForest.js";
import "./silentWoods.js";
import "./deepseaMonument.js";
import "./frostedFjord.js";
import "./outerEnd.js";
import "./soulRuins.js";
export const customDimIds = [
    "dungeons:ancientdim_spider_cave",
    "dungeons:ancientdim_ancient_crypt",
    "dungeons:ancientdim_slimy_sewer",
    "dungeons:ancientdim_mushroom_dimension",
    "dungeons:ancientdim_woodland_mansion",
    "dungeons:ancientdim_creepy_stronghold",
    "dungeons:ancientdim_faraway_fortress",
    "dungeons:ancientdim_obsidian_fortress",
    "dungeons:ancientdim_corrupted_jungle",
    "dungeons:ancientdim_lower_forge",
    "dungeons:ancientdim_woodland_prison",
    "dungeons:ancientdim_misty_peak",
    "dungeons:ancientdim_grand_bastion",
    "dungeons:ancientdim_desert_tomb",
    "dungeons:ancientdim_forgotten_citadel",
    "dungeons:ancientdim_ominous_castle",
    "dungeons:ancientdim_deepsea_monument",
    "dungeons:ancientdim_pumpkin_forest",
    "dungeons:ancientdim_silent_woods",
    "dungeons:ancientdim_soggy_cave",
    "dungeons:ancientdim_sanctum_summit",
    "dungeons:ancientdim_cursed_halls",
    "dungeons:ancientdim_coral_cave",
    "dungeons:ancientdim_frosted_fjord",
    "dungeons:ancientdim_soul_ruins",
    "dungeons:ancientdim_outer_end"
]

const doNotDefineViaScript = [
    "dungeons:ancientdim_spider_cave",
    "dungeons:ancientdim_slimy_sewer",
    "dungeons:ancientdim_faraway_fortress",
    "dungeons:ancientdim_corrupted_jungle",
    "dungeons:ancientdim_misty_peak",
    "dungeons:ancientdim_pumpkin_forest",
    "dungeons:ancientdim_silent_woods",
    "dungeons:ancientdim_soggy_cave",
    "dungeons:ancientdim_coral_cave",
    "dungeons:ancientdim_desert_tomb",
    "dungeons:ancientdim_forgotten_citadel",
    "dungeons:ancientdim_outer_end",
    "dungeons:ancientdim_frosted_fjord",
    "dungeons:ancientdim_mushroom_dimension",
    "dungeons:ancientdim_grand_bastion",
    "dungeons:ancientdim_obsidian_fortress",
    "dungeons:ancientdim_woodland_mansion",
    "dungeons:ancientdim_woodland_prison"

]

const openRoof = [
    "dungeons:ancientdim_mushroom_dimension",
    "dungeons:ancientdim_obsidian_fortress",
    "dungeons:ancientdim_corrupted_jungle",
    "dungeons:ancientdim_misty_peak",
    "dungeons:ancientdim_pumpkin_forest",
    "dungeons:ancientdim_silent_woods",
    "dungeons:ancientdim_frosted_fjord",
    "dungeons:ancientdim_outer_end"
]

const hasFog = [
    "dungeons:ancientdim_mushroom_dimension",
    "dungeons:ancientdim_woodland_mansion",
    "dungeons:ancientdim_obsidian_fortress",
    "dungeons:ancientdim_corrupted_jungle",
    "dungeons:ancientdim_misty_peak",
    "dungeons:ancientdim_forgotten_citadel",
    "dungeons:ancientdim_pumpkin_forest",
    "dungeons:ancientdim_silent_woods",
    "dungeons:ancientdim_cursed_halls",
    "dungeons:ancientdim_frosted_fjord",
    "dungeons:ancientdim_outer_end"
]

const hasMusic = [
    "dungeons:ancientdim_spider_cave",
    "dungeons:ancientdim_ancient_crypt",
    "dungeons:ancientdim_slimy_sewer",
    "dungeons:ancientdim_mushroom_dimension",
    "dungeons:ancientdim_woodland_mansion",
    "dungeons:ancientdim_creepy_stronghold",
    "dungeons:ancientdim_faraway_fortress",
    "dungeons:ancientdim_obsidian_fortress",
    "dungeons:ancientdim_corrupted_jungle",
    "dungeons:ancientdim_lower_forge",
    "dungeons:ancientdim_woodland_prison",
    "dungeons:ancientdim_misty_peak",
    "dungeons:ancientdim_grand_bastion",
    "dungeons:ancientdim_desert_tomb",
    "dungeons:ancientdim_ominous_castle",
    "dungeons:ancientdim_deepsea_monument",
    "dungeons:ancientdim_pumpkin_forest",
    "dungeons:ancientdim_silent_woods",
    "dungeons:ancientdim_soggy_cave",
    "dungeons:ancientdim_sanctum_summit",
    "dungeons:ancientdim_cursed_halls",
    "dungeons:ancientdim_coral_cave",
    "dungeons:ancientdim_frosted_fjord",
    "dungeons:ancientdim_soul_ruins",
    "dungeons:ancientdim_outer_end"
]


system.run(() => {
    if (hunts == undefined) hunts = world.getDynamicProperty("dungeons:ancient_hunts_enabled") == false ? false : true
})


system.beforeEvents.startup.subscribe(({ dimensionRegistry }) => {
    if (!hunts) return;
    for (const id of customDimIds) {
        if (doNotDefineViaScript.includes(id)) continue;
        dimensionRegistry.registerCustomDimension(id);
    }
});

system.run(() => {
    const tickingAreaManager = world.tickingAreaManager
    for (const areaId of tickingAreaManager.getAllTickingAreas()) {
        if (customDimIds.includes(areaId.dimension)) tickingAreaManager.remove(areaId.identifier)
    }
})

//portal control

system.runInterval(() => {
    if (!hunts) return;
    for (const player of world.getPlayers({ excludeGameModes: ["Spectator"] })) {
        const dim = player.dimension
        const loc = player.location
        if (dim.isChunkLoaded(loc) == false) continue;
        if (player.hasTag("dungeons:portal_proof")) {
            const block = dim.getBlock(loc)
            if (block.typeId !== "dungeons:ancient_portal") {
                player.removeTag("dungeons:portal_proof")
            }
            continue;
        }
        const block = dim.getBlock(loc)
        if (!block) continue;
        if (block.typeId !== "dungeons:ancient_portal") {
            player.setDynamicProperty("dungeons:ancient_portal_travel_time", 0)
            continue;
        };
        const travelTime = player.getDynamicProperty("dungeons:ancient_portal_travel_time")
        player.addEffect("nausea", 80, { showParticles: false })
        player.dimension.playSound("portal.trigger", player.location, { volume: 0.25 })
        var max = 80
        if (player.getGameMode() == "Creative") max = 2
        if (travelTime < max) {
            player.setDynamicProperty("dungeons:ancient_portal_travel_time", travelTime + 1)
        } else {
            player.addTag("dungeons:portal_proof")
            player.setDynamicProperty("dungeons:ancient_portal_travel_time", 0)
            if (customDimIds.includes(player.dimension.id)) {
                const findMarker = dim.getEntities({ location: loc, type: "dungeons:ancient_hunt_marker", closest: 1, maxDistance: 190 })
                const findExitMarker = dim.getEntities({ location: loc, type: "dungeons:ancient_hunt_exit_portal_marker", closest: 1, maxDistance: 5 })
                var gift = false
                if(findExitMarker.length == 0) {
                    dim.spawnEntity("dungeons:ancient_hunt_exit_portal_marker", loc)
                    gift = dim.getPlayers({maxDistance: 190, location: loc}).length + 4
                }
                player.playSound("ancient_hunt.exit")
                if (findMarker.length > 0 && !findMarker[0].hasTag("dungeons:registered_ending")) closeAncientHunt(player, findMarker[0])
                returnDimension(player, true, gift)
            } else {
                var target = block.permutation.getState("dungeons:target")
                if(target == "empty") target = block.permutation.getState("dungeons:target2")
                if(target == "empty") target = "spider_cave"
                enterAncientDimension(player, "dungeons:ancientdim_" + target, block)
            }
        }
    }
})


//find portal

const subchunkSize = 8
 
function* findSpawnerJob(player, dim, loc, state, tryAgain) {
    var offset = 0
    if (dim.id == "dungeons:ancientdim_misty_peak") offset = 10
    if (dim.id == "dungeons:ancientdim_sanctum_summit") offset = 10
    if (dim.id == "dungeons:ancientdim_obsidian_fortress") offset = 10
 
    const radius = Math.ceil(29 / 3 + 9)
    const minCorner = {
        x: loc.x - radius,
        y: (loc.y - 15) + offset,
        z: loc.z - radius
    }
    const maxCorner = {
        x: loc.x + radius,
        y: (loc.y + 15) + offset,
        z: loc.z + radius
    }
    const subchunks = []
    for (let x = minCorner.x; x <= maxCorner.x; x += subchunkSize) {
        for (let y = minCorner.y; y <= maxCorner.y; y += subchunkSize) {
            for (let z = minCorner.z; z <= maxCorner.z; z += subchunkSize) {
                const from = { x, y, z }
                const to = {
                    x: Math.min(x + subchunkSize - 1, maxCorner.x),
                    y: Math.min(y + subchunkSize - 1, maxCorner.y),
                    z: Math.min(z + subchunkSize - 1, maxCorner.z)
                }
                const midX = (from.x + to.x) / 2
                const midY = (from.y + to.y) / 2
                const midZ = (from.z + to.z) / 2
                const distSq = (midX - loc.x) ** 2 + (midY - loc.y) ** 2 + (midZ - loc.z) ** 2
                subchunks.push({ from, to, distSq })
            }
        }
    }
    subchunks.sort((a, b) => a.distSq - b.distSq)
    const failedstuff = []
 
    const checkChunk = function* (chunk) {
        if (!player.isValid) return "abort";
        const volume = new BlockVolume(chunk.from, chunk.to)
 
        var hasSpawner = false
        var loadFailure = false
        try {
            hasSpawner = dim.containsBlock(volume, { includeTypes: ["dungeons:spawner_obsidian"] }, true)
        } catch (err) {
            loadFailure = true
            hasSpawner = false
        }
 
        if (loadFailure) {
            failedstuff.push(chunk)
            return "continue";
        }
 
        if (hasSpawner) {
            for (const blockLoc of volume.getBlockLocationIterator()) {
                if (!player.isValid) return "abort";
                const checkBlock = dim.getBlock(blockLoc)
                if (checkBlock && checkBlock.typeId == "dungeons:spawner_obsidian") {
                    console.warn(`§a${player.name} has entered an Ancient Hunt`)
                    state.active = false
                    player.teleport(checkBlock.above().bottomCenter())
                    player.removeTag("dungeons:ancient_hunt_try_again_placement")
                    const marker = dim.getEntities({ type: "dungeons:ancient_hunt_marker", location: checkBlock.above().bottomCenter(), maxDistance: 64 })
                    if (marker.length > 0) {
                        const dimMarker = marker[0]
                        if (!dimMarker.getDynamicProperty("dungeons:exit_portal_location")) player.runCommand("scriptevent dungeons:test_if_exit")
                    }
                    return "found";
                }
                yield
            }
        }
        return "continue";
    }
 
    try {
        for (const chunk of subchunks) {
            const result = yield* checkChunk(chunk)
            if (result === "abort" || result === "found") return;
            yield
        }
 
        if (failedstuff.length > 0) {
            console.warn(`§eRetrying safespace check !`)
            for (const chunk of failedstuff) {
                const result = yield* checkChunk(chunk)
                if (result === "abort" || result === "found") return;
                yield
            }
        }
 
        if(!tryAgain) console.warn("§cCould not find safespace!!! very bad")
        player.addTag("dungeons:ancient_hunt_try_again_placement")
    } finally {
        state.active = false
    }
}
 
const tryagainTag = "dungeons:ancient_hunt_try_again_placement"
system.runInterval(() => {
    for(const player of world.getPlayers({tags:[tryagainTag]})) {
        if(player.getGameMode() == "Spectator" || !player.isValid || player.dimension.id.includes("dungeons:ancientdim_") == false) {
            player.removeTag(tryagainTag)
            continue;
        }
        const headSpot = player.dimension.getBlock(player.getHeadLocation())
        if(!headSpot) continue;
        console.warn("found headspot")
        if(headSpot) {
            system.runJob(findSpawnerJob(player, player.dimension, player.location, { active: true }, true))
        }
    }
},10)


function runSpawnerSearch(player, dim, loc) {
    if (!hunts) return;
    const state = { active: true }
    const searchRadius = Math.ceil(29 / 3 + 9) + subchunkSize
    const searchTickId = `dungeons:spawner_search_${player.id}`
    world.tickingAreaManager.createTickingArea(searchTickId, {
        dimension: dim,
        from: {
            x: loc.x - searchRadius,
            y: dim.heightRange.min,
            z: loc.z - searchRadius
        },
        to: {
            x: loc.x + searchRadius,
            y: dim.heightRange.max,
            z: loc.z + searchRadius
        }
    })
 
    player.runCommand("hud @s hide")
    player.addTag("dungeons:ancient_hunt_loading")
    player.addEffect("invisibility", 1200)
    const runInt = system.runInterval(() => {
        if (!state.active || !player.isValid) {
            if (world.tickingAreaManager.getTickingArea(searchTickId)) {
                world.tickingAreaManager.removeTickingArea(searchTickId)
            }
            player.runCommand("hud @s reset")
            player.removeTag("dungeons:ancient_hunt_loading")
            player.removeEffect("invisibility")
            system.clearRun(runInt)
            for (let i = 0; i < 100; i++) {
                player.runCommand(`camerashake add @s 0.01 ${5.1 - i / 10}`)
            }
            return;
        }
        player.runCommand(`camera @s fade time 0 0.5 3 color 2 0 5`)
        player.onScreenDisplay.setActionBar({ rawtext: [{ text: "§l§d" }, { translate: "dungeons.warn.ancient_hunt.loading" }] })
        player.teleport(loc, { dimension: dim })
    }, 1)
 
    system.runJob(findSpawnerJob(player, dim, loc, state))
}
//invis while loading
world.beforeEvents.entityHurt.subscribe((e) => {
    if (!hunts) return;
    const hurt = e.hurtEntity;
    if(!hurt || !hurt.isValid) return;
    if(hurt.hasTag("dungeons:ancient_hunt_loading")) e.cancel = true;
})

world.afterEvents.playerJoin.subscribe((e) => {
    if (!hunts) return;
    const runInt = system.runInterval(() => {
        const player = world.getEntity(e.playerId)
        if(player) {
            player.removeTag("dungeons:ancient_hunt_loading")
            return system.clearRun(runInt)
        }
    })
})


function enterAncientDimension(player, destination, portalBlock) {
    if (!hunts) return;
    player.playSound("ancient_hunt.begin", { volume: 0.5 })
    player.runCommand("camera @s fade time 0 1 5 color 2 0 5")
    player.setDynamicProperty("dungeons:ancient_origin_dim", player.dimension.id)
    if(portalBlock) {
        player.setDynamicProperty("dungeons:ancient_origin_loc", portalBlock.bottomCenter())
    } else {
        player.setDynamicProperty("dungeons:ancient_origin_loc", player.location)
    }
    const loc = {
        x: Math.floor(player.location.x / 100) * 500,
        y: 64,
        z: Math.floor(player.location.z / 100) * 500
    }
    const dim = world.getDimension(destination)
    const tickingAreaManager = world.tickingAreaManager
    const tickId = `dungeons:dimension_${player.id}_${destination}`
    tickingAreaManager.createTickingArea(tickId, {
        dimension: dim,
        from: {
            x: loc.x - 8,
            y: loc.y,
            z: loc.z - 8
        },
        to: {
            x: loc.x + 8,
            y: loc.y,
            z: loc.z + 8
        }
    })
    player.runCommand(`camera @s fade time 0 0.5 3 color 2 0 5`)
    player.teleport(loc, { dimension: dim })
    var placed = false
    for (let i = 0; i < 100 && placed == false; i++) {
        system.runTimeout(() => {
            if (placed == false) {
                if (dim.isChunkLoaded(loc)) {
                    placed = true
                    tickingAreaManager.removeTickingArea(tickId)
                    const checkForMarker = dim.getEntities({
                        location: loc,
                        type: "dungeons:ancient_hunt_marker",
                        maxDistance: 64
                    })
                    if (checkForMarker.length == 0) {
                        console.warn("New Hunt generating")
                        const marker = dim.spawnEntity("dungeons:ancient_hunt_marker", player.location)
                        const structureManager = world.structureManager
                        const boundingBox = structureManager.placeJigsawStructure(destination.replace("dungeons:ancientdim_", "dungeons:") + "_ancient_hunt", dim, { x: loc.x - 1, y: loc.y - 3, z: loc.z - 1 }, { ignoreStartHeight: true })
                        marker.setDynamicProperty("dungeons:max_bound", boundingBox.max)
                        marker.setDynamicProperty("dungeons:min_bound", boundingBox.min)
                        marker.runCommand("scriptevent dungeons:generated_hunt " + dim.id)
                    }
                    runSpawnerSearch(player, dim, loc)
                }
            }
        }, i)
    }
    system.runTimeout(() => {
        const tagId = "dungeons:visited_" + destination.replace("dungeons:ancientdim_", "")
        if (player.hasTag(tagId)) return;
        const runInt = system.runInterval(() => {
            if (!player.isValid) return;
            if (player.hasTag(tagId)) return;
            const rot = player.getRotation()
            system.runTimeout(() => {
                if (!player.isValid) system.clearRun(runInt);
                const playerBlock = player.dimension.getBlock(player.location)
                if(!playerBlock) return;
                if (rot !== player.getRotation() && playerBlock && ((playerBlock.below().isAir == false && playerBlock.below().typeId !== "dungeons:spawner_obsidian" && playerBlock.below().typeId !== "minecraft:obsidian" && playerBlock.below().typeId !== "minecraft:crying_obsidian" && playerBlock.below().typeId !== "dungeons:gilded_obsidian") || player.isFlying)) {
                    if (!player.hasTag(tagId) && !player.hasTag("dungeons:ancient_hunt_loading")) {
                        player.addTag(tagId)
                        player.onScreenDisplay.updateSubtitle({ translate: "dungeons.dimension" })
                        player.onScreenDisplay.setTitle({ translate: "dungeons.dimension." + destination.replace("dungeons:ancientdim_", "") }, { fadeInDuration: 25, stayDuration: 50, fadeOutDuration: 50 })
                    }
                    system.clearRun(runInt)
                }
            }, 1)
        })
    }, 50)
    system.runTimeout(() => {
        if (tickingAreaManager.getTickingArea(tickId)) tickingAreaManager.removeTickingArea(tickId)
    }, 101)
    return;
}

export function returnDimension(player, destroy, loot) {
    player.runCommand("scriptevent dungeons:survival_skills_proven")
    if (!hunts) return;
    var returnDim = world.getDimension(player.getDynamicProperty("dungeons:ancient_origin_dim"))
    if (!returnDim) returnDim = world.getDimension("minecraft:overworld")
    var returnLoc = player.getDynamicProperty("dungeons:ancient_origin_loc")
    player.setDynamicProperty("dungeons:safe_spot", undefined)
    if (!returnLoc) returnLoc = { x: 0, y: 320, z: 0 }
    player.teleport(returnLoc, { dimension: returnDim })
    if (destroy) {
        destroyPortalAt(returnDim, returnLoc, loot)
    }
}

async function destroyPortalAt(returnDim, returnLoc, loot) {
    const tickingAreaManager = world.tickingAreaManager;
    const areaId = `dungeons:destroy_portal_${Math.round(returnLoc.x)}_${Math.round(returnLoc.y)}_${Math.round(returnLoc.z)}_${Date.now()}`
    const options = {
        dimension: returnDim,
        from: { x: returnLoc.x - 1, y: returnLoc.y - 1, z: returnLoc.z - 1 },
        to: { x: returnLoc.x + 1, y: returnLoc.y + 1, z: returnLoc.z + 1 }
    }

    let areaCreated = false
    try {
        if (!tickingAreaManager.hasCapacity(options)) {
            await system.waitTicks(5);
        }
        if (tickingAreaManager.hasCapacity(options)) {
            await tickingAreaManager.createTickingArea(areaId, options)
            areaCreated = true
        } else {
            console.warn(`§cCouldn't destroy portal!`)
        }
    } catch {
            console.warn(`§cCouldn't destroy portal!`)
    }

    let attempts = 0
    const maxAttempts = 500
    const runInt = system.runInterval(() => {
        attempts++
        const b = returnDim.getBlock(returnLoc)
        if (b !== undefined && returnDim.isChunkLoaded(returnLoc)) {
            if (b.typeId == "dungeons:ancient_portal") {
                returnDim.runCommand(`setblock ${b.x} ${b.y} ${b.z} air destroy`)
                if (loot) {
                    for (let i = 0; i < loot; i++) {
                        returnDim.spawnItem(new ItemStack("dungeons:ancient_gold_ingot", 1), b.center())
                    }
                }
                system.clearRun(runInt)
                if (areaCreated) tickingAreaManager.removeTickingArea(areaId)
                return;
            } else {
            }
        }
        if (attempts >= maxAttempts) {
            system.clearRun(runInt)
            if (areaCreated) tickingAreaManager.removeTickingArea(areaId)
        }
    })
}

//prevent void deaths

system.runInterval(() => {
    if (!hunts) return;
    for (const dimensionId of customDimIds) {
        const dim = world.getDimension(dimensionId)
        if (!dim) continue;
        for (const player of dim.getPlayers({ excludeGameModes: ["Spectator"] })) {
            if (player.location.y <= dim.heightRange.min) {
                player.addTag("dungeons:portal_proof")
                player.setDynamicProperty("dungeons:ancient_portal_travel_time", 0)
                returnDimension(player)
            }
        }
    }
}, 20)

//prevent block break

const canBreak = [
    "minecraft:seagrass",
    "minecraft:sea_grass",
    "minecraft:kelp",
    "minecraft:water",
    "minecraft:short_grass",
    "minecraft:tall_grass",
    "minecraft:moss_carpet",
    "minecraft:pale_moss_carpet",
    "minecraft:web",
    "minecraft:cave_vines",
    "minecraft:cave_vines_body_with_berries",
    "minecraft:cave_vines_head_with_berries",
    "dungeons:orange_glowshroom",
    "minecraft:torch",
    "minecraft:soul_torch",
    "minecraft:copper_torch",
    "dungeons:green_glowshroom",
    "dungeons:spider_egg",
    "dungeons:sticky_sludge",
    "minecraft:decorated_pot",
    "minecraft:pale_hanging_moss",
    "dungeons:cyan_glowshroom",
    "minecraft:torchflower",
    "minecraft:cornflower",
    "minecraft:fern",
    "minecraft:large_fern",
    "minecraft:red_flower",
    "minecraft:yellow_flower",
    "minecraft:bamboo",
    "dungeons:redstone_crystal",
    "minecraft:red_shrub",
    "minecraft:leaf_litter",
    "minecraft:bush",
    "minecraft:snow_layer",
    "dungeons:purple_ender_vine",
    "dungeons:purple_ender_grass",
    "dungeons:yellow_ender_grass"
]

world.beforeEvents.playerBreakBlock.subscribe((e) => {
    if (customDimIds.includes(e.player.dimension.id)) {
        if (e.player.getGameMode() !== "Creative") {
            if (canBreak.includes(e.block.typeId) || e.block.hasTag("dungeons:ancient_hunt_trophy")) return;
            e.cancel = true;
            system.run(() => {
                e.player.addEffect("mining_fatigue", 20, { amplifier: 20, showParticles: false })
            })
        }
    }
})

//prevent placement

const overrideCanPlace = [
    "minecraft:decorated_pot",
    "minecraft:bamboo",
    "dungeons:spider_egg",
    "dungeons:sticky_sludge",
    "dungeons:redstone_crystal",
    "minecraft:moss_carpet",
    "minecraft:pale_moss_carpet",
    "minecraft:snow_layer"
]

world.afterEvents.playerPlaceBlock.subscribe((e) => {
    const block = e.block
    const player = e.player;
    if (canBreak.includes(block.typeId) && !overrideCanPlace.includes(block.typeId) && !block.hasTag("dungeons:ancient_hunt_trophy")) return;
    if (player.getGameMode() == "Creative") return;
    if (!customDimIds.includes(player.dimension.id)) return;
    block.dimension.runCommand(`setblock ${block.x} ${block.y} ${block.z} air destroy`)
})

//prevent items

const cannotUse = [
    "ender_eye",
    "shears",
    "bone_meal",
    "oak_boat",
    "oak_chest_boat",
    "spruce_boat",
    "spruce_chest_boat",
    "birch_boat",
    "birch_chest_boat",
    "jungle_boat",
    "jungle_chest_boat",
    "acacia_boat",
    "acacia_chest_boat",
    "dark_oak_boat",
    "dark_oak_chest_boat",
    "mangrove_boat",
    "mangrove_chest_boat",
    "bamboo_raft",
    "bamboo_chest_raft",
    "cherry_boat",
    "cherry_chest_boat",
    "pale_oak_boat",
    "pale_oak_chest_boat",
    "poplar_boat",
    "poplar_chest_boat",
    "minecraft:flint_and_steel",
    "minecraft:fire_charge",
    "minecraft:lava_bucket",
    "minecraft:powder_snow_bucket",
    "minecraft:bucket",
    "minecraft:water_bucket",
    "minecraft:cod_bucket",
    "minecraft:salmon_bucket",
    "minecraft:pufferfish_bucket",
    "minecraft:tropical_fish_bucket",
    "minecraft:tadpole_bucket",
    "minecraft:axolotl_bucket",
    "red_cushion",
    "orange_cushion",
    "yellow_cushion",
    "green_cushion",
    "lime_green_cushion",
    "blue_cushion",
    "light_blue_cushion",
    "cyan_cushion",
    "purple_cushion",
    "magenta_cushion",
    "pink_cushion",
    "brown_cushion",
    "gray_cushion",
    "light_gray_cushion",
    "white_cushion",
    "black_cushion",
    "ender_pearl"
]


world.beforeEvents.itemUse.subscribe((e) => {
    const item = e.itemStack;
    const dim = e.source.dimension;
    if (customDimIds.includes(dim.id) && (cannotUse.includes(item.typeId.replace("minecraft:", "")) || cannotUse.includes(item.typeId))) {
        e.cancel = true
    }
})

world.beforeEvents.playerInteractWithBlock.subscribe((e) => {
    const item = e.itemStack;
    if (!item) return;
    const dim = e.player.dimension
    if(dim.id.includes("dungeons:ancientdim_") == false) return
    if (customDimIds.includes(dim.id) && ((cannotUse.includes(item.typeId.replace("minecraft:", "")) || cannotUse.includes(item.typeId))) || (e.block && e.block.typeId.includes("minecraft:") && e.block.typeId.includes("_shelf"))) {
        e.cancel = true
    }
})

//prevent explosionGrief

world.beforeEvents.explosion.subscribe((e) => {
    const dim = e.dimension;
    if (!customDimIds.includes(dim.id)) return;
    e.setImpactedBlocks([])
})


//prevent stuck

system.runInterval(() => {
    if (!hunts) return;
    for (const dimensionId of customDimIds) {
        const dim = world.getDimension(dimensionId)
        if (!dim) continue;
        for (const player of dim.getPlayers({ excludeGameModes: ["Spectator", "Creative"] })) {

            if (player.getDynamicProperty("dungeons:safe_spot")) {
                const range = dim.heightRange
                var isAir = true
                for (let i = range.min; i < range.max; i++) {
                    const test = dim.getBlock({
                        x: player.location.x,
                        y: i,
                        z: player.location.z
                    })
                    if (test && test.isAir == false) isAir = false
                }
                if (isAir) {
                    player.teleport(player.getDynamicProperty("dungeons:safe_spot"))
                } else {
                    if (!dim.getBlock(player.location).below().isAir && dim.getBlock(player.location).isAir && dim.getBlock(player.getHeadLocation()).isAir) {
                        player.setDynamicProperty("dungeons:safe_spot", player.location)
                    }
                }
            } else if (!dim.getBlock(player.location).below().isAir && dim.getBlock(player.location).isAir && dim.getBlock(player.getHeadLocation()).isAir) {
                player.setDynamicProperty("dungeons:safe_spot", player.location)
            }
        }
    }
}, 20)

system.runInterval(() => {
    if (!hunts) return;
    for (const dimensionId of customDimIds) {
        const dim = world.getDimension(dimensionId)
        if (!dim) continue;
        if (dimensionId.includes("outer_end")) continue;
        var blockId = undefined
        if (!blockId && dimensionId.includes("ancient_crypt")) blockId = "stonebrick"
        if (!blockId && dimensionId.includes("slimy_sewer")) blockId = "stonebrick"
        if (!blockId && dimensionId.includes("woodland_mansion")) blockId = "dark_oak_planks"
        if (!blockId && dimensionId.includes("creepy_stronghold")) blockId = "stonebrick"
        if (!blockId && dimensionId.includes("faraway_fortress")) blockId = "nether_brick"
        if (!blockId && dimensionId.includes("lower_forge")) blockId = "deepslate_tiles"
        if (!blockId && dimensionId.includes("woodland_prison")) blockId = "stonebrick"
        if (!blockId && dimensionId.includes("grand_bastion")) blockId = "polished_blackstone_bricks"
        if (!blockId && dimensionId.includes("desert_tomb")) blockId = "dungeons:desert_bricks"
        if (!blockId && dimensionId.includes("forgotten_citadel")) blockId = "end_bricks"
        if (!blockId && dimensionId.includes("ominous_castle")) blockId = "stonebrick"
        if (!blockId && dimensionId.includes("deepsea_monument")) blockId = "prismarine_bricks"
        if (!blockId && dimensionId.includes("sanctum_summit")) blockId = "quartz_bricks"
        if (!blockId && dimensionId.includes("cursed_halls")) blockId = "stonebrick"
        if (!blockId && dimensionId.includes("soul_ruins")) blockId = "stonebrick"
        var bounds = undefined
        if (!bounds && dimensionId.includes("creepy_stronghold")) bounds = 30
        if (!bounds && dimensionId.includes("forgotten_citadel")) bounds = 30
        if (!bounds && dimensionId.includes("ominous_castle")) bounds = 35
        if (!bounds && dimensionId.includes("sanctum_summit")) bounds = 35
        if (!blockId) blockId = "stone"
        if (!bounds) bounds = 20
 
        for (const player of dim.getPlayers({ excludeGameModes: ["Spectator"] })) {
            if ((!player.isOnGround && !player.isInWater) && !player.isJumping && !player.isSwimming) continue
            for (let i = -5; i < 5; i++) {
                for (let j = -5; j < 5; j++) {
                    if (openRoof.includes(dimensionId)) {
                        var height = 80
                        if (dimensionId.includes("obsidian_fortress")) height = 100
                        if (dimensionId.includes("misty_peak")) height = 100
                        if (dimensionId.includes("corrupted_jungle")) height = 72
                        if (dimensionId.includes("frosted_fjord")) height = 73
                        const checkLoc = {
                            x: player.location.x + i,
                            y: height,
                            z: player.location.z + j
                        }
                        if (dim.getBlock(checkLoc) && dim.getBlock(checkLoc).isAir) dim.setBlockType(checkLoc, "dungeons:ancient_hunt_barrier")
                    }
                    const loc = {
                        x: player.location.x + i,
                        y: player.location.y,
                        z: player.location.z + j
                    }
                    var fill = true
 
                    if (!openRoof.includes(dimensionId)) {
                        for (let k = player.location.y - bounds; k < player.location.y + bounds; k++) {
                            const block = dim.getBlock({ x: loc.x, y: k, z: loc.z })
                            if (!block) continue;
                            if (!block.isAir) fill = false
                        }
                        if (fill) {
                            for (let k = player.location.y - bounds; k < player.location.y + bounds; k++) {
                                if(dim.getBlock({ x: loc.x, y: k, z: loc.z })) dim.getBlock({ x: loc.x, y: k, z: loc.z }).setType(blockId)
                            }
                        } else {
                            var fill2 = true
                            for (let colY = loc.y; colY < loc.y + bounds / 2; colY++) {
                                if (fill2 == false) continue;
                                const block2 = dim.getBlock({ x: loc.x, y: colY, z: loc.z })
                                if (!block2) continue;
                                if (block2.isAir) {
                                    const topmostNear = dim.getTopmostBlock({ x: loc.x, z: loc.z }, block2.y + bounds / 2)
                                    if (!topmostNear) {
                                        block2.setType(blockId)
                                    } else {
                                        const topmostFar = dim.getTopmostBlock({ x: loc.x, z: loc.z }, block2.y + bounds)
                                        if (topmostFar.y <= block2.y) {
                                            block2.setType(blockId)
                                        }
                                    }
                                } else {
                                    fill2 = false
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}, 5)

//close

function closeAncientHunt(originP, marker) {
    console.warn("Ancient Hunt is closing!")
    const loc = marker.location
    const dim = marker.dimension
    const tickingAreaManager = world.tickingAreaManager
    const tickId = `dungeons:dimension_${marker.id}_closing`
    tickingAreaManager.createTickingArea(tickId, {
        dimension: dim,
        from: {
            x: loc.x - 8,
            y: loc.y,
            z: loc.z - 8
        },
        to: {
            x: loc.x + 8,
            y: loc.y,
            z: loc.z + 8
        }
    })
    marker.addTag("dungeons:registered_ending")
    const players = dim.getPlayers({ location: loc, maxDistance: 160 })
    for (const player of players) {
        if (player.id !== originP.id) {
            player.sendMessage({ translate: "dungeons.warn.ancient_hunt.cleared" })
            player.playSound("ancient_hunt.exit", { volume: 0.5 })
            player.addEffect("nausea", 80, { showParticles: false })
            player.playSound("portal.trigger", { volume: 0.66 })
        }
        player.setDynamicProperty("dungeons:hunt_complete_t", 80)
        player.addTag("dungeons:exiting_ancient_hunt")
    }
    system.runTimeout(() => {
        for (const entity of dim.getEntities({ tags: ["dungeons:ancient_hunt"], location: loc, maxDistance: 160 })) {
            entity.runCommand("fill ~15 ~15 ~15 ~-15 ~-15 ~-15 air")
            system.runTimeout(() => {

                entity.remove()
            }, 1)
        }


        const players2 = dim.getPlayers({ location: loc, maxDistance: 160 })
        for (const player of players2) {
            if (!player.hasTag("dungeons:exiting_ancient_hunt")) {
                if (player.id !== originP.id) {
                    player.sendMessage({ translate: "dungeons.warn.ancient_hunt.cleared" })
                    player.playSound("ancient_hunt.exit", { volume: 0.5 })
                }
                player.setDynamicProperty("dungeons:hunt_complete_t", 1)
                player.addTag("dungeons:exiting_ancient_hunt")
            }
        }
        if (marker.isValid) {
            marker.remove()
        }
    }, 81)
    system.runTimeout(() => {

        tickingAreaManager.removeTickingArea(tickId)
    }, 82)
}

system.runInterval(() => {
    if (!hunts) return;
    for (const player of world.getPlayers({ tags: ["dungeons:exiting_ancient_hunt"] })) {
        const timer = player.getDynamicProperty("dungeons:hunt_complete_t")
        if (!timer) player.removeTag("dungeons:exiting_ancient_hunt")
        if (!customDimIds.includes(player.dimension.id)) {
            player.removeTag("dungeons:exiting_ancient_hunt")
            player.setDynamicProperty("dungeons:hunt_complete_t", null)
        }
        if (timer > 0) {
            player.setDynamicProperty("dungeons:hunt_complete_t", timer - 1)
            player.runCommand(`camerashake add @s 0.01 2`)
            if (timer % 20 == 0) {
                player.onScreenDisplay.setActionBar({ rawtext: [{ text: "§l§e" }, { translate: "dungeons.warn.ancient_hunt.exiting" }, { text: "" }] })
                system.runTimeout(() => {
                    player.onScreenDisplay.setActionBar({ rawtext: [{ text: "§l§e" }, { translate: "dungeons.warn.ancient_hunt.exiting" }, { text: "." }] })
                }, 5)
                system.runTimeout(() => {
                    player.onScreenDisplay.setActionBar({ rawtext: [{ text: "§l§e" }, { translate: "dungeons.warn.ancient_hunt.exiting" }, { text: ".." }] })
                }, 10)
                system.runTimeout(() => {
                    player.onScreenDisplay.setActionBar({ rawtext: [{ text: "§l§e" }, { translate: "dungeons.warn.ancient_hunt.exiting" }, { text: "..." }] })
                }, 15)
            }
        } else {
            const findMarker = player.dimension.getEntities({ tags: ["dungeons:registered_ending"], type: "dungeons:ancient_hunt_marker", closest: 1, maxDistance: 160, location: player.location })
            if (findMarker[0]) findMarker[0].remove()
            player.removeTag("dungeons:exiting_ancient_hunt")
            player.setDynamicProperty("dungeons:hunt_complete_t", null)
            player.addTag("dungeons:portal_proof")
            player.setDynamicProperty("dungeons:ancient_portal_travel_time", 0)
            returnDimension(player, true)
        }
    }
})


import { isWearingSet } from "components/armour.js"

//mob drop gold

world.afterEvents.entityDie.subscribe((e) => {
    const dead = e.deadEntity;
    if (world.gameRules.doEntityDrops == false) return;
    if (!dead || !dead.isValid) return;
    if (customDimIds.includes(dead.dimension.id) == false) return;
    const attacker = e.damageSource.damagingEntity
    var goldAmt = 0
    var rerolled = false
    if (dead.matches({ families: ["ancient_minion"] })) {
        return;
    } else if (dead.matches({ families: ["ancient"] })) {
        goldAmt = 6 + Math.floor(Math.random() * 7)
        const secondRoll = 6 + Math.floor(Math.random() * 7)
        if (attacker && attacker.typeId == "minecraft:player" && isWearingSet(attacker, "dungeons:luck_of_the_sea")) {
            if (secondRoll > goldAmt) {
                goldAmt = secondRoll
                rerolled = false // since we only want the particle and sound if the unique item was rerolled
            }
        }
    } else if (dead.matches({ families: ["miniboss"] })) {
        for (let i = 0; i < 5; i++) {
            if (Math.random() > 0.66) {
                goldAmt += 1
            } else if (attacker && attacker.typeId == "minecraft:player" && isWearingSet(attacker, "dungeons:luck_of_the_sea")) {
                if (Math.random() > 0.66) {
                    rerolled = true
                    goldAmt += 1
                }
            }
        }
    } else if (dead.matches({ families: ["enchanted"], tags: ["dungeons:ancient_hunt"] })) {
        if (Math.random() > 0.95) {
            goldAmt += 1
        } else if (attacker && attacker.typeId == "minecraft:player" && isWearingSet(attacker, "dungeons:luck_of_the_sea")) {
            if (Math.random() > 0.95) {
                rerolled = true
                goldAmt += 1
            }
        }

    } else if (dead.matches({ families: ["monster"], tags: ["dungeons:ancient_hunt"] })) {
        if (Math.random() > 0.97) {
            goldAmt += 1
        } else if (attacker && attacker.typeId == "minecraft:player" && isWearingSet(attacker, "dungeons:luck_of_the_sea")) {
            if (Math.random() > 0.66) {
                rerolled = true
                goldAmt += 1
            }
        }
    }
    if (goldAmt == 0) return;
    if (attacker) {
        const playerCount = attacker.dimension.getPlayers({ excludeGameModes: ["Spectator"], maxDistance: 100, closest: 9 }).length - 1;
        if (playerCount > 0) {
            if (Math.random() < playerCount / 10) goldAmt += 1
        }
        if (rerolled) {
            if (dead.dimension.isChunkLoaded(dead.location)) {
                dead.dimension.spawnParticle("dungeons:luck_of_the_sea", dead.location)
                dead.dimension.playSound("armour.luck_of_the_sea", attacker.location, { volume: 0.66, pitch: 0.7 + Math.random() * 0.5 })
            }
        }
    }
    if (dead.dimension.isChunkLoaded(dead.location)) {
        dead.dimension.playSound("ancient_hunt.drop_gold", dead.location, { volume: 2 })
    }
    dead.dimension.spawnItem(new ItemStack("dungeons:ancient_gold_ingot", goldAmt), dead.location).applyImpulse({ x: Math.random() * 0.2 - 0.1, y: 0.05, z: Math.random() * 0.2 - 0.1 })
})


//fog

system.runInterval(() => {
    for (const player of world.getPlayers({ tags: ["dungeons:ancient_fog"] })) {
        var findDim = undefined
        for (const tag of player.getTags()) if (tag.includes("dungeons:") && tag.includes("_fog") && tag !== "dungeons:ancient_fog") findDim = tag
        if (!findDim) findDim = "a"
        const dimID = findDim.replace("dungeons:", "dungeons:ancientdim_").replace("_fog", "")
        if (player.dimension.id !== dimID) {
            for (const tag of player.getTags()) if (tag.includes("dungeons:") && tag.includes("_fog")) player.removeTag(tag)

            player.runCommand("fog @s remove dungeons:ancient_fog")
        }
    }
    for (const player of world.getPlayers({ tags: ["dungeons:ignorefog"] })) {

        for (const tag of player.getTags()) if (tag.includes("dungeons:") && tag.includes("_fog")) player.removeTag(tag)

        player.runCommand("fog @s remove dungeons:ancient_fog")

    }
    if (!hunts) return;
    
    for (const dimId of hasFog) {
        const dim = world.getDimension(dimId)
        const fogTag = dimId.replace("ancientdim_", "") + "_fog"
        for (const player of dim.getPlayers({ excludeTags: [fogTag, "dungeons:ignorefog"] })) {
            player.addTag("dungeons:ancient_fog")
            player.addTag(fogTag)
            player.runCommand("fog @s push " + fogTag.replace("_fog", "") + " dungeons:ancient_fog")
        }
    }
}, 5)

//music

system.runInterval(() => {
    for (const player of world.getPlayers({ tags: ["dungeons:ancient_music"] })) {
        var findDim = undefined
        for (const tag of player.getTags()) if (tag.includes("dungeons:") && tag.includes("_music") && tag !== "dungeons:ancient_music") findDim = tag
        if (!findDim) findDim = "a"
        const dimID = findDim.replace("dungeons:", "dungeons:ancientdim_").replace("_music", "")
        if (player.dimension.id !== dimID) {
            for (const tag of player.getTags()) if (tag.includes("dungeons:") && tag.includes("_music")) player.removeTag(tag)
            player.stopMusic()
        }
    }
    for (const player of world.getPlayers({ tags: ["dungeons:ignoremusic"] })) {
        for (const tag of player.getTags()) if (tag.includes("dungeons:") && tag.includes("_music")) player.removeTag(tag)
        player.stopMusic()
    }
    for (const player of world.getPlayers({ tags: ["alylica:music_playing"] })) {
        for (const tag of player.getTags()) if (tag.includes("dungeons:") && tag.includes("_music")) player.removeTag(tag)
        //player.stopMusic()
    }
    if (!hunts) return;
    for (const dimId of hasMusic) {
        const dim = world.getDimension(dimId)
        const musicTag = dimId.replace("ancientdim_", "") + "_music"
        for (const player of dim.getPlayers({ excludeTags: [musicTag, "dungeons:ignoremusic", "alylica:music_playing"] })) {
            player.addTag("dungeons:ancient_music")
            player.addTag(musicTag)
            player.playMusic(`${musicTag.replace("dungeons:", "music.game.").replace("_music", "")}`, { loop: true, fade: 1 })
        }
    }
}, 5)

world.afterEvents.playerJoin.subscribe((e) => {
    system.runTimeout(() => {
        const player = world.getEntity(e.playerId)
        for (const tag of player.getTags()) if (tag.includes("dungeons:") && tag.includes("_music")) player.removeTag(tag)
    }, 200)
})

//graphicsetting

/*
due to a bug with the graphics module, this is all disabled

const hasGraphics = [
    "dungeons:ancientdim_outer_end",
    "dungeons:ancientdim_forgotten_citadel",
    "dungeons:ancientdim_silent_woods",
    "dungeons:ancientdim_pumpkin_forest",
    "dungeons:ancientdim_mushroom_dimension"
]

const graphicSettings = [
    {
        id: "outer_end",
        biome: "minecraft:the_end",
        highlightSaturation: {x:1, y:1, z:1},
        midtonesSaturation: {x:1, y:1, z:1},
        shadowsSaturation: {x:1, y:1, z:1},
        highlightsGamma: {x:3, y:2.4, z:3},
        midtonesGamma: {x:3, y:2.4, z:3},
        shadowsGamma: {x:3, y:2.4, z:3}
    },
    {
        id: "forgotten_citadel",
        biome: "minecraft:the_end",
        highlightSaturation: {x:1, y:1, z:1},
        midtonesSaturation: {x:1, y:1, z:1},
        shadowsSaturation: {x:1, y:1, z:1},
        highlightsGamma: {x:3, y:2, z:3},
        midtonesGamma: {x:3, y:2, z:3},
        shadowsGamma: {x:3, y:2, z:3}
    },
    {
        id: "silent_woods",
        biome: "minecraft:pale_garden",
        highlightSaturation: {x:1, y:1, z:1.2},
        midtonesSaturation: {x:0.8, y:1, z:1},
        shadowsSaturation: {x:0.8, y:1, z:1},
        highlightsGamma: {x:1.5, y:2, z:2},
        midtonesGamma: {x:1.2, y:2, z:2},
        shadowsGamma: {x:1, y:2, z:2}
    },
    {
        id: "pumpkin_forest",
        biome: "minecraft:dappled_forest",
        highlightSaturation: {x:1.4, y:1.2, z:1},
        midtonesSaturation: {x:1.3, y:1.1, z:1},
        shadowsSaturation: {x:1.2, y:1, z:1},
        highlightsGamma: {x:2, y:1.6, z:1.2},
        midtonesGamma: {x:2, y:1.6, z:1.2},
        shadowsGamma: {x:2, y:1.6, z:1.2}
    },
    {
        id: "mushroom_dimension",
        biome: "minecraft:mushroom_island",
        highlightSaturation: {x:1.1, y:1.1, z:1.15},
        midtonesSaturation: {x:1.1, y:1.1, z:1.15},
        shadowsSaturation: {x:1.1, y:1.1, z:1.15},
        highlightsGamma: {x:2.42, y:2.4, z:2.42},
        midtonesGamma: {x:1.6, y:1.6, z:1.6},
        shadowsGamma: {x:1, y:1, z:1}
    }
]


system.run(() => {
    for (const player of world.getPlayers({ tags: ["dungeons:ancient_graphicsetting"] })) {
        const dimId = player.dimension.id.replace("dungeons:ancientdim_","")
            var colourData = undefined
            for(const entry of graphicSettings) {
                if(entry.id == dimId) colourData = entry
            }
            if(!colourData) continue;
            if(!player.dimension.isChunkLoaded(player.location)) continue;
            const playerBiome = player.dimension.getBiome(player.location)
            const dimTag = player.dimension.id.replace("ancientdim_", "") + "_graphicsetting"
            player.removeTag(dimTag)
            for(const biomeType of BiomeTypes.getAll()) {
                if(biomeType.id == colourData.biome) {
                    const colourGrading = getPlayerColorGrading(biomeType, player)
                    if(colourData.highlightSaturation) colourGrading.resetHighlightsSaturation()
                    if(colourData.midtonesSaturation) colourGrading.resetMidtonesSaturation()
                    if(colourData.shadowsSaturation) colourGrading.resetShadowsSaturation()
                    if(colourData.highlightsGamma) colourGrading.resetHighlightsGamma()
                    if(colourData.midtonesGamma) colourGrading.resetMidtonesGamma()
                    if(colourData.shadowsGamma) colourGrading.resetShadowsGamma()
                }
            }
    }
})

system.afterEvents.scriptEventReceive.subscribe((e) => {
    if(e.id == "dungeons:rainbow") {
        for(const player of world.getPlayers()) {
            for(const biomeType of BiomeTypes.getAll()) {
                    const colourGrading = getPlayerColorGrading(biomeType, player)
                    const lighting = getPlayerLighting(biomeType, player)
                    const biomeAtmosphere = getPlayerAtmospherics(biomeType, player)

                    biomeAtmosphere.resetSkyHorizonColor()
                    biomeAtmosphere.resetSkyZenithColor()

                    biomeAtmosphere.resetSkyHorizonColor()
                    biomeAtmosphere.resetSkyZenithColor()

                    lighting.resetAmbientColor()
                    lighting.resetMoonColor()
                    lighting.resetSunColor()

                    colourGrading.resetHighlightsSaturation()
                    colourGrading.resetMidtonesSaturation()
                    colourGrading.resetShadowsSaturation()
                    colourGrading.resetHighlightsGamma()
                    colourGrading.resetMidtonesGamma()
                    colourGrading.resetShadowsGamma()
                    colourGrading.resetHighlightsContrast()
                    colourGrading.resetMidtonesContrast()
                    colourGrading.resetShadowsContrast()
                    colourGrading.resetShadowsOffset()

const entries = [
    {x:1, y:0.0, z:0.0},
    {x:1, y:0.0469, z:0.0},
    {x:1, y:0.0938, z:0.0},
    {x:1, y:0.1406, z:0.0},
    {x:1, y:0.1875, z:0.0},
    {x:1, y:0.2344, z:0.0},
    {x:1, y:0.2812, z:0.0},
    {x:1, y:0.3281, z:0.0},
    {x:1, y:0.375, z:0.0},
    {x:1, y:0.4219, z:0.0},
    {x:1, y:0.4688, z:0.0},
    {x:1, y:0.5156, z:0.0},
    {x:1, y:0.5625, z:0.0},
    {x:1, y:0.6094, z:0.0},
    {x:1, y:0.6562, z:0.0},
    {x:1, y:0.7031, z:0.0},
    {x:1, y:0.75, z:0.0},
    {x:1, y:0.7969, z:0.0},
    {x:1, y:0.8438, z:0.0},
    {x:1, y:0.8906, z:0.0},
    {x:1, y:0.9375, z:0.0},
    {x:1, y:0.9844, z:0.0},
    {x:0.9688, y:1, z:0.0},
    {x:0.9219, y:1, z:0.0},
    {x:0.875, y:1, z:0.0},
    {x:0.8281, y:1, z:0.0},
    {x:0.7812, y:1, z:0.0},
    {x:0.7344, y:1, z:0.0},
    {x:0.6875, y:1, z:0.0},
    {x:0.6406, y:1, z:0.0},
    {x:0.5938, y:1, z:0.0},
    {x:0.5469, y:1, z:0.0},
    {x:0.5, y:1, z:0.0},
    {x:0.4531, y:1, z:0.0},
    {x:0.4062, y:1, z:0.0},
    {x:0.3594, y:1, z:0.0},
    {x:0.3125, y:1, z:0.0},
    {x:0.2656, y:1, z:0.0},
    {x:0.2188, y:1, z:0.0},
    {x:0.1719, y:1, z:0.0},
    {x:0.125, y:1, z:0.0},
    {x:0.0781, y:1, z:0.0},
    {x:0.0312, y:1, z:0.0},
    {x:0.0, y:1, z:0.0156},
    {x:0.0, y:1, z:0.0625},
    {x:0.0, y:1, z:0.1094},
    {x:0.0, y:1, z:0.1562},
    {x:0.0, y:1, z:0.2031},
    {x:0.0, y:1, z:0.25},
    {x:0.0, y:1, z:0.2969},
    {x:0.0, y:1, z:0.3438},
    {x:0.0, y:1, z:0.3906},
    {x:0.0, y:1, z:0.4375},
    {x:0.0, y:1, z:0.4844},
    {x:0.0, y:1, z:0.5312},
    {x:0.0, y:1, z:0.5781},
    {x:0.0, y:1, z:0.625},
    {x:0.0, y:1, z:0.6719},
    {x:0.0, y:1, z:0.7188},
    {x:0.0, y:1, z:0.7656},
    {x:0.0, y:1, z:0.8125},
    {x:0.0, y:1, z:0.8594},
    {x:0.0, y:1, z:0.9062},
    {x:0.0, y:1, z:0.9531},
    {x:0.0, y:1.0, z:1},
    {x:0.0, y:0.9531, z:1},
    {x:0.0, y:0.9062, z:1},
    {x:0.0, y:0.8594, z:1},
    {x:0.0, y:0.8125, z:1},
    {x:0.0, y:0.7656, z:1},
    {x:0.0, y:0.7188, z:1},
    {x:0.0, y:0.6719, z:1},
    {x:0.0, y:0.625, z:1},
    {x:0.0, y:0.5781, z:1},
    {x:0.0, y:0.5312, z:1},
    {x:0.0, y:0.4844, z:1},
    {x:0.0, y:0.4375, z:1},
    {x:0.0, y:0.3906, z:1},
    {x:0.0, y:0.3438, z:1},
    {x:0.0, y:0.2969, z:1},
    {x:0.0, y:0.25, z:1},
    {x:0.0, y:0.2031, z:1},
    {x:0.0, y:0.1562, z:1},
    {x:0.0, y:0.1094, z:1},
    {x:0.0, y:0.0625, z:1},
    {x:0.0, y:0.0156, z:1},
    {x:0.0312, y:0.0, z:1},
    {x:0.0781, y:0.0, z:1},
    {x:0.125, y:0.0, z:1},
    {x:0.1719, y:0.0, z:1},
    {x:0.2188, y:0.0, z:1},
    {x:0.2656, y:0.0, z:1},
    {x:0.3125, y:0.0, z:1},
    {x:0.3594, y:0.0, z:1},
    {x:0.4062, y:0.0, z:1},
    {x:0.4531, y:0.0, z:1},
    {x:0.5, y:0.0, z:1},
    {x:0.5469, y:0.0, z:1},
    {x:0.5938, y:0.0, z:1},
    {x:0.6406, y:0.0, z:1},
    {x:0.6875, y:0.0, z:1},
    {x:0.7344, y:0.0, z:1},
    {x:0.7812, y:0.0, z:1},
    {x:0.8281, y:0.0, z:1},
    {x:0.875, y:0.0, z:1},
    {x:0.9219, y:0.0, z:1},
    {x:0.9688, y:0.0, z:1},
    {x:1, y:0.0, z:0.9844},
    {x:1, y:0.0, z:0.9375},
    {x:1, y:0.0, z:0.8906},
    {x:1, y:0.0, z:0.8438},
    {x:1, y:0.0, z:0.7969},
    {x:1, y:0.0, z:0.75},
    {x:1, y:0.0, z:0.7031},
    {x:1, y:0.0, z:0.6562},
    {x:1, y:0.0, z:0.6094},
    {x:1, y:0.0, z:0.5625},
    {x:1, y:0.0, z:0.5156},
    {x:1, y:0.0, z:0.4688},
    {x:1, y:0.0, z:0.4219},
    {x:1, y:0.0, z:0.375},
    {x:1, y:0.0, z:0.3281},
    {x:1, y:0.0, z:0.2812},
    {x:1, y:0.0, z:0.2344},
    {x:1, y:0.0, z:0.1875},
    {x:1, y:0.0, z:0.1406},
    {x:1, y:0.0, z:0.0938},
    {x:1, y:0.0, z:0.0469},
];
                const speed = 1
                                    for(let i = 0; i < entries.length; i++) {
                        const entry = entries[i]
                        const mult = 2
                        //var entry = multiply(entries[i], 4)
                        system.runTimeout(() => {
                            colourGrading.setHighlightsGain({x:entry.x * mult, y:entry.y*mult,z:entry.z*mult})
                            colourGrading.setMidtonesGain({x:entry.x * mult, y:entry.y*mult,z:entry.z*mult})
                            colourGrading.setShadowsGain({x:entry.x * mult, y:entry.y*mult,z:entry.z*mult})
                            colourGrading.setHighlightsGamma({x:entry.x * mult, y:entry.y*mult,z:entry.z*mult})
                            colourGrading.setMidtonesGamma({x:entry.x * mult, y:entry.y*mult,z:entry.z*mult})
                            colourGrading.setShadowsGamma({x:entry.x * mult, y:entry.y*mult,z:entry.z*mult})
                        }, i*speed)
                    }
                system.runInterval(() => {
                    for(let i = 0; i < entries.length; i++) {
                        const entry = entries[i]
                        const mult = 2
                        //var entry = multiply(entries[i], 4)
                        system.runTimeout(() => {
                            colourGrading.setHighlightsGain({x:entry.x * mult, y:entry.y*mult,z:entry.z*mult})
                            colourGrading.setMidtonesGain({x:entry.x * mult, y:entry.y*mult,z:entry.z*mult})
                            colourGrading.setShadowsGain({x:entry.x * mult, y:entry.y*mult,z:entry.z*mult})
                            colourGrading.setHighlightsGamma({x:entry.x * mult, y:entry.y*mult,z:entry.z*mult})
                            colourGrading.setMidtonesGamma({x:entry.x * mult, y:entry.y*mult,z:entry.z*mult})
                            colourGrading.setShadowsGamma({x:entry.x * mult, y:entry.y*mult,z:entry.z*mult})
                        }, i*speed)
                    }
                }, speed * entries.length + 1)
            }
        }
    } else if(e.id == "dungeons:rainbowoff") {
        for(const player of world.getPlayers()) {
            for(const biomeType of BiomeTypes.getAll()) {
                    const colourGrading = getPlayerColorGrading(biomeType, player)
                    colourGrading.resetHighlightsSaturation()
                    colourGrading.resetMidtonesSaturation()
                    colourGrading.resetShadowsSaturation()
                    colourGrading.resetHighlightsGamma()
                    colourGrading.resetMidtonesGamma()
                    colourGrading.resetShadowsGamma()
                    colourGrading.resetHighlightsContrast()
                    colourGrading.resetMidtonesContrast()
                    colourGrading.resetShadowsContrast()
                    colourGrading.resetShadowsOffset()
            }
        }

    }
})

system.runInterval(() => {
    for (const player of world.getPlayers({ tags: ["dungeons:ancient_graphicsetting"] })) {
        var findDim = undefined
        for (const tag of player.getTags()) if (tag.includes("dungeons:") && tag.includes("_graphicsetting") && tag !== "dungeons:ancient_graphicsetting") findDim = tag
        if (!findDim) findDim = "a"
        const dimID = findDim.replace("dungeons:", "dungeons:ancientdim_").replace("_graphicsetting", "")
        if (player.dimension.id !== dimID) {
            var dimTag = undefined
            for (const tag of player.getTags()) if (tag.includes("dungeons:") && tag.includes("_graphicsetting")) dimTag = tag
            if(!dimTag) continue;
            var colourData = undefined
            for(const entry of graphicSettings) {
                if(entry.id == dimTag.replace("dungeons:","").replace("_graphicsetting","")) colourData = entry
            }
            if(!colourData) continue;
            if(!player.dimension.isChunkLoaded(player.location)) continue;
            const playerBiome = player.dimension.getBiome(player.location)
            player.removeTag(dimTag)
            for(const biomeType of BiomeTypes.getAll()) {
                if(biomeType.id == colourData.biome) {
                    const colourGrading = getPlayerColorGrading(biomeType, player)
                    if(colourData.highlightSaturation) colourGrading.resetHighlightsSaturation()
                    if(colourData.midtonesSaturation) colourGrading.resetMidtonesSaturation()
                    if(colourData.shadowsSaturation) colourGrading.resetShadowsSaturation()
                    if(colourData.highlightsGamma) colourGrading.resetHighlightsGamma()
                    if(colourData.midtonesGamma) colourGrading.resetMidtonesGamma()
                    if(colourData.shadowsGamma) colourGrading.resetShadowsGamma()
                }
            }
        }
    }
    for (const player of world.getPlayers({ tags: ["dungeons:ignoregraphicsetting"] })) {

            var dimTag = undefined
            for (const tag of player.getTags()) if (tag.includes("dungeons:") && tag.includes("_graphicsetting")) dimTag = tag
            if(!dimTag) continue;
            var colourData = undefined
            for(const entry of graphicSettings) {
                if(entry.id == dimTag.replace("dungeons:","").replace("_graphicsetting","")) colourData = entry
            }
            if(!colourData) continue;
            if(!player.dimension.isChunkLoaded(player.location)) continue;
            const playerBiome = player.dimension.getBiome(player.location)
            player.removeTag(dimTag)
            for(const biomeType of BiomeTypes.getAll()) {
                if(biomeType.id == colourData.biome) {
                    const colourGrading = getPlayerColorGrading(biomeType, player)
                    if(colourData.highlightSaturation) colourGrading.resetHighlightsSaturation()
                    if(colourData.midtonesSaturation) colourGrading.resetMidtonesSaturation()
                    if(colourData.shadowsSaturation) colourGrading.resetShadowsSaturation()
                    if(colourData.highlightsGamma) colourGrading.resetHighlightsGamma()
                    if(colourData.midtonesGamma) colourGrading.resetMidtonesGamma()
                    if(colourData.shadowsGamma) colourGrading.resetShadowsGamma()
                }
            }

    }
    if (!hunts) return;
    
    for (const dimId of hasGraphics) {
        const dim = world.getDimension(dimId)
        const graphicsettingTag = dimId.replace("ancientdim_", "") + "_graphicsetting"
        for (const player of dim.getPlayers({ excludeTags: [graphicsettingTag, "dungeons:ignoregraphicsetting"] })) {
            player.addTag("dungeons:ancient_graphicsetting")
            player.addTag(graphicsettingTag)
            if(!player.dimension.isChunkLoaded(player.location)) continue;
            const biomeType = player.dimension.getBiome(player.location)
            var colourData = undefined
            for(const entry of graphicSettings) {
                if(entry.id == graphicsettingTag.replace("dungeons:","").replace("_graphicsetting","")) colourData = entry
            }
            const colourGrading = getPlayerColorGrading(biomeType, player)
            if(colourData.highlightSaturation) colourGrading.setHighlightsSaturation(colourData.highlightSaturation)
            if(colourData.midtonesSaturation) colourGrading.setMidtonesSaturation(colourData.midtonesSaturation)
            if(colourData.shadowsSaturation) colourGrading.setShadowsSaturation(colourData.shadowsSaturation)
            if(colourData.highlightsGamma) colourGrading.setHighlightsGamma(colourData.highlightsGamma)
            if(colourData.midtonesGamma) colourGrading.setMidtonesGamma(colourData.midtonesGamma)
            if(colourData.shadowsGamma) colourGrading.setShadowsGamma(colourData.shadowsGamma)
            
        }
    }
}, 5)
*/


//no glide
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        if (customDimIds.includes(player.dimension.id) && player.isGliding) {
            const equippable = player.getComponent("equippable")
            if (!equippable) continue;
            const chest = equippable.getEquipment("Chest")
            const dura = chest.getComponent("durability")
            if (dura.damage == dura.maxDurability) continue;
            dura.damage = dura.maxDurability
            equippable.setEquipment("Chest", chest)
            player.playSound("random.break")
        }
    }
}, 4)





//detect exit
 
const searchDist = 200; //how far to check for exit portal
const searchHeight = 100; // same but vertical
const checkCount = 32; //how many blocks to check at once
 
system.afterEvents.scriptEventReceive.subscribe(async (e) => {
    if (e.id !== "dungeons:test_if_exit") return;
    console.warn("looking for exit portal")
    const entity = e.sourceEntity;
    const dim = entity.dimension;
    const marker = dim.getEntities({ location: entity.location, type: "dungeons:ancient_hunt_marker", maxDistance: 150 });
    if (marker.length === 0) return console.warn("Failed portal check: no marker");
 
    const dimMarker = marker[0];
    if (dimMarker.getDynamicProperty("dungeons:exit_portal_location")) return console.warn("Failed portal check: already saved")
    if (dimMarker.hasTag("dungeons:searching_for_exit")) return console.warn("Failed portal check: already searching")
 
    dimMarker.addTag("dungeons:searching_for_exit")
    var loc = dimMarker.location;
    var topMost = entity.dimension.getTopmostBlock({ x: entity.location.x, z: entity.location.z }, entity.location.y)
    if (!topMost) topMost = { x: entity.location.x, y: 64, z: entity.location.z }
    loc = {
        x: loc.x,
        y: topMost.y + 1,
        z: loc.z
    }
    let hasPortal = false;
    var exitCoOrds = false
    if (!hasPortal) {
        const tickingAreaManager = world.tickingAreaManager;
        var minX
        var maxX
        var minZ
        var maxZ
        var heightMin
        var heightMax
        const maxBound = dimMarker.getDynamicProperty("dungeons:max_bound")
        const minBound = dimMarker.getDynamicProperty("dungeons:min_bound")
 
        if (maxBound !== undefined && minBound !== undefined) {
            minX = Math.min(minBound.x, maxBound.x)
            maxX = Math.max(minBound.x, maxBound.x)
            minZ = Math.min(minBound.z, maxBound.z)
            maxZ = Math.max(minBound.z, maxBound.z)
            heightMin = Math.min(minBound.y, maxBound.y)
            heightMax = Math.max(minBound.y, maxBound.y)
        } else {
            minX = loc.x - searchDist
            maxX = loc.x + searchDist
            minZ = loc.z - searchDist
            maxZ = loc.z + searchDist
            heightMin = loc.y - searchHeight
            heightMax = loc.y + searchHeight
            console.warn("§cNo bounds saved ;c")
        }
 
        if (dim.heightRange.max < heightMax) heightMax = dim.heightRange.max
        if (dim.heightRange.min > heightMin) heightMin = dim.heightRange.min
 
        const steps = [];
        for (let x = minX; x < maxX; x += checkCount) {
            for (let z = minZ; z < maxZ; z += checkCount) {
                const from = { x: x, y: heightMin, z: z };
                const to = {
                    x: Math.min(x + checkCount, maxX),
                    y: heightMax,
                    z: Math.min(z + checkCount, maxZ)
                };
                steps.push({
                    id: `dungeons_${dimMarker.id}_${Math.round(from.x)}_${Math.round(from.z)}`,
                    from,
                    to
                });
            }
        }
 
        for (const step of steps) {
            if (hasPortal) break;
            const options = { dimension: dim, from: step.from, to: step.to };
            if (!tickingAreaManager.hasCapacity(options)) {
                await system.waitTicks(5);
                if (!tickingAreaManager.hasCapacity(options)) {
                    continue;
                }
            }
 
            try {
                await tickingAreaManager.createTickingArea(step.id, options);
            } catch {
                continue;
            }
 
            const vol = new BlockVolume(step.from, step.to);
            try {
                if (dim.containsBlock(vol, { includeTypes: ["dungeons:ancient_portal"] }, true)) {
                    hasPortal = true;
                    if (exitCoOrds == false) {
                        console.warn("attempting to save location")
                        exitCoOrds = true
                        saveLoc(dimMarker, vol)
                    }
                }
            } catch { }
            tickingAreaManager.removeTickingArea(step.id);
        }
    }
 
    if (!hasPortal) {
        console.warn("§cNo exit portal was generated")
        var topMost = undefined
        var minHeight = undefined
        if (dim.id == "dungeons:ancientdim_misty_peak") minHeight = 77
        for (let h = 0; h < 10; h++) {
            if (topMost) continue;
            for (let i = -8 - h; i < 8 + h; i++) {
                if (topMost) continue;
 
                for (let j = -8 - h; j < 8 + h; j++) {
                    if (topMost) continue;
                    const testLoc = {
                        x: entity.location.x + i * 2,
                        z: entity.location.z + j * 2
                    }
                    const testTopMost = dim.getTopmostBlock(testLoc, loc.y + 1)
                    if (testTopMost && minHeight && testTopMost.y < minHeight) continue;
                    /*if (testTopMost) {
                        testTopMost.setType("minecraft:glowstone")
                    } else {
                        dim.getBlock({ x: testLoc.x, y: loc.y, z: testLoc.z }).setType("minecraft:shroomlight")
                    }*/
                    if (!topMost && testTopMost && (testTopMost.above().isAir || canBreak.includes(testTopMost.above().typeId))) {
                        const neighbours = [
                            testTopMost.north(),
                            testTopMost.east(),
                            testTopMost.south(),
                            testTopMost.west()
                        ]
                        var neighboursPass = true
                        for (const neighbour of neighbours) {
                            if (neighbour.typeId == "dungeons:ancient_hunt_barrier") neighboursPass = false
                        }
                        var noPlayersNear = dim.getPlayers({maxDistance:3, location: testTopMost.location})
                        if (noPlayersNear.length == 0 && neighboursPass && testTopMost.y > loc.y - 1) {
                            topMost = testTopMost
                        }
                    }
                }
            }
        }
        if (!topMost) {
            dimMarker.removeTag("dungeons:searching_for_exit")
            console.warn("§cNo fallback portal generated")
            return;
        }
        dimMarker.removeTag("dungeons:searching_for_exit")
        console.warn("§eGenerating exit portal...")
        dim.runCommand('/structure load "mystructure:ancient_hunt/fallback_portal" ' + `${topMost.x} ${topMost.y - 1} ${topMost.z}`)
        dimMarker.setDynamicProperty("dungeons:exit_portal_location", topMost)
    } else {
        dimMarker.removeTag("dungeons:searching_for_exit")
        if (!exitCoOrds) console.warn("never attempted to save location??")
        //console.warn("§aExit portal is generated")
    }
});

function saveLoc(marker, vol) {
    var worked = false
    var i = 0
    const tickingAreaManager = world.tickingAreaManager
    const tickId = `dungeons:dimension_save_loc_${marker.id}`
    tickingAreaManager.createTickingArea(tickId, {
        dimension: marker.dimension,
        from: vol.from,
        to: vol.to
    })
    for (const testBlock of vol.getBlockLocationIterator()) {
        i += 0.0001
        system.runTimeout(() => {
            if (marker.dimension.getBlock(testBlock).typeId == "dungeons:ancient_portal" && worked == false) {
                worked = true
                marker.setDynamicProperty("dungeons:exit_portal_location", testBlock)
            }
        }, Math.floor(i))
    }
    system.runTimeout(() => {
            marker.removeTag("dungeons:searching_for_exit")
        tickingAreaManager.removeTickingArea(tickId)
        if (worked) console.warn("Location was saved")
        if (!worked) console.warn("Location was not saved")
    }, Math.floor(i) + 1)
}

//locator bar
function clearAncientWaypoints(player) {
    const locatorBar = player.locatorBar
    for (const waypoint of locatorBar.getAllWaypoints()) {
        if (waypoint.getDimensionLocation().dimension.id.includes("dungeons:ancientdim_")) locatorBar.removeWaypoint(waypoint)
    }
}
world.afterEvents.playerDimensionChange.subscribe((e) => {
    const player = e.player;
    if (e.fromDimension.id.includes("dungeons:ancientdim_")) {
        clearAncientWaypoints(player)
        player.removeTag("dungeons:has_exit_portal_locator")
    }
})


const bounds0 = [
    {
        lowerBound: 0,
        upperBound: 128,
        texture: {
            path: "textures/locatorbar/portal_waypoint_0.png",
            iconWidth: 1,
            iconHeight: 1
        }
    },
    {
        lowerBound: 128,
        texture: {
            path: "textures/locatorbar/portal_waypoint_0_s.png",
            iconWidth: 0.66,
            iconHeight: 0.66
        }
    }
]
const bounds1 = [
    {
        lowerBound: 0,
        upperBound: 128,
        texture: {
            path: "textures/locatorbar/portal_waypoint_1.png",
            iconWidth: 1,
            iconHeight: 1
        }
    },
    {
        lowerBound: 128,
        texture: {
            path: "textures/locatorbar/portal_waypoint_1_s.png",
            iconWidth: 0.66,
            iconHeight: 0.66
        }
    }
]
const bounds2 = [
    {
        lowerBound: 0,
        upperBound: 128,
        texture: {
            path: "textures/locatorbar/portal_waypoint_2.png",
            iconWidth: 1,
            iconHeight: 1
        }
    },
    {
        lowerBound: 128,
        texture: {
            path: "textures/locatorbar/portal_waypoint_2_s.png",
            iconWidth: 0.66,
            iconHeight: 0.66
        }
    }
]
const bounds3 = [
    {
        lowerBound: 0,
        upperBound: 128,
        texture: {
            path: "textures/locatorbar/portal_waypoint_3.png",
            iconWidth: 1,
            iconHeight: 1
        }
    },
    {
        lowerBound: 128,
        texture: {
            path: "textures/locatorbar/portal_waypoint_3_s.png",
            iconWidth: 0.66,
            iconHeight: 0.66
        }
    }
]
const bounds4 = [
    {
        lowerBound: 0,
        upperBound: 128,
        texture: {
            path: "textures/locatorbar/portal_waypoint_4.png",
            iconWidth: 1,
            iconHeight: 1
        }
    },
    {
        lowerBound: 128,
        texture: {
            path: "textures/locatorbar/portal_waypoint_4_s.png",
            iconWidth: 0.66,
            iconHeight: 0.66
        }
    }
]
const bounds5 = [
    {
        lowerBound: 0,
        upperBound: 128,
        texture: {
            path: "textures/locatorbar/portal_waypoint_5.png",
            iconWidth: 1,
            iconHeight: 1
        }
    },
    {
        lowerBound: 128,
        texture: {
            path: "textures/locatorbar/portal_waypoint_5_s.png",
            iconWidth: 0.66,
            iconHeight: 0.66
        }
    }
]
const bounds6 = [
    {
        lowerBound: 0,
        upperBound: 128,
        texture: {
            path: "textures/locatorbar/portal_waypoint_6.png",
            iconWidth: 1,
            iconHeight: 1
        }
    },
    {
        lowerBound: 128,
        texture: {
            path: "textures/locatorbar/portal_waypoint_6_s.png",
            iconWidth: 0.66,
            iconHeight: 0.66
        }
    }
]
const bounds7 = [
    {
        lowerBound: 0,
        upperBound: 128,
        texture: {
            path: "textures/locatorbar/portal_waypoint_7.png",
            iconWidth: 1,
            iconHeight: 1
        }
    },
    {
        lowerBound: 128,
        texture: {
            path: "textures/locatorbar/portal_waypoint_7_s.png",
            iconWidth: 0.66,
            iconHeight: 0.66
        }
    }
]

function createWaypoint(dim, location, marker) {
    const waypoint = new LocationWaypoint({ dimension: dim, x: location.x, y: location.y, z: location.z }, {
        textureBoundsList: bounds0
    })
    var frame = 0
    const runInt = system.runInterval(() => {
        if (!marker.isValid) system.clearRun(runInt)
        frame += 1
        if (frame > 7) frame = 0
        if (frame == 0) waypoint.textureSelector = { textureBoundsList: bounds0 }
        if (frame == 1) waypoint.textureSelector = { textureBoundsList: bounds1 }
        if (frame == 2) waypoint.textureSelector = { textureBoundsList: bounds2 }
        if (frame == 3) waypoint.textureSelector = { textureBoundsList: bounds3 }
        if (frame == 4) waypoint.textureSelector = { textureBoundsList: bounds4 }
        if (frame == 5) waypoint.textureSelector = { textureBoundsList: bounds5 }
        if (frame == 6) waypoint.textureSelector = { textureBoundsList: bounds6 }
        if (frame == 7) waypoint.textureSelector = { textureBoundsList: bounds7 }

    }, 2)
    return waypoint
}

system.run(() => {
    for (const player of world.getPlayers()) {
        player.removeTag("dungeons:has_exit_portal_locator")
    }
})
world.afterEvents.entityDie.subscribe((e) => {
    const entity = e.deadEntity;
    if (!entity || !entity.isValid) return;
    if (!entity.matches({ families: ["ancient"] })) return;
    if (!entity.dimension.id.includes("dungeons:ancientdim_")) return;
    const dim = entity.dimension;
    const marker = dim.getEntities({ location: entity.location, type: "dungeons:ancient_hunt_marker", maxDistance: 200, closest: 1 });
    if (marker.length === 0) return console.warn("Failed exit portal marker: no marker");
    const dimMarker = marker[0]
    var location = undefined
    if (dimMarker.getDynamicProperty("dungeons:exit_portal_location")) location = dimMarker.getDynamicProperty("dungeons:exit_portal_location")
    if (location == undefined) return console.log("no saved location");
    var waypoint = createWaypoint(dim, location, dimMarker)
    const players = entity.dimension.getPlayers({ location: entity.location, maxDistance: 20, excludeTags: ["dungeons:has_exit_portal_locator"] })
    for (const player of players) {
        player.addTag("dungeons:boa_defeated_" + entity.typeId.replace("dungeons:",""))
        player.addTag("dungeons:has_exit_portal_locator")
        if (!player.hasTag("dungeons:defeated_ancient_tutorial")) {
            player.addTag("dungeons:defeated_ancient_tutorial")
            player.sendMessage({ translate: "dungeons.warn.ancient_exit" })
        }
        player.locatorBar.addWaypoint(waypoint)
    }
})
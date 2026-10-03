import { world, system, BlockPermutation } from "@minecraft/server";

const frameMaterials = [
    "minecraft:obsidian",
    "dungeons:gilded_obsidian",
    "dungeons:ancient_portal_frame"
]

const portalTargets = {
    spider_cave: {
        id: "spider_cave",
        minimumRunes: ["a", "s", "t"]
    },
    ancient_crypt: {
        id: "ancient_crypt",
        minimumRunes: ["a", "i", "i"]
    },
    mushroom_dimension: {
        id: "mushroom_dimension",
        minimumRunes: ["a", "i", "c", "p"]

    },
    deepsea_monument: {
        id: "deepsea_monument",
        minimumRunes: ["c", "i", "t"]

    },
    cursed_halls: {
        id: "cursed_halls",
        minimumRunes: ["s", "u", "o", "a"]

    },
    ominous_castle: {
        id: "ominous_castle",
        minimumRunes: ["o", "r", "r"]

    },
    desert_tomb: {
        id: "desert_tomb",
        minimumRunes: ["c", "o", "i"]

    },
    woodland_mansion: {
        id: "woodland_mansion",
        minimumRunes: ["o", "s", "s"]

    },
    frosted_fjord: {
        id: "frosted_fjord",
        minimumRunes: ["u", "s", "r"]

    },
    soul_ruins: {
        id: "soul_ruins",
        minimumRunes: ["r", "a", "r"]

    },
    slimy_sewer: {
        id: "slimy_sewer",
        minimumRunes: ["r", "c", "u"]

    },
    soggy_cave: {
        id: "soggy_cave",
        minimumRunes: ["r", "c", "i"]

    },
    creepy_stronghold: {
        id: "creepy_stronghold",
        minimumRunes: ["a", "a", "c", "i"]

    },
    obsidian_fortress: {
        id: "obsidian_fortress",
        minimumRunes: ["s", "r", "p", "t"]

    },
    woodland_prison: {
        id: "woodland_prison",
        minimumRunes: ["o", "o"]

    },
    outer_end: {
        id: "outer_end",
        minimumRunes: ["c", "r", "c", "s"]

    },
    pumpkin_forest: {
        id: "pumpkin_forest",
        minimumRunes: ["c", "t", "c", "o"]

    },
    silent_woods: {
        id: "silent_woods",
        minimumRunes: ["o", "p", "u", "u"]

    },
    faraway_fortress: {
        id: "faraway_fortress",
        minimumRunes: ["t", "u", "u"]

    },
    corrupted_jungle: {
        id: "corrupted_jungle",
        minimumRunes: ["c", "c", "u"]

    },
    lower_forge: {
        id: "lower_forge",
        minimumRunes: ["t", "t", "i"]

    },
    grand_bastion: {
        id: "grand_bastion",
        minimumRunes: ["r", "a", "i"]

    },
    coral_cave: {
        id: "coral_cave",
        minimumRunes: ["s", "s", "t"]

    },
    sanctum_summit: {
        id: "sanctum_summit",
        minimumRunes: ["r", "i", "i", "t"]

    },
    forgotten_citadel: {
        id: "forgotten_citadel",
        minimumRunes: ["t", "c", "a"]

    },
    misty_peak: {
        id: "misty_peak",
        minimumRunes: ["a", "u", "a"]

    }
}

import {hunts} from "./main.js"


world.afterEvents.itemStartUseOn.subscribe((e) => {
    if (!hunts) return;
    const block = e.block
    const face = e.blockFace
    const item = e.itemStack
    if (!item) return;
    if (item.typeId !== "minecraft:flint_and_steel" && item.typeId !== "minecraft:fire_charge") return
    var fireAt = undefined
    if (face == "Up") fireAt = block.above()
    if (face == "Down") fireAt = block.below()
    if (face == "North") fireAt = block.north()
    if (face == "East") fireAt = block.east()
    if (face == "South") fireAt = block.south()
    if (face == "West") fireAt = block.west()
    if (!fireAt) return;
    if (!frameMaterials.includes(fireAt.below().typeId)) return;
    system.runTimeout(() => {
        findFrame(fireAt)
    }, 1)
})

function findFrame(fireBlock) {
    var axis = undefined
    var secondColumn = undefined

    if (fireBlock.east().isAir && frameMaterials.includes(fireBlock.east().below().typeId)) {
        axis = "ew"; secondColumn = fireBlock.east()
    } else if (fireBlock.west().isAir && frameMaterials.includes(fireBlock.west().below().typeId)) {
        axis = "ew"; secondColumn = fireBlock.west()
    } else if (fireBlock.north().isAir && frameMaterials.includes(fireBlock.north().below().typeId)) {
        axis = "ns"; secondColumn = fireBlock.north()
    } else if (fireBlock.south().isAir && frameMaterials.includes(fireBlock.south().below().typeId)) {
        axis = "ns"; secondColumn = fireBlock.south()
    }

    if (!axis) return;

    checkAndBuildFrame(fireBlock, secondColumn, axis)
}

function runesSatisfy(runeValues, requiredRunes) {
    const pool = [...runeValues]
    for (const rune of requiredRunes) {
        const idx = pool.indexOf(rune)
        if (idx === -1) return false;
        pool.splice(idx, 1)
    }
    return true;
}

function checkAndBuildFrame(colA, colB, axis) {
    const dim = colA.dimension
    const y = colA.location.y

    var originX, originZ
    if (axis === "ew") {
        originX = Math.min(colA.location.x, colB.location.x)
        originZ = colA.location.z
    } else {
        originX = colA.location.x
        originZ = Math.min(colA.location.z, colB.location.z)
    }

    const interiorCells = []
    const borderCells = []

    for (let du = -1; du <= 2; du++) {
        for (let dv = -1; dv <= 3; dv++) {
            const isInterior = (du >= 0 && du <= 1 && dv >= 0 && dv <= 2)
            const pos = axis === "ew"
                ? { x: originX + du, y: y + dv, z: originZ }
                : { x: originX, y: y + dv, z: originZ + du }
            const blk = dim.getBlock(pos)
            if (!blk) return;
            (isInterior ? interiorCells : borderCells).push(blk)
        }
    }

    for (const blk of interiorCells) {
        if (blk.location.y === y) {
            if (blk.typeId !== "minecraft:fire" && blk.typeId !== "minecraft:air") return;
        } else {
            if (blk.typeId !== "minecraft:air") return;
        }
    }

    var frameCount = 0
    for (const blk of borderCells) {
        if (!frameMaterials.includes(blk.typeId)) return;
        if (blk.typeId === "dungeons:ancient_portal_frame") frameCount++
    }
    if (frameCount !== 6) return;

    const runeValues = borderCells
        .filter(blk => blk.typeId === "dungeons:ancient_portal_frame")
        .map(blk => blk.permutation.getState("dungeons:rune"))

    const matchingTargets = Object.values(portalTargets)
        .filter(target => runesSatisfy(runeValues, target.minimumRunes))

    if (matchingTargets.length === 0) return;

    const chosenTarget = matchingTargets[Math.floor(Math.random() * matchingTargets.length)]

    buildPortal(dim, originX, originZ, y, axis, chosenTarget.id)
    finalizeFrame(borderCells)
    dim.playSound("block.ancient_portal.open", colA.location, { volume: 0.59 })
    console.warn("ancient_hunt." + chosenTarget.id)
    dim.playSound("ancient_hunt." + chosenTarget.id, colA.location, { pitch: 0.9, volume: 2 })
}

function buildPortal(dim, originX, originZ, y, axis, targetId) {
    const direction = axis === "ew" ? "north" : "east"
    const permutation = BlockPermutation.resolve("dungeons:ancient_portal", {
        "minecraft:cardinal_direction": direction,
        "dungeons:target": targetId,
        "dungeons:target2": targetId
    })

    for (let du = 0; du <= 1; du++) {
        for (let dv = 0; dv <= 2; dv++) {
            const pos = axis === "ew"
                ? { x: originX + du, y: y + dv, z: originZ }
                : { x: originX, y: y + dv, z: originZ + du }
            dim.getBlock(pos)?.setPermutation(permutation)
        }
    }
}

function finalizeFrame(borderCells) {
    for (const blk of borderCells) {
        if (blk.typeId === "minecraft:obsidian") {
            const permutation = BlockPermutation.resolve("dungeons:gilded_obsidian", {
                "dungeons:unbreakable": true
            })
            blk.setPermutation(permutation)
        } else if (blk.typeId === "dungeons:gilded_obsidian" || blk.typeId === "dungeons:ancient_portal_frame") {
            blk.setPermutation(blk.permutation.withState("dungeons:unbreakable", true))
        }
    }
}
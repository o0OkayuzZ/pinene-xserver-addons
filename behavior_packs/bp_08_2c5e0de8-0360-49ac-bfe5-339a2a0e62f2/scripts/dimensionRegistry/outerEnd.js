import { world, system, BlockPermutation, BlockVolume } from "@minecraft/server";
import {hunts} from "./main.js"

import {returnDimension} from "./main.js"

const DIM_ID = "dungeons:ancientdim_outer_end"


system.runInterval(() => {
    if(!hunts) return;
    for (const player of world.getDimension(DIM_ID).getPlayers()) {
        if (!player.getDynamicProperty("dungeons:ambient_effects")) continue;
        if (player.dimension.isChunkLoaded(player.location)) player.spawnParticle("dungeons:forgotten_citadel_ambient", player.location)
    }
}, 70)


system.runInterval(() => {
    if(!hunts) return;
    for (const player of world.getDimension(DIM_ID).getPlayers()) {
        if (!player.getDynamicProperty("dungeons:ambient_effects")) continue;
        if (player.dimension.isChunkLoaded(player.location)) player.spawnParticle("dungeons:outer_end_stars", player.location)
    }
}, 25)

//void
system.runInterval(() => {
    if(!hunts) return;
    const dim = world.getDimension(DIM_ID)
    for(const entity of dim.getEntities()) {
        if(entity.isValid && entity.hasTag("dungeons:levitation_item")) {
            entity.applyImpulse({x:0, y:0.045, z:0})
            if(entity.location.y > 70) {
                entity.removeTag("dungeons:levitation_item")
                entity.addTag("dungeons:levitation_item_bounced")
            }
        }
        if(entity.isValid == false || entity.location.y > 61) continue;
        if(entity.typeId == "minecraft:item") {
            entity.addTag("dungeons:levitation_item")
            if(entity.hasTag("dungeons:levitation_item_bounced")) entity.remove()
        } else if (entity.typeId == "minecraft:player") {
                entity.addTag("dungeons:portal_proof")
                entity.setDynamicProperty("dungeons:ancient_portal_travel_time", 0)
                returnDimension(entity)
            
        } else if((entity.matches({families: ["mob"]}) || entity.matches({families: ["animal"]}) || entity.matches({families: ["monster"]}) || entity.hasTag("dungeons:ancient_hunt"))) {
            entity.remove()
        }
    }
})



system.run(() => {
    if(!hunts) return;
    for(const entity of world.getDimension(DIM_ID).getEntities({tags:["dungeons:building_border"]})) {
        entity.removeTag("dungeons:building_border")
    }
    world.setDynamicProperty("dungeons:generating_border_blocks", false)
})

system.runInterval(() => {
    if(!hunts) return;
    for(const marker of world.getDimension(DIM_ID).getEntities({type:"dungeons:ancient_hunt_marker"})) {
        if(marker.hasTag("dungeons:building_border")) {
            const players = marker.dimension.getPlayers({maxDistance: 200, location:marker.location})
            for(const player of players) {
                player.addEffect("resistance", 5, {amplifier: 255})
                player.addEffect("slowness", 10, {amplifier: 255})
                player.addEffect("blindness", 10, {amplifier: 255})
                player.runCommand("camera @s fade time 0 2 2 color 0 0 0 ")
                if(!player.hasTag("dungeons:ancient_hunt_loading"))player.onScreenDisplay.setActionBar({ rawtext: [{ text: "§l§d" }, { translate: "dungeons.warn.ancient_hunt.loading.end" }] })
            }
        }
    }
})

system.afterEvents.scriptEventReceive.subscribe(async (e) => {
    //return;
    if (e.id !== "dungeons:generated_hunt") return;
    if (e.message !== DIM_ID) return;
    const dim = world.getDimension(e.message)
    const marker = e.sourceEntity;
    if (!dim || !marker) return;

    if (marker.hasTag("dungeons:building_border")) return console.warn("Failed border build: building in process");
    if (marker.getDynamicProperty("dungeons:border_built")) return console.warn("Failed border build: already built");

    const maxBound = marker.getDynamicProperty("dungeons:max_bound")
    const minBound = marker.getDynamicProperty("dungeons:min_bound")
    const height = maxBound.y - minBound.y
    const width = Math.max(maxBound.x - minBound.x, maxBound.z - minBound.z)
    var fillsPerTick = 1
    var maxWallSliceHeight = 16
    var checkCount = 24
    console.warn(`${width} ${height}`)
    if(height > 90 || width >= 260) {
        checkCount = 12
        maxWallSliceHeight = 6
        fillsPerTick = 1
    }
    if (maxBound === undefined || minBound === undefined) return console.warn("Failed border build: no bounds saved");

    const players = marker.dimension.getPlayers({maxDistance: 200, location:marker.location})
    for(const player of players) {
        player.addEffect("resistance", 50, {amplifier: 255})
        player.addEffect("slowness", 50, {amplifier: 255})
        player.runCommand("camera @s fade time 0 2 2 color 0 0 0 ")
    }
    marker.addTag("dungeons:building_border")
    world.setDynamicProperty("dungeons:generating_border_blocks", true)

    const minX = Math.min(minBound.x, maxBound.x)
    const maxX = Math.max(minBound.x, maxBound.x)
    const minZ = Math.min(minBound.z, maxBound.z)
    const maxZ = Math.max(minBound.z, maxBound.z)
    var heightMin = Math.min(minBound.y, maxBound.y)
    var heightMax = Math.max(minBound.y, maxBound.y)

    if (dim.heightRange.max < heightMax) heightMax = dim.heightRange.max
    if (dim.heightRange.min > heightMin) heightMin = dim.heightRange.min

    const tickingAreaManager = world.tickingAreaManager;
    const block = BlockPermutation.resolve("dungeons:end_sky");

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
                id: `dungeons_border_${marker.id}_${Math.round(from.x)}_${Math.round(from.z)}`,
                from,
                to
            });
        }
    }

    let fillsSinceWait = 0;

    try {
        for (const step of steps) {
            const tickFrom = { x: step.from.x - 1, y: heightMin - 1, z: step.from.z - 1 };
            const tickTo = { x: step.to.x + 1, y: heightMax + 1, z: step.to.z + 1 };
            const options = { dimension: dim, from: tickFrom, to: tickTo };
            if (!tickingAreaManager.hasCapacity(options)) {
                await system.waitTicks(5);
                if (!tickingAreaManager.hasCapacity(options)) {
                    console.warn(`§cSkipped border step ${step.id}: no ticking area capacity`)
                    continue;
                }
            }

            try {
                await tickingAreaManager.createTickingArea(step.id, options);
            } catch {
                console.warn(`§cSkipped border step ${step.id}: failed to create ticking area`)
                continue;
            }

            const jobs = collectBorderJobs(dim, step, minX, maxX, minZ, maxZ, heightMin, heightMax, block, maxWallSliceHeight);
            for (const job of jobs) {
                if (!isSegmentAlreadyFilled(dim, job.from, job.to)) {
                    fillSafe(dim, job.from, job.to, job.block);
                }

                fillsSinceWait++;
                if (fillsSinceWait >= fillsPerTick) {
                    await system.waitTicks(1);
                    fillsSinceWait = 0;
                }
            }

            tickingAreaManager.removeTickingArea(step.id);
        }
    } finally {
        world.setDynamicProperty("dungeons:generating_border_blocks", false)
    }

    if(!marker.isValid) return console.warn("builder complete, marker gone???")
    marker.removeTag("dungeons:building_border")
    marker.setDynamicProperty("dungeons:border_built", true)
    console.warn("§aBorder generation complete")
})


function collectBorderJobs(dim, step, minX, maxX, minZ, maxZ, heightMin, heightMax, block, maxWallSliceHeight) {
    const heightRange = dim.heightRange;
    const jobs = [];

    const fromX = step.from.x - 1;
    const toX = step.to.x + 1;
    const fromZ = step.from.z - 1;
    const toZ = step.to.z + 1;

    const floorY = heightMin - 1;
    const ceilY = heightMax + 1;

    if (floorY >= heightRange.min) {
        jobs.push({ from: { x: fromX, y: floorY, z: fromZ }, to: { x: toX, y: floorY, z: toZ }, block });
    }
    if (ceilY <= heightRange.max) {
        jobs.push({ from: { x: fromX, y: ceilY, z: fromZ }, to: { x: toX, y: ceilY, z: toZ }, block });
    }

    const wallSpecs = [];
    if (step.from.x <= minX) wallSpecs.push({ axis: "z", x: minX - 1, from: fromZ, to: toZ });
    if (step.to.x >= maxX) wallSpecs.push({ axis: "z", x: maxX, from: fromZ, to: toZ });
    if (step.from.z <= minZ) wallSpecs.push({ axis: "x", z: minZ - 1, from: fromX, to: toX });
    if (step.to.z >= maxZ) wallSpecs.push({ axis: "x", z: maxZ, from: fromX, to: toX });

    for (const wall of wallSpecs) {
        for (let y = heightMin - 1; y <= heightMax + 1; y += maxWallSliceHeight) {
            const yTo = Math.min(y + maxWallSliceHeight - 1, heightMax + 1);
            if (wall.axis === "z") {
                jobs.push({ from: { x: wall.x, y, z: wall.from }, to: { x: wall.x, y: yTo, z: wall.to }, block });
            } else {
                jobs.push({ from: { x: wall.from, y, z: wall.z }, to: { x: wall.to, y: yTo, z: wall.z }, block });
            }
        }
    }

    return jobs;
}

function isSegmentAlreadyFilled(dim, from, to) {
    try {
        return !dim.containsBlock(new BlockVolume(from, to), { excludeTypes: ["dungeons:end_sky"] }, true);
    } catch (e) {
        return false;
    }
}

function fillSafe(dim, from, to, block) {
    try {
        dim.fillBlocks(new BlockVolume(from, to), block);
    } catch (e) {
        console.warn(`§cBorder section failed`)
    }
}
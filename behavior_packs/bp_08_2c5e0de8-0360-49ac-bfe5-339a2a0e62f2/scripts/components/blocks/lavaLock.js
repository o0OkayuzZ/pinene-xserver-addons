import { world, system } from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
    event.blockComponentRegistry.registerCustomComponent('dungeons:lava_lock', {
        onPlayerInteract(e) {
            const block = e.block;
            const dim = e.dimension
            drainLavaNear(dim, block.location)
            block.setType("minecraft:chiseled_nether_bricks")

        }
    })
})

function findConnectedLava(dim, startPos, maxBlocks) {
    maxBlocks = 4000
    const dirs = [
        { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
        { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 },
        { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 }
    ]

    const key = (p) => `${p.x},${p.y},${p.z}`
    const visited = new Set([key(startPos)])
    const queue = [startPos]
    const byLevel = new Map()
    var count = 0

    while (queue.length && count < maxBlocks) {
        const pos = queue.shift()
        const block = dim.getBlock(pos)
        if (!block || block.typeId != "minecraft:lava") continue

        if (!byLevel.has(pos.y)) byLevel.set(pos.y, [])
        byLevel.get(pos.y).push(pos)
        count++

        for (const d of dirs) {
            const next = { x: pos.x + d.x, y: pos.y + d.y, z: pos.z + d.z }
            const k = key(next)
            if (visited.has(k)) continue
            visited.add(k)
            const nb = dim.getBlock(next)
            if (nb && nb.typeId == "minecraft:lava") queue.push(next)
        }
    }

    return byLevel
}

// walls the pool off, drains top level first so it doesnt just refill from source below
function drainLavaPool(dim, startPos, tickDelay, sblock) {
    dim.playSound("random.fizz", sblock.location, { pitch: 0.5 })
    const maxPasses = 50
    var startY = startPos.y + 1
    function runPass(pass) {
        if (pass >= maxPasses) return console.warn("lava drain hit max passes")

        const byLevel = findConnectedLava(dim, startPos)
        if (byLevel.size == 0) return console.warn(`lava drain done, took ${pass} pass(es)`)

        const levels = [...byLevel.keys()].sort((a, b) => b - a)
        var i = 0

        function nextLevel() {
            if (i >= levels.length) {
                system.runTimeout(() => runPass(pass + 1), tickDelay)
                return
            }

            for (const pos of byLevel.get(levels[i])) {
                const block = dim.getBlock(pos)
                if (block && block.typeId == "minecraft:lava") {
                    block.setType("air")
                    if (block.y < startY) {
                        startY = block.y
                        var volume = 2 - (startPos.y - block.y) / startPos.y
                        dim.playSound("liquid.lavapop", {
                            x: sblock.x,
                            y: block.y,
                            z: sblock.z
                        }, { pitch: 0.35, volume: volume })
                    }

                }
            }

            i++
            system.runTimeout(nextLevel, tickDelay)
        }

        nextLevel()
    }

    runPass(0)
}

function drainLavaNear(dim, playerLoc) {
    const below = dim.getBlock(playerLoc)?.below()
    if (!below) return console.warn("no block below player")

    const belowLoc = below.location
    const radius = 2

    for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
            const pos = { x: belowLoc.x + dx, y: belowLoc.y, z: belowLoc.z + dz }
            const block = dim.getBlock(pos)
            if (block && block.typeId == "minecraft:lava") return drainLavaPool(dim, pos, 10, below)
        }
    }
}

system.afterEvents.scriptEventReceive.subscribe((e) => {
    if (e.id !== "dungeons:lavatest") return
    const player = e.sourceEntity
    if (!player) return

    drainLavaNear(player.dimension, player.location)
})
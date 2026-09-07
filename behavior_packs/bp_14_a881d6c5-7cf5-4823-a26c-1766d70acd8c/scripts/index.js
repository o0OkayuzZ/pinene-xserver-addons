import { world, system, ItemStack } from "@minecraft/server"

world.beforeEvents.worldInitialize.subscribe(i => {
    try {
        i.blockComponentRegistry.registerCustomComponent("block:interact", {
            onPlayerInteract: () => { }
        })
    } catch (e) {
        if (!String(e).includes("AlreadyRegistered")) throw e
    }
})

const directions = [
    { tag: "north", dx: 0, dy: 0, dz: -1 },
    { tag: "south", dx: 0, dy: 0, dz: 1 },
    { tag: "west", dx: -1, dy: 0, dz: 0 },
    { tag: "east", dx: 1, dy: 0, dz: 0 },
    { tag: "up", dx: 0, dy: 1, dz: 0 },
    { tag: "down", dx: 0, dy: -1, dz: 0 }
]
const oppositeDir = { north: "south", south: "north", west: "east", east: "west", up: "down", down: "up" }

world.afterEvents.entityDie.subscribe(e => {
    const entity = e.deadEntity
    if (entity && !["none", "selfDestruct", "contact", "override", "suicide"].includes(e.damageSource.cause)
        && !entity.hasComponent("is_baby") && entity.hasComponent("health") && !entity.typeId.includes("golem")) {
        const { x, y, z } = entity.location
        const block = entity.dimension.getBlock({ x, y, z })

        if (block?.typeId === "effectoo:xp_extractor") {
            const xpFluit = entity.dimension.spawnEntity("effectoo:xp_fluid", { x: Math.floor(x) + 0.5, y: Math.floor(y) - 0.2, z: Math.floor(z) + 0.5 })
            xpFluit.setProperty("xp:level", Math.floor(Math.random() * 11) + 1)
            xpFluit.addTag("skipTick")
        }
    }
})

system.runInterval(() => {
    processPlayerXp()
    for (const dimensionId of [...new Set(world.getAllPlayers().map(player => player.dimension.id))]) {
        const dimension = world.getDimension(dimensionId)

        if (system.currentTick % 5 === 0) {
            for (const xpOrb of dimension.getEntities({ type: "minecraft:xp_orb" })) {
                const { x, y, z } = xpOrb.location
                const block = dimension.getBlock({ x, y, z })

                if (block?.typeId === "effectoo:xp_extractor") {
                    const xpFluit = dimension.spawnEntity("effectoo:xp_fluid", { x: Math.floor(x) + 0.5, y: Math.floor(y) - 0.2, z: Math.floor(z) + 0.5 })
                    xpFluit.setProperty("xp:level", Math.floor(Math.random() * 3) + 1)
                    xpFluit.addTag("skipTick")
                    xpOrb.remove()
                }
            }
        }
        if (system.currentTick % 40 === 0) {
            for (const xpFairy of dimension.getEntities({ type: "effectoo:orb_fairy" })) {
                const fairyPos = xpFairy.location
                const player = dimension.getEntities({ location: fairyPos, closest: 1, maxDistance: 8, type: "minecraft:player" })[0]
                if (!player) continue

                const playerPos = player.location
                const distance = Math.sqrt(Math.pow(playerPos.x - fairyPos.x, 2) + Math.pow(playerPos.y - fairyPos.y, 2) + Math.pow(playerPos.z - fairyPos.z, 2))
                const factor = -0.5 / distance

                if (distance <= 4 && player.getTotalXp() > 0 && xpFairy.getProperty("xp:level") < 30916) {
                    const xpAmount = Math.min(player.xpEarnedAtCurrentLevel, Math.floor(Math.random() * 55) + 1)
                    xpFairy.setProperty("xp:level", xpFairy.getProperty("xp:level") + xpAmount)

                    const xpPts = updatePlayerXp(player)
                    player.addExperience(-xpAmount + xpPts)
                    dimension.playSound("random.orb", playerPos, { volume: 0.5, pitch: Math.random() * 0.2 + 0.9 })
                }
                else if (xpFairy.getProperty("xp:level") < 30960 && Math.random() < 0.1) {
                    xpFairy.setProperty("xp:level", xpFairy.getProperty("xp:level") + Math.floor(Math.random() * 11) + 1)
                }
                xpFairy.applyImpulse({ x: (playerPos.x - fairyPos.x) * factor, y: 0.2, z: (playerPos.z - fairyPos.z) * factor })
            }
        }
        for (const xpFluit of dimension.getEntities({ type: "effectoo:xp_fluid" })) {
            const { x, y, z } = xpFluit.location
            const [fx, fy, fz] = [Math.floor(x), Math.floor(y), Math.floor(z)]
            const currentBlock = dimension.getBlock({ x, y, z })
            const data = xpFluit.getTags()
            let currentDir = data.find(tag => directions.map(dir => dir.tag).includes(tag))
            if (!currentBlock) continue

            if (xpFluit.hasTag("skipTick")) {
                xpFluit.removeTag("skipTick")
                continue
            }
            else if (currentBlock.typeId === "effectoo:xp_extractor" && xpFluit.hasTag("followPlayer") && system.currentTick % 5 === 0) {
                xpFluit.teleport({ x: fx + 0.5, y: fy - 0.2, z: fz + 0.5 }, { keepVelocity: false })
                continue
            }
            else if (currentBlock.typeId === "effectoo:xp_tank" && xpFluit.hasTag("remove")) {
                system.runTimeout(() => { try { xpFluit.remove() } catch (e) { } }, 2); continue
            }
            else if (currentBlock.typeId != "effectoo:xp_pipe") {
                if (xpFluit.hasTag("followPlayer")) {
                    const xpPos = xpFluit.location
                    const players = dimension.getEntities({ location: xpPos, closest: 1, maxDistance: 8, type: "minecraft:player" })

                    if (players.length > 0) {
                        const player = players[0]
                        const playerPos = player.location
                        const distance = Math.sqrt(Math.pow(playerPos.x - xpPos.x, 2) + Math.pow(playerPos.y - xpPos.y, 2) + Math.pow(playerPos.z - xpPos.z, 2))
                        const factor = 0.02 / distance

                        if (distance <= 0.3) {
                            player.addExperience(xpFluit.getProperty("xp:level"))
                            dimension.playSound("random.orb", playerPos, { volume: 0.5, pitch: Math.random() * 0.2 + 0.9 })
                            xpFluit.remove()
                        }
                        else if (distance <= 3) {
                            xpFluit.applyImpulse({ x: (playerPos.x - xpPos.x) * (factor + 0.08), y: (playerPos.y - xpPos.y) * (factor + 0.08), z: (playerPos.z - xpPos.z) * (factor + 0.08) })
                        }
                        else if (distance <= 8 && xpFluit.isOnGround) {
                            xpFluit.applyImpulse({ x: (playerPos.x - xpPos.x) * factor, y: (playerPos.y - xpPos.y) * factor, z: (playerPos.z - xpPos.z) * factor })
                        }
                    }
                }
                else {
                    switch (currentDir) {
                        case "north": xpFluit.applyImpulse({ x: 0, y: 0, z: -0.1 }); break
                        case "south": xpFluit.applyImpulse({ x: 0, y: 0, z: 0.1 }); break
                        case "west": xpFluit.applyImpulse({ x: -0.1, y: 0, z: 0 }); break
                        case "east": xpFluit.applyImpulse({ x: 0.1, y: 0, z: 0 }); break
                        case "up": xpFluit.applyImpulse({ x: 0, y: 0.2, z: 0 }); break
                        case "down": xpFluit.applyImpulse({ x: 0, y: -0.1, z: 0 }); break
                    }
                    xpFluit.addTag("followPlayer")
                    xpFluit.addTag("skipTick")
                    xpFluit.triggerEvent("physics")
                    xpFluit.setProperty("xp:offset", true)
                }
                continue
            }
            else if (currentBlock.typeId === "effectoo:xp_pipe" && xpFluit.hasTag("followPlayer")) {
                xpFluit.removeTag("followPlayer")
                xpFluit.triggerEvent("default")
                xpFluit.setProperty("xp:offset", false)
                xpFluit.teleport({ x: fx + 0.5, y: fy + 0.5, z: fz + 0.5 }, { keepVelocity: false })
            }
            let direction = directions.find(dir => dir.tag === currentDir)

            if (!direction) {
                direction = getRandomDirection(null, { x, y, z }, currentBlock)
                if (direction) xpFluit.addTag(direction.tag)
            }
            if (!direction) continue
            const nextBlock = dimension.getBlock({ x: x + direction.dx * 0.5, y: y + direction.dy * 0.5, z: z + direction.dz * 0.5 })

            if (!nextBlock) continue

            let nextTick = false
            const posData = data.find(tag => tag.startsWith(`{"x`))
            if (!posData) xpFluit.addTag(JSON.stringify({ x: "U", y: "N", z: "D" }))
            else {
                const matchedPos = JSON.parse(posData)
                if (matchedPos.x != fx || matchedPos.y != fy || matchedPos.z != fz) {
                    if (Math.abs(x - fx - 0.5) < 0.1 && Math.abs(y - fy - 0.5) < 0.1 && Math.abs(z - fz - 0.5) < 0.1) {
                        nextTick = transferXpToTank(xpFluit, currentBlock, fx, fy, fz, dimension, posData)
                    }
                    if (currentBlock.permutation.getState("pipe:flow")) {
                        direction = directions.find(dir => oppositeDir[currentDir] === dir.tag)
                        xpFluit.removeTag(currentDir)
                        xpFluit.addTag(direction.tag)

                        xpFluit.removeTag(posData)
                        xpFluit.addTag(JSON.stringify({ x: fx, y: fy, z: fz }))

                        if (currentBlock.permutation.getState(`pipe:${direction.tag}`) === 1) {
                            if (dimension.getBlock({ x: fx + direction.dx, y: fy + direction.dy, z: fz + direction.dz })?.typeId === "effectoo:xp_pipe") {
                                xpFluit.teleport({ x: fx + direction.dx + 0.5, y: fy + direction.dy + 0.5, z: fz + direction.dz + 0.5 })
                            }
                        }
                        continue
                    }
                }
            }
            if (nextTick) continue
            if (nextBlock?.typeId === "effectoo:xp_pipe") moveOrbs()
            else {
                direction = getRandomDirection(currentDir, { x: fx, y: fy, z: fz }, currentBlock)
                if (direction) {
                    xpFluit.removeTag(currentDir ?? "")
                    xpFluit.addTag(direction.tag)
                }
                else if (currentDir) {
                    if (nextBlock?.typeId === "effectoo:xp_tank") {
                        direction = directions.find(dir => oppositeDir[currentDir] === dir.tag)
                        xpFluit.removeTag(currentDir)
                        xpFluit.addTag(direction.tag)
                    }
                    else if (directions.every(dir => dir.tag === oppositeDir[currentDir] || currentBlock.permutation.getState(`pipe:${dir.tag}`) === 0)) {
                        direction = directions.find(dir => dir.tag === currentDir)
                        if (currentBlock.typeId === "effectoo:xp_pipe") moveOrbs()
                    }
                    else {
                        const oldDir = currentDir
                        xpFluit.removeTag(currentDir ?? "")
                        xpFluit.addTag(oppositeDir[oldDir])
                    }
                }
            }
            if (system.currentTick % 20 === 0 && posData) {
                xpFluit.removeTag(posData)
                xpFluit.addTag(JSON.stringify({ x: "N", y: "U", z: "L" }))
            }
            function moveOrbs() {
                const random = Math.random()
                let newX = x + direction.dx * 0.11 + (random < 0.5 ? -0.05 : 0.05)
                let newY = y + direction.dy * 0.11 + (random < 0.5 ? -0.05 : 0.05)
                let newZ = z + direction.dz * 0.11 + (random < 0.5 ? -0.05 : 0.05)
                if (direction.dx != 0) { newZ = fz + 0.5; newY = fy + 0.5 }
                else if (direction.dy != 0) { newX = fx + 0.5; newZ = fz + 0.5 }
                else if (direction.dz != 0) { newX = fx + 0.5; newY = fy + 0.5 }
                xpFluit.teleport({ x: newX, y: newY, z: newZ })
            }
        }
        for (const xpStorage of dimension.getEntities({ type: "effectoo:xp_storage" })) {
            const { x, y, z } = xpStorage.location
            const block = dimension.getBlock({ x, y, z })
            const blockBelow = dimension.getBlock({ x, y, z })?.below()
            const [fx, fy, fz] = [Math.floor(x), Math.floor(y), Math.floor(z)]
            if (xpStorage.hasTag("skipTick") || !blockBelow || !block) {
                xpStorage.removeTag("skipTick")
                continue
            }
            else if (block.typeId != "effectoo:xp_tank") {
                emitXpParticles(dimension, block.location)
                continue
            }
            const currentLevel = xpStorage.getProperty("xp:level")
            if (blockBelow.typeId === "effectoo:xp_pipe" && !blockBelow.permutation.getState("pipe:flow") && !block.getRedstonePower()) {
                if (currentLevel === 0) {
                    xpStorage.remove()
                    block.setPermutation(block.permutation.withState("block:light", 0))
                    continue
                }
                else if (dimension.getEntitiesAtBlockLocation({ x: fx, y: fy - 1, z }).filter(e => e.typeId === "effectoo:xp_fluid").length > 5) continue
                const xpAmount = Math.min(currentLevel, 160)
                const xpFluit = dimension.spawnEntity("effectoo:xp_fluid", { x: fx + 0.5, y: fy - 0.2, z: fz + 0.5 })
                xpFluit.setProperty("xp:level", xpAmount)
                xpStorage.setProperty("xp:level", currentLevel - xpAmount)
                xpStorage.addTag("skipTick")
                xpFluit.addTag("down")
            }
            else if (blockBelow.typeId === "effectoo:xp_tank" && !block.getRedstonePower()) {
                if (currentLevel === 0) {
                    xpStorage.remove()
                    continue
                }
                let otherTank = dimension.getEntitiesAtBlockLocation({ x: fx, y: fy - 1, z: fz }).find(e => e.typeId === "effectoo:xp_storage")
                if (!otherTank) otherTank = dimension.spawnEntity("effectoo:xp_storage", { x: fx + 0.5, y: fy - 1, z: fz + 0.5 })
                if (otherTank.getProperty("xp:level") === 2920 || otherTank.hasTag("skipTick")) continue
                dimension.playSound("random.orb", { x: fx + 0.5, y: fy, z: fz + 0.5 }, { volume: 0.3, pitch: Math.random() * 0.2 + 0.9 })

                const otherTankLevel = otherTank.getProperty("xp:level")
                const transferAmount = Math.min(currentLevel, 160, 2920 - otherTankLevel)
                otherTank.setProperty("xp:level", otherTankLevel + transferAmount)
                xpStorage.setProperty("xp:level", currentLevel - transferAmount)

                otherTank.addTag("skipTick")
                xpStorage.addTag("skipTick")
            }
        }
        function getRandomDirection(excludeTag, { x, y, z }, currentBlock) {
            const validDirections = directions.filter(dir => dir.tag != oppositeDir[excludeTag] && currentBlock.permutation.getState(`pipe:${dir.tag}`) === 1)
            const direction = validDirections.sort(() => Math.random() - 0.5).find(dir => {
                const block = dimension.getBlock({ x: x + dir.dx, y: y + dir.dy, z: z + dir.dz })
                if (!excludeTag && block?.typeId === "effectoo:xp_tank") return true
                return block?.typeId === "effectoo:xp_pipe"
            })
            return direction
        }
    }
})

function transferXpToTank(xpFluit, currentBlock, fx, fy, fz, dimension, posData) {
    xpFluit.removeTag(posData ?? "")
    xpFluit.addTag(JSON.stringify({ x: fx, y: fy, z: fz }))

    for (const dir of directions) {
        if (dir.tag != "up" && currentBlock.permutation.getState(`pipe:${dir.tag}`) === 1) {
            const adjacentPos = { x: fx + dir.dx + 0.5, y: fy + dir.dy + 0.5, z: fz + dir.dz + 0.5 }
            const adjacentBlock = dimension.getBlock(adjacentPos)
            if (!adjacentBlock) continue

            if (adjacentBlock.typeId === "effectoo:xp_tank") {
                let xpStorage = dimension.getEntitiesAtBlockLocation(adjacentPos).find(e => e.typeId === "effectoo:xp_storage")
                if (!xpStorage) xpStorage = dimension.spawnEntity("effectoo:xp_storage", { x: fx + dir.dx + 0.5, y: fy + dir.dy, z: fz + dir.dz + 0.5 })
                if (xpStorage.getProperty("xp:level") === 2920 || xpStorage.hasTag("skipTick")) continue
                adjacentBlock.setPermutation(adjacentBlock.permutation.withState("block:light", 1))

                const currentLevel = xpStorage.getProperty("xp:level")
                const fluidLevel = xpFluit.getProperty("xp:level")
                const newLevel = Math.min(currentLevel + fluidLevel, 2920)
                xpStorage.setProperty("xp:level", newLevel)
                xpStorage.addTag("skipTick")

                const remainingLevel = fluidLevel - (newLevel - currentLevel)
                if (remainingLevel > 0) xpFluit.setProperty("xp:level", remainingLevel)
                else {
                    xpFluit.teleport(adjacentPos)
                    xpFluit.addTag("remove")
                    return true
                }
            }
        }
    }
    return false
}

function processPlayerXp() {
    for (const player of world.getAllPlayers()) {
        if (player.isSneaking) {
            const { x, y, z } = player.location
            const block = player.dimension.getBlock({ x, y, z })
            if (!block) continue

            if (block.below().typeId === "effectoo:xp_tank") {
                if (player.getTotalXp() === 0) continue

                let xpStorage = player.dimension.getEntitiesAtBlockLocation({ x, y: y - 1, z }).find(e => e.typeId === "effectoo:xp_storage")
                if (!xpStorage) xpStorage = player.dimension.spawnEntity("effectoo:xp_storage", { x: Math.floor(x) + 0.5, y: Math.floor(y) - 1, z: Math.floor(z) + 0.5 })
                if (xpStorage.getProperty("xp:level") === 2920 || xpStorage.hasTag("skipTick")) continue
                player.dimension.playSound("random.orb", { x: x + 0.5, y: y, z: z + 0.5 }, { volume: 0.3, pitch: Math.random() * 0.2 + 0.9 })
                block.below().setPermutation(block.below().permutation.withState("block:light", 1))


                let playerXp = Math.min(player.xpEarnedAtCurrentLevel, 160)
                const currentLevel = xpStorage.getProperty("xp:level")
                const newLevel = Math.min(currentLevel + playerXp, 2920)
                xpStorage.setProperty("xp:level", newLevel)

                const xpPts = updatePlayerXp(player)
                player.addExperience(-((newLevel - currentLevel) - xpPts))
                xpStorage.addTag("skipTick")
            }
            else if (block.typeId === "effectoo:xp_extractor") {
                if (player.getTotalXp() === 0) continue
                const xpFluit = player.dimension.spawnEntity("effectoo:xp_fluid", { x: Math.floor(x) + 0.5, y: Math.floor(y) - 0.2, z: Math.floor(z) + 0.5 })
                const newLevel = Math.min(player.xpEarnedAtCurrentLevel, 160)
                xpFluit.setProperty("xp:level", newLevel)
                xpFluit.addTag("skipTick")

                const xpPts = updatePlayerXp(player)
                player.addExperience(-(newLevel - xpPts))
            }
        }
    }
}

world.afterEvents.projectileHitEntity.subscribe(e => {
    const entity = e.getEntityHit().entity
    if (entity?.typeId === "effectoo:orb_fairy") handleOrbHit(entity)
})

world.afterEvents.entityHitEntity.subscribe(e => {
    const entity = e.hitEntity
    if (entity?.typeId === "effectoo:orb_fairy") handleOrbHit(entity, true)
})

function handleOrbHit(entity, despawn) {
    if (entity.getProperty("xp:level") > 0) {
        const ammount = Math.min(Math.floor(Math.random() * 5) + 1, entity.getProperty("xp:level"))

        entity.setProperty("xp:level", entity.getProperty("xp:level") - ammount)
        for (let i = 0; i < ammount; i++) {
            entity.dimension.spawnEntity("minecraft:xp_orb", entity.location)
        }
        entity.applyImpulse({ x: Math.random(), y: 1.5, z: Math.random() })
    }
    else if (despawn) {
        entity.dimension.playSound("random.orb", entity.location, { volume: 1, pitch: 2 })
        entity.dimension.spawnParticle("effectoo:orb_despawn", entity.location)
        entity.remove()
    }
}

function emitXpParticles(dimension, location) {
    const xpStorage = dimension.getEntitiesAtBlockLocation(location).find(e => e.typeId === "effectoo:xp_storage")
    if (xpStorage) {
        let xpLevel = xpStorage.getProperty("xp:level")
        for (; xpLevel > 0; xpLevel -= Math.min(xpLevel, 160)) {
            const xpAmount = Math.min(xpLevel, 160)
            const xpFluit = dimension.spawnEntity("effectoo:xp_fluid", { x: location.x + Math.random(), y: location.y, z: location.z + Math.random() })
            xpFluit.applyImpulse({ x: Math.random() - 0.5, y: Math.random(), z: Math.random() - 0.5 })
            xpFluit.setProperty("xp:level", xpAmount)
        }
        xpStorage.remove()
    }
}

system.afterEvents.scriptEventReceive.subscribe(e => {
    if (e.id === "orb_fairy:despawn") {
        const entity = e.sourceEntity
        if (!entity) return
        entity.dimension.playSound("random.orb", entity.location, { volume: 1, pitch: 2 })
        entity.dimension.spawnParticle("effectoo:orb_despawn", entity.location)
        entity.remove()
    }
})

world.afterEvents.entitySpawn.subscribe(e => {
    const entity = e.entity
    if (entity?.typeId === "effectoo:orb_fairy") {
        try { entity.setProperty("xp:level", Math.floor(Math.random() * 55) + 1) }
        catch (e) { }
    }
})

world.afterEvents.itemStartUseOn.subscribe(e => {
    const block = e.block
    if (block?.typeId === "effectoo:xp_tank" && e.itemStack?.typeId === "minecraft:glass_bottle") {
        const xpStorage = block.dimension.getEntitiesAtBlockLocation(block.location).find(e => e.typeId === "effectoo:xp_storage")
        if (xpStorage && !xpStorage.hasTag("skipTick")) {
            const xpLevel = xpStorage.getProperty("xp:level")
            if (xpLevel > 10) {
                let item = e.itemStack
                if (item.amount > 1) item.amount--
                else item = null

                const inventory = e.source.getComponent("minecraft:inventory").container
                inventory.addItem(new ItemStack("minecraft:experience_bottle"))
                inventory.setItem(e.source.selectedSlotIndex, item)
                xpStorage.setProperty("xp:level", xpLevel - Math.floor(Math.random() * 5 + 7))
                xpStorage.addTag("skipTick")
            }
        }
    }
    else if (block?.typeId === "effectoo:xp_valve") {
        const valveFlow = block.permutation.getState("valve:flow")
        const valveDir = block.permutation.getState("minecraft:block_face")
        let pipe
        switch (valveDir) {
            case "north": pipe = block.south(); break
            case "south": pipe = block.north(); break
            case "west": pipe = block.east(); break
            case "east": pipe = block.west(); break
            case "up": pipe = block.below(); break
            case "down": pipe = block.above(); break
        }
        if (pipe?.typeId === "effectoo:xp_pipe") pipe.setPermutation(pipe.permutation.withState(`pipe:flow`, !valveFlow))
        block.setPermutation(block.permutation.withState("valve:flow", !valveFlow))
    }
})

function updatePlayerXp(player) {
    if (player.xpEarnedAtCurrentLevel === 0) {
        player.addLevels(-1)
        player.addExperience(player.totalXpNeededForNextLevel - 1)

        let extraXp = player.getTags().find(tag => tag.startsWith('{"extraXp":'))
        if (extraXp) {
            player.removeTag(extraXp)
            extraXp = JSON.parse(extraXp).extraXp + player.totalXpNeededForNextLevel - player.xpEarnedAtCurrentLevel
        }
        else extraXp = player.totalXpNeededForNextLevel - player.xpEarnedAtCurrentLevel
        player.addTag(JSON.stringify({ extraXp }))
    }
    else {
        let extraXp = player.getTags().find(tag => tag.startsWith('{"extraXp":'))
        if (extraXp) {
            player.removeTag(extraXp)
            extraXp = JSON.parse(extraXp).extraXp
            return extraXp
        }
    }
    return 0
}

function updatePipeConnections(p) {
    const pipe = p.block
    const directions = { "down": pipe.below(), "up": pipe.above(), "north": pipe.north(), "south": pipe.south(), "west": pipe.west(), "east": pipe.east() }

    for (const [direction, blockAtDir] of Object.entries(directions)) {
        const state = `pipe:${direction}`
        if (state.includes("up") && blockAtDir.typeId === "effectoo:xp_extractor") {
            pipe.setPermutation(pipe.permutation.withState("block:default", 1).withState(state, 1))
        }
        else if (blockAtDir.typeId === "effectoo:xp_pipe" || blockAtDir.typeId === "effectoo:xp_tank") {
            pipe.setPermutation(pipe.permutation.withState("block:default", 1).withState(state, 1))
        }
        else if (blockAtDir.typeId === "effectoo:xp_valve") {
            const blockFace = blockAtDir.permutation.getState("minecraft:block_face")
            if (blockFace === direction) {
                pipe.setPermutation(pipe.permutation.withState("block:default", 1).withState(state, 1))
            }
        }
        else pipe.setPermutation(pipe.permutation.withState("block:default", 1).withState(state, 0))
    }
}

function updateAdjacentBlocks(block, callback) {
    const { x, y, z } = block
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            for (let k = -1; k <= 1; k++) {
                const newBlock = block.dimension.getBlock({ x: x + i, y: y + j, z: z + k })
                if (newBlock?.typeId === "effectoo:xp_pipe") {
                    callback({ block: newBlock })
                }
            }
        }
    }
}

world.afterEvents.playerPlaceBlock.subscribe(b => {
    const blockId = b.block.typeId
    if (blockId === "effectoo:xp_pipe" || blockId === "effectoo:xp_tank" || blockId === "effectoo:xp_extractor" || blockId === "effectoo:xp_valve") {
        updateAdjacentBlocks(b.block, updatePipeConnections)
    }
})

world.afterEvents.playerBreakBlock.subscribe(b => {
    const blockId = b.brokenBlockPermutation.type.id
    if (blockId === "effectoo:xp_pipe" || blockId === "effectoo:xp_tank" || blockId === "effectoo:xp_extractor" || blockId === "effectoo:xp_valve") {
        updateAdjacentBlocks(b.block, updatePipeConnections)
    }
    if (blockId === "effectoo:xp_tank") {
        emitXpParticles(b.dimension, b.block)
    }
})
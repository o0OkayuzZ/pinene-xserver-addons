
import {
    system,
    world
} from "@minecraft/server";


const canBeReplaced = [
    "minecraft:stone_bricks",
    "minecraft:stonebrick",
    "minecraft:cracked_stone_bricks",
    "minecraft:mossy_stone_bricks",
    "dungeons:golden_lock"
]

system.beforeEvents.startup.subscribe((event) => {
    event.blockComponentRegistry.registerCustomComponent("dungeons:key_golem_lock", {
        onPlayerInteract(e, { params }) {
            const { block, dimension, player } = e;
            if (!block || !player) return;
            if (dimension.isChunkLoaded(block.location) == false) return;
            const item = params.item
            const perm = block.permutation
            var forceOpen = false
            const equippable = player.getComponent("equippable")
            if (!equippable) return;
            const offhand = equippable.getEquipment("Offhand")
            if (!offhand || offhand.typeId !== item) {
                dimension.playSound("block.key_lock.rejected", block.location, { pitch: 1.2 })
                var keyGolemCount = 0
                for (const keyGolem of dimension.getEntities({ location: block.location, maxDistance: 200, type: item.replace("_item", "") })) keyGolemCount += 1
                for (const foundPlayer of dimension.getPlayers({ maxDistance: 200, location: block.location })) {
                    const fequippable = foundPlayer.getComponent("equippable")
                    const foffhand = fequippable.getEquipment("Offhand")
                    if (foffhand && foffhand.typeId == item) keyGolemCount += 1
                }
                if (keyGolemCount == 0 && player.dimension.id.includes("dungeons:ancientdim_")) {
                    player.sendMessage({ translate: "dungeons.warn.no_key_golem_near" })
                    forceOpen = true
                }
                if (!forceOpen) return;
            }
            if (!forceOpen) equippable.setEquipment("Offhand", undefined)
            var verticalCol = [block]
            for (let i = 0; i < 2; i++) {
                if (canBeReplaced.includes(block.above(i + 1).typeId)) {
                    verticalCol.push(block.above(i + 1))
                } else break;
            }
            for (let i = 0; i < 2; i++) {
                if (canBeReplaced.includes(block.below(i + 1).typeId)) {
                    verticalCol.push(block.below(i + 1))
                } else break;
            }
            dimension.playSound("mob.keygolem.unlock", player.location)
            dimension.playSound("block.key_lock.opened", block.center(), { pitch: 0.5 })
            player.runCommand("scriptevent dungeons:key_golem_unlocked")
            breakBlock(block, true)
            for (const check of verticalCol) {
                breakBlock(check, false)
                hozCol(check)
            }
        }
    });
})

function hozCol(block) {
    const horizontalCol = []
    for (let i = 0; i < 5; i++) {
        if (canBeReplaced.includes(block.west(i + 1).typeId)) {
            horizontalCol.push(block.west(i + 1))
        } else break;
    }
    for (let i = 0; i < 5; i++) {
        if (canBeReplaced.includes(block.east(i + 1).typeId)) {
            horizontalCol.push(block.east(i + 1))
        } else break;
    }
    for (let i = 0; i < 5; i++) {
        if (canBeReplaced.includes(block.north(i + 1).typeId)) {
            horizontalCol.push(block.north(i + 1))
        } else break;
    }
    for (let i = 0; i < 5; i++) {
        if (canBeReplaced.includes(block.south(i + 1).typeId)) {
            horizontalCol.push(block.south(i + 1))
        } else break;
    }
    for (let i = 0; i < horizontalCol.length; i++) {
        system.runTimeout(() => {
            const check2 = horizontalCol[i]
            breakBlock(check2, false)
            breakBlock(check2.east(), false)
            breakBlock(check2.north(), false)
            breakBlock(check2.west(), false)
            breakBlock(check2.south(), false)
        })
    }
}

function breakBlock(block, bypass) {
    if (canBeReplaced.includes(block.typeId) || bypass) {
        block.setType("air")
        block.dimension.spawnParticle("dungeons:tuff", block.center())
        system.runTimeout(() => {
            block.dimension.playSound("break.heavy_core", block.location, { volume: 1, pitch: Math.random() / 2 + 0.7 })
        }, Math.floor(Math.random() * 5))
    }
}


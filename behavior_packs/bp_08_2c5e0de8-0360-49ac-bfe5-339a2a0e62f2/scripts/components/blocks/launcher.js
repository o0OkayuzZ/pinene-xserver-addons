import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";
const expLaunch = false
system.beforeEvents.startup.subscribe((event) => {
    event.blockComponentRegistry.registerCustomComponent("dungeons:launcher", {
        onStepOn(e) {
            const entity = e.entity;
            if (entity.matches({ families: ["lightweight"] })) return;
            const block = e.block;
            activate(block)
        },
        onTick(e) {
            const block = e.block;
            const perm = block.permutation
            if (perm.getState("dungeons:active") == false) return;
            const dim = block.dimension;
            const goopy = block.getComponent("dungeons:launcher").customComponentParameters.params.goopy
            if(goopy) {
                dim.playSound("tile.piston.in", block.center(), { pitch: 0.5, volume:0.5 })
                dim.playSound("mob.slime.big", block.center(), { pitch: 1 })
            } else {
                dim.playSound("tile.piston.in", block.center(), { pitch: 1.5 })
            }
            for (const part of block.getParts()) {
                part.setPermutation(part.permutation.withState("dungeons:active", false));
            }

        }
    });
})

function activate(block) {
    const perm = block.permutation
    if (perm.getState("dungeons:active") == true) return;
    if (perm.getState("minecraft:multi_block_part") == 1) return;
    const goopy = block.getComponent("dungeons:launcher").customComponentParameters.params.goopy
    const dim = block.dimension;
    if(goopy) {
        dim.playSound("tile.piston.out", block.center(), { pitch: 0.5, volume:0.5 })
        dim.playSound("mob.slime.attack", block.center(), { pitch: 0.5 })

    } else {
        dim.playSound("tile.piston.out", block.center(), { pitch: 1.5 })
        dim.playSound("block.launcher.launch", block.center(), { pitch: Math.random() * 0.4 + 0.8 })
    }
    const above = block.above()
    for (const entity of dim.getEntitiesAtBlockLocation(above)) {
        if (!entity.hasTag("dungeons:launcher_immune")) {
            var v = entity.getVelocity()
            if (expLaunch) {
                if (Math.abs(v.x) > Math.abs(v.z)) {
                    v = {
                        x: v.x,
                        y: v.y,
                        z: 0
                    }
                } else {
                    v = {
                        x: 0,
                        y: v.y,
                        z: v.z
                    }

                }
            }

            entity.applyImpulse({ x: v.x / 0.5, y: 1.2, z: v.z / 0.5 })
            entity.addTag("dungeons:launcher_immune")
            entity.addTag("dungeons:launcher_launched")
            entity.setDynamicProperty("dungeons:launcher_height", above.y)
            system.runTimeout(() => {
                entity.removeTag("dungeons:launcher_immune")

            }, 2)
        }
    }
    for (const part of block.getParts()) {
        part.setPermutation(part.permutation.withState("dungeons:active", true));
    }
    const neighbours = [
        block.east(),
        block.west(),
        block.north(),
        block.south()
    ]
    for (const neigh of neighbours) {
        if (!neigh || !dim.isChunkLoaded(neigh.location)) continue;
        if (neigh.typeId == block.typeId) activate(neigh)
    }
}

system.runInterval(() => {
    const dims = []
    for (const player of world.getPlayers()) if (dims.includes(player.dimension) == false) dims.push(player.dimension)
    for (const dim of dims) {
        for (const mob of dim.getEntities({ tags: ["dungeons:launcher_launched"] })) {
            if (mob.isOnGround) {
                mob.setDynamicProperty("dungeons:launcher_height", null)
                mob.removeTag("dungeons:launcher_launched")
            }
        }
    }
})

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt || !hurt.isValid || e.damageSource.cause !== EntityDamageCause.fall) return;
    if (!hurt.hasTag("dungeons:launcher_launched")) return;
    const startH = hurt.getDynamicProperty("dungeons:launcher_height")
    const y = hurt.location.y
    if (y > startH - 4) {
        e.damage = 0;
        e.cancel = true
        system.run(() => {
            hurt.setDynamicProperty("dungeons:launcher_height", null)
            hurt.removeTag("dungeons:launcher_launched")

        })
        return
    } else {
        e.damage = e.damage * 0.3
        system.run(() => {
            hurt.setDynamicProperty("dungeons:launcher_height", null)
            hurt.removeTag("dungeons:launcher_launched")

        })
        return
    }
})

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt || !hurt.isValid || e.damageSource.cause !== EntityDamageCause.fall) return;
    const dim = hurt.dimension
    const block = dim.getBlock(hurt.location).below()
    if(block.typeId == "dungeons:slime_launcher") e.cancel = true;
})
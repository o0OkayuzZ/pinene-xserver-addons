import {
    world,
    system,
    ItemStack,
    DimensionTypes,
    EntityDamageCause
} from "@minecraft/server";

//Fall Asleep Event
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity
    if (!entity || !entity.isValid) return;
    if (!entity.typeId.includes("key_golem")) return;
    if (e.eventId == "dungeons:fall_asleep") {
        const targetDim = entity.getDynamicProperty("dungeons:dim")
        const targetLoc = entity.getDynamicProperty("dungeons:home")
        if (!targetDim || !targetLoc || targetDim !== entity.dimension.id) return;
        const loc = entity.location
        var distanceBetween = Math.round(Math.hypot(loc.x - targetLoc.x, loc.y - targetLoc.y, loc.z - targetLoc.z))
        if (distanceBetween < 5) {
            const block = entity.dimension.getBlock(loc)
            if (block.isAir) entity.teleport(block.bottomCenter())
        }
    }
})

// Pickup
world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt || !hurt.isValid) return;
    if (!hurt.typeId.includes("key_golem")) return;
    const attacker = e.damageSource.damagingEntity;
    if (!attacker || !attacker.isValid) return;
    e.damage = 0;
    if (attacker.typeId !== "minecraft:player" && attacker.matches({ families: ["monster"] })) {
        e.cancel = true
        system.run(() => {
            for (const tag of hurt.getTags()) if (tag.includes("dungeons:key_golem_pickup")) hurt.removeTag(tag)
            hurt.addTag(`dungeons:key_golem_pickup`)
            hurt.addTag(`dungeons:key_golem_pickup_${attacker.id}`)
            hurt.triggerEvent("dungeons:cannot_target")
            hurt.dimension.playSound("mob.keygolem.stolen", hurt.location)
        })
    } else if (attacker.typeId == "minecraft:player") {
        if (hurt.hasTag("dungeons:key_golem_pickup")) return e.cancel = true
        const equippable = attacker.getComponent("minecraft:equippable")
        if (!equippable) return e.cancel = true
        const offhand = equippable.getEquipment("Offhand")
        if (offhand) {
            attacker.sendMessage({ translate: "dungeons.warn.key_golem_wont_fit" })
            return e.cancel = true
        } else {
            system.run(() => {
                const keyItem = new ItemStack(hurt.typeId + "_item", 1)
                keyItem.lockMode = "slot"
                keyItem.setDynamicProperty("dungeons:mob_id", hurt.id)
                keyItem.setDynamicProperty("dungeons:mob_name", hurt.nameTag)
                if (hurt.getDynamicProperty("dungeons:home")) {
                    keyItem.setDynamicProperty("dungeons:mob_location", hurt.getDynamicProperty("dungeons:home"))

                } else {
                    keyItem.setDynamicProperty("dungeons:mob_location", hurt.location)
                }
                keyItem.setDynamicProperty("dungeons:mob_dimension", hurt.dimension.id)
                keyItem.nameTag = hurt.nameTag

                equippable.setEquipment("Offhand", keyItem)
                hurt.dimension.playSound("mob.keygolem.pickup", hurt.location)
                hurt.remove()
            })
        }
    }
});

//Drop
world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt || !hurt.isValid) return;
    if (hurt.typeId !== "minecraft:player") return;
    const equippable = hurt.getComponent("minecraft:equippable")
    if (!equippable) return
    const offhand = equippable.getEquipment("Offhand")
    if (!offhand) return;
    if (!offhand.hasTag("dungeons:key_golem")) return;
    const loc = hurt.location
    const dim = hurt.dimension;
    const spawnDim = offhand.getDynamicProperty("dungeons:mob_dimension");
    if (spawnDim == dim.id) {
        const spawnLoc = offhand.getDynamicProperty("dungeons:mob_location");
        system.run(() => {
            const tickingAreaManager = world.tickingAreaManager
            const tickId = `dungeons:key_golem_${offhand.getDynamicProperty("dungeons:mob_id")}`
            tickingAreaManager.createTickingArea(tickId, {
                dimension: dim,
                from: {
                    x: spawnLoc.x - 3,
                    y: spawnLoc.y,
                    z: spawnLoc.z - 3
                },
                to: {
                    x: spawnLoc.x + 3,
                    y: spawnLoc.y,
                    z: spawnLoc.z + 3
                }
            })
            system.runTimeout(() => {
                tickingAreaManager.removeTickingArea(tickId)
            }, 20)
            system.runTimeout(() => {
                const mob = dim.spawnEntity(offhand.typeId.replace("_item", ""), spawnLoc, { spawnEvent: "minecraft:entity_spawned" })
                mob.setDynamicProperty("dungeons:home", spawnLoc)
                mob.setDynamicProperty("dungeons:dim", spawnDim)
                mob.teleport(loc)
                mob.nameTag = offhand.getDynamicProperty("dungeons:mob_name");
                equippable.setEquipment("Offhand", undefined)
            }, 1)
        })
    } else {
        system.run(() => {
            const mob = dim.spawnEntity(offhand.typeId.replace("_item", ""), loc, { spawnEvent: "minecraft:entity_spawned" })
            mob.nameTag = offhand.getDynamicProperty("dungeons:mob_name");
            equippable.setEquipment("Offhand", undefined)
        })
    }
})

//monster pickup
system.runInterval(() => {
    const dims = []
    for (const player of world.getPlayers()) if (!dims.includes(player.dimension.id)) dims.push(player.dimension.id)
    for (const dimensionType of dims) {
        const dim = world.getDimension(dimensionType)
        for (const entity of dim.getEntities({ tags: ["dungeons:key_golem_pickup"] })) {
            var pickUpId = undefined
            for (const tag of entity.getTags()) if (tag.includes("dungeons:key_golem_pickup_")) pickUpId = tag.replace("dungeons:key_golem_pickup_", "")
            const holder = world.getEntity(`${pickUpId}`)
            if (holder == undefined || !holder.isValid) {
                for (const tag of entity.getTags()) if (tag.includes("dungeons:key_golem_pickup")) entity.removeTag(tag)
                for (const tag of entity.getTags()) if (tag.includes("dungeons:key_golem_pickup_")) entity.removeTag(tag)
                entity.triggerEvent("dungeons:can_target")
                continue;
            }
            const headLoc = holder.getHeadLocation()
            const targetLoc = {
                x: headLoc.x,
                y: headLoc.y + 0.3,
                z: headLoc.z
            }
            if (dim.getBlock(targetLoc) && !dim.getBlock(targetLoc).isAir) {
                if (holder == undefined || !holder.isValid) {
                    for (const tag of entity.getTags()) if (tag.includes("dungeons:key_golem_pickup")) entity.removeTag(tag)
                    for (const tag of entity.getTags()) if (tag.includes("dungeons:key_golem_pickup_")) entity.removeTag(tag)
                    entity.triggerEvent("dungeons:can_target")
                    continue;
                }
            } else {
                const didTP = entity.tryTeleport(targetLoc)
                if (!didTP) {
                    for (const tag of entity.getTags()) if (tag.includes("dungeons:key_golem_pickup")) entity.removeTag(tag)
                    for (const tag of entity.getTags()) if (tag.includes("dungeons:key_golem_pickup_")) entity.removeTag(tag)
                    entity.triggerEvent("dungeons:can_target")
                    continue;
                } else {
                    const rot = holder.getRotation()
                    entity.setRotation({ x: 0, y: rot.y / 180 })
                }
            }
        }
    }
})

//delete when leaving hunt

world.afterEvents.playerDimensionChange.subscribe((e) => {
    const fromDim = e.fromDimension;
    if(!fromDim.id.includes("dungeons:ancientdim_")) return;
    const fromLoc = e.fromLocation;
    const player = e.player;
    const equippable = player.getComponent("minecraft:equippable")
    if (!equippable) return
    const offhand = equippable.getEquipment("Offhand")
    if (!offhand) return;
    if (!offhand.hasTag("dungeons:key_golem")) return;
    if(fromDim.isChunkLoaded(fromLoc)) {
        const mob = fromDim.spawnEntity(offhand.typeId.replace("_item", ""), fromLoc, { spawnEvent: "minecraft:entity_spawned" })
        mob.nameTag = offhand.getDynamicProperty("dungeons:mob_name");
    }
    equippable.setEquipment("Offhand", undefined)
})
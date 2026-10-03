import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"

system.runInterval(() => {
    for (const player of world.getPlayers({ excludeGameModes: ["Spectator"] })) {
        if (isWearingSet(player, "dungeons:spelunker_armour")) {
            const tameTag = "dungeons:bat_" + `${player.id}`
            const dim = player.dimension
            const bats = dim.getEntities({ type: "dungeons:pet_bat", tags: [tameTag] })
            if (bats.length == 0) {
                var x = Math.random() * 7 - Math.random() * 7
                var z = Math.random() * 7 - Math.random() * 7
                const spawnLoc = dim.getTopmostBlock({ x: player.location.x + x, z: player.location.z + z }, player.location.y + 2).above().center()
                if (dim.isChunkLoaded(spawnLoc) == false) return;
                const pet = dim.spawnEntity("dungeons:pet_bat", spawnLoc)
                pet.addTag(tameTag)
                pet.getComponent("tameable").tame(player)
            }
        }
    }
}, 120)

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const id = e.eventId;
    if (id !== "dungeons:check_bat") return;
    const entity = e.entity;
    if (entity.typeId == "dungeons:pet_bat") {
        const owner = entity.getComponent("tameable").tamedToPlayer
        var despawn = false
        if (!owner) despawn = true
        if (owner && owner.dimension !== entity.dimension) despawn = true
        if (owner && !isWearingSet(owner, "dungeons:spelunker_armour")) despawn = true
        if (despawn) entity.remove()
    }
})
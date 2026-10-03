import {
    world,
    system,
    MolangVariableMap
} from "@minecraft/server";

const canFloatWhileStunned = [
    "minecraft:ghast",
    "minecraft:happy_ghast",
    "dungeons:baby_ghast",
    "minecraft:ender_dragon"
]

export function stunnedEffect(entity, duration) {
    if(!entity || !entity.isValid)
    if(entity.typeId == "minecraft:item") return;
    if (!entity.matches({ families: ["player"] }) && !entity.matches({ families: ["monster"] }) && !entity.matches({ families: ["target_dummy"] }) && !entity.matches({ families: ["mob"] }) && !entity.matches({ families: ["animal"] })) {
        return
    }
    if(entity.matches({families:["stun_immune"]})) return
    if(entity.matches({families:["reduced_stun"]})) duration = Math.max(5, duration/2)
    if(entity.matches({families:["miniboss"]}) || entity.matches({families:["boss"]})) {
        duration = Math.max(5, duration/2)
    } else if(entity.matches({families:["enchanted"]})) {
        duration = Math.max(5, duration * 0.66)
    }
    duration = Math.max(5, duration)
    var timeLeft = world.scoreboard.getObjective('dungeons:stunned_effect_t');
    if (!timeLeft) {
        timeLeft = world.scoreboard.addObjective('dungeons:stunned_effect_t');
    }
    if(entity.typeId == "minecraft:player") {
        const sendCommandFeedback = world.gameRules.sendCommandFeedback
        if(sendCommandFeedback == true) {
            world.gameRules.sendCommandFeedback = false
            system.runTimeout(() => {
                world.gameRules.sendCommandFeedback = sendCommandFeedback
            }, 2)
        }
    }
    entity.runCommand("teleport ~ " + `${entity.location.y}` + " ~ ~ 30")
    entity.addTag('dungeons:stunned_effect');
    entity.dimension.playSound("mob.stun", entity.location, {volume: 0.5})
    if(entity.typeId == "minecraft:player") entity.playSound("mob.stun", {volume: 2})
    timeLeft.setScore(entity, duration);
    return true;
}

export function removeStunnedEffect(entity) {
    if (entity.hasTag("dungeons:stunned_effect")) {
        var timeLeft = world.scoreboard.getObjective('dungeons:stunned_effect_t');
        timeLeft.removeParticipant(entity)
        entity.removeTag('dungeons:stunned_effect');
         if(entity.typeId == "minecraft:player") {
            entity.runCommand("/inputpermission set @s movement enabled")
            entity.runCommand("/inputpermission set @s camera enabled")
        }
    }
}

world.afterEvents.entityDie.subscribe((e) => {
    const deadEntity = e.deadEntity;
    if (deadEntity == undefined) return;
    if (!deadEntity.isValid) return
    removeStunnedEffect(deadEntity)
})

world.afterEvents.itemCompleteUse.subscribe((e) => {
    const { itemStack, source } = e;
    if (itemStack.typeId == "minecraft:milk_bucket") {
        removeStunnedEffect(source)
    }
})

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if(!hurt || !hurt.isValid || !hurt.hasTag("dungeons:stunned_effect")) return;
    if((Math.random() > 0.85) || (hurt.typeId == "minecraft:player" && Math.random() > 0.5)) {
        system.run(() => {
            removeStunnedEffect(hurt)
        })
    }
})

// TIMER

system.runInterval(() => {
    const dims = []
    for (const player of world.getPlayers()) if (!dims.includes(player.dimension.id)) dims.push(player.dimension.id)
    for (const dimensionType of dims) {
        const dim = world.getDimension(dimensionType)
        for (const entity of dim.getEntities({ tags: ["dungeons:stunned_effect"] })) {
            var timeLeft = world.scoreboard.getObjective('dungeons:stunned_effect_t');
            if (!timeLeft) return;
            if (!timeLeft.hasParticipant(entity)) continue;
            let duration = timeLeft.getScore(entity);
            if (duration % 8 == 0 && dim.isChunkLoaded(entity.location)) dim.spawnParticle("dungeons:stun_effect_smoke", entity.location)
            if (duration % 5 == 0 && dim.isChunkLoaded(entity.location)) dim.spawnParticle("dungeons:stun_effect_circles", entity.getHeadLocation())

            if (duration > 0) {
                timeLeft.addScore(entity, -1);

                //stun code
                if(entity.typeId !== "minecraft:player") {
                    if(entity.matches({families:["creeper"]})) entity.triggerEvent("minecraft:stop_exploding")
                    if(entity.isOnGround && entity.getBlockStandingOn()) {
                        const v = entity.getVelocity()
                        entity.applyImpulse({x:v.x*-1.1,y:0,z:v.z*-1.1})
                        entity.runCommand("teleport ~ " + `${entity.location.y}` + " ~ ~ 30")
                    } else {
                        const v = entity.getVelocity()
                        entity.applyImpulse({x:v.x*-1,y:(-0.1 * !canFloatWhileStunned.includes(entity.typeId)),z:v.z*-1})
                    }
                } else {
                    entity.runCommand(`camerashake add @s ${Math.min(0.2,duration/1000) + 0.02} 0.5`)
                    entity.runCommand("/inputpermission set @s movement disabled")
                    entity.runCommand("/inputpermission set @s camera disabled")
                    entity.addEffect("mining_fatigue", duration, {amplifier: 255, showParticles:false})
                    if(entity.isOnGround && entity.getBlockStandingOn()) {
                        const v = entity.getVelocity()
                        entity.applyImpulse({x:v.x*-1.1,y:0,z:v.z*-1.1})
                    } else {
                        const v = entity.getVelocity()
                        entity.applyImpulse({x:v.x*-1,y:-0.1,z:v.z*-1})
                    }
                }
            }
            if (duration <= 0  || (entity.typeId == "minecraft:player" && entity.getGameMode() == "Spectator")) {
                removeStunnedEffect(entity)
            }
        }
    }
});

//effects
world.afterEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt || !hurt.isValid) return;
    if (hurt.hasTag("dungeons:stunned_effect")) hurt.clearVelocity()
})

//cannot attack
world.beforeEvents.entityHurt.subscribe((e) => {
    const attacker = e.damageSource.damagingEntity;
    if(!attacker || !attacker.isValid || !attacker.hasTag("dungeons:stunned_effect")) return
    if(e.damageSource.cause !== "entityAttack") return;
    e.damage = 0;
    e.cancel = true
})

//cannot use item
world.beforeEvents.itemUse.subscribe((e) => {
    const player = e.source;
    if(e.itemStack.typeId == "minecraft:milk_bucket") return;
    if(!player || !player.isValid || !player.hasTag("dungeons:stunned_effect")) return
    e.cancel = true
})

//cannot shoot
world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    if(!entity || !entity.isValid) return;
    const projectile = entity.getComponent("projectile")
    if(!projectile) return;
    const owner = projectile.owner;
    if(owner && owner.hasTag("dungeons:stunned_effect")) entity.remove()
})

//cannot pickUp
world.beforeEvents.entityItemPickup.subscribe((e) => {
    const player = e.entity
    if(!player || !player.isValid || !player.hasTag("dungeons:stunned_effect")) return
    e.cancel = true
})

//cannot explode
world.beforeEvents.explosion.subscribe((e) => {
    const source = e.source
    if(!source) return;
    if(!source || !source.isValid || !source.hasTag("dungeons:stunned_effect")) return
    e.cancel = true
    system.run(() => {
        if(source.matches({families:["creeper"]})) source.triggerEvent("minecraft:stop_exploding")
    })
})

//cannot mine
world.beforeEvents.playerBreakBlock.subscribe((e) => {
    const player = e.player
    if(!player || !player.isValid || !player.hasTag("dungeons:stunned_effect")) return
    e.cancel = true
})

//cannot interact
world.beforeEvents.playerInteractWithBlock.subscribe((e) => {
    const player = e.player
    if(!player || !player.isValid || !player.hasTag("dungeons:stunned_effect")) return
    e.cancel = true
})
world.beforeEvents.playerInteractWithEntity.subscribe((e) => {
    const player = e.player
    if(!player || !player.isValid || !player.hasTag("dungeons:stunned_effect")) return
    e.cancel = true
})
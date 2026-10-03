import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { isValidTarget, getDirection, makeVector } from "main.js"
import { addVoidedEffect } from "misc/voidedEffect.js"

//spawn cutscene
system.afterEvents.scriptEventReceive.subscribe((event) => {
    const id = event.id;
    const entity = event.sourceEntity;
    if (id === 'dungeons:delay_cutscene_end') {
        system.runTimeout(() => {
            entity.runCommand("camerashake add @a[r=128] 0.1 6 positional")
            entity.runCommand("camerashake add @a[r=128] 0.4 3 positional")
            entity.runCommand("camerashake add @a[r=128] 0.4 2.5 positional")
            entity.runCommand("camerashake add @a[r=128] 0.4 2 positional")
            entity.runCommand("camerashake add @a[r=128] 0.4 1.5 positional")
        }, 230)
        system.runTimeout(() => {
            entity.runCommand('function cutscene/exit_cutscene')
        }, 300);
    }
});
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:start_cutscene' && entity.typeId == "dungeons:vengeful_heart_of_ender_resting") {
        let hp = entity.getComponent("health")
        hp.setCurrentValue(9)
        for (let i = 1; i < hp.defaultValue / 9; i++) {
            system.runTimeout(() => {
                if (entity.getComponent("health").currentValue + 9 <= hp.defaultValue) {
                    hp.setCurrentValue(entity.getComponent("health").currentValue + 9)
                } else {
                    hp.setCurrentValue(entity.getComponent("health").defaultValue)

                }
            }, i)
        }
    }
})
//death cutscene

system.afterEvents.scriptEventReceive.subscribe((event) => {
    const id = event.id;
    const entity = event.sourceEntity;
    if (id === 'dungeons:vhoe_death') {

        system.runTimeout(() => {
            entity.dimension.getEntities({
                location: entity.location,
                maxDistance: 64,
                type: 'minecraft:player'
            }).forEach(target => {
                target.runCommand('camerashake add @s 0.44 1.2 positional')
            });

            system.runTimeout(() => {
                entity.dimension.getEntities({
                    location: entity.location,
                    maxDistance: 64,
                    type: 'minecraft:player'
                }).forEach(target => {
                    target.runCommand('camerashake add @s 2 5 positional')
                    target.runCommand('camera @s fade time 3 4 6 color 255 255 255 ')
                });
            }, 24);
        }, 60);
    }
});
world.afterEvents.entityDie.subscribe((event) => {
    const deadEntity = event.deadEntity;
    if (deadEntity.typeId === "dungeons:vengeful_heart_of_ender") {
        const rot = deadEntity.getRotation().y
        const spooky = deadEntity.getProperty("dungeons:spooky")
        const dead = deadEntity.dimension.spawnEntity('dungeons:vengeful_heart_of_ender_death', deadEntity.location, { initialRotation: rot });
        dead.setProperty("dungeons:spooky", spooky)
        deadEntity.addEffect("invisibility", 80, {
            amplifier: 1,
            showParticles: false
        });
        system.runTimeout(() => {

            deadEntity.remove();
        }, 1)
        let hp = dead.getComponent('minecraft:health');
        hp.setCurrentValue(1);
    }
});

// Attack - Big Bang

system.afterEvents.scriptEventReceive.subscribe((event) => {
    const id = event.id;
    const entity = event.sourceEntity;
    const message = event.message;
    if (id === 'dungeons:big_bang_attack') {
        var value = parseInt(message);
        if (!value) {
            console.warn('No damage specified for big-bang');
            return;
        }
        if (!entity.hasTag('dungeons:vhoe_locked_in')) {
            value = value / 3;
        }
        entity.addTag('dungeons:vhoe_locked_in')

        system.runTimeout(() => {
            entity.dimension.spawnParticle('dungeons:big_bang_explosion', entity.location);
            entity.dimension.spawnParticle('dungeons:big_bang_explosion_small', entity.location);
            system.runTimeout(() => {
                entity.dimension.spawnParticle('dungeons:big_bang_stars', entity.location);
                entity.dimension.playSound('ambient.weather.the_end_light_flash', entity.location, {
                    volume: 100,
                    pitch: 2.5
                });
                entity.dimension.getEntities({
                    location: entity.location,
                    maxDistance: 17.5,
                    families: ['player']
                }).forEach(target => {
                    target.applyDamage(value, {
                        cause: EntityDamageCause.magic,
                        damagingEntity: entity
                    });
                    if (target.typeId === 'minecraft:player') {
                        target.runCommand('camerashake add @s 1 1 positional')
                    }
                });
                entity.dimension.getEntities({
                    location: entity.location,
                    maxDistance: 15,
                    families: ['player']
                }).forEach(kb_target => {
                    const dir = getDirection(entity.location, kb_target.location);
                    kb_target.applyKnockback(makeVector(dir, 1), 0.5);
                });
            }, 7);
        }, 20);
    }
});

//Attack - Black Hole

system.runInterval(() => {
    const dims = []
    for (const player of world.getPlayers()) if (!dims.includes(player.dimension.id)) dims.push(player.dimension.id)
    for (const dimensionType of dims) {
        const dim = world.getDimension(dimensionType)
        for (let entity of dim.getEntities({
            tags: ["dungeons:vhoe_pull"],
            type: "dungeons:vengeful_heart_of_ender"
        })) {
            if (dim.isChunkLoaded(entity.location) == false) continue;
            dim.spawnParticle('dungeons:vhoe_pull', entity.location);
            dim.getEntities({
                location: entity.location,
                maxDistance: 17.5,
                families: ['player']
            }).forEach(target => {
                dim.spawnParticle('dungeons:vhoe_sucking', target.location);
            });
            dim.getEntities({
                location: entity.location,
                maxDistance: 64,
                minDistance: 6,
                excludeFamilies: ['enderman', 'boss', 'gravity_immune', 'endersent', 'endermite', 'enderling', 'inanimate', 'ignore']
            }).forEach(pulled => {
                const yDif = pulled.location.y - entity.location.y;
                var mult = 4;
                var mult2 = 0.52;

                if (pulled.typeId === 'minecraft:player' && pulled.isFlying) return;
                if (pulled.isSprinting) {
                    mult = mult * 0.33;
                }
                if (!pulled.isOnGround) {
                    mult2 = mult + 0.3;
                    mult = mult * 0.5;
                }
                if (pulled.isOnGround && pulled.isSneaking) {
                    mult = mult * 0.4
                }
                const dir = getDirection(pulled.location, entity.location)
                //pulled.applyKnockback(makeVector(dir, 0.17 * mult), 0.02 * mult2);
                if (mult2 > 3 || yDif >= 8 || (yDif <= -8 && yDif >= -24)) mult2 += -0.33 * yDif
                pulled.applyImpulse({ x: makeVector(dir, 0.04 * mult).x, y: 0.01 * mult2, z: makeVector(dir, 0.04 * mult).z })
            });
        }
    }
}, 1);


//scatter bombs

const bombId = "dungeons:vhoe_mine_projectile"

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    //if(e.entity.typeId == "dungeons:vengeful_heart_of_ender") world.sendMessage(e.eventId)
})

system.runInterval(() => {
    const dims = []
    for (const player of world.getPlayers()) if (!dims.includes(player.dimension.id)) dims.push(player.dimension.id)
    for (const dimensionType of dims) {
        const dim = world.getDimension(dimensionType)
        const mobs = dim.getEntities({type:"dungeons:vengeful_heart_of_ender"})
        for(const entity of mobs) {
            if(!entity.getProperty("dungeons:casting")) continue;
            const bombsLeft = entity.getProperty("dungeons:bombs")
            if(bombsLeft == 0) continue;
            const view = entity.getViewDirection()
            const bomb = dim.spawnEntity(bombId, {
                x:entity.location.x + view.x, y:entity.location.y+3 + Math.random(), z:entity.location.z+view.z
            })
            const proj = bomb.getComponent("projectile")
            proj.owner = entity
            const randX = Math.round((Math.random()*2 - 1)*100)/100
            const randZ = Math.round((Math.random()*2 - 1)*100)/100
            proj.shoot({
                x:randX/1.5,
                y:0 + Math.random()/3,
                z:randZ/1.5
            })
            entity.setProperty("dungeons:bombs", bombsLeft - 1)
        }
    }
},3)

world.afterEvents.projectileHitBlock.subscribe((e) => {
    const entity = e.projectile;
    const loc = e.location;
    const dim = e.dimension;
    if (entity.typeId == bombId) {
        const proj = entity.getComponent("minecraft:projectile")
        const owner = proj.owner;
        if (!owner) {
            entity.remove()
            return;
        }
        dim.spawnEntity("dungeons:vhoe_bomb", e.getBlockHit().block.above().bottomCenter())
        entity.remove()
    }
})

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (entity.typeId !== "dungeons:vhoe_bomb") return;
    if (id === 'dungeons:vhoe_bomb_explode') {
        if (!entity.isValid) return;
        var loc = entity.location;
        const dim = entity.dimension;
        dim.spawnParticle("dungeons:endersent_teleport_boom", { x: loc.x, y: loc.y - 0.5, z: loc.z })
        dim.spawnParticle("dungeons:endersent_teleport_boom_dust", loc)
        dim.playSound("random.explode", loc, { pitch: 0.5 })
        dim.playSound("armour.teleport.explode", loc)
        const endermiteCount = dim.getEntities({families:["vhoe_endermite"], maxDistance:54, location: loc})
        if(endermiteCount.length < 8 && Math.random() > 0.5) {
            const eventId = "dungeons:spawn_for_vhoe"
            var mobId = "minecraft:endermite"
            if(Math.random() > 0.9) mobId = "dungeons:enchanted_endermite"
            dim.spawnEntity(mobId, loc, {spawnEvent:eventId})
        }
        entity.remove()

        const targets = dim.getEntities({ location: loc, maxDistance: 6 })
        for (const target of targets) {
            if (target.matches({families:["endermite"]})) continue;
            if (target.matches({families:["enderling"]})) continue;
            if (target.matches({families:["enderman"]})) continue;
            if (target.matches({families:["vengeful_heart_of_ender"]})) continue;
            if ((isValidTarget(target) || target.matches({ families: ["player"] }))) {
                var dmgAmt = 10
                if(world.getDifficulty() == "Normal") dmgAmt = 15
                if(world.getDifficulty() == "Hard") dmgAmt = 20
                const damage = target.applyDamage(dmgAmt, { cause: EntityDamageCause.entityExplosion })
                if (damage) {
                    if(dmgAmt > 10) {
                        addVoidedEffect(target, dmgAmt*10)
                        target.addEffect("slowness", dmgAmt*10, {showParticles:false})
                    }
                    if (target.typeId == "minecraft:player") {
                        target.runCommand("camerashake add @s 0.15 2")
                        target.runCommand("camerashake add @s 0.15 1.5")
                        target.runCommand("camerashake add @s 0.15 1")
                        target.runCommand("camerashake add @s 0.15 0.5")
                    }
                    const dir = getDirection(loc, target.location);
                    target.applyKnockback(makeVector(dir, 0.6), 0.4)
                }
            }
        }

        for (const mine of dim.getEntities({ type: entity.typeId, maxDistance: 5, minDistance: 0.5, location: loc })) {
            system.runTimeout(() => {
                if (mine.isValid) mine.triggerEvent("dungeons:vhoe_bomb_explode")
            }, 3)
        }
    }
});
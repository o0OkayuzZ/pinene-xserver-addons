import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

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
        const dead = deadEntity.dimension.spawnEntity('dungeons:vengeful_heart_of_ender_death', deadEntity.location, { initialRotation: rot });
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

import { getDirection, makeVector } from "main.js"

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
const dimensionIds = ["overworld", "nether", "the_end"];

system.runInterval(() => {
    for (let dimId of dimensionIds) {
        for (let entity of world.getDimension(dimId).getEntities({
            tags: ["dungeons:vhoe_pull"],
            type: "dungeons:vengeful_heart_of_ender"
        })) {
            if (entity.dimension.isChunkLoaded(entity.location) == false) continue;
            entity.dimension.spawnParticle('dungeons:vhoe_pull', entity.location);
            entity.dimension.getEntities({
                location: entity.location,
                maxDistance: 17.5,
                families: ['player']
            }).forEach(target => {
                target.dimension.spawnParticle('dungeons:vhoe_sucking', target.location);
            });
            entity.dimension.getEntities({
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
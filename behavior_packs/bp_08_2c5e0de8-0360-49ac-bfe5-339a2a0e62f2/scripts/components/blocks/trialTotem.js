import {
    world,
    system,
    ItemStack,
    EntityDamageCause
} from "@minecraft/server";

import { getDirection, makeVector } from "main.js"
import { addVoidedEffect } from "misc/voidedEffect.js"

function spawnWave(block, dim, type, state) {
    if (dim.isChunkLoaded(block.location) == false) return;
    if (state == "on") dim.spawnParticle("dungeons:trial_totem_basic", block.bottomCenter())
    if (state == "ominous") dim.spawnParticle("dungeons:trial_totem_ominous", block.bottomCenter())
    dim.playSound("block.trial_totem.wave", block.location)
    const mobsInRange = dim.getEntities({ maxDistance: 10, location: block.location, excludeFamilies: ["ignore", "inanimate"] })
    var targets = []
    for (const mob of mobsInRange) {
        if (targets.includes(mob)) continue;
        if (mob.matches({ families: ["player"] }) || mob.matches({ families: ["monster"] }) || mob.matches({ families: ["mob"] }) || mob.matches({ families: ["animal"] })) {
            targets.push(mob)
        }
    }
    system.runTimeout(() => {
        if (dim.isChunkLoaded(block.location) == false) return;
        for (const target of targets) {
            if (target.isValid == false) continue;
            if (target.matches({ families: ["monster"] })) {
                const isOnFire = target.getComponent("onfire")
                if (isOnFire) {
                    if (dim.isChunkLoaded(target.location) == true) {
                        if (state == "on") dim.spawnParticle("dungeons:trial_totem_prepare_basic", target.location)
                        if (state == "ominous") dim.spawnParticle("dungeons:trial_totem_prepare_ominous", target.location)
                    }
                    target.extinguishFire()
                    target.addEffect("fire_resistance", 200, { showParticles: false })
                } else {
                    const rand = Math.random()
                    if (rand > 0.5 && state == "ominous") {
                        dim.spawnParticle("dungeons:trial_totem_prepare_ominous", target.location)
                        if (rand > 0.76) target.addEffect("strength", 160, { showParticles: true })
                        if (rand <= 0.76) target.addEffect("speed", 160, { showParticles: true })
                    }
                }
            } else {
                if (type == "stone") {
                    if (state == "ominous") target.applyDamage(5, { cause: EntityDamageCause.magic })
                    if (state == "on") target.applyDamage(2.5, { cause: EntityDamageCause.magic })
                }
                if (type == "mossy") {
                    if (state == "ominous") {
                        target.applyDamage(1, { cause: EntityDamageCause.magic })
                        target.addEffect("fatal_poison", 300, { amplifier: 1 })
                    }
                    if (state == "on") {
                        target.applyDamage(1, { cause: EntityDamageCause.magic })
                        target.addEffect("fatal_poison", 150, { amplifier: 0 })
                    }
                }
                if (type == "calcite") {
                    dim.spawnParticle('minecraft:wind_explosion_emitter', block.center());
                    dim.playSound('wind_charge.burst', block.center())
                    const dir = getDirection(block.location, target.location);
                    if (state == "ominous") {
                        target.applyDamage(3, { cause: EntityDamageCause.blockExplosion })
                        target.applyKnockback(makeVector(dir, -2), 1.33)
                    }
                    if (state == "on") {
                        target.applyDamage(3, { cause: EntityDamageCause.blockExplosion })
                        target.applyKnockback(makeVector(dir, 4), 0.5)
                    }
                }
                if (type == "void") {
                    if (state == "ominous") {
                        target.applyDamage(4, { cause: EntityDamageCause.magic })
                        target.addEffect("weakness", 200, { amplifier: 1 })
                        addVoidedEffect(target, 200)
                    }
                    if (state == "on") {
                        target.applyDamage(2, { cause: EntityDamageCause.magic })
                        target.addEffect("weakness", 200, { amplifier: 0 })
                        addVoidedEffect(target, 100)
                    }
                }
            }
        }
    }, 5)
}

system.beforeEvents.startup.subscribe((event) => {
    event.blockComponentRegistry.registerCustomComponent("dungeons:trial_totem", {
        onTick(e, { params }) {
            const { block, dimension } = e;
            if (dimension.isChunkLoaded(block.location) == false) return;
            const type = params.type
            const perm = block.permutation
            const below = block.below()
            if (below.typeId !== "minecraft:trial_spawner") return;
            const totemType = perm.getState("dungeons:type")
            const belowPerm = below.permutation
            const trialSpawnerType = belowPerm.getState("ominous")
            const trialSpawnerState = belowPerm.getState("trial_spawner_state")

            if (totemType !== "off") {
                const energy = perm.getState("dungeons:energy")
                const subenergy = perm.getState("dungeons:subenergy")
                if (energy > 0) {
                    block.setPermutation(block.permutation.withState("dungeons:energy", energy - 1))
                } else {
                    if (subenergy > 0) {
                        block.setPermutation(block.permutation.withState("dungeons:energy", 9))
                        block.setPermutation(block.permutation.withState("dungeons:subenergy", subenergy - 1))
                    } else {
                        block.setPermutation(block.permutation.withState("dungeons:subenergy", 9))

                        dimension.playSound("block.trial_totem.charge", block.location)
                        if (totemType == "on") dimension.spawnParticle("dungeons:trial_totem_prepare_basic", block.bottomCenter())
                        if (totemType == "ominous") dimension.spawnParticle("dungeons:trial_totem_prepare_ominous", block.bottomCenter())
                        system.runTimeout(() => {

                            spawnWave(block, dimension, type, totemType)
                        }, 15)



                    }
                }
            } else {
                if (belowPerm.getState("trial_spawner_state") == 4) {
                    for (const item of dimension.getEntitiesAtBlockLocation(block.location)) {
                        if (item.typeId == "minecraft:item") {
                            item.tryTeleport(block.above().bottomCenter())
                            dimension.spawnParticle("dungeons:trial_totem_prepare_basic", block.above().bottomCenter())

                        }
                    }
                }
            }

            if (trialSpawnerState !== 2 && totemType !== "off") {
                block.setPermutation(perm.withState('dungeons:type', "off").withState("dungeons:subenergy", 3))
                return;
            }
            if (trialSpawnerState == 2 && trialSpawnerType == false && totemType !== "on") {
                dimension.playSound("block.trial_totem.activate", block.center())
                block.setPermutation(perm.withState('dungeons:type', "on").withState("dungeons:subenergy", 3))
                return;
            }
            if (trialSpawnerState == 2 && trialSpawnerType == true && totemType !== "ominous") {
                dimension.playSound("block.trial_totem.activate", block.center(), { pitch: 0.7 })
                block.setPermutation(perm.withState('dungeons:type', "ominous").withState("dungeons:subenergy", 3))
                return;
            }
        }
    });
})


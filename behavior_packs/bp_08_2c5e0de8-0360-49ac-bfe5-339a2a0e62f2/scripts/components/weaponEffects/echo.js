import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";
import { specialDamage } from "main.js";

const effectId = "dungeons:echo"

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    const attacker = e.damageSource.damagingEntity;
    if (!attacker) return;
    if (!attacker.isValid) return;
    if (attacker.typeId !== 'minecraft:player') return;
    const cause = e.damageSource.cause;
    if (cause !== EntityDamageCause.entityAttack) return;
    const equippable = attacker.getComponent("equippable")
    if (!equippable) return;
    const heldItem = equippable.getEquipment("Mainhand")
    if (!heldItem) return;
    if (!heldItem.hasTag(effectId) && !heldItem.getDynamicProperty(effectId.replace("dungeons:", "dungeons:gild_"))) return;
    //effect code
    if (e.damage <= 0) return;
    system.run(() => {
        const hp = hurt.getComponent("health")
        if (hp) {
            if (hp.currentValue <= 0) return;
        }
        var echoT = world.scoreboard.getObjective('dungeons:echo_t');
        if (!echoT) {
            echoT = world.scoreboard.addObjective('dungeons:echo_t');
        }
        if (echoT.hasParticipant(attacker.scoreboardIdentity)) return;
        var delay = 10
        if(heldItem.getComponent("dungeons:daggers")) delay += 10
        if(heldItem.getComponent("dungeons:gauntlets")) delay += 10
        if(heldItem.getComponent("dungeons:sickles")) delay += 10
        if(heldItem.getComponent("dungeons:void_blades")) delay += 10
        if(heldItem.hasTag("dungeons:triple_hit")) delay += 10
        echoT.setScore(attacker, 100 + delay);
        system.runTimeout(() => {
            const dim = hurt.dimension
            const hurtLoc = hurt.location;
            if(heldItem.typeId == "dungeons:spine_chill_spear") {
                var count = 3 +  Math.round(e.damage/4)
                for(let i = 0; i< count; i++) {
                    dim.spawnParticle('dungeons:spine_chill_spear', hurt.getHeadLocation());
                    dim.spawnParticle('dungeons:spine_chill_echo', hurt.getHeadLocation());
                }
                dim.playSound('weapon.rush_spear.attack_spooky', hurtLoc, {
                    volume: 0.6
                });
                dim.playSound('weapon.cackling_broom.swing', hurtLoc, {pitch: 1.5});
                const deadLoc = hurt.location
                system.runTimeout(() => {
                    var dead = false
                    if(hurt.isValid) {
                        const hp = hurt.getComponent("health")
                        if(hp.currentValue <= 0) dead = true
                    } else {
                        dead = true
                    }
                    if(dead) {
                        for(let i = 0; i< 5; i++) {
                            dim.spawnParticle('dungeons:spine_chill_spear', deadLoc);
                            dim.spawnParticle('dungeons:spine_chill_echo', deadLoc);
                        }
                        dim.playSound("weapon.rush_spear.spooky", deadLoc, { pitch: Math.random() / 5 + 0.9 })
                        dim.playSound('weapon.cackling_broom.swing', deadLoc, {pitch: 2});
                    }
                },14)
            } else {
                dim.spawnParticle('dungeons:echo', hurtLoc);
                dim.playSound('weapon.daggers.hit', hurtLoc, {
                    volume: 0.6
                });
            }
            const diddamage = specialDamage(attacker, hurt, 7, cause, ["weapon", "apply_weakness", "apply_strength", "apply_melee_enchants"])
            if (diddamage == false) specialDamage(attacker, hurt, 1, cause, ["weapon"])
        }, delay)
    })
});

// TIMER
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        var timeLeft = world.scoreboard.getObjective('dungeons:echo_t');
        if (!timeLeft) return;
        if (!player.scoreboardIdentity) continue;
        if (!timeLeft.hasParticipant(player.scoreboardIdentity)) continue;
        let duration = timeLeft.getScore(player);

        if (duration > 0) {
            timeLeft.addScore(player, -1);
        }
        if (duration <= 0) {
            timeLeft.removeParticipant(player)
        }
    }
});
import {
    world,
    system,
    EntityDamageCause,
    ButtonState,
    InputPermissionCategory
} from "@minecraft/server";

import { isWearingSet, isWearingMysteryArmour } from "components/armour.js"
world.afterEvents.playerButtonInput.subscribe((event) => {
    const player = event.player;
    const button = event.button;
    const newState = event.newButtonState;
    let inputInfo = player.inputInfo.lastInputModeUsed;
    if (player.hasTag("dungeons:rolltest") == false && !isWearingSet(player, "dungeons:goat_armour") && !isWearingMysteryArmour(player, "roll")) return;
    if (isWearingSet(player, "dungeons:teleportation_robes")) return;
    if (player.hasTag("dungeons:cutscene")) return;
    if(player.isOnGround == false) return;
    const inputPerms = player.inputPermissions
    if(inputPerms.isPermissionCategoryEnabled(InputPermissionCategory.Movement) == false) return;
    if(inputPerms.isPermissionCategoryEnabled(InputPermissionCategory.LateralMovement) == false) return;
    if (button === "Jump") return;
    if (newState === ButtonState.Released) return;
    if (player.hasTag('dungeons:debug')) {
        player.sendMessage(button);
        player.sendMessage(newState);
        player.sendMessage(inputInfo);
    }
    if(player.getGameMode() == "Spectator") return;
    if (player.hasTag('dungeons:detect_double_sneak')) {
        player.removeTag('dungeons:detect_double_sneak');
        const dim = player.dimension;
        var cd = world.scoreboard.getObjective('dungeons:roll_t');
        if (!cd) {
            cd = world.scoreboard.addObjective('dungeons:roll_t');
        }
        if (cd.hasParticipant(player.scoreboardIdentity)) {
            return;
        }
        cd.addScore(player, 25)

        var v = player.getVelocity()
        const face = player.getViewDirection()

        const velocityThreshold = 0.05

        var dirX
        var dirZ

        if (Math.abs(v.x) > 0.05 || Math.abs(v.z) > 0.05) {
            dirX = v.x
            dirZ = v.z
        } else {
            const face = player.getViewDirection()
            dirX = face.x
            dirZ = face.z
        }
        const angle = Math.atan2(dirZ, dirX)
        const sec = Math.round(angle / (Math.PI / 4))

        var x = 0
        var z = 0

    

        var animId = "animation.player.roll_slowed"
        switch (sec) {
            case 0:
            case 8:
            case -8:
                x = 1.5
                z = 0
                break

            case 1:
                x = 1.33
                z = 1.33
                break

            case 2:
                x = 0
                z = 1.5
                break

            case 3:
                x = -1.33
                z = 1.33
                break

            case 4:
            case -4:
                x = -1.5
                z = 0
                break

            case 5:
            case -3:
                x = -1.33
                z = -1.33
                break

            case 6:
            case -2:
                x = 0
                z = -1.5
                break

            case 7:
            case -1:
                x = 1.33
                z = -1.33
                break
        }
        const forwardCheck = x * face.x + z * face.z
        const leftCheck = x * face.z - z * face.x


        if (Math.abs(forwardCheck) >= Math.abs(leftCheck)) {
            if (forwardCheck >= 0) {
                animId = "animation.player.roll_slowed"
            } else {
                animId = "animation.player.roll_slowedback"
            }
        } else {
            if (leftCheck >= 0) {
                animId = "animation.player.roll_slowedleft"
            } else {
                animId = "animation.player.roll_slowedright"
            }
        }
        const loc = player.location
        
        const speed = player.getEffect("speed")
        if(speed) {
            var mult = 1
            for(let i = 0; i < (speed.amplifier + 1); i++) {
                mult += 0.2
            }
            x = x*mult
            z = z*mult
        }
        const slowness = player.getEffect("slowness")
        if(slowness) {
            var mult = 1
            for(let i = 0; i < (slowness.amplifier + 1); i++) {
                mult -= 0.15
            }
            if(mult < 0.1) mult = 0.1
            x = x*mult
            z = z*mult
        }
        if(player.isInWater) {
            player.applyImpulse({x:x/1.5,y:0.1,z:z/1.5})
            for(let i = 0; i < 4; i++) {
            system.runTimeout(() => {
                if(player.isValid) {
                    player.dimension.spawnParticle("minecraft:bubble_column_up_particle", player.location)
                    player.dimension.spawnParticle("minecraft:ice_evaporation_emitter", player.location)
                }
            },i)
        }
        } else {
            player.applyImpulse({x:x,y:0.2,z:z})
            for(let i = 0; i < 6; i++) {
            system.runTimeout(() => {
                if(player.isValid) {
                    player.dimension.spawnParticle("minecraft:ice_evaporation_emitter", player.location)
                }
            },i)
        }
        }
        player.addTag("dungeons:rolling")
        system.runTimeout(() => {
            if(player.isValid) player.removeTag("dungeons:rolling")
        }, 12)
        player.runCommand("scriptevent dungeons:roll " + `${loc.x}_${loc.y}_${loc.z}`)
        dim.playSound('wind_charge.burst', loc, {
            pitch: 1.5,
            volume: 0.15
        });
        dim.playSound("mob.goat.ram_impact", loc, {pitch: 1, volume:2})
        if (!player.hasTag("dungeons:in_shadow_form")) {
            player.playAnimation(animId, {
            blendOutTime: 1,
            nextState: 'lightFeather'
            });
        }
        return;
    } else {
        player.addTag('dungeons:detect_double_sneak');
        if (inputInfo === "Touch") {
            system.runTimeout(() => {
                if (player.hasTag('dungeons:detect_double_sneak')) player.removeTag('dungeons:detect_double_sneak');
            }, 10);
            return;
        }
        else {
            system.runTimeout(() => {
                if (player.hasTag('dungeons:detect_double_sneak')) player.removeTag('dungeons:detect_double_sneak');
            }, 5);
        }
    }
});



// TIMER
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        var timeLeft = world.scoreboard.getObjective('dungeons:roll_t');
        if (!timeLeft) return;
        if (!player.scoreboardIdentity) continue;
        if (!timeLeft.hasParticipant(player.scoreboardIdentity)) continue;
        let duration = timeLeft.getScore(player);

        if (duration > 0) {
            timeLeft.addScore(player, -1);
        }
        if (duration <= 0) {
            timeLeft.removeParticipant(player)
            player.playSound("mob.goat.ram_impact", {pitch: 0.9, volume:0.45})
        }
    }
});



world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (hurt.typeId !== "minecraft:player") return;
    if (e.damageSource.cause == "selfDestruct") return;
    if(hurt.hasTag("dungeons:rolling")) e.damage = e.damage * 0.75
});
world.beforeEvents.entityHurt.subscribe((e) => {
    const attacker = e.damageSource.damagingEntity;
    if (!attacker) return;
    if (!attacker.isValid) return;
    if (attacker.typeId !== "minecraft:player") return;
    if(attacker.hasTag("dungeons:rolling")) e.damage = e.damage * 0.25
});
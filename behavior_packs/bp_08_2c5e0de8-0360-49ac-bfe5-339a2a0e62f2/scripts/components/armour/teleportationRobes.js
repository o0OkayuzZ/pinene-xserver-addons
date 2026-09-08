import {
    world,
    system,
    EntityDamageCause,
    ButtonState
} from "@minecraft/server";
import { isWearingSet } from "components/armour.js"
world.afterEvents.playerButtonInput.subscribe((event) => {
    const player = event.player;
    const button = event.button;
    const newState = event.newButtonState;
    let inputInfo = player.inputInfo.lastInputModeUsed;
    if (!isWearingSet(player, "dungeons:teleportation_robes")) return;
    if (player.hasTag("dungeons:cutscene")) return;

    if (button === "Jump") return;
    if (newState === ButtonState.Released) return;
    if (player.hasTag('dungeons:debug')) {
        player.sendMessage(button);
        player.sendMessage(newState);
        player.sendMessage(inputInfo);
    }
    if (player.hasTag('dungeons:detect_double_sneak')) {
        player.removeTag('dungeons:detect_double_sneak');
        const dim = player.dimension;
        var block
        var faceLocation
        var face
        const raycast = player.getBlockFromViewDirection({ maxDistance: 50, includePassableBlocks: false, includeLiquidBlocks: true });
        if (!raycast) {
            const headLocation = player.getHeadLocation()
            const vd = player.getViewDirection()
            const point = { x: headLocation.x + (vd.x * 15), y: headLocation.y, z: headLocation.z + (vd.z * 15) }
            block = dim.getTopmostBlock({ x: point.x, z: point.z }, point.y)
            if (!block) return;
            if (block.y < player.location.y - 3.5) return;
            if (block.y > player.location.y + 3.5) return;
            face = "Up"
            faceLocation = { x: 0, y: 0, z: 0 }
            const baseDist = Math.hypot(block.x - player.location.x, block.y - player.location.y, block.z - player.location.z)
            const targetLoc = player.location;
            const xDif = targetLoc.x - block.x
            const yDif = targetLoc.y - block.y
            const zDif = targetLoc.z - block.z
            for (let i = 1; i < baseDist; i++) {
                if (player.dimension.getBlock({ x: block.x + (xDif * (i / baseDist)), y: 1 + block.y + (yDif * (i / baseDist)), z: block.z + (zDif * (i / baseDist)) }).isAir == false) return;

            }
            if (block.above().isAir == false || block.above().above().isAir == false) return;
        } else {
            block = raycast.block.location;
            faceLocation = raycast.faceLocation;
            face = raycast.face;
        }
        var cd = world.scoreboard.getObjective('dungeons:tp_robes_t');
        if (!cd) {
            cd = world.scoreboard.addObjective('dungeons:tp_robes_t');
        }
        if (cd.hasParticipant(player.scoreboardIdentity)) {
            return;
        }
        cd.addScore(player, 40)
        const loc = player.location;
        dim.spawnParticle('dungeons:instant_teleport', { x: loc.x, y: loc.y + 1, z: loc.z });
        dim.spawnParticle('dungeons:teleport_out', loc)
        dim.playSound('armour.teleport.out', loc);
        player.runCommand("scriptevent dungeons:teleport_roll " + `${loc.x}_${loc.y}_${loc.z}`)
        if ((face === "Up" || face === "Down") || !raycast.block.above().isAir) {
            if (face == "Up") player.tryTeleport({ x: block.x + faceLocation.x, y: block.y + 1, z: block.z + faceLocation.z }, { checkForBlocks: false });
            if (face == "Down") player.tryTeleport({ x: block.x + faceLocation.x, y: block.y - 1.8, z: block.z + faceLocation.z }, { checkForBlocks: false });
            if (face !== "Up" && face !== "Down") {
                var xMod = 0
                if (faceLocation.z > 0) xMod = 1.2
                if (faceLocation.z < 0) xMod = -1.2
                var zMod = 0
                if (faceLocation.x > 0) zMod = 1.2
                if (faceLocation.x < 0) zMod = -1.2
                player.tryTeleport({ x: block.x + xMod, y: block.y + 2 * faceLocation.y, z: block.z + zMod }, { checkForBlocks: false });
            }

        } else {
            player.tryTeleport({ x: block.x + 0.5, y: block.y + 1, z: block.z + 0.5 }, { checkForBlocks: false });
        }
        connectLine(player, loc, dim)
        player.playAnimation("animation.teleport_robes")
        player.addEffect("invisibility", 8, { showParticles: false })
        system.runTimeout(() => {
            player.dimension.spawnParticle('dungeons:instant_teleport', { x: player.location.x, y: player.location.y + 1, z: player.location.z });
            player.dimension.spawnParticle('dungeons:teleport_in', player.location)
            player.dimension.playSound('armour.teleport.in', player.location);
        }, 8);
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

function connectLine(player, baseLoc, baseDim) {
    const baseDist = Math.hypot(baseLoc.x - player.location.x, baseLoc.y - player.location.y, baseLoc.z - player.location.z)
    for (let i = 1; i < 8; i += 8 / baseDist) {
        system.runTimeout(() => {
            if (player.dimension !== baseDim) return;
            const targetLoc = player.location;
            const xDif = targetLoc.x - baseLoc.x
            const yDif = targetLoc.y - baseLoc.y
            const zDif = targetLoc.z - baseLoc.z
            player.dimension.spawnParticle("dungeons:voided_stars", { x: baseLoc.x + (xDif * (i / 8)), y: 1 + baseLoc.y + (yDif * (i / 8)), z: baseLoc.z + (zDif * (i / 8)) })
            player.dimension.spawnParticle("dungeons:teleport_beam", { x: baseLoc.x + (xDif * (i / 8)), y: 1 + baseLoc.y + (yDif * (i / 8)), z: baseLoc.z + (zDif * (i / 8)) })
        }, i)
    }
}

// TIMER
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        var timeLeft = world.scoreboard.getObjective('dungeons:tp_robes_t');
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
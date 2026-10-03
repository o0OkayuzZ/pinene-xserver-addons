import { world, system } from "@minecraft/server";
import {getSoulBarText} from "misc/soulManager.js"

system.beforeEvents.startup.subscribe(event => {
    const registry = event.customCommandRegistry;
    const PlayerSelector = { name: "victim", type: "PlayerSelector" };
    const Souls = { name: "souls", type: "Integer" };
    const setsouls = {
        name: "dungeons:setsouls",
        description: "Set the soul count of a player.",
        cheatsRequired: true,
        permissionLevel: 1,
        mandatoryParameters: [PlayerSelector, Souls]
    }
    registry.registerCommand(setsouls,
        (source, victim, soulcount) => {
            system.run(() => {
                const sourceEntity = source.sourceEntity;
                if (soulcount < 0) {
                    if (world.gameRules.sendCommandFeedback == true) {
                        sourceEntity.sendMessage(`§cCannot have negative souls.`)
                    }
                    return;
                }
                for (let player of victim) {
                    world.scoreboard.getObjective("soulGauge").setScore(player, soulcount)
                    player.onScreenDisplay.setActionBar(getSoulBarText(player, false))

                }
                if (world.gameRules.sendCommandFeedback == true) {
                    sourceEntity.sendMessage(`Souls granted.`)
                }
            })
        }
    );
});
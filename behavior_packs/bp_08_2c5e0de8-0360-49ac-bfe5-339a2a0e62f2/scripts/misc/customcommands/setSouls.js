import { world, system } from "@minecraft/server";


system.beforeEvents.startup.subscribe(event => {
    const registry = event.customCommandRegistry;
    const PlayerSelector = { name: "victim", type: "PlayerSelector" };
    const Souls = { name: "souls", type: "Integer" };
    const setsouls = {
        name: "dungeons:setsouls",
        description: "プレイヤーのソウル数を設定します。",
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
                        sourceEntity.sendMessage(`§cソウル数を負の値にはできません。`)
                    }
                    return;
                }
                for (let player of victim) {
                    world.scoreboard.getObjective("soulGauge").setScore(player, soulcount)
                    player.onScreenDisplay.setActionBar(`§b${soulcount}§s ソウル `)

                }
                if (world.gameRules.sendCommandFeedback == true) {
                    sourceEntity.sendMessage(`ソウル数を設定しました。`)
                }
            })
        }
    );
});
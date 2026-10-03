import { world, system } from "@minecraft/server";

world.afterEvents.playerSpawn.subscribe((e) => {
    if (e.player.getDynamicProperty("dungeons:ambient_effects") == undefined) e.player.setDynamicProperty("dungeons:ambient_effects", true)
})

system.beforeEvents.startup.subscribe(event => {
    const registry = event.customCommandRegistry;
    const Bool = { name: "boolean", type: "Boolean" };
    const showambienteffects = {
        name: "dungeons:showambienteffects",
        description: "Toggles ambient effects in Ancient Hunts. Disable if you experience lag",
        cheatsRequired: false,
        permissionLevel: 0,
        mandatoryParameters: [Bool]
    }
    registry.registerCommand(showambienteffects,
        (source, bool) => {
            system.run(() => {
                const sourceEntity = source.sourceEntity;
                if (!sourceEntity) return;
                if (bool == sourceEntity.getDynamicProperty("dungeons:ambient_effects")) {
                    if (world.gameRules.sendCommandFeedback == true) {
                        sourceEntity.sendMessage(`Already applied.`)
                    }
                    return;
                }
                sourceEntity.setDynamicProperty("dungeons:ambient_effects", bool)
                if (bool == true && world.gameRules.sendCommandFeedback == true) {
                    sourceEntity.sendMessage(`Timers Enabled.`)
                }
                if (bool == false && world.gameRules.sendCommandFeedback == true) {
                    sourceEntity.sendMessage(`Timers Disabled.`)
                }
            })
        }
    );
});
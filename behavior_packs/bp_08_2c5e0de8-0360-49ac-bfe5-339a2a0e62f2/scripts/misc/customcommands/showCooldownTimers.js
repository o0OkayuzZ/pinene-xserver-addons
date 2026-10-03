import { world, system } from "@minecraft/server";


system.beforeEvents.startup.subscribe(event => {
    const registry = event.customCommandRegistry;
    const Bool = { name: "boolean", type: "Boolean" };
    const showcooldowntimers = {
        name: "dungeons:showcooldowntimers",
        description: "Shows artefact cooldown times on the HUD.",
        cheatsRequired: false,
        permissionLevel: 0,
        mandatoryParameters: [Bool]
    }
    registry.registerCommand(showcooldowntimers,
        (source, bool) => {
            system.run(() => {
                const sourceEntity = source.sourceEntity;
                if (!sourceEntity) return;
                if (bool == sourceEntity.getDynamicProperty("dungeons:cooldown_timer")) {
                    if (world.gameRules.sendCommandFeedback == true) {
                        sourceEntity.sendMessage(`Already applied.`)
                    }
                    return;
                }
                sourceEntity.setDynamicProperty("dungeons:cooldown_timer", bool)
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
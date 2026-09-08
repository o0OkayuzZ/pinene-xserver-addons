import { world, system } from "@minecraft/server";


system.beforeEvents.startup.subscribe(event => {
    const registry = event.customCommandRegistry;
    const Bool = { name: "boolean", type: "Boolean" };
    const showcooldowntimers = {
        name: "dungeons:showcooldowntimers",
        description: "アーティファクトの待ち時間をHUDに表示します。",
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
                        sourceEntity.sendMessage(`すでに設定されています。`)
                    }
                    return;
                }
                sourceEntity.setDynamicProperty("dungeons:cooldown_timer", bool)
                if (bool == true && world.gameRules.sendCommandFeedback == true) {
                    sourceEntity.sendMessage(`待ち時間の表示を有効にしました。`)
                }
                if (bool == false && world.gameRules.sendCommandFeedback == true) {
                    sourceEntity.sendMessage(`待ち時間の表示を無効にしました。`)
                }
            })
        }
    );
});
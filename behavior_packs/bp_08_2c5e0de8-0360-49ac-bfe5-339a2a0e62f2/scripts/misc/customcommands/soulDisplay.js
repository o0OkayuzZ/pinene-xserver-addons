import { world, system } from "@minecraft/server";

const entriesArray = [
    "default",
    "bar",
    "classic"
]

system.beforeEvents.startup.subscribe(event => {
    const registry = event.customCommandRegistry;
    const DisplayStyle = { name: "dungeons:display_style", type: "Enum" };
    registry.registerEnum("dungeons:display_style", entriesArray)
    const souldisplay = {
        name: "dungeons:souldisplay",
        description: "Set a different display style for the Soul Bar on the HUD.",
        cheatsRequired: false,
        permissionLevel: 0,
        mandatoryParameters: [DisplayStyle]
    }
    registry.registerCommand(souldisplay,
        (source, style) => {
            const owner = source.sourceEntity
            system.run(() => {
                for(const style of entriesArray) {
                    owner.removeTag("dungeons:soul_display_" + style)
                }
                owner.addTag("dungeons:soul_display_" +  style)
                if(world.gameRules.sendCommandFeedback) owner.sendMessage("Updated display style!")
            })
        }
    );
});
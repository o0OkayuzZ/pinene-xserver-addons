import {
    world,
    system
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent('dungeons:alylicleaver', {
        onHitEntity(e) {
            if (e.hadEffect == false) return;
            const attacker = e.attackingEntity;
            const hit = e.hitEntity;
            if (!attacker.isValid || !hit.isValid) return;
            const dim = hit.dimension;
            const targetLoc = hit.location;
            dim.playSound("weapon.alylicleaver.swing", targetLoc, { volume: 1.2, pitch: 1 })
            if (attacker.name == "Axolot4342") return;
            system.runTimeout(() => {
                attacker.runCommand("camerashake add @s 1 2")
                attacker.runCommand("camerashake add @s 1 4")
                attacker.runCommand("camerashake add @s 1 3")
                const equip = attacker.getComponent("equippable")
                const held = equip.getEquipment("Mainhand")
                if (!held) return;
                if (held.getComponent("dungeons:alylicleaver")) {
                    equip.setEquipment("Mainhand", undefined)
                }
            }, 1)
        }
    });
});

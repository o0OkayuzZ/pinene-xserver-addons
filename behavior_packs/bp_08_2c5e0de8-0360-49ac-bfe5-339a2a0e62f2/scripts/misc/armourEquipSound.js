import {
    world,
    system
} from "@minecraft/server";

function playsound(player, item) {
    if (item.typeId.includes("dungeons:") == false) return;
    const id = item.typeId.replace("_boots", "").replace("_leggings", "").replace("_chestplate", "").replace("_helmet", "").replace("dungeons:", "")
    const pitch = Math.random() * 0.6 + 0.7
    player.dimension.playSound("armour.equip." + id, player.location, { volume: 0.5, pitch: pitch })
}

system.runInterval(() => {
    for (const player of world.getPlayers({ excludeGameModes: ["Spectator"] })) {
        const equippable = player.getComponent("equippable")
        const head = equippable.getEquipment("Head")
        const chest = equippable.getEquipment("Chest")
        const legs = equippable.getEquipment("Legs")
        const feet = equippable.getEquipment("Feet")
        system.runTimeout(() => {
            if (!player.isValid) return;
            const equippable2 = player.getComponent("equippable")
            const head2 = equippable2.getEquipment("Head")
            const chest2 = equippable2.getEquipment("Chest")
            const legs2 = equippable2.getEquipment("Legs")
            const feet2 = equippable2.getEquipment("Feet")
            if (head2 && (!head || head.typeId !== head2.typeId)) playsound(player, head2)
            if (chest2 && (!chest || chest.typeId !== chest2.typeId)) playsound(player, chest2)
            if (legs2 && (!legs || legs.typeId !== legs2.typeId)) playsound(player, legs2)
            if (feet2 && (!feet || feet.typeId !== feet2.typeId)) playsound(player, feet2)
        }, 1)
    }
})
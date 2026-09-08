import {
    world,
    system,
    ItemStack
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
    event.blockComponentRegistry.registerCustomComponent('dungeons:void_portal_frame', {

        onPlayerInteract(e) {
            const block = e.block;
            const player = e.player;
            const permutation = block.permutation;
            const equipment = player.getComponent('equippable');
            const selectedItem = equipment.getEquipment('Mainhand');
            if (!selectedItem) return;
            if (selectedItem.typeId !== 'dungeons:enchanted_eye_of_ender') return;
            if (!e.player.matches({ gameMode: 'Creative' })) {
                if (selectedItem.amount > 1) {
                    selectedItem.amount -= 1;
                    equipment.setEquipment('Mainhand', selectedItem);
                } else {
                    equipment.setEquipment('Mainhand', undefined);
                }
            }
            const newPermutation = permutation.withState('dungeons:eye', 1);
            block.setPermutation(newPermutation);


            const dim = e.dimension
            const loc = block.bottomCenter()
            dim.spawnParticle('dungeons:fill_frame', loc)
            dim.playSound('block.void_portal.power', loc, { volume: 0.7, pitch: 1 })
            echoSound(1, dim, loc, "block.end_portal_frame.fill", 0.5, 1)
            echoSound(6, dim, loc, "block.end_portal_frame.fill", 0.4, 1)
            echoSound(11, dim, loc, "block.end_portal_frame.fill", 0.3, 1)
            echoSound(16, dim, loc, "block.end_portal_frame.fill", 0.2, 1)
            echoSound(21, dim, loc, "block.end_portal_frame.fill", 0.1, 1)
            const voidPortal = dim.getEntities({
                type: "dungeons:void_portal",
                closest: 1,
                maxDistance: 64,
                location: loc
            })
            if (voidPortal.length == 0) return;
            voidPortal[0].triggerEvent("dungeons:eye_placed")
        }
    })
})

function echoSound(delay, dim, loc, sound, vol, pitch) {
    system.runTimeout(() => {
        dim.playSound(sound, loc, { volume: vol * 0.8, pitch: pitch })
    }, delay * 1.5)
}
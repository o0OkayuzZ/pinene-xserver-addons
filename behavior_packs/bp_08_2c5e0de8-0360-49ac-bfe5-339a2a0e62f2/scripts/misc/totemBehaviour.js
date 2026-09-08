import {
    world,
    system
} from "@minecraft/server";


function hasTotem(player) {
    const equippable = player.getComponent("equippable")
    if (!equippable) return false;
    const offhand = equippable.getEquipment("Offhand")
    if (offhand && offhand.typeId == "minecraft:totem_of_undying") return true;
    const mainhand = equippable.getEquipment("Mainhand")
    if (mainhand && mainhand.typeId == "minecraft:totem_of_undying") return true;
    return false;
}

world.beforeEvents.entityHurt.subscribe((e) => {
    const player = e.hurtEntity;
    if (!player || !player.isValid) return;
    if (e.damageSource.cause == "selfDestruct") return;
    if (e.damageSource.cause == "override") return;
    const totem = hasTotem(player)
    if (!totem) return;
    var maxHealth = player.getComponent("health").defaultValue
    if (e.damage >= maxHealth) {
        if (e.damage >= maxHealth) {
            e.cancel = true;
            e.damage = 0;
            system.run(() => {
                player.applyDamage(maxHealth * 2, { cause: "override" })
            })
        }
    }
});
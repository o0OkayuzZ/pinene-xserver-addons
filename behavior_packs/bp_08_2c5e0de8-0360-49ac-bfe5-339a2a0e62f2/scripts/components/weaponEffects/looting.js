import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const effectId = "dungeons:looting"

const noLootingItems = [
    "minecraft:nether_star",
    "minecraft:totem_of_undying",
    "minecraft:saddle",
    "dungeons:redstone_key",
    "dungeons:nameless_key",
    "dungeons:questionable_key",
    "dungeons:wretched_key",
    "dungeons:corrupted_key",
    "dungeons:jungle_key",
    "dungeons:tempest_key",
    "dungeons:ancient_key",
    "dungeons:blaze_key",
    "dungeons:echo_key",
    "dungeons:skeleton_key",
    "dungeons:void_key",
    "dungeons:obsidian_key"
]

world.afterEvents.entityDie.subscribe((e) => {
    const hurt = e.deadEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    const attacker = e.damageSource.damagingEntity;
    if (!attacker) return;
    if (!attacker.isValid) return;
    if (attacker.typeId !== 'minecraft:player') return;
    const cause = e.damageSource.cause;
    if (cause !== EntityDamageCause.entityAttack) return;
    const equippable = attacker.getComponent("equippable")
    if (!equippable) return;
    const heldItem = equippable.getEquipment("Mainhand")
    if (!heldItem) return;
    if (!heldItem.hasTag(effectId) && heldItem.getDynamicProperty("dungeons:gild") !== effectId) return;
    //effect code
    const loc = hurt.location
    const dim = hurt.dimension
    const lootManager = world.getLootTableManager()
    const loot = lootManager.generateLootFromEntity(hurt, heldItem)
    if (!loot) return;
    for (const item of loot) {
        if (noLootingItems.includes(item.typeId)) continue;
        if (item.hasTag("dungeons:ignore_looting")) continue;
        const spawned = dim.spawnItem(item, loc)
        const x = Math.random() * 0.5 - 0.5
        const z = Math.random() * 0.5 - 0.5
        spawned.applyImpulse({ x: x / 5, y: 0.01, z: z / 5 })
    }
    if (loot.length > 0) {
        dim.spawnParticle("dungeons:radiance_aura2", { x: loc.x, y: loc.y + 1, z: loc.z })
    }
});
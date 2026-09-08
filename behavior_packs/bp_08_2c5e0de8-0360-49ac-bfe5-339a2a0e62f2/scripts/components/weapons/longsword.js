import {
    world,
    system,
    ItemStack
} from "@minecraft/server";
const ignoreBlock = [
    'anvil',
    'campfire',
    'contact',
    'drowning',
    'fall',
    'fallingBlock',
    'fire',
    'fireTick',
    'flyIntoWall',
    'freezing',
    'lava',
    'lightning',
    'magic',
    'magma',
    'none',
    'selfDestruct',
    'sonicBoom',
    'soulCampfire',
    'stalagmite',
    'stalactite',
    'starve',
    'suffocation',
    'suicide',
    'temperature',
    'void',
    'wither'
];
world.afterEvents.itemStartUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;
    if (player.hasTag('dungeons:sword_block')) return;
    if (!item.hasTag('dungeons:blockable_weapon')) return;
    player.addTag('dungeons:sword_block');
});
world.afterEvents.itemStopUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;
    if (!player.hasTag('dungeons:sword_block')) return;
    player.removeTag('dungeons:sword_block');
});
system.runInterval(() => {
    for (const player of world.getPlayers({
        tags: ["dungeons:sword_block"]
    })) {
        if (!player.hasTag("dungeons:in_shadow_form")) {
            player.playAnimation('animation.player.block', {
                blendOutTime: 0.33,
                nextState: 'swordBlock'
            })
        }
    }
});
world.beforeEvents.entityHurt.subscribe((e) => {
    const hurtEntity = e.hurtEntity;
    const cause = e.damageSource.cause;
    const damage = e.damage;
    if (!hurtEntity) return;
    if (hurtEntity.typeId !== 'minecraft:player') return;
    if (!hurtEntity.hasTag('dungeons:sword_block')) return;
    if (ignoreBlock.includes(cause)) return;
    e.damage = damage * 0.5
    system.run(() => {
        const dim = hurtEntity.dimension
        const loc = hurtEntity.location
        dim.playSound('weapon.sword.parry', loc)
        hurtEntity.addEffect("strength", 10, { showParticles: false })
        const item = hurtEntity.getComponent("minecraft:equippable").getEquipment("Mainhand");
        if (!item) return;
        if (!item.hasTag('dungeons:blockable_weapon')) {
            player.removeTag('dungeons:sword_block');
            return;
        }
        let durability = item.getComponent("durability");
        if (!durability) return;
        var weaponDamage = 1;
        if (e.damage >= 4) {
            weaponDamage += Math.floor(e.damage);
        }
        durability.damage += weaponDamage;
        const maxDurability = durability.maxDurability
        const currentDamage = durability.damage
        if (currentDamage >= maxDurability) {
            dim.playSound('random.break', loc)
            item.getComponent('cooldown').startCooldown(hurtEntity);
            hurtEntity.getComponent("minecraft:equippable").setEquipment("Mainhand", undefined);
        } else {
            item.getComponent('cooldown').startCooldown(hurtEntity);
            hurtEntity.getComponent("minecraft:equippable").setEquipment("Mainhand", item);
        }
    })
});
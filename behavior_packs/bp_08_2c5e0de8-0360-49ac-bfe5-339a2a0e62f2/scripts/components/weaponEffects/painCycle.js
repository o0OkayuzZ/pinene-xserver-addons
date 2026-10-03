import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const effectId = "dungeons:pain_cycle"

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
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
    if (!heldItem.hasTag(effectId) && !heldItem.getDynamicProperty(effectId.replace("dungeons:", "dungeons:gild_"))) return;
    //effect code
    if (e.damage <= 0) return;
    var lvl = world.scoreboard.getObjective('dungeons:pain_cycle_lvl');
    if (!lvl) {
        system.run(() => {

            lvl = world.scoreboard.addObjective('dungeons:pain_cycle_lvl');
        })
        return;
    }
    var playerLvl = lvl.getScore(attacker)
    if (!playerLvl) playerLvl = 0
    if (playerLvl < 5) {
        system.run(() => {
            const dmg = attacker.applyDamage(2)
            if (dmg || attacker.getGameMode() == "Creative") {
                lvl.setScore(attacker, playerLvl + 1)
                const dim = hurt.dimension;
                for (let i = 0; i < playerLvl + 1; i++) dim.spawnParticle("dungeons:pain_cycle_spark", attacker.location)
                dim.playSound('weapon.enchant.pain_cycle.charge', attacker.location, { volume: 0.75, pitch: 1 + ((playerLvl + 1) / 5) })

            }
        })
    } else {
        const base = e.damage
        e.damage = e.damage * 4
        if (e.damage > base + 50) e.damage = base + 50
        system.run(() => {
            lvl.setScore(attacker, 0)
            const dim = hurt.dimension;
            const loc = hurt.location
            for (let i = 0; i < 10; i++) dim.spawnParticle("dungeons:pain_cycle_spark", hurt.location)
            for(let i = 0; i < 15; i++) {
                attacker.runCommand("camerashake add @s 0.04 " + `${1 - i/20}`)
            }
            dim.spawnParticle("dungeons:pain_cycle_smoke", { x: loc.x, y: loc.y + 1, z: loc.z })

            dim.playSound('weapon.enchant.pain_cycle', attacker.location, { volume: 2 })
        })

    }
});
import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";
import { specialDamage, isValidTarget } from "main.js";

const effectId = "dungeons:guarding_strike"



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
    if (!heldItem.hasTag(effectId) && !heldItem.getDynamicProperty(effectId.replace("dungeons:", "dungeons:gild_"))) return;
    //effect code
    system.run(() => {
        var cd = world.scoreboard.getObjective('dungeons:guarding_strike_t');
        if (!cd) {
            cd = world.scoreboard.addObjective('dungeons:guarding_strike_t');
        }
        if (cd.hasParticipant(attacker.scoreboardIdentity)) {
            return;
        }
        const dim = hurt.dimension
        cd.setScore(attacker, 60)
        dim.playSound('weapon.enchant.guarding_strike', attacker.location)
    })

});



// TIMER
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        var timeLeft = world.scoreboard.getObjective('dungeons:guarding_strike_t');
        if (!timeLeft) return;
        if (!player.scoreboardIdentity) continue;
        if (!timeLeft.hasParticipant(player.scoreboardIdentity)) continue;
        let duration = timeLeft.getScore(player);

        if (duration > 0) player.dimension.spawnParticle("dungeons:opulent_immunity", player.location)
        if (duration > 0) {
            timeLeft.addScore(player, -1);

        }
        if (duration <= 0) {
            timeLeft.removeParticipant(player)
        }
    }
});

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (hurt.typeId !== "minecraft:player") return;
    var timeLeft = world.scoreboard.getObjective('dungeons:guarding_strike_t');
    if (!timeLeft) return;
    if (!hurt.scoreboardIdentity) return;
    if (!timeLeft.hasParticipant(hurt.scoreboardIdentity)) return;
    let duration = timeLeft.getScore(hurt);
    if (duration <= 0) return;
    const baseDmg = e.damage;
    if (!baseDmg) return;
    if (baseDmg <= 0) return;
    if (e.damageSource.cause == "selfDestruct") return;
    e.damage = e.damage * 0.5
    if (hurt.getDynamicProperty("dungeons:damage_reduction_prevented") >= baseDmg) {
        e.cancel = true;
        return;
    }
    hurt.setDynamicProperty("dungeons:damage_reduction_prevented", baseDmg)
    system.runTimeout(() => {
        hurt.setDynamicProperty("dungeons:damage_reduction_prevented", null)
    }, 9)
});

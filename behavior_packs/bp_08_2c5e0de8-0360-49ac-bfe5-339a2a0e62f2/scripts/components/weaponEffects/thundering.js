import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";
import { specialDamage, isValidTarget } from "main.js";

const effectId = "dungeons:thundering"

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
    if (!heldItem.hasTag(effectId) && heldItem.getDynamicProperty("dungeons:gild") !== effectId) return;
    //effect code
    if (hurt.hasTag("dungeons:area_hit")) return;
    if (e.damage <= 0) return;
    const critical = Math.floor(Math.random() * 10);
    if (critical <= 4) {
        system.run(() => {
            const dim = hurt.dimension
            const hurtLoc = hurt.location;


            const damageRange = dim.getEntities({
                location: hurtLoc,
                maxDistance: 8,
                excludeFamilies: ['ignore']
            });
            var count = 0
            for (const target of damageRange) {
                if (count > 3) break;
                if (isValidTarget(target) == false) continue;
                if (target === hurt) continue;
                if (target === attacker) continue;
                const damageDone = specialDamage(attacker, target, 12, EntityDamageCause.lightning, ["lightning"])
                if (damageDone) {
                    target.applyKnockback({ x: 0, z: 0 }, -0.1)
                    count += 1
                    dim.playSound("weapon.enchant.thundering", target.location)
                    dim.spawnParticle("dungeons:lightning_wand_shock", target.location)
                }
            }
            if (count > 0) {
                dim.spawnParticle("dungeons:lightning_wand_shock", hurtLoc)
            }
        })
    }

});
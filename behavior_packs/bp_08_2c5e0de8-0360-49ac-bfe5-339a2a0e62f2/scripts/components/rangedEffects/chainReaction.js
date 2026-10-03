import {
    world,
    system,
    ItemStack,
    EntityDamageCause
} from "@minecraft/server";

import { arrowTypes, getWeaponFiredType, addTagsAfter } from "components/ranged.js"
import { getDirection, makeVector } from "main.js"

const effectId = "dungeons:chain_reaction_bow_effect"

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    const attacker = e.damageSource.damagingEntity;
    if (!attacker) return;
    if (!attacker.isValid) return;
    if (attacker.typeId !== 'minecraft:player') return;
    const projectile = e.damageSource.damagingProjectile;
    if (!projectile) return;
    if (!projectile.isValid) return;
    if (!arrowTypes.includes(projectile.typeId)) return
    const cause = e.damageSource.cause;
    if (cause !== EntityDamageCause.projectile) return;
    if (!projectile.hasTag(effectId)) return;
    if (!projectile.hasTag(effectId.replace("dungeons:", "dungeons:nongilded_")))  {
        if(Math.random() > 0.5 || (Math.random() > 0.25 && (projectile.hasTag("dungeons:ricochet_arrow") || projectile.hasTag("dungeons:reliable_ricochet_arrow")))) return;
    }
    const canHit = projectile.getDynamicProperty("dungeons:can_hit");
    if (canHit <= 0) return;
    //effect code
    if (e.damage <= 0) return;
    var weapon = getWeaponFiredType(projectile)
    var item = undefined
    var spawnY = undefined
    spawnY = projectile.location.y + 0.3
    if (weapon) item = new ItemStack(weapon)
    system.run(() => {
        const angles = [
            { x: -1, y: -0.1, z: 0 },
            { x: 0, y: -0.1, z: 1 },
            { x: 1, y: -0.1, z: 0 },
            { x: 0, y: -0.1, z: -1 }
        ]
        const headLoc = hurt.getHeadLocation()
        if(!spawnY) spawnY = headLoc.y + 0.4
        for (const angle of angles) {
            const newprojectile = hurt.dimension.spawnEntity(projectile.typeId, { x: headLoc.x + angle.x, y: spawnY, z: headLoc.z + angle.z })
            const proj = newprojectile.getComponent('projectile');
            if (proj) {
                proj.owner = attacker
                proj.shoot(angle)
            }
            newprojectile.addTag("dungeons:multishot_arrow")
            newprojectile.addTag("dungeons:chain_reaction_arrow")
            newprojectile.addTag("dungeons:cannot_be_picked_up")
            newprojectile.addTag("dungeons:ignore_arrow_tags")
            newprojectile.addTag("dungeons:arrow")
            newprojectile.addTag("dungeons:crossbow_checked")
            if (item !== undefined) {
                addTagsAfter(newprojectile, item)
            }
        }
    })

});
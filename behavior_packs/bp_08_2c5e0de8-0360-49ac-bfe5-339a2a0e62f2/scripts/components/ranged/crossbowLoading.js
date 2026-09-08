import {
    world,
    system,
    EnchantmentType
} from "@minecraft/server";

import { arrowTypes, playShootSound } from "components/ranged.js"

function playDrawSound(player, ticks) {
    if (ticks < 10) ticks = 10
    if (ticks > 40) ticks = 40
    const dim = player.dimension
    const loc = player.location
    var pitchSpeed = 20 / ticks
    dim.playSound("crossbow.loading.start", loc, { pitch: pitchSpeed })
    system.runTimeout(() => {
        dim.playSound("crossbow.loading.middle", loc, { pitch: pitchSpeed })
    }, Math.floor(ticks / 4))
    system.runTimeout(() => {

        dim.playSound("crossbow.loading.end", loc, { pitch: pitchSpeed })
    }, Math.floor(ticks / 2))
}



world.afterEvents.itemStartUse.subscribe((e) => {
    var item = e.itemStack;
    const player = e.source;
    if (!item) return;
    if (item.hasTag("dungeons:crossbow")) {
        var state = item.getDynamicProperty("dungeons:loaded")
        if (state == true) return;
        playDrawSound(player, e.useDuration)
        const enchantable = item.getComponent("enchantable")
        if (enchantable !== undefined) {
            const quickCharge = enchantable.getEnchantment("minecraft:quick_charge")
            if (quickCharge !== undefined) {
                enchantable.removeEnchantment(new EnchantmentType("minecraft:quick_charge"))
                const equippable = player.getComponent("equippable")
                equippable.setEquipment("Mainhand", item)
                player.sendMessage([{ text: "§7§o" }, { translate: "dungeons.warn.cannot_use_quick_charge" }])
                return;
            }
        }
    }
})

world.afterEvents.itemStopUse.subscribe((e) => {
    var item = e.itemStack;
    const player = e.source;
    if (!item) return;
    if (item.hasTag("dungeons:crossbow")) {
        const enchantable = item.getComponent("enchantable")
        if (enchantable !== undefined) {
            const quickCharge = enchantable.getEnchantment("minecraft:quick_charge")
            if (quickCharge !== undefined) {
                enchantable.removeEnchantment(new EnchantmentType("minecraft:quick_charge"))
                const equippable = player.getComponent("equippable")
                equippable.setEquipment("Mainhand", item)
                player.sendMessage([{ text: "§7§o" }, { translate: "dungeons.warn.cannot_use_quick_charge" }])
                return;
            }
        }
        var arrowFound
        const arrowNear = player.dimension.getEntities({ location: player.location, maxDistance: 48, excludeTags: ["dungeons:crossbow_checked"] })
        for (const arrowPoss of arrowNear) {
            if (arrowTypes.includes(arrowPoss.typeId)) {
                const proj = arrowPoss.getComponent("projectile")
                if (!proj) continue;
                const owner = proj.owner;
                if (!owner) continue;
                if (owner == player) arrowFound = arrowPoss
            } else continue;
        }
        if (!arrowFound && e.useDuration > 0) return;
        if (arrowFound) {
            arrowFound.addTag("dungeons:crossbow_checked")
        }
        system.run(() => {
            const equippable = player.getComponent("equippable")
            var held = equippable.getEquipment("Mainhand")
            var state = held.getDynamicProperty("dungeons:loaded")
            if (held.typeId !== e.itemStack.typeId) return;
            if (state == null) {
                state = false
            }
            if (state == true && arrowFound !== undefined) {
                held.setDynamicProperty("dungeons:loaded", false)
            }
            if (state == false) {
                held.setDynamicProperty("dungeons:loaded", true)
            }
            equippable.setEquipment("Mainhand", held)
        })
    }
})

export function crossbowFired(player, item, arrow) {
    var bonusShots = 1
    arrow.addTag("dungeons:crossbow_checked")
    const customSoundComponent = item.getComponent("dungeons:shooter_sound")
    if (!customSoundComponent) return;
    const params = customSoundComponent.customComponentParameters.params
    playShootSound(player, params.sound)

    const arrowNear = player.dimension.getEntities({ location: player.location, maxDistance: 48, excludeTags: ["dungeons:crossbow_checked"] })
    const enchantable = item.getComponent("enchantable")
    if (enchantable !== undefined) {
        const multishot = enchantable.getEnchantment("minecraft:multishot")
        if (multishot !== undefined) {
            bonusShots += multishot.level * 2
            for (const arrowPoss of arrowNear) {
                if (arrowTypes.includes(arrowPoss.typeId)) {
                    const proj = arrowPoss.getComponent("projectile")
                    if (!proj) continue;
                    const owner = proj.owner;
                    if (!owner) continue;
                    if (owner == player) {
                        if (arrowPoss !== arrow) arrowPoss.remove()
                    }
                } else continue;
            }
        }

    }
    if (item.hasTag("dungeons:multishot") || item.getDynamicProperty("dungeons:gild") == "dungeons:multishot") bonusShots += 2
    if (item.hasTag("dungeons:super_multishot") || item.getDynamicProperty("dungeons:gild") == "dungeons:super_multishot") bonusShots += 4
    if (bonusShots > 1) multiShot(bonusShots, arrow.typeId, player, item)
    if (item.hasTag("dungeons:burst_crossbow")) {
        var allTags = arrow.getTags()
        const id = arrow.typeId
        const weaponId = item.typeId
        system.runTimeout(() => {
            if (arrow.isValid) allTags = arrow.getTags()
            if (player.isValid) extraShot(allTags, id, player, weaponId, params.sound)
        }, 4)
        system.runTimeout(() => {
            if (arrow.isValid) allTags = arrow.getTags()
            if (player.isValid) extraShot(allTags, id, player, weaponId, params.sound)
        }, 9)
    } else if (item.hasTag("dungeons:double_crossbow_shot")) {
        var allTags = arrow.getTags()
        const id = arrow.typeId
        const weaponId = item.typeId

        system.runTimeout(() => {
            if (arrow.isValid) allTags = arrow.getTags()
        }, 2)
        system.runTimeout(() => {
            if (player.isValid) extraShot(allTags, id, player, weaponId, params.sound)
        }, 9)
    }
    system.run(() => {

        const equippable = player.getComponent("equippable")
        var heldItem = equippable.getEquipment("Mainhand")
        if (heldItem.typeId !== item.typeId) return;
        const cd = heldItem.getComponent("minecraft:cooldown")
        if (cd) {
            player.startItemCooldown(cd.cooldownCategory, 20)
            player.addTag("dungeons:fire_cooldown")
            system.runTimeout(() => {
                player.removeTag("dungeons:fire_cooldown")
            }, 2)
        }
        const durability = heldItem.getComponent("durability")
        if (durability && player.getGameMode() !== "Creative") {
            const duraDamage = bonusShots - 1
            if (durability.damage + duraDamage < durability.maxDurability) {
                durability.damage += duraDamage;
                equippable.setEquipment("Mainhand", heldItem)
            } else {
                equippable.setEquipment("Mainhand", undefined)
                player.dimension.playSound("random.break", source.location, { volume: 1, pitch: 1 })

            }
        } else {
            equippable.setEquipment("Mainhand", heldItem)
        }
    })
}

function extraShot(tags, projectileId, player, itemId, sound) {
    const equippable = player.getComponent("equippable")
    const held = equippable.getEquipment("Mainhand")
    if (!held) return;
    if (held.typeId !== itemId) return;
    const hd = player.getHeadLocation();
    const vd = player.getViewDirection();
    const projectile = player.dimension.spawnEntity(projectileId, { x: hd.x + vd.x, y: hd.y + vd.y, z: vd.z + hd.z })
    const comp = projectile.getComponent('projectile');
    var mult = 4.5
    if (projectileId == "dungeons:torment_arrow") mult = 0.8
    if (comp) {
        comp.owner = player
        comp.shoot(multiply(vd, { x: mult, y: mult, z: mult }))
    } else {
        projectile.applyImpulse(multiply(vd, { x: mult, y: mult, z: mult }))
    }
    projectile.addTag("dungeons:arrow")
    projectile.addTag("dungeons:multishot_arrow")
    projectile.addTag("dungeons:crossbow_checked")
    projectile.addTag("dungeons:ignore_arrow_tags")
    if (tags) for (const tag of tags) projectile.addTag(tag)
    playShootSound(player, sound)
}

function multiShot(projectileCount, projectileId, player, item) {
    if (projectileCount == 0) return;
    const itemId = item.typeId
    const dim = player.dimension;
    const viewDir = player.getViewDirection()
    let amount = projectileCount
    var mult = 4.5
    if (projectileId == "dungeons:torment_arrow") mult = 0.8
    for (let i = 0; i < amount; i++) {
        const equippable = player.getComponent("equippable")
        const held = equippable.getEquipment("Mainhand")
        if (!held) return;
        if (held.typeId !== itemId) return;
        const angle = -((amount - 1) / 2 * 10) + 10 * i;
        const radians = angle * (Math.PI / 180)
        if (angle == 0) continue;
        const hd = player.getHeadLocation();
        const vd = player.getViewDirection();
        const projectile = dim.spawnEntity(projectileId, { x: hd.x + vd.x, y: hd.y + vd.y, z: vd.z + hd.z })
        const comp = projectile.getComponent('projectile');
        let cosTheta = Math.cos(radians);
        let sinTheta = Math.sin(radians);
        const direction = {
            x: viewDir.x * cosTheta + viewDir.z * sinTheta,
            y: viewDir.y,
            z: -viewDir.x * sinTheta + viewDir.z * cosTheta
        }
        if (comp) {
            comp.owner = player
            comp.shoot(multiply(direction, { x: mult, y: mult, z: mult }))
        } else {
            projectile.applyImpulse(multiply(direction, { x: mult, y: mult, z: mult }))
        }
        projectile.addTag("dungeons:multishot_arrow")
        projectile.addTag("dungeons:crossbow_checked")
    }
}
function multiply(a, b) {
    return { x: a.x * b.x, y: a.y * b.y, z: a.z * b.z };
}

import {
    world,
    system,
    ItemStack,
    EntityDamageCause
} from "@minecraft/server";
import { isWearingMysteryArmour } from "components/armour.js"

export const colourList = [
    "green",
    "black",
    "blue",
    "light_blue",
    "orange",
    "pink",
    "purple",
    "red",
    "white"
]

export const effectsList = [
    "health_share",
    "damage_reduction",
    "weapon_speed",
    "artefact_damage",
    "soul_gathering",
    "freezing_resistance",
    "lifesteal",
    "melee_damage",
    "sprint_speed",
    "heal_boost",
    "damage_evasion",
    "artefact_cooldown",
    "sprint_resistance",
    "ranged_damage",
    "ink_mobs",
    "exp_shield",
    "knock_fall_resist",
    "environment_resist",
    "roll",
    "healing_cooldown",
    "healing_hunger",
    "status_duration",
    "spawn_bees"
]

export const debuffsList = [
    "sprint_slow",
    "artefact_slow"
]

system.afterEvents.scriptEventReceive.subscribe((e) => {
    const player = e.sourceEntity;
    if(e.id !== "dungeons:mystery_gen") return;
    var randColour = colourList[Math.floor(Math.random()*colourList.length)]
    var colourId = randColour
    if(randColour == "green") colourId = undefined
    var helmet = undefined
    var chestplate = undefined
    if(colourId) {
        helmet = new ItemStack("dungeons:mystery_helmet_" + colourId)
        chestplate = new ItemStack("dungeons:mystery_chestplate_" + colourId)
    } else {
        helmet = new ItemStack("dungeons:mystery_helmet")
        chestplate = new ItemStack("dungeons:mystery_chestplate")
    }
    const leggings = new ItemStack("dungeons:mystery_leggings")
    const boots = new ItemStack("dungeons:mystery_boots")
    const items = [
        helmet,
        chestplate,
        leggings,
        boots
    ]
    const chosenEffects = []
    for(let i = 0; i < 2; i++) {
        var options = []
        for(const possibleOption of effectsList) if(!chosenEffects.includes(possibleOption)) options.push(possibleOption)
        chosenEffects.push(options[Math.floor(Math.random()*options.length)])
    }
    if(Math.random() >= 0.75) {
        if(chosenEffects.includes("sprint_speed")) {
            if(!chosenEffects.includes("artefact_cooldown")) chosenEffects.push("artefact_slow")
        } else if(chosenEffects.includes("artefact_cooldown")) {
            if(!chosenEffects.includes("sprint_speed")) chosenEffects.push("sprint_slow")
        } else {
            chosenEffects.push(debuffsList[Math.floor(Math.random()*debuffsList.length)])
        }
    }
    for(const item of items) {
        if(!item) return;
        const loreArray = []
        loreArray.push({translate: "dungeons.mystery_colour." + randColour})
        loreArray.push({ translate: "dungeons.desc.armour.full_set" })
        for(const effect of chosenEffects) {
            loreArray.push({translate: "dungeons.mystery." + effect})
        }
        item.setLore(loreArray)
        for(let i = 0; i < chosenEffects.length; i++) {
            item.setDynamicProperty(`dungeons:mystery_effect_${i}`, chosenEffects[i])
        }
        player.dimension.spawnItem(item, player.location)
    }
})


//soul gathering in soulManager


//swing
world.afterEvents.playerSwingStart.subscribe((e) => {
    const heldItem = e.heldItemStack;
    if (!heldItem) return;
    const player = e.player
    if (isWearingMysteryArmour(player, "weapon_speed"))
        system.runTimeout(() => {
            var cd = heldItem.getComponent("cooldown")
            if (cd !== undefined) {
                if(cd.cooldownCategory == "minecraft:sawblade") return;
                const timeLeft = player.getItemCooldown(cd.cooldownCategory)
                if (timeLeft > cd.cooldownTicks - 2) {
                    player.startItemCooldown(cd.cooldownCategory, Math.ceil(cd.cooldownTicks * 3 / 4))
                } else {
                    system.runTimeout(() => {
                        var cd2 = heldItem.getComponent("cooldown")
                        if (cd2 !== undefined) {
                            const timeLeft2 = player.getItemCooldown(cd2.cooldownCategory)
                            if (timeLeft2 > cd2.cooldownTicks - 3) {
                                player.startItemCooldown(cd2.cooldownCategory, Math.ceil(cd2.cooldownTicks * 3 / 4))
                            }
                        }
                    }, 1)
                }
            }
        }, 0)
})


//freezing

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (hurt.typeId !== "minecraft:player") return;
    if (!isWearingMysteryArmour(hurt, "freezing_resistance")) return;
    if (e.damageSource.cause !== EntityDamageCause.freezing) return;
    const baseDmg = e.damage;
    if (!baseDmg) return;
    if (baseDmg <= 0) return;
    e.damage = e.damage * 0.5
});

//sprint resist

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (hurt.typeId !== "minecraft:player") return;
    if (!isWearingMysteryArmour(hurt, "sprint_resistance")) return;
    if (hurt.isSprinting == false) return;
    const baseDmg = e.damage;
    if (!baseDmg) return;
    if (baseDmg <= 0) return;
    if (e.damageSource.cause == "selfDestruct") return;
    e.damage = e.damage * 0.7
});

//healing hunger
world.afterEvents.entityHealthChanged.subscribe((event) => {
    const player = event.entity;
    const oldValue = event.oldValue;
    var newValue = event.newValue;
    if (!player) return;
    if (!player.isValid) return;
    if (player.typeId !== "minecraft:player") return;
    if (!isWearingMysteryArmour(player, "healing_hunger")) return;
    if (newValue <= oldValue) {
        return;
    }
    const hp = player.getComponent("health")
    if (newValue > hp.effectiveMax) newValue = hp.effectiveMax
    const diff = newValue - oldValue
    if (diff == 0) return;
    const hunger = player.getComponent("minecraft:player.hunger")
    if (!hunger) return;
    var healAmt = diff / 2
    if (healAmt > 5) healAmt = 5
    const max = hunger.defaultValue
    const current = hunger.currentValue;
    if (current == max) return;

    if (healAmt + current > max) {
        hunger.setCurrentValue(max)
    } else {
        hunger.setCurrentValue(current + healAmt)
    }

    if (healAmt > 1) player.dimension.playSound('random.eat', player.location, { volume: 0.4, pitch: 1.2 });
});

//ranged

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    const attacker = e.damageSource.damagingEntity;

    if (!attacker) return;
    if (!attacker.isValid) return;
    if (attacker.typeId !== "minecraft:player") return;
    if (!isWearingMysteryArmour(attacker, "ranged_damage")) return;
    if (e.damageSource.cause !== EntityDamageCause.projectile) return;
    const baseDmg = e.damage;
    if (baseDmg <= 0) return;
    e.damage = e.damage * 1.25
});

//melee

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    const attacker = e.damageSource.damagingEntity;

    if (!attacker) return;
    if (!attacker.isValid) return;
    if (attacker.typeId !== "minecraft:player") return;
    if (!isWearingMysteryArmour(attacker, "melee_damage")) return;
    if (e.damageSource.cause !== EntityDamageCause.entityAttack) return;
    const baseDmg = e.damage;
    if (baseDmg <= 0) return;
    e.damage = e.damage * 1.15
});


//heal_boost
world.beforeEvents.entityHeal.subscribe((e) => {
    const player = e.healedEntity;
    if (player.typeId !== 'minecraft:player') {
        return;
    }
    if (isWearingMysteryArmour(player, "heal_boost")) {
        e.healing = e.healing * 1.25
    }
});

//slow down

system.runInterval(() => {
    for (const player of world.getPlayers({ excludeGameModes: ["Spectator"] })) {
        if (isWearingMysteryArmour(player, "sprint_slow")) {
            if (player.isSprinting) {
                player.addEffect("slowness", 100, { amplifier: 1, showParticles: false });
                system.runTimeout(() => {
                    if (!player.isSprinting) player.removeEffect("slowness")
                }, 1)
            }
        }
    }
});

//sprint speed

system.runInterval(() => {
    for (const player of world.getPlayers({ excludeGameModes: ["Spectator"] })) {
        if (isWearingMysteryArmour(player, "sprint_speed")) {
            if (player.isSprinting) player.addEffect("speed", 4, { amplifier: 1, showParticles: false });
        }
    }
});

//lifesteal

world.afterEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    const attacker = e.damageSource.damagingEntity;

    if (!attacker) return;
    if (!attacker.isValid) return;
    if (attacker.typeId !== "minecraft:player") return;
    if (!isWearingMysteryArmour(attacker, "lifesteal")) return;
    if (e.damage <= 0) return;
    var healAmt = e.damage * 0.05
    if (healAmt > 1.5) healAmt = 1.5
    let hp = attacker.getComponent("health")
    if (!hp) return;

    const maxHP = hp.effectiveMax
    const currentHP = hp.currentValue;

    if (healAmt + currentHP > maxHP) {
        hp.setCurrentValue(maxHP)
    } else {
        hp.setCurrentValue(currentHP + healAmt)
    }

});


//knock fall
world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (hurt.typeId !== "minecraft:player") return;
    if (!isWearingMysteryArmour(hurt, "knock_fall_resist")) return;
    if (e.damageSource.cause == EntityDamageCause.fall) e.damage = e.damage * 0.5
    const attacker = e.damageSource.damagingEntity
    if(!attacker || !attacker.isValid) return;
    const v = hurt.getVelocity()
    system.runTimeout(() =>{
        const newV = hurt.getVelocity()
        var dif = {
            x: newV.x - v.x,
            y: newV.y - v.y,
            z: newV.z - v.z
        }
        hurt.clearVelocity()
        hurt.applyImpulse({
            x: v.x + dif.x*0.5,
            y: v.y + dif.y*0.5,
            z: v.z + dif.z*0.5
        })
    },1)
});

//status duration in entertainer file


//evasion

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (hurt.typeId !== "minecraft:player") return;
    if (!isWearingMysteryArmour(hurt, "damage_evasion")) return;
    if (e.damageSource.cause == "selfDestruct") return;
    const baseDmg = e.damage;
    if (!baseDmg) return;
    if (baseDmg <= 0) return;
    const rand = Math.random()
    if (rand > 0.1) return;
    e.damage = 0 * e.damage
    e.cancel = true;
});

//damaage resist

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (hurt.typeId !== "minecraft:player") return;
    if (!isWearingMysteryArmour(hurt, "damage_reduction")) return;
    const baseDmg = e.damage;
    if (!baseDmg) return;
    if (baseDmg <= 0) return;
    if (e.damageSource.cause == "selfDestruct") return;
    e.damage = e.damage * 0.85
});
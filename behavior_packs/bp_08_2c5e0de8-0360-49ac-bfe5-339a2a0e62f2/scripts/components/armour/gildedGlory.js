import {
    world,
    system
} from "@minecraft/server";


import { isWearingSet } from "components/armour.js"

const minLevels = 10
const rechargeXp = 150
const rechargeTicks = 600

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (hurt.typeId !== "minecraft:player") return;
    if (!isWearingSet(hurt, "dungeons:gilded_glory")) return;
    if (hurt.getDynamicProperty("dungeons:damage_reduction_prevented") >= 999) {
        e.cancel = true;
        return;
    }
    hurt.setDynamicProperty("dungeons:damage_reduction_prevented", 999)
    system.runTimeout(() => {
        hurt.setDynamicProperty("dungeons:damage_reduction_prevented", null)
    }, 9)
    var deathBarterScore = world.scoreboard.getObjective('dungeons:death_barter_lvl');
    if (!deathBarterScore) {
        system.run(() => {
            deathBarterScore = world.scoreboard.addObjective('dungeons:death_barter_lvl');
            deathBarterScore.setScore(hurt, rechargeXp)
        })
        return;
    }
    if (!deathBarterScore.hasParticipant(hurt.scoreboardIdentity)) {
        system.run(() => {
            deathBarterScore.setScore(hurt, rechargeXp)
        })
        return;
    }
    if (deathBarterScore.getScore(hurt) < rechargeXp) return;
    if (hurt.level < minLevels) return;
    var cd = world.scoreboard.getObjective('dungeons:death_barter_t');
    if (!cd) {
        system.run(() => {

            cd = world.scoreboard.addObjective('dungeons:death_barter_t');
        })
        return;
    }
    if (cd.hasParticipant(hurt.scoreboardIdentity)) {
        return;
    }
    const equippable = hurt.getComponent("equippable")
    const mainHand = equippable.getEquipment("Mainhand")
    if (mainHand !== undefined && mainHand.typeId == "minecraft:totem_of_undying") return;
    const offhand = equippable.getEquipment("Offhand")
    if (offhand !== undefined && offhand.typeId == "minecraft:totem_of_undying") return;
    const baseDmg = e.damage;
    if (!baseDmg) return;
    if (baseDmg <= 0) return;

    const hp = hurt.getComponent("health")
    if (hp.currentValue > 0) return;
    e.damage = e.damage * 0.0
    e.cancel = true;
    system.run(() => {
        const dim = hurt.dimension
        const loc = hurt.location
        dim.playSound("random.totem", loc)
        dim.playSound("armour.death_barter.charged", loc, { pitch: 0.7 })
        dim.spawnParticle("dungeons:death_barter", loc)
        hurt.runCommand("camerashake add @s 0.2 0.3")
        hurt.runCommand("camerashake add @s 0.2 0.5")
        hurt.runCommand("camerashake add @s 0.2 0.7")
        hurt.addEffect("absorption", 100, { amplifier: 1 })
        hurt.addEffect("regeneration", 300, { amplifier: 1 })
        hurt.addEffect("fire_resistance", 300)
        if (hp.currentValue / 2 < 5) {
            hp.setCurrentValue(5)
        } else {
            hp.setCurrentValue(hp.currentValue / 2)
        }
        cd.setScore(hurt, rechargeTicks)
        deathBarterScore.setScore(hurt, 0)
        var levelsToLose = minLevels + Math.round((hurt.level - minLevels) * 0.25)
        if (hurt.level > 50) levelsToLose += Math.round(hurt.level * 0.2)
        if (hurt.hasTag("dungeons:debug")) hurt.sendMessage(`§o§e死の物々交換 §a${levelsToLose} レベルを消費`)
        const expToLose = Math.floor(getXpFromLevelCount(levelsToLose) / 20) * 20
        for (let i = 0; i < 20; i++) {
            system.runTimeout(() => {
                var subtract = (expToLose / 20) * -1
                if (levelsToLose > 1000) subtract += 1000
                if (hurt.xpEarnedAtCurrentLevel + subtract < 0) {
                    subtract -= hurt.xpEarnedAtCurrentLevel
                    if (subtract < 0) subtract = 0
                    const setLevel = hurt.level
                    hurt.resetLevel()
                    hurt.addLevels(setLevel - 1)
                }
                hurt.addExperience(subtract)
                hurt.dimension.spawnParticle("dungeons:opulent_immunity", hurt.location)
            }, i)
        }

    })
});

function getXpFromLevelCount(levelCount) {
    if (levelCount <= 0) return 0
    if (levelCount > 0 && levelCount <= 16) return (levelCount * levelCount) + (6 * levelCount)
    if (levelCount > 16 && levelCount <= 31) return 2.5 * (levelCount * levelCount) - 40.5 * levelCount + 360
    if (levelCount > 31) return 4.5 * (levelCount * levelCount) - 162.5 * levelCount + 2220
}

world.afterEvents.entityDie.subscribe((e) => {
    const player = e.deadEntity;
    if (!player) return;
    if (player.isValid == false) return;
    var timeLeft = world.scoreboard.getObjective('dungeons:death_barter_t');
    if (!timeLeft) return;
    if (!player.scoreboardIdentity) return;
    if (timeLeft && timeLeft.hasParticipant(player.scoreboardIdentity)) timeLeft.removeParticipant(player)
    var lvl = world.scoreboard.getObjective('dungeons:death_barter_lvl');
    if (!lvl) return;
    if (lvl && lvl.hasParticipant(player.scoreboardIdentity)) lvl.setScore(player, 150)

})

// TIMER
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        var timeLeft = world.scoreboard.getObjective('dungeons:death_barter_t');
        if (!timeLeft) return;
        if (!player.scoreboardIdentity) continue;
        if (!timeLeft.hasParticipant(player.scoreboardIdentity)) continue;
        let duration = timeLeft.getScore(player);

        if (duration > 0) {
            timeLeft.addScore(player, -1);
        }
        if (duration <= 0) {
            if (world.scoreboard.getObjective('dungeons:death_barter_lvl').getScore(player) >= rechargeXp) player.playSound("armour.death_barter.charged")
            timeLeft.removeParticipant(player)
        }
    }
});

system.runInterval(() => {
    for (const player of world.getPlayers({ excludeGameModes: ["Spectator"] })) {
        if (isWearingSet(player, "dungeons:gilded_glory")) {
            const xp = player.getTotalXp();
            system.runTimeout(() => {
                if (player.getTotalXp() > xp) {
                    const diff = Math.round(player.getTotalXp() - xp)
                    var lvl = world.scoreboard.getObjective('dungeons:death_barter_lvl');
                    if (!lvl) {
                        lvl = world.scoreboard.addObjective('dungeons:death_barter_lvl');
                    }
                    if (!lvl.hasParticipant(player.scoreboardIdentity)) {
                        return;
                    }
                    if (lvl.getScore(player) >= rechargeXp) return
                    if (lvl.getScore(player) + diff > rechargeXp) {
                        lvl.setScore(player, rechargeXp)
                    } else {
                        lvl.addScore(player, diff)
                    }
                    if (lvl.getScore(player) >= rechargeXp && world.scoreboard.getObjective("dungeons:death_barter_t").hasParticipant(player.scoreboardIdentity) == false) player.playSound("armour.death_barter.charged")
                    if (lvl.getScore(player) < rechargeXp) player.playSound("random.orb", { pitch: 1, volume: 0.05 })
                    player.onScreenDisplay.setActionBar(`§l§a${lvl.getScore(player)}/${rechargeXp} `)
                }
            }, 1);
        }
    }
}, 1);
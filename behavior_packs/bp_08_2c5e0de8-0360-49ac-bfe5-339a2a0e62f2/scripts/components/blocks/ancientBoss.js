import { world, system } from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
    event.blockComponentRegistry.registerCustomComponent('dungeons:ancient_boss', {
        onPlayerInteract(e, p) {
            if (world.getDifficulty() == "Peaceful" || world.gameRules.doMobSpawning == false) return;
            const block = e.block;
            const dim = e.dimension
            const player = e.player;
            const boss = p.params.boss;
            const minion = p.params.minion;
            const minionCount = p.params.minion_count;

            const head = p.params.ancient_helmet
            const chest = p.params.ancient_chestplate
            const mainhand = p.params.ancient_mainhand
            var maxDist = p.params.max_distance
            if (!maxDist) maxDist = 5
            const tag = "dungeons:spawned_at_" + `${Math.round(block.x)}${Math.round(block.y)}${Math.round(block.z)}`
            if (block.below().typeId == "dungeons:gilded_obsidian") block.below().setType("air")
            dim.runCommand(`setblock ${block.x} ${block.y} ${block.z} air destroy`)
            dim.playSound("ancient_mob.approach", block.location, { pitch: 0.5, volume: 0.5 })
            system.runTimeout(() => {
                spawnMob(boss, block.location, dim, tag, block.location, head, chest, mainhand)
                for (let i = 0; i < minionCount; i++) {
                    system.runTimeout(() => {
                        var x = Math.random() * (maxDist * 2) - maxDist
                        var z = Math.random() * (maxDist * 2) - maxDist
                        if (x > 0) x += 3
                        if (z > 0) z += 3
                        if (x <= 0) x -= 3
                        if (z <= 0) z -= 3
                        spawnMob(minion, { x: block.x + x, y: block.y, z: block.z + z }, dim, tag, block.location)
                    }, i)
                }
            }, 20)
        }
    })
})

function spawnMob(id, loc, dim, tag, fallback, head, chest, mainhand) {
    var block = dim.getTopmostBlock({ x: loc.x, z: loc.z }, loc.y + 1)
    if (block == undefined) block = dim.getBlock(fallback).below()
    var particleId = "dungeons:spawn_ancient"
    if (id.includes("_minion")) particleId += "_minion"
    dim.spawnParticle(particleId, block.above().bottomCenter())
    system.runTimeout(() => {
        dim.playSound("ancient_mob.spawn", block.above().center())
    }, 2)
    system.runTimeout(() => {
        dim.spawnParticle(particleId + "_strike", block.above().bottomCenter())
        var mob = undefined
        if (id.includes("minion")) {
            mob = dim.spawnEntity(id, fallback, { initialPersistence: true })
            mob.tryTeleport(block.above().bottomCenter())
            mob.addTag("dungeons:ancient_hunt")
            mob.addTag(tag)
            dim.playSound('weapon.enchant.exploding', mob.location, {
                pitch: 1.5
            });

        } else {
            mob = dim.spawnEntity(id, block.above().bottomCenter(), { initialPersistence: true })
            mob.addTag("dungeons:ancient_hunt")
            mob.addTag(tag)
            dim.playSound('weapon.enchant.exploding', mob.location, {
                pitch: 1.5
            });
        }
        if(head) mob.runCommand("replaceitem entity @s slot.armor.head 0 " + head)
        if(chest) mob.runCommand("replaceitem entity @s slot.armor.chest 0 " + chest)
        if(mainhand) mob.runCommand("replaceitem entity @s slot.weapon.mainhand 0 " + mainhand)
    }, 30)
}
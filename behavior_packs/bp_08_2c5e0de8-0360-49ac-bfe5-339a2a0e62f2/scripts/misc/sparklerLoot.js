import {
    world,
    system,
    ItemStack
} from "@minecraft/server";

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (entity.typeId == "dungeons:diamond_chest" && id.includes("open")) {
        const month = new Date().getMonth();
        const date = new Date().getDate();
        var validDay = false
        if (month == 5 && date >= 18) validDay = true
        if (month == 6 && date <= 3) validDay = true
        if (!validDay) return;
        if (Math.random() > 1 / 3) return;
        system.runTimeout(() => {
            entity.dimension.playSound("firework.launch", entity.location)
        }, 20)
        for (let i = 0; i < 10; i++) {
            system.runTimeout(() => {
                var loc = {
                    x: entity.location.x,
                    y: entity.location.y + (0.4 * i * 1),
                    z: entity.location.z
                };
                const dim = entity.dimension;
                dim.spawnParticle("dungeons:firework_arrow", loc)
            }, 20 + (i * 1))

        }
        system.runTimeout(() => {
            var loc = {
                x: entity.location.x,
                y: entity.location.y + 4,
                z: entity.location.z
            };
            const dim = entity.dimension;
            dim.spawnParticle("dungeons:sparkler_hit", loc)
            dim.playSound("random.birthday", loc, { pitch: 1.5 })
            dim.playSound("random.birthday", loc, { pitch: 1.5 })
            const sparkler = new ItemStack("dungeons:sparkler", 1)
            dim.spawnItem(sparkler, loc)
        }, 30)
    }
});
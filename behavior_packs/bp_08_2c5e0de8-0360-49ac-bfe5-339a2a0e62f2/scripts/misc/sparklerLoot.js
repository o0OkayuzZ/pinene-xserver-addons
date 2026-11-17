import {
    world,
    system,
    ItemStack
} from "@minecraft/server";

const items = [
    "dungeons:sparkler",
    "dungeons:sugar_rush",
    "dungeons:sweet_tooth_helmet"
]

function pickItem() {
    var item = items[Math.floor(Math.random()*items.length)]
    return item
}

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (entity.typeId == "dungeons:diamond_chest" && id.includes("open")) {
        const month = new Date().getMonth();
        const date = new Date().getDate();
        var validDay = false
        if (month == 5 && date >= 18) validDay = true
        if (month == 6 && date <= 3) validDay = true
        if (month == 10 && date >= 1 && date <= 9) validDay = true
        if (!validDay) return;
        if (Math.random() > 3 / 4) return;
        const itemId = pickItem()
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
            var ids = []
            if(itemId.includes("helmet")) {
                ids = [
                    itemId,
                    itemId.replace("helmet","chestplate"),
                    itemId.replace("helmet","leggings"),
                    itemId.replace("helmet","boots")
                ]
            } else {
                ids = [
                    itemId
                ]
            }
            for(const entry of ids) {
                const sitem = new ItemStack(entry, 1)
                dim.spawnItem(sitem, loc)
            }
        }, 30)
    }
});

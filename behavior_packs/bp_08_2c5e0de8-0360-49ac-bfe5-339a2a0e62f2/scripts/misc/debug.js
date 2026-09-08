import {
    world
} from "@minecraft/server";


const specailNames = [
    {
        username: "Axolot4342",
        printName: "§dAxolot4342"
    },
    {
        username: "G0ldenAury",
        printName: "§6G0ldenAury"
    },
    {
        username: "HoneyBee1228489",
        printName: "§eHoneyBee1228489"
    },
    {
        username: "Lemayfamily",
        printName: "§uLemayfamily"
    },
    {
        username: "Oreocat3564",
        printName: "§aOreocat3564"
    },
    {
        username: "Maxolotl3050",
        printName: "§bMaxolotl3050"
    },
    {
        username: "Star Man6044",
        printName: "§gStar Man6044"
    },
    {
        username: "Strikenators",
        printName: "§1Strikenators"
    },
    {
        username: "Bruck228",
        printName: "§2Bruck228"
    },
    {
        username: "FrostyPrince474",
        printName: "§9FrostyPrince474"
    },
    {
        username: "WardedCentaur65",
        printName: "§qWardedCentaur65"
    }
];

export function getDamageColour(damage) {
    if (damage < 4) return "§c"
    if (damage >= 4 && damage < 10) return "§6"
    if (damage >= 10 && damage < 20) return "§e"
    if (damage >= 20 && damage < 50) return "§a"
    if (damage >= 50 && damage < 100) return "§b"
    if (damage >= 100) return "§d"
    return ""
}

world.afterEvents.entityHurt.subscribe((e) => {
    const player = e.damageSource.damagingEntity;
    const damage = Math.round(100 * e.damage) / 100;
    const hurt = e.hurtEntity;
    if (hurt && hurt.isValid && hurt.typeId == "minecraft:player" && hurt.hasTag("dungeons:debug_damage")) {
        hurt.sendMessage("§e自分§7が受けたダメージ: " + getDamageColour(damage) + `${damage}§7 ダメージ`)
    }
    if (player) {
        if (!player.isValid) return;
        if (player.typeId !== "minecraft:player") return;
        var nameTag = undefined
        nameTag = specailNames.find(username => username.username == player.name)
        if (!nameTag) {
            nameTag = `§f${player.name}`
        } else {
            nameTag = nameTag.printName
        }
        for (const entity of world.getPlayers(({ tags: ["dungeons:debug_damage"] }))) {
            entity.sendMessage(nameTag + "§7が与えたダメージ: " + getDamageColour(damage) + `${damage}§7 ダメージ`)

        }
    }
});
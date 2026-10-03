import {
    world,
    system,
    ItemStack
} from "@minecraft/server";


const specailNames = [
    {
        username: "Alylicara",
        printName: "§dAlylicara"
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
        username: "BlazingFurnace1",
        printName: "§qBlazingFurnace1"
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
        hurt.sendMessage("§eYou§7 took: " + getDamageColour(damage) + `${damage}§7 Damage`)
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
            entity.sendMessage(nameTag + "§7 Dealt: " + getDamageColour(damage) + `${damage}§7 Damage`)

        }
    }
});


system.runInterval(
    () => {
        const players = world.getAllPlayers();
        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            if (!player.hasTag('dungeons:debug_showstates')) continue;
            try {
                var { block, face } = player.getBlockFromViewDirection();
                if (!block) {
                    player.onScreenDisplay.setActionBar("Not looking at a Block.");
                    return;
                };
                player.onScreenDisplay.setActionBar(
                    `§eBlock: §7${block.typeId}§r, §Face: §7${face}§r, §cx§by§az: §c${block.location.x} §e/ §b${block.location.y} §e/ §a${block.location.z}§r,\n`
                    + `§edata: §7${JSON.stringify(block.permutation.getAllStates(), null, 4)}`
                );
            } catch {
                player.onScreenDisplay.setActionBar("§cNot looking at a Block.");
            };
        };
    }
);


const interval = 10 //delay between check
let TPS = 20 //Use this on the rest of your codes

let lastDate = Date.now()
system.runInterval(() => {
    const currDate = Date.now()
    TPS = interval * 50 / (currDate - lastDate) * 20
    lastDate = currDate
    for (const player of world.getPlayers({ tags: ["dungeons:debug_data"] })) {
        var val = Math.round(TPS)
        var colour = "§a"
        if (val < 20) colour = "§e"
        if (val < 17) colour = "§c"
        player.onScreenDisplay.setActionBar(colour + "TPS:" + ` ${Math.round(TPS)}`);
    }
}, interval)
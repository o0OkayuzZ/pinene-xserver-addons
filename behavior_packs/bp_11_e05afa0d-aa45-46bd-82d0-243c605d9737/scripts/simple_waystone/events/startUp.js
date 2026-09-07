import { system, EquipmentSlot, EntityComponentTypes, GameMode } from "@minecraft/server";
import { warpstonePedestalInfo } from "../lib/warpstonePedestal/info";
import { AddonConfig, upgradeXpDiscount } from "../variables";
import { apiWaystoneSpace } from "../lib/waystone/space";
import { waystoneUISettings } from "../ui/settingsUI";
import { waystonesList } from "../lib/waystone/list";
import { waystoneInfo } from "../lib/waystone/info";
import { waystoneUICreate } from "../ui/createUI";
import { apiCooldown } from "../lib/apiCooldown";
import { waystoneUIList } from "../ui/listUI";
import { apiWarn } from "../lib/player/warn";
const replaceBlock = ["minecraft:air", "minecraft:lava", "minecraft:water"];
system.beforeEvents.startup.subscribe(({ blockComponentRegistry: customB, itemComponentRegistry: customI }) => {
    customB.registerCustomComponent("ws:waystone", {
        beforeOnPlayerPlace: e => {
            const { block, dimension, player } = e;
            const up = block.above(1);
            if (!up || !player)
                return;
            if (!replaceBlock.includes(up.typeId) || up.location.y >= dimension.heightRange.max) {
                e.cancel = true;
                return;
            }
            system.runTimeout(() => {
                apiWaystoneSpace.setOff(player, block);
                waystoneUICreate(player, block);
            });
        },
        onPlayerInteract: e => {
            const { block: b, player } = e;
            const perm = b.permutation.getAllStates();
            const block = perm["ws:waystone"] == 1 ? b : b.below(1);
            if (!player || !block)
                return;
            if (perm["ws:waystone_on"] == false)
                return waystoneUICreate(player, block);
            const waystone = waystonesList.findWaystone(block.dimension.id, block.location);
            if (!waystone) {
                apiWaystoneSpace.setOff(player, block);
                return apiWarn.notify(player, "warning.simple_waystone:waystone.corrupted", { type: "actionbar", sound: "simple_waystone.warn.bass" });
            }
            const item = player.getComponent(EntityComponentTypes.Equippable)?.getEquipment(EquipmentSlot.Mainhand)?.typeId;
            if (player.id == waystone.owner && item) {
                if (dyes.includes(item))
                    return apiWaystoneSpace.paintWaystone(player, block, dyes);
                const discountValue = parseInt(Object.entries(upgradeXpDiscount).find(([key, value]) => value == item)?.[0] ?? "a");
                if (!AddonConfig.disableDiscount && !isNaN(discountValue))
                    return apiWaystoneSpace.upgradeXp(player, block, discountValue);
            }
            if (waystone.owner == player.id && player.getComponent(EntityComponentTypes.Equippable)?.getEquipment(EquipmentSlot.Mainhand)?.typeId == "minecraft:brush")
                return apiWaystoneSpace.waystoneToWarpstone(player, block);
            if (waystoneInfo.claimedWaystone(player, waystone))
                return;
            if (player.isSneaking)
                return waystoneUISettings(player, waystone.owner, block);
            if (!AddonConfig.tpByBlock)
                return apiWarn.notify(player, "warning.simple_waystone:waysone.disabled", { sound: "simple_waystone.warn.bass" });
            const cooldown = apiCooldown.timeUp(player, "waystoneCooldown");
            if (!cooldown.end)
                return apiWarn.notify(player, { translate: "warning.simple_waystone:waysone.teleport_cooldown", with: [`${cooldown.time}s`] }, { type: "actionbar" });
            waystoneUIList(player, block, waystone);
        }
    });
    customB.registerCustomComponent("ws:warpstone_pedestal", {
        beforeOnPlayerPlace: ({ block, player }) => {
            if (!player)
                return;
            system.run(() => warpstonePedestalInfo.create(block, player));
        },
        onPlayerInteract: ({ block, player }) => {
            if (!player)
                return;
            if (player.isSneaking)
                return waystoneUISettings(player, player.id, block);
            if (!AddonConfig.tpByBlock)
                return apiWarn.notify(player, "warning.simple_waystone:waysone.disabled", { sound: "simple_waystone.warn.bass" });
            const cooldown = apiCooldown.timeUp(player, "waystoneCooldown");
            if (!cooldown.end)
                return apiWarn.notify(player, { translate: "warning.simple_waystone:waysone.teleport_cooldown", with: [`${cooldown.time}s`] }, { type: "actionbar" });
            waystoneUIList(player, block, undefined, undefined);
        }
    });
    customI.registerCustomComponent("ws:warpstone", {
        onUse: ({ source: player, itemStack: item }) => {
            if (!item)
                return;
            if (player.getGameMode() == GameMode.Creative) {
                player.setDynamicProperty("warpstoneCooldown", Math.floor(new Date().getTime() / 1000) - 1);
                return waystoneUIList(player, undefined, undefined, item);
            }
            const cooldown = apiCooldown.timeUp(player, "warpstoneCooldown");
            if (item.typeId == "ws:warpstone" && !cooldown.end)
                return apiWarn.notify(player, { translate: "warning.simple_waystone:teleport_item.cooldown", with: [`${cooldown.time}s`] }, { type: "actionbar" });
            waystoneUIList(player, undefined, undefined, item);
        }
    });
    
});
const dyes = [
    "minecraft:white_dye",
    "minecraft:light_gray_dye",
    "minecraft:gray_dye",
    "minecraft:black_dye",
    "minecraft:brown_dye",
    "minecraft:red_dye",
    "minecraft:orange_dye",
    "minecraft:yellow_dye",
    "minecraft:lime_dye",
    "minecraft:green_dye",
    "minecraft:cyan_dye",
    "minecraft:light_blue_dye",
    "minecraft:blue_dye",
    "minecraft:purple_dye",
    "minecraft:magenta_dye",
    "minecraft:pink_dye"
];

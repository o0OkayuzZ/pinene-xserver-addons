import { dimensionsOrder } from "../ui/settingsUI";
import { apiConfig } from "./apiConfig";
const dimensionList = { "overworld": "minecraft:overworld", "nether": "minecraft:nether", "the_end": "minecraft:the_end" };
const currentDimension = { "minecraft:overworld": 1, "minecraft:nether": 3, "minecraft:the_end": 5 };
export const apiOrganize = new class apiOrganize {
    organize(list, alphabetical = true) {
        const waystones = list;
        if (alphabetical)
            return waystones.sort((a, z) => { return z.name.localeCompare(a.name); });
        return waystones.sort((a, z) => { return a.name.localeCompare(z.name); });
    }
    organizeDimension(player, list) {
        const config = apiConfig.getConfig(player);
        const organize = config.organizeDimension;
        const dimensionIndex = currentDimension[player.dimension.id];
        if (dimensionIndex == undefined)
            return [];
        const dimensionOrder = dimensionsOrder[organize == 0 ? dimensionIndex : organize]?.split("-").map(value => `${dimensionList[value]}`);
        if (!dimensionOrder)
            return [];
        const initialize = dimensionOrder.reduce((acc, dimension) => {
            acc[dimension] = [];
            return acc;
        }, { "favorite": [] });
        const waystones = list.reduce((acc, info) => {
            if (info.favorite.has(player.id)) {
                acc["favorite"]?.push(info);
                return acc;
            }
            const dimensionList = acc[info.dimension];
            if (dimensionList) {
                dimensionList.push(info);
            }
            else
                (acc[info.dimension] ??= []).push(info);
            return acc;
        }, initialize);
        for (const dimension of Object.keys(waystones)) {
            if (config.organize) {
                waystones[dimension]?.sort((a, b) => b.name.localeCompare(a.name));
            }
            else {
                waystones[dimension]?.sort((a, b) => a.name.localeCompare(b.name));
            }
        }
        return Object.values(waystones).flat();
    }
    sameNames(name, waystonesName) {
        let newName = name;
        let counter = 1;
        while (waystonesName.includes(newName))
            newName = `${name} (${counter++})`;
        return newName;
    }
};

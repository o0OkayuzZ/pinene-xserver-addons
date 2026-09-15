import { BlockVolume } from "@minecraft/server";
import { splitBoundsForFill } from "./sourcePartsVolumes.js";

/** Remove attached lights before their support; never suppress world drops. */
export function clearCastleSection(dimension, section, envelope=section) {
    const from={...section.from},to={...section.to};
    // Lanterns attach vertically. Include the adjacent slice only when it is
    // part of the same approved removal envelope (never a protected building).
    from.y=Math.max(envelope.from.y,from.y-1);
    to.y=Math.min(envelope.to.y,to.y+1);
    // Keep the protective pass within the same bounded fill limit.
    for (const area of splitBoundsForFill({from,to})) {
        dimension.fillBlocks(new BlockVolume(area.from,area.to),
            "minecraft:air",{blockFilter:{includeTypes:["minecraft:lantern","minecraft:soul_lantern"]}});
    }
    // If the removal-only pass fails, do not remove supports underneath it.
    return dimension.fillBlocks(new BlockVolume(section.from,section.to),"minecraft:air");
}

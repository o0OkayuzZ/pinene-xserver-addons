import { system, world } from "@minecraft/server";
const DIMENSION = "infinite_castle:dungeon";
const TYPE = "infinite_castle:sky_backdrop";
const shells = new Map();
let lastWarning = -1000;
export function updateCastleSky() {
    let dimension;
    try { dimension = world.getDimension(DIMENSION); } catch { return; }
    const players = dimension.getPlayers();
    const present = new Set(players.map(player => player.id));
    for (const [id, shell] of shells) {
        if (!present.has(id) || !shell.isValid) {
            try { if (shell.isValid) shell.remove(); } catch {}
            shells.delete(id);
        }
    }
    // Clean script-reload leftovers, including entities that loaded later.
    const tracked = new Set([...shells.values()].map(shell => shell.id));
    for (const shell of dimension.getEntities({type:TYPE})) {
        if (!tracked.has(shell.id)) { try { shell.remove(); } catch {} }
    }
    for (const player of players) {
        try {
            let shell = shells.get(player.id);
            if (!shell) {
                shell = dimension.spawnEntity(TYPE, player.location);
                shells.set(player.id, shell);
            }
            shell.teleport(player.location, {dimension});
        } catch (error) {
            if (system.currentTick - lastWarning >= 1200) {
                lastWarning = system.currentTick;
                console.warn(`[infinite_castle] sky backdrop: ${error}`);
            }
        }
    }
}
system.runInterval(() => {
    try { updateCastleSky(); } catch (error) {
        if (system.currentTick - lastWarning >= 1200) {
            lastWarning = system.currentTick;
            console.warn(`[infinite_castle] sky update: ${error}`);
        }
    }
}, 5);

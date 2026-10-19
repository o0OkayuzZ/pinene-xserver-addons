import { system, world } from "@minecraft/server";
import { INFINITE_CASTLE_DIMENSION_ID } from "./dimensionSetup.js";
import { syncInfiniteCastleAtmosphere } from "./infiniteCastleAtmosphere.js";
import { rebuildSourcePartsSceneryForPlayer } from "./sourcePartsReconstructionV2.js";

const RESTORE_KEY = "infinite_castle:background_restore_20261007_v2";
const RETRY_TICKS = 20 * 15;

let restoreInProgress = false;
let nextRetryTick = 0;

function isInsideCastle(player) {
    try {
        return player?.dimension?.id === INFINITE_CASTLE_DIMENSION_ID;
    } catch {
        return false;
    }
}

function restoreComplete() {
    return world.getDynamicProperty(RESTORE_KEY) === true;
}

function queueRestore(player, delayTicks = 40) {
    system.runTimeout(() => {
        void tryRestoreCastleBackground(player);
    }, delayTicks);
}
export async function tryRestoreCastleBackground(player, { force = false } = {}) {
    if ((!force && restoreComplete()) || restoreInProgress || !isInsideCastle(player)) return;
    if (!force && system.currentTick < nextRetryTick) return;

    restoreInProgress = true;
    try {
        // Re-apply the sunset haze too; the report may refer to fog or scenery.
        syncInfiniteCastleAtmosphere(player);

        const result = await rebuildSourcePartsSceneryForPlayer(player);
        const complete = result?.ok === true
            && result?.partial !== true
            && Number(result?.placements ?? 0) > 0;

        if (complete) {
            world.setDynamicProperty(RESTORE_KEY, true);
            player.sendMessage("[infinite_castle] 背景城郭を復旧しました。");
            console.warn("[infinite_castle] one-time background restore complete placements="
                + result.placements);
            return;
        }

        nextRetryTick = system.currentTick + RETRY_TICKS;
        console.warn("[infinite_castle] background restore deferred reason="
            + (result?.reason ?? "partial"));
    } catch (error) {
        nextRetryTick = system.currentTick + RETRY_TICKS;
        console.warn("[infinite_castle] background restore failed: "
            + (error?.stack ?? error));
    } finally {
        restoreInProgress = false;
    }
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id !== "infinite_castle:restore_background") return;
    const player = event.sourceEntity;
    if (!isInsideCastle(player)) {
        player?.sendMessage("[infinite_castle] 背景城郭の復旧は無限城ディメンション内で実行してください");
        return;
    }
    player.sendMessage("[infinite_castle] 背景城郭を強制再構築します");
    void tryRestoreCastleBackground(player, { force: true });
});

world.afterEvents.playerDimensionChange.subscribe((event) => {
    if (isInsideCastle(event.player)) queueRestore(event.player, 40);
});

world.afterEvents.playerSpawn.subscribe((event) => {
    if (isInsideCastle(event.player)) queueRestore(event.player, 80);
});

system.runTimeout(() => {
    if (restoreComplete()) return;
    for (const player of world.getAllPlayers()) {
        if (isInsideCastle(player)) {
            queueRestore(player, 1);
            break;
        }
    }
}, 100);

system.runInterval(() => {
    if (restoreComplete() || restoreInProgress || system.currentTick < nextRetryTick) return;
    for (const player of world.getAllPlayers()) {
        if (isInsideCastle(player)) {
            void tryRestoreCastleBackground(player);
            break;
        }
    }
}, 100);

// The RP sound event already chooses randomly between koto_a and koto_b.
// Keep pitch intact so both authored recordings retain their tuning.
export const SOURCE_REBUILD_SOUND_ID = "infinite_castle.koto";

export function createRebuildStartCue(dimension, { scenery = false, enabled = true } = {}) {
    let started = false;
    return () => {
        if (started || !enabled || dimension?.id !== "infinite_castle:dungeon") return 0;
        started = true;
        let heard = 0;
        try {
            // Read listeners at actual start, not at the beginning of planning.
            for (const player of dimension.getPlayers()) {
                try {
                    player.playSound(SOURCE_REBUILD_SOUND_ID, {
                        volume: scenery ? 0.55 : 1,
                        pitch: 1,
                    });
                    heard += 1;
                } catch {
                    // A disconnect or sound failure must not abort block work.
                }
            }
        } catch {
            // The dimension can disappear during shutdown.
        }
        console.log(`[ic-koto] start=${scenery ? "scenery" : "core"} listeners=${heard}`);
        return heard;
    };
}

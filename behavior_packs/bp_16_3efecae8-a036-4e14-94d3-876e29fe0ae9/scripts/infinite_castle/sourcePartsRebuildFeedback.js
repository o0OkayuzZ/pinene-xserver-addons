// The RP sound event already chooses randomly between koto_a and koto_b.
// Keep pitch intact so both authored recordings retain their tuning.
export const SOURCE_REBUILD_SOUND_ID = "infinite_castle.koto";
export const SCENERY_REBUILD_SOUND_ID = "infinite_castle.koto_distant";

function rebuildSoundOptions(player, scenery) {
    // The original stereo recording stays close and clear for the core.
    if (!scenery) return { volume: 1, pitch: 1 };
    const location = player.location;
    if (location && [location.x, location.y, location.z].every(Number.isFinite)) {
        // The distant recording is mono for positional playback. Keep the
        // source within hearing range for every listener, even across floors.
        return {
            volume: 0.85, pitch: 1,
            location: { x: location.x + 6, y: location.y + 2, z: location.z + 4 },
        };
    }
    return { volume: 0.45, pitch: 1 };
}

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
                    player.playSound(
                        scenery ? SCENERY_REBUILD_SOUND_ID : SOURCE_REBUILD_SOUND_ID,
                        rebuildSoundOptions(player, scenery),
                    );
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

// Full visual rebuilds allow spectators, plus creative observers when recording
// is explicitly enabled. Normal gameplay retains occupied-room protection.
let activeDimension = null;
let allowCreativeObservers = false;

export function isVisualTestSpectator(player) {
    try { return String(player.getGameMode()).toLowerCase() === "spectator"; }
    catch { return false; }
}

function allowedObserver(player) {
    if (isVisualTestSpectator(player)) return true;
    try { return allowCreativeObservers && String(player.getGameMode()).toLowerCase() === "creative"; }
    catch { return false; }
}

export function assertVisualTestSafety(dimension = undefined) {
    if (!activeDimension) return;
    if (dimension && dimension.id !== activeDimension.id) {
        throw new Error("visual rebuild cannot modify another dimension");
    }
    if (activeDimension.getPlayers().some((player) => !allowedObserver(player))) {
        throw new Error(allowCreativeObservers
            ? "録画用再構成は無限城内の全員をクリエイティブまたはスペクテイターにして実行してください"
            : "総入れ替え中にスペクテイター以外のプレイヤーを検出したため停止しました。全員をスペクテイターにして再実行してください");
    }
}

export function beginVisualTest(dimension, { allowCreative = false } = {}) {
    if (activeDimension) throw new Error("visual rebuild is already running");
    if (dimension?.id !== "infinite_castle:dungeon") throw new Error("visual rebuild requires castle dimension");
    activeDimension = dimension;
    allowCreativeObservers = allowCreative;
    try { assertVisualTestSafety(dimension); }
    catch (error) { endVisualTest(); throw error; }
}

export function endVisualTest() { activeDimension = null; allowCreativeObservers = false; }

export function isVisualTestObserver(player, dimension) {
    return Boolean(activeDimension && activeDimension.id === dimension?.id && allowedObserver(player));
}

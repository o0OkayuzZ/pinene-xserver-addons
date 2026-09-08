// This opt-in guard exists only for the destructive, spectator-only visual
// test. Normal gameplay keeps its occupied-room protection unchanged.
let activeDimension = null;

export function isVisualTestSpectator(player) {
    try { return String(player.getGameMode()).toLowerCase() === "spectator"; }
    catch { return false; }
}

export function assertVisualTestSafety(dimension = undefined) {
    if (!activeDimension) return;
    if (dimension && dimension.id !== activeDimension.id) {
        throw new Error("visual rebuild cannot modify another dimension");
    }
    if (activeDimension.getPlayers().some((player) => !isVisualTestSpectator(player))) {
        throw new Error("総入れ替え中にスペクテイター以外のプレイヤーを検出したため停止しました。全員をスペクテイターにして再実行してください");
    }
}

export function beginVisualTest(dimension) {
    if (activeDimension) throw new Error("visual rebuild is already running");
    if (dimension?.id !== "infinite_castle:dungeon") throw new Error("visual rebuild requires castle dimension");
    activeDimension = dimension;
    try { assertVisualTestSafety(dimension); }
    catch (error) { activeDimension = null; throw error; }
}

export function endVisualTest() { activeDimension = null; }

export function isVisualTestObserver(player, dimension) {
    return Boolean(activeDimension && activeDimension.id === dimension?.id && isVisualTestSpectator(player));
}

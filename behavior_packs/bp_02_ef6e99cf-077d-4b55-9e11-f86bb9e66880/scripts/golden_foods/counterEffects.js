import { FOODS } from "./data.js";
import { CAPABILITIES } from "./capabilities.js";

export const COUNTER_KEY = "pinene:golden_food_counters_v1";
const FEATURES = new Set(["prevent_effects", "reduce_incoming_effect_duration", "poison_to_regeneration"]);
export function counterState(player) {
    const raw = player.getDynamicProperty(COUNTER_KEY);
    if (!raw) return { entries: [], nextPoisonProc: 0 };
    const state = JSON.parse(raw);
    if (!Array.isArray(state.entries)) throw new Error("invalid Golden Food counter state");
    return state;
}
export function activateFoodCounters(player, itemId, now, caps = CAPABILITIES) {
    const food = FOODS[itemId];
    if (!food) return false;
    const features = food.features.filter((f) => FEATURES.has(f.key) && caps[f.key] === true);
    if (!features.length) return false;
    const state = counterState(player);
    state.entries = state.entries.filter((e) => e.until > now);
    for (const f of features) {
        const id = `${itemId}:${f.key}`;
        state.entries = state.entries.filter((e) => e.id !== id);
        state.entries.push({ id, feature: f, until: now + f.duration_s * 20 });
    }
    player.setDynamicProperty(COUNTER_KEY, JSON.stringify(state));
    return true;
}
export function incomingEffectDecision(state, id, duration, now) {
    const features = state.entries.filter((e) => e.until > now).map((e) => e.feature);
    const prevent = features.some((f) => f.key === "prevent_effects" && f.effect_ids.includes(id));
    const ratio = Math.max(
        0,
        ...features
            .filter((f) => f.key === "reduce_incoming_effect_duration" && f.effect_ids.includes(id))
            .map((f) => f.ratio),
    );
    const convert =
        id === "poison" && now >= (state.nextPoisonProc ?? 0)
            ? features.find((f) => f.key === "poison_to_regeneration")
            : null;
    return {
        cancel: prevent || !!convert,
        duration: duration > 0 ? Math.max(1, Math.floor(duration * (1 - ratio))) : duration,
        convert,
    };
}

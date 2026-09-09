import { FOODS } from "./data.js";
import { CAPABILITIES } from "./capabilities.js";

const ALLOWED_CLEANSE = new Set(["poison", "wither", "hunger", "blindness", "darkness", "nausea"]);
const ALLOWED_SHORTEN = new Set(["poison", "wither", "hunger"]);

// Never build a stronger/longer buff from two independent sources.
// A stronger existing potion/beacon/food wins; same-level duration never shrinks.
export function chooseEffect(current, incoming) {
  const ticks = Math.round(incoming.seconds * 20);
  if (!Number.isInteger(incoming.amplifier) || incoming.amplifier < 0 ||
      !Number.isFinite(ticks) || ticks < 1 || ticks > 20000000) return null;
  if (current) {
    if (current.amplifier > incoming.amplifier) return null;
    if (current.amplifier === incoming.amplifier &&
        (!Number.isFinite(current.duration) || current.duration < 0 || current.duration >= ticks)) return null;
  }
  return { id: incoming.id, ticks, amplifier: incoming.amplifier };
}

// Capability-gated one-shot prototype. No recurring scan, recursion, or blanket clear.
export function applyOneShot(player, feature, caps, reportError) {
  if (caps[feature.key] !== true) return;
  if (feature.key === "cleanse_on_consume") {
    for (const id of feature.effect_ids) {
      if (!ALLOWED_CLEANSE.has(id)) continue;
      try { player.removeEffect(id); } catch (error) { reportError(error); }
    }
  } else if (feature.key === "extinguish_on_consume") {
    player.extinguishFire();
  } else if (feature.key === "reduce_existing_effect_duration_once") {
    if (!(feature.ratio > 0 && feature.ratio < 1)) return;
    for (const id of feature.effect_ids) {
      if (!ALLOWED_SHORTEN.has(id)) continue;
      const old = player.getEffect(id);
      // Unknown/infinite duration is left alone instead of converting it to a finite buff.
      if (!old || !Number.isFinite(old.duration) || old.duration <= 0 ||
          old.duration > 20000000) continue;
      const duration = Math.max(1, Math.floor(old.duration * (1 - feature.ratio)));
      const oldDuration = old.duration;
      const amplifier = old.amplifier;
      if (player.removeEffect(id)) {
        try { player.addEffect(id, duration, { amplifier, showParticles: true }); }
        catch (error) {
          // Best-effort restoration if a native add failed; never shorten it again.
          try { player.addEffect(id, oldDuration, { amplifier, showParticles: true }); }
          catch (restoreError) { reportError(restoreError); }
          reportError(error);
        }
      }
    }
  }
}

export function consumeFood(event, caps = CAPABILITIES, reportError = () => {}) {
  const player = event.source;
  const food = FOODS[event.itemStack?.typeId];
  if (!player || player.typeId !== "minecraft:player" || !food?.food) return false;
  for (const effect of food.effects) {
    try {
      const next = chooseEffect(player.getEffect(effect.id), effect);
      if (next) player.addEffect(next.id, next.ticks, { amplifier: next.amplifier, showParticles: true });
    } catch (error) { reportError(error); }
  }
  for (const feature of food.features) {
    try { applyOneShot(player, feature, caps, reportError); }
    catch (error) { reportError(error); }
  }
  // Minecraft consumes the food itself. No extra decrement/heal/UI/notifications.
  return true;
}

const EFFECT_NAMES = {
  night_vision:"暗視", haste:"採掘速度上昇", speed:"移動速度上昇",
  regeneration:"再生能力", resistance:"耐性", absorption:"衝撃吸収", fire_resistance:"火炎耐性"
};
const LEVELS = ["I","II","III","IV"];
export function effectLines(food, caps = CAPABILITIES) {
  const lines = food.effects.map(e =>
    `${EFFECT_NAMES[e.id] ?? e.id} ${LEVELS[e.amplifier] ?? e.amplifier + 1}：${e.seconds}秒`);
  for (const f of food.features) {
    if (caps[f.key] !== true) continue;
    if (f.key === "cleanse_on_consume") lines.push("食後に対象の状態異常を解除");
    if (f.key === "extinguish_on_consume") lines.push("食後に消火");
    if (f.key === "reduce_existing_effect_duration_once") lines.push(`既存の毒・衰弱・空腹の残り時間を${f.ratio * 100}%短縮（食後1回）`);
  }
  return lines;
}

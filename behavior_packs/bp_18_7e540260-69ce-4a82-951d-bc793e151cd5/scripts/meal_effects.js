// Pure meal behavior: no polling, inventory edits, commands or purchase checks.
export const MEAL_COOLDOWN_KEY = 'pine_food:meal_effect_ready_at';

export function applyMealEffects(player, meal, now = Date.now()) {
  if (player?.typeId !== 'minecraft:player' || player.isValid === false || !meal) {
    return { status: 'ignored', applied: [] };
  }
  if (!meal.effects?.length) return { status: 'food_only', applied: [] };
  const cooldownMs = meal.cooldownSeconds * 1000;
  const readyAt = player.getDynamicProperty(MEAL_COOLDOWN_KEY);
  if (Number.isFinite(readyAt) && readyAt > now && readyAt <= now + cooldownMs) {
    return { status: 'cooldown', applied: [], remainingSeconds: Math.ceil((readyAt - now) / 1000) };
  }
  const applied = [], preserved = [], failed = [];
  for (const effect of meal.effects) {
    const type = 'minecraft:' + effect.id;
    const ticks = effect.seconds * 20;
    try {
      const current = player.getEffect(type);
      // Infinite-duration effects are reported with a negative duration.
      if (current && (current.amplifier > effect.amplifier ||
          (current.amplifier === effect.amplifier && (current.duration < 0 || current.duration >= ticks)))) {
        preserved.push(effect.id);
        continue;
      }
      player.addEffect(type, ticks, { amplifier: effect.amplifier, showParticles: false });
      applied.push(effect.id);
    } catch (error) {
      failed.push(effect.id);
    }
  }
  if (applied.length) player.setDynamicProperty(MEAL_COOLDOWN_KEY, now + cooldownMs);
  return { status: applied.length ? 'applied' : failed.length ? 'failed' : 'preserved', applied, preserved, failed };
}

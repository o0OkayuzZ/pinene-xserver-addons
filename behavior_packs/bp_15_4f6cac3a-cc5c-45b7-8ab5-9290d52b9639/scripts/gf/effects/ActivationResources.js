import { balance } from "../cards/balance.js";
export const COOLDOWN_KEY = "pinene_gf:cooldowns_v1";
export class ActivationResources {
  constructor(now = Date.now) { this.now = now; }
  cooldowns(player) {
    const raw = player.getDynamicProperty(COOLDOWN_KEY);
    if (raw === undefined) return {};
    const values = JSON.parse(raw);
    if (!values || typeof values !== "object" || Array.isArray(values)
      || Object.values(values).some(v => !Number.isFinite(v) || v < 0)) throw new Error("Invalid GF cooldown data");
    return values;
  }
  ammo(player, itemId) {
    if (itemId === null) return null; // Explicit development mode; no real coin item added.
    const container = player.getComponent("minecraft:inventory")?.container;
    if (container) for (let slot = 0; slot < container.size; slot++) {
      const item = container.getItem(slot);
      if (item?.typeId === itemId && item.amount > 0) return { container, slot, item };
    }
    throw new Error("電磁硬貨が不足しています。");
  }
  preflight(player, card) {
    if ((this.cooldowns(player)[card.id] ?? 0) > this.now()) throw new Error("超電磁砲はクールダウン中です。");
    this.ammo(player, card.effect.parameters.ammoItemId);
  }
  commit(player, card) {
    this.preflight(player, card);
    const p = card.effect.parameters, ammo = this.ammo(player, p.ammoItemId);
    const cooldowns = this.cooldowns(player);
    cooldowns[card.id] = this.now() + p.cooldownTicks * balance.runtime.millisecondsPerSecond / balance.runtime.ticksPerSecond;
    // Persist cooldown before any damage. Unexpected API errors fail closed, never replay a shot.
    player.setDynamicProperty(COOLDOWN_KEY, JSON.stringify(cooldowns));
    if (ammo) {
      const item = ammo.item.clone();
      if (item.amount === 1) ammo.container.setItem(ammo.slot, undefined);
      else { item.amount--; ammo.container.setItem(ammo.slot, item); }
    }
  }
}

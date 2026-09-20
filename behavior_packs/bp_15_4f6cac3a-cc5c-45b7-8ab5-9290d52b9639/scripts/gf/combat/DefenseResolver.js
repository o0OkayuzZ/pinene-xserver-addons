import { requireActive } from "../core/RuntimeGate.js";
import { ATTRIBUTES } from "../core/CardRegistry.js";

export function matchesDefense(card, attack) {
  return card.category === "defense" && attack.attributes.some(attribute => card.attributes.includes(attribute));
}

// Defenses are evaluated lazily: cards below a full block are never invoked.
export function resolveDefense(player, attack, manual, automatic, priority = "manual_first") {
  requireActive(player);
  if (!Number.isFinite(attack.damage) || attack.damage < 0 || !Array.isArray(attack.attributes) || !attack.attributes.length || attack.attributes.some(a => !ATTRIBUTES.includes(a))) throw new Error("Invalid incoming attack");
  let damage = attack.damage;
  const applied = [];
  const groups = priority === "automatic_first" ? [automatic, manual] : [manual, automatic];
  for (const group of groups) {
    for (const entry of group) {
      if (damage <= 0) return { damage: 0, applied };
      if (!matchesDefense(entry.card, attack)) continue;
      requireActive(player);
      entry.consume?.();
      damage = entry.card.effect.type === "nullify" ? 0 : damage * entry.card.effect.multiplier;
      applied.push(entry.copyId);
    }
  }
  return { damage, applied };
}

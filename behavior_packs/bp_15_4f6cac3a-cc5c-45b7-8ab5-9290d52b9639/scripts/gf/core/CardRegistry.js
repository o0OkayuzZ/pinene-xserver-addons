import { attackCards } from "../cards/attack/testCards.js";
import { defenseCards } from "../cards/defense/testCards.js";

export const ATTRIBUTES = Object.freeze(["colorless", "red", "blue", "yellow", "purple"]);
export class CardRegistry {
  constructor(definitions = [...attackCards, ...defenseCards]) {
    this.cards = new Map();
    for (const definition of definitions) {
      if (!definition.id || !definition.name || this.cards.has(definition.id)) throw new Error("Invalid/duplicate card definition");
      if (!Array.isArray(definition.attributes) || !definition.attributes.length || definition.attributes.some(a => !ATTRIBUTES.includes(a))) throw new Error("Invalid attributes");
      const effect = definition.effect;
      if (definition.category === "attack") {
        if (effect?.type !== "damage" || !Number.isFinite(effect.damage) || effect.damage <= 0) throw new Error("Invalid attack");
      } else if (definition.category === "defense") {
        if (effect?.type !== "nullify" && !(effect?.type === "reduce" && Number.isFinite(effect.multiplier) && effect.multiplier >= 0 && effect.multiplier < 1)) throw new Error("Invalid defense");
      } else throw new Error("Invalid category");
      this.cards.set(definition.id, Object.freeze({ ...definition, attributes: Object.freeze([...definition.attributes]), effect: Object.freeze({ ...effect }) }));
    }
  }
  get(id) {
    const card = this.cards.get(id);
    if (!card) throw new Error(`未登録カード: ${id}`);
    return card;
  }
  all() { return [...this.cards.values()]; }
}

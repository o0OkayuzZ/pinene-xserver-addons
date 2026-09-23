import { productionAttackCards } from "../cards/attack/productionCards.js";
import { productionDefenseCards } from "../cards/defense/productionCards.js";
import { validateEffect } from "../effects/EffectRegistry.js";
import { attackCards } from "../cards/attack/testCards.js";
import { defenseCards } from "../cards/defense/testCards.js";

export const ATTRIBUTES = Object.freeze(["colorless", "red", "blue", "yellow", "purple"]);
export class CardRegistry {
  constructor(definitions = [...attackCards, ...defenseCards, ...productionAttackCards, ...productionDefenseCards]) {
    this.cards = new Map();
    for (const definition of definitions) {
      if (!definition.id || !definition.name || this.cards.has(definition.id)) throw new Error("Invalid/duplicate card definition");
      if (!Array.isArray(definition.attributes) || !definition.attributes.length || definition.attributes.some(a => !ATTRIBUTES.includes(a))) throw new Error("Invalid attributes");
      const effect = definition.effect;
      validateEffect(definition);
      this.cards.set(definition.id, Object.freeze({ ...definition, developmentOnly: definition.developmentOnly ?? [...attackCards, ...defenseCards].some(test => test.id === definition.id), attributes: Object.freeze([...definition.attributes]), effect: Object.freeze({ ...effect, ...(effect.parameters ? { parameters: Object.freeze({ ...effect.parameters }) } : {}) }) }));
    }
  }
  get(id) {
    const card = this.cards.get(id);
    if (!card) throw new Error(`未登録カード: ${id}`);
    return card;
  }
  all({ includeTests = true } = {}) { return [...this.cards.values()].filter(card => includeTests || !card.developmentOnly); }
}

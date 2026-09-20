import { shuffle } from "../deck/ShuffleManager.js";

export function createBattle(config, random) {
  const cards = shuffle(config.randomDeck.map(copy => copy.copyId), random);
  return { version: 1, configurationRevision: config.configurationRevision, hand: cards.slice(0, 5), drawPile: cards.slice(5), discardPile: [], resolving: null };
}

export function clone(value) { return JSON.parse(JSON.stringify(value)); }

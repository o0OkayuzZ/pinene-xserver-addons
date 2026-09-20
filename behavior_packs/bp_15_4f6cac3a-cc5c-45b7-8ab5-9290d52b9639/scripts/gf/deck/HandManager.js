import { clone } from "../core/CardState.js";
import { shuffle } from "./ShuffleManager.js";

export function beginUse(state, slot) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= 5 || !state.hand[slot] || state.resolving !== null) throw new Error("使用できない手札です。");
  const next = clone(state);
  next.resolving = next.hand[slot];
  next.hand[slot] = null;
  return next;
}

// A persisted in-flight card is completed without replaying its effect after reload.
export function finishUse(state, random) {
  if (state.resolving === null) return state;
  const next = clone(state);
  const slot = next.hand.indexOf(null);
  if (slot < 0) throw new Error("Missing resolving slot");
  next.discardPile.push(next.resolving);
  next.resolving = null;
  if (!next.drawPile.length) {
    next.drawPile = shuffle(next.discardPile, random);
    next.discardPile = [];
  }
  next.hand[slot] = next.drawPile.shift();
  return next;
}

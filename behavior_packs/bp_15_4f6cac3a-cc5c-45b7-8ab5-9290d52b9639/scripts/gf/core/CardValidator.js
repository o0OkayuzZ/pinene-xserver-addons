export function validateConfiguration(config, registry, fixedSlots = 1) {
  if (config?.version !== 1 || !Number.isSafeInteger(config.configurationRevision) || config.configurationRevision < 1) throw new Error("Configuration version/revision invalid");
  if (!Number.isInteger(fixedSlots) || fixedSlots < 1 || fixedSlots > 3) throw new Error("固定枠は1〜3です。");
  const ids = new Set();
  for (const [key, min, max, category] of [["randomDeck", 16, 16, null], ["fixedAttack", 0, fixedSlots, "attack"], ["autoDefense", 0, 9, "defense"]]) {
    const deck = config[key];
    if (!Array.isArray(deck) || deck.length < min || deck.length > max) throw new Error(`${key}: ${min}〜${max}枚必要です。`);
    const counts = new Map();
    for (const copy of deck) {
      if (!copy || typeof copy.copyId !== "string" || !/^[a-zA-Z0-9_:-]{1,80}$/.test(copy.copyId) || ids.has(copy.copyId)) throw new Error("copyIdが不正または重複しています。");
      ids.add(copy.copyId);
      const card = registry.get(copy.cardId);
      if (category && card.category !== category) throw new Error(`${key}: カード種別が違います。`);
      const count = (counts.get(card.name) ?? 0) + 1;
      if (count > 3) throw new Error(`${card.name}: 同名は最大3枚です。`);
      counts.set(card.name, count);
    }
  }
  if (!["manual_first", "automatic_first"].includes(config.settings?.defensePriority)) throw new Error("Invalid defense priority");
  return true;
}

export function validateBattle(config, state) {
  if (state?.version !== 1 || state.configurationRevision !== config.configurationRevision) return false;
  if (!Array.isArray(state.hand) || state.hand.length !== 5 || !Array.isArray(state.drawPile) || !Array.isArray(state.discardPile)) return false;
  if (state.resolving !== null && typeof state.resolving !== "string") return false;
  const holes = state.hand.filter(id => id === null).length;
  if (holes !== (state.resolving === null ? 0 : 1)) return false;
  const ids = [...state.drawPile, ...state.hand.filter(id => id !== null), ...state.discardPile, ...(state.resolving === null ? [] : [state.resolving])];
  const expected = new Set(config.randomDeck.map(c => c.copyId));
  return ids.length === 16 && new Set(ids).size === 16 && ids.every(id => typeof id === "string" && expected.has(id));
}

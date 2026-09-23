export function createOwnershipApi(collection, log = console) {
  return {
    grantCard(player, cardId, amount, { source = "unspecified" } = {}) {
      if (player?.typeId !== "minecraft:player" || player.isValid === false) throw new Error("有効なplayerが必要です。");
      const result = collection.grant(player, cardId, amount);
      // A notification/log failure must not turn a successful grant into a retryable failure.
      try { player.sendMessage(`§a${collection.registry.get(cardId).name}を${amount}枚入手しました`); } catch {}
      try { log.warn(`[GF grant] player=${player.id} card=${cardId} amount=${amount} source=${String(source).slice(0, 120)}`); } catch {}
      return result;
    },
  };
}

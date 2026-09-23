export const CASE_COMPONENT = "pinene:gf_case";
export const CASE_IDS = Object.freeze({
  active_attack: "pinene_gf:case_active_attack",
  active_defense: "pinene_gf:case_active_defense",
  auto_defense: "pinene_gf:case_auto_defense",
  auto_attack: "pinene_gf:case_auto_attack",
});

const granting = new Set();
export function giveCases(player, createItem) {
  if (player?.typeId !== "minecraft:player" || player.isValid === false) return;
  if (granting.has(player.id)) return;
  granting.add(player.id);
  try {
    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) throw new Error("インベントリを取得できません。");
    const existing = new Set(), empty = [];
    for (let slot = 0; slot < container.size; slot++) {
      const item = container.getItem(slot);
      if (item) existing.add(item.typeId); else empty.push(slot);
    }
    const missing = Object.values(CASE_IDS).filter(id => !existing.has(id));
    if (empty.length < missing.length) {
      player.sendMessage(`§eGFケース付与には空きスロットが${missing.length}枠必要です。今回は何も変更していません。`);
      return { added: [], full: true };
    }
    // Construct everything before writing. Never overwrite items or spawn public drops.
    const items = missing.map(id => createItem(id, 1));
    for (let i = 0; i < items.length; i++) container.setItem(empty[i], items[i]);
    // Repeating the command grants only missing cases, including after a partial write error.
    player.sendMessage(`§aGFケースを${items.length}個付与しました（所持済みは追加しません）。`);
    return { added: missing, full: false };
  } finally { granting.delete(player.id); }
}

export const KEYS = Object.freeze({ configuration: "pinene_gf:configuration_v1", battle: "pinene_gf:battle_v1", manual: "pinene_gf:manual_v1", fixedSlots: "pinene_gf:fixed_slots_v1" });

export class Persistence {
  readConfiguration(player) {
    const raw = player.getDynamicProperty(KEYS.configuration);
    if (raw === undefined) return null;
    // Never replace an unreadable ownership record with an empty/default deck.
    try {
      const value = JSON.parse(raw);
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid configuration");
      return value;
    } catch { throw new Error("GF構成の保存データが破損しています。元データを保持して停止しました。"); }
  }
  readBattle(player) {
    const raw = player.getDynamicProperty(KEYS.battle);
    try { return raw === undefined ? null : JSON.parse(raw); } catch { return null; }
  }
  write(player, key, value) {
    const raw = JSON.stringify(value);
    if (raw.length > 10000) throw new Error("GF保存サイズ上限を超えました。");
    player.setDynamicProperty(key, raw);
  }
  fixedSlots(player) {
    const count = player.getDynamicProperty(KEYS.fixedSlots) ?? 1;
    if (!Number.isInteger(count) || count < 1 || count > 3) throw new Error("Invalid fixed slot capacity");
    return count;
  }
}

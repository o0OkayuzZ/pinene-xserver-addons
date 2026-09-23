import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { FormSessions } from "./FormSessions.js";
import { CaseActions } from "./CaseActions.js";

export function createCardMenu(decks, combat, actions, sessions = new FormSessions()) {
  actions ??= new CaseActions(decks, combat, sessions);
  const describe = (config, id) => {
    const copy = config.randomDeck.find(c => c.copyId === id);
    return copy ? decks.registry.get(copy.cardId).name : "—";
  };
  async function edit(player) {
    const config = decks.configuration(player);
    const snapshot = actions.snapshot(player);
    const all = decks.registry.all();
    const ids = all.map(c => c.id);
    const encode = copies => copies.map(c => ids.indexOf(c.cardId) + 1).join(",");
    const form = new ModalFormData().title("GF デッキ構築")
      .textField(all.map((c, i) => `${i + 1}: ${c.name}`).join("\n") + "\nランダム16枚（番号をカンマ区切り・同名3枚まで）", "1,1,1,2,...", { defaultValue: config ? encode(config.randomDeck) : "" })
      .textField(`固定攻撃（最大${decks.persistence.fixedSlots(player)}枚）`, "1", { defaultValue: config ? encode(config.fixedAttack) : "" })
      .textField("自動防御（上から順・最大9枚）", "4,5,6", { defaultValue: config ? encode(config.autoDefense) : "" });
    const response = await form.show(player);
    if (response.canceled) return;
    actions.assertSnapshot(player, snapshot, false);
    const revision = (config?.configurationRevision ?? 0) + 1;
    const parse = (value, group) => {
      if (!String(value).trim()) return [];
      const old = [...(config?.[group] ?? [])];
      return String(value).split(/[,、\s]+/).filter(Boolean).map((token, index) => {
        if (!/^\d+$/.test(token) || !ids[Number(token) - 1]) throw new Error(`不正なカード番号: ${token}`);
        const cardId = ids[Number(token) - 1];
        const previous = old.findIndex(c => c.cardId === cardId);
        return previous >= 0 ? old.splice(previous, 1)[0] : { copyId: `c_${revision}_${group}_${index}`, cardId };
      });
    };
    decks.saveConfiguration(player, { randomDeck: parse(response.formValues[0], "randomDeck"), fixedAttack: parse(response.formValues[1], "fixedAttack"), autoDefense: parse(response.formValues[2], "autoDefense"), settings: config?.settings ?? { defensePriority: "manual_first" } }, config?.configurationRevision ?? 0);
    sessions.invalidate(player);
    player.sendMessage("§aGF構成を保存しました。");
  }
  return async function show(player) {
    const lock = sessions.begin(player);
    if (!lock) return;
    try {
      const { config, battle, active } = decks.load(player);
      const snapshot = actions.snapshot(player);
      const form = new ActionFormData().title("GF v0.2 開発用メニュー");
      if (!config || !active) {
        form.body(active ? "デッキを登録してください。" : "ピネディメンション外：戦闘状態を保存して停止中。").button("デッキ構築");
        const response = await form.show(player);
        if (!response.canceled) { actions.assertSnapshot(player, snapshot, false); await edit(player); }
        return;
      }
      form.body(`手札 ${battle.hand.length} / 山札 ${battle.drawPile.length} / 捨て札 ${battle.discardPile.length}\n攻撃：視線の先の対象へ。防御：次の対応攻撃に備える。`);
      for (let slot = 0; slot < 5; slot++) form.button(`${slot + 1}: ${describe(config, battle.hand[slot])}`);
      for (const copy of config.fixedAttack) form.button(`固定: ${decks.registry.get(copy.cardId).name}`);
      form.button("デッキ構築");
      const response = await form.show(player);
      if (response.canceled) return;
      actions.assertSnapshot(player, snapshot);
      if (response.selection === 5 + config.fixedAttack.length) { await edit(player); return; }
      const result = response.selection < 5 ? actions.useHand(player, response.selection, snapshot) : actions.useFixed(player, response.selection - 5, snapshot);
      player.sendMessage(result.pending ? "§e超電磁砲 チャージ中" : result.armed ? "§b手動防御を構えました。対応するGF攻撃に1回反応します。" : "§aGF攻撃を実行しました。");
    } catch (error) {
      try { player.sendMessage(`§cGF: ${error.message}`); } catch {}
    } finally { sessions.end(player, lock); }
  };
}

import { isActive } from "../core/RuntimeGate.js";

const titles = { active_attack: "GF 能動攻撃ケース", active_defense: "GF 能動防御ケース", auto_defense: "GF 自動防御ケース" };

// Case categories are views over the existing five-slot BattleState, not new decks.
export function createCaseMenu(decks, actions, sessions, createForm, collectionMenus) {
  const cardLabel = copy => {
    const card = decks.registry.get(copy.cardId);
    return `${card.name}\n${card.category} | ${card.attributes.join(" / ")}\n${card.description ?? card.effect.type}`;
  };
  async function details(player, entries, snapshot) {
    const form = createForm().title("GF 攻撃カード詳細");
    entries.forEach(entry => form.button(entry.label));
    form.button("閉じる");
    const response = await form.show(player);
    actions.assertSnapshot(player, snapshot);
    if (response.canceled || response.selection === entries.length) return;
    const entry = Number.isInteger(response.selection) && entries[response.selection];
    if (!entry) throw new Error("不正なカード選択です。");
    await createForm().title("GF 攻撃カード詳細").body(entry.label).button("閉じる").show(player);
  }
  async function show(player, kind) {
    const lock = sessions.begin(player);
    if (!lock) return;
    try {
      if (!collectionMenus && !isActive(player)) throw new Error("GFケースの戦闘操作はピネディメンション内でのみ利用できます。");
      const { config, battle, active } = decks.load(player);
      if ((!config || !battle) && !collectionMenus) {
        player.sendMessage("§eGFデッキが未登録です。カードコレクションとデッキ構築から準備してください。");
        return;
      }
      const snapshot = actions.snapshot(player);
      const form = createForm().title(titles[kind]);
      const entries = [];
      if (kind === "auto_defense") {
        const defense = config?.autoDefense.map((copy, i) => `${i + 1}. ${cardLabel(copy)}`) ?? [];
        form.body(`自動防御: ${defense.length} / 9枚（上から順）\n${defense.join("\n") || "未登録"}\n防御優先: ${config?.settings.defensePriority ?? "未登録"}\n追加・削除・順序変更はデッキ構築から行います。`);
      } else if (!active || !config || !battle) {
        form.body("GFコレクションとデッキ構築。戦闘には有効なデッキとピネディメンションへの入場が必要です。");
      } else {
        const category = kind === "active_attack" ? "attack" : "defense";
        for (let slot = 0; slot < battle.hand.length; slot++) {
          const copy = config.randomDeck.find(c => c.copyId === battle.hand[slot]);
          if (copy && decks.registry.get(copy.cardId).category === category) {
            entries.push({ kind: "hand", slot, label: `手札 ${slot + 1}: ${cardLabel(copy)}` });
          }
        }
        let body = `手札: 5枚 / 山札: ${battle.drawPile.length}枚 / 捨て札: ${battle.discardPile.length}枚\n手動防御: ${actions.manualStatus(player, config, battle)}`;
        if (kind === "active_attack") {
          config.fixedAttack.forEach((copy, slot) => entries.push({ kind: "fixed", slot, label: `固定: ${cardLabel(copy)}` }));
          body += `\n固定攻撃: ${config.fixedAttack.length} / ${decks.persistence.fixedSlots(player)}枠（最大3枠）\n固定攻撃は再利用可能・手札を消費しません。\n攻撃は視線先へ（通常24 blocks・超電磁砲は設定射程）。`;
        } else {
          body += "\n防御を選ぶと構えます。対応GF攻撃まで保持し、非対応攻撃では消費しません。";
        }
        form.body(body);
        entries.forEach(entry => form.button(entry.label));
      }
      const detailIndex = kind === "active_attack" && entries.length ? entries.length : -1;
      if (detailIndex >= 0) form.button("攻撃カード詳細");
      const collectionIndex = entries.length + (detailIndex >= 0 ? 1 : 0);
      if (collectionMenus) form.button("カードコレクション").button("デッキ構築");
      else if (!entries.length) form.button("閉じる");
      const response = await form.show(player);
      if (response.canceled) return;
      if (collectionMenus && [collectionIndex, collectionIndex + 1].includes(response.selection)) {
        actions.assertSnapshot(player, snapshot, false);
        sessions.end(player, lock);
        await (response.selection === collectionIndex ? collectionMenus.showCollection(player) : collectionMenus.showBuilder(player));
        return;
      }
      if (detailIndex >= 0 && response.selection === detailIndex) {
        actions.assertSnapshot(player, snapshot);
        await details(player, entries, snapshot);
        return;
      }
      if (!entries.length) return;
      const entry = Number.isInteger(response.selection) && entries[response.selection];
      if (!entry) throw new Error("不正なカード選択です。");
      const result = entry.kind === "hand"
        ? actions.useHand(player, entry.slot, snapshot)
        : actions.useFixed(player, entry.slot, snapshot);
      player.sendMessage(result.pending ? "§e超電磁砲 チャージ中" : result.armed ? "§b手動防御を構えました。対応するGF攻撃まで手札に保持します。" : "§aGF攻撃を実行しました。");
    } catch (error) {
      try { player.sendMessage(`§cGF: ${error.message}`); } catch {}
    } finally { sessions.end(player, lock); }
  }
  return {
    showActiveAttack: player => show(player, "active_attack"),
    showActiveDefense: player => show(player, "active_defense"),
    showAutoDefense: player => show(player, "auto_defense"),
    // Reserved UI entry only: never load/repair battle state or schedule attacks.
    showAutoAttack: player => player.sendMessage("自動攻撃システムは未実装です"),
  };
}

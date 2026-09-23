import { DeckDraft } from "../collection/DeckDraft.js";
import { deckUsage } from "../collection/CardCollection.js";

export function createCollectionMenu(decks, collection, sessions, createForm) {
  const groupNames = { randomDeck: "ランダム", fixedAttack: "固定攻撃", autoDefense: "自動防御" };
  const summary = (player, card, config) => {
    const owned = collection.count(player, card.id), used = deckUsage(config).get(card.id) ?? 0;
    return `${card.name} | ${card.attributes.join("/")} | ${card.category}\n所有${owned} / 使用${used} / 残り${Math.max(0, owned - used)}${owned ? "" : " / 未入手"}`;
  };
  async function collectionView(player) {
    const config = decks.configuration(player);
    const form = createForm().title("GF カードコレクション");
    form.body(collection.registry.all({ includeTests: false }).map(card => summary(player, card, config)).join("\n\n"));
    form.button("閉じる"); await form.show(player);
  }
  async function editGroup(player, draft, group) {
    while (true) {
      draft.assertCurrent();
      const entries = draft.value[group], form = createForm().title(`GF ${groupNames[group]}編集`);
      form.body(`登録${entries.length}枚 / ランダムは保存時16枚必須\n選択で削除/順序変更。未完成の編集は保存されません。`);
      form.button("所有カードから追加");
      entries.forEach((copy, i) => form.button(`${i + 1}: ${collection.registry.get(copy.cardId).name}`));
      form.button("戻る");
      const response = await form.show(player); draft.assertCurrent();
      if (response.canceled || response.selection === entries.length + 1) return;
      if (response.selection === 0) {
        const choices = collection.registry.all({ includeTests: false }).filter(card => collection.count(player, card.id) > 0
          && (group !== "fixedAttack" || card.category === "attack")
          && (group !== "autoDefense" || card.category === "defense" && card.activation !== "manual"));
        const add = createForm().title("GF 所有カードから追加").body("所有数と全領域の使用数を確認してください。");
        choices.forEach(card => add.button(summary(player, card, draft.value))); add.button("戻る");
        const selected = await add.show(player); draft.assertCurrent();
        if (!selected.canceled && Number.isInteger(selected.selection) && choices[selected.selection]) {
          try { draft.add(group, choices[selected.selection].id); } catch (error) { player.sendMessage(`§e${error.message}`); }
        }
      } else if (Number.isInteger(response.selection) && entries[response.selection - 1]) {
        const index = response.selection - 1;
        const choice = await createForm().title(collection.registry.get(entries[index].cardId).name)
          .button("削除").button("1つ上へ移動").button("戻る").show(player);
        draft.assertCurrent();
        if (!choice.canceled && choice.selection === 0) draft.remove(group, index);
        if (!choice.canceled && choice.selection === 1 && index > 0) draft.moveUp(group, index);
      }
    }
  }
  async function edit(player) {
    decks.activations?.assertAvailable(player);
    const draft = new DeckDraft(player, decks, collection, sessions);
    while (true) {
      draft.assertCurrent();
      const status = Object.entries(groupNames).map(([key, name]) => `${name}: ${draft.value[key].length}`).join(" / ");
      const productionNames = new Set(collection.registry.all({ includeTests: false }).map(card => card.name));
      const warning = productionNames.size * 3 < 16 ? "\n現在の本番カード種類では16枚に届きません。今後のカード追加が必要です。" : "";
      const form = createForm().title("GF デッキ構築").body(`${status}\n現在の構成は編集途中では変わりません。\n既存構成も、保存には全copyの所有が必要です。${warning}`);
      Object.values(groupNames).forEach(name => form.button(`${name}を編集`));
      form.button("保存（ランダム16枚必須）").button("編集を破棄して閉じる");
      const response = await form.show(player); draft.assertCurrent();
      if (response.canceled || response.selection === 4) return;
      if (response.selection === 3) {
        try { draft.save(); player.sendMessage("§aGF構成を保存しました。"); return; }
        catch (error) { player.sendMessage(`§e保存できません: ${error.message}`); }
      } else if (Number.isInteger(response.selection) && Object.keys(groupNames)[response.selection]) {
        await editGroup(player, draft, Object.keys(groupNames)[response.selection]);
      }
    }
  }
  async function guarded(player, operation) {
    const lock = sessions.begin(player); if (!lock) return;
    try { await operation(player); } catch (error) { try { player.sendMessage(`§cGF: ${error.message}`); } catch {} }
    finally { sessions.end(player, lock); }
  }
  return { showCollection: player => guarded(player, collectionView), showBuilder: player => guarded(player, edit) };
}

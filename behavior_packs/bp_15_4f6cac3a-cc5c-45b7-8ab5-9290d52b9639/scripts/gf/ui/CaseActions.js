import { feedbackConfig } from "../feedback/config.js";
import { COLLECTION_KEY } from "../collection/CardCollection.js";
import { requireActive } from "../core/RuntimeGate.js";
import { KEYS } from "../core/Persistence.js";
import { validateBattle } from "../core/CardValidator.js";

// UI-independent entry points for cases, debug UI and future input adapters.
export class CaseActions {
  constructor(decks, combat, sessions, activations) {
    this.activations = activations;
    this.decks = decks; this.combat = combat; this.sessions = sessions;
  }
  snapshot(player) {
    return {
      identity: this.sessions.identity(player), dimension: player.dimension.id,
      properties: [...Object.values(KEYS), COLLECTION_KEY].map(key => player.getDynamicProperty(key)),
    };
  }
  assertSnapshot(player, snapshot, active = true) {
    if (player.isValid === false) throw new Error("プレイヤーが退出しました。");
    if (active) requireActive(player);
    if (!snapshot || snapshot.identity !== this.sessions.identity(player)
      || snapshot.dimension !== player.dimension.id
      || [...Object.values(KEYS), COLLECTION_KEY].some((key, i) => player.getDynamicProperty(key) !== snapshot.properties[i])) {
      throw new Error("GFの手札・構成・状態が変化しました。ケースを開き直してください。");
    }
  }
  target(player) {
    const target = player.getEntitiesFromViewDirection({ maxDistance: 24 })
      .find(hit => hit.entity.typeId !== feedbackConfig.entityId && hit.entity.id !== player.id && hit.entity.isValid !== false)?.entity;
    if (!target) throw new Error("24ブロック以内の視線先に対象がいません。カードは使用していません。");
    requireActive(target);
    // Reject unreadable target configuration before the attacker's use journal opens.
    this.decks.configuration(target);
    return target;
  }
  useHand(player, slot, snapshot) {
    this.activations?.assertAvailable(player);
    requireActive(player);
    if (snapshot) this.assertSnapshot(player, snapshot);
    if (!Number.isInteger(slot) || slot < 0 || slot >= 5) throw new Error("不正な手札位置です。");
    // Read-only preflight: a missing target must not trigger a repair/shuffle/write.
    const config = this.decks.configuration(player);
    const battle = this.decks.persistence.readBattle(player);
    if (!config || !validateBattle(config, battle) || battle.resolving !== null) throw new Error("ケースを開き直して手札を復元してください。");
    const copy = config.randomDeck.find(c => c.copyId === battle.hand[slot]);
    const card = this.decks.registry.get(copy.cardId);
    if (card.effect.type === "railgun") {
      if (!this.activations) throw new Error("Activation service unavailable");
      return this.activations.start(player, "hand", slot, card);
    }
    const target = card.category === "attack" ? this.target(player) : undefined;
    const result = this.combat.useHand(player, slot, target);
    this.sessions.invalidate(player);
    return result;
  }
  useFixed(player, slot, snapshot) {
    this.activations?.assertAvailable(player);
    requireActive(player);
    if (snapshot) this.assertSnapshot(player, snapshot);
    const config = this.decks.configuration(player);
    if (!Number.isInteger(slot) || slot < 0 || !config?.fixedAttack[slot]) throw new Error("固定攻撃枠がありません。");
    const card = this.decks.registry.get(config.fixedAttack[slot].cardId);
    if (card.effect.type === "railgun") {
      if (!this.activations) throw new Error("Activation service unavailable");
      return this.activations.start(player, "fixed", slot, card);
    }
    const target = this.target(player);
    const result = this.combat.useFixed(player, slot, target);
    this.sessions.invalidate(player);
    return result;
  }
  manualStatus(player, config, battle) {
    let armed;
    try { armed = JSON.parse(player.getDynamicProperty(KEYS.manual) ?? "null"); } catch { return "なし"; }
    if (armed?.configurationRevision !== config.configurationRevision) return "なし";
    const slot = battle.hand.indexOf(armed.copyId);
    const copy = config.randomDeck.find(c => c.copyId === armed.copyId);
    if (slot < 0 || !copy) return "なし";
    return `${slot + 1}: ${this.decks.registry.get(copy.cardId).name}（対応攻撃を待機中）`;
  }
}

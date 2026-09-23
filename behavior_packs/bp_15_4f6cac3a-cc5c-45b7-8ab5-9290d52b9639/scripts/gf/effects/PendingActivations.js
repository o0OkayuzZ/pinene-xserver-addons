import { feedbackConfig } from "../feedback/config.js";
import { requireActive } from "../core/RuntimeGate.js";
import { KEYS } from "../core/Persistence.js";
import { validateBattle } from "../core/CardValidator.js";
import { ActivationResources } from "./ActivationResources.js";

export const PENDING_KEY = "pinene_gf:pending_activation_v1";
// A reservation references a copy still in the v1 hand; it never owns a second copy.
// Only the existing synchronous resolving journal owns a committed hand-card use.
export class PendingActivations {
  constructor(decks, combat, sessions, scheduler, resources = new ActivationResources()) {
    this.decks = decks; this.combat = combat; this.sessions = sessions;
    this.scheduler = scheduler; this.resources = resources; this.pending = new Map();
    decks.activations = this;
  }
  recover(player) {
    if (!this.pending.has(player.id) && player.getDynamicProperty(PENDING_KEY) !== undefined) {
      // Reload never resumes an old timer or replays damage. Existing resolving recovery is separate.
      player.setDynamicProperty(PENDING_KEY, undefined);
      this.sessions.invalidate(player);
    }
  }
  assertAvailable(player) {
    this.recover(player);
    if (this.pending.has(player.id)) throw new Error("超電磁砲 チャージ中");
  }
  beforeUse(player, slot) {
    const reservation = this.pending.get(player.id);
    if (reservation?.kind === "hand" && reservation.slot === slot) throw new Error("カードはチャージ予約中です。");
  }
  ray(player, card) {
    const p = card.effect.parameters;
    const hits = player.getEntitiesFromViewDirection({ maxDistance: p.maxRange, ignoreBlockCollision: false });
    const seen = new Set(), targets = [];
    for (const hit of [...hits].sort((a, b) => a.distance - b.distance)) {
      const target = hit.entity;
      if (!Number.isFinite(hit.distance) || hit.distance < 0 || hit.distance > p.maxRange
        || !target || target.typeId === feedbackConfig.entityId || target.id === player.id || target.isValid === false || seen.has(target.id)) continue;
      requireActive(target);
      this.decks.configuration(target);
      seen.add(target.id); targets.push(target);
      if (targets.length === p.maxTargets) break;
    }
    if (!targets.length) throw new Error("超電磁砲の射線に有効な対象がいません。");
    return targets;
  }
  start(player, kind, slot, card) {
    requireActive(player); this.assertAvailable(player);
    const config = this.decks.configuration(player), battle = this.decks.persistence.readBattle(player);
    if (!["hand", "fixed"].includes(kind) || !Number.isInteger(slot) || slot < 0 || !config
      || card.effect.type !== "railgun" || !validateBattle(config, battle) || battle.resolving !== null) throw new Error("Invalid activation reservation");
    const copyId = kind === "hand" ? battle?.hand[slot] : config?.fixedAttack[slot]?.copyId;
    const copy = (kind === "hand" ? config.randomDeck : config.fixedAttack).find(copy => copy.copyId === copyId);
    if (!copy || copy.cardId !== card.id) throw new Error("予約対象カードがありません。");
    this.resources.preflight(player, card);
    this.ray(player, card); // No writes when ammo, cooldown or initial ray is invalid.
    const entry = { player, kind, slot, card, copyId, dimension: player.dimension.id,
      identity: this.sessions.identity(player), config: player.getDynamicProperty(KEYS.configuration),
      battle: player.getDynamicProperty(KEYS.battle), fixedSlots: this.decks.persistence.fixedSlots(player) };
    player.setDynamicProperty(PENDING_KEY, JSON.stringify({ version: 1, phase: "pending", kind, slot,
      cardId: card.id, copyId, configurationRevision: config.configurationRevision, dimension: entry.dimension }));
    this.pending.set(player.id, entry);
    try { entry.timer = this.scheduler.runTimeout(() => this.finish(player.id, entry), card.effect.parameters.chargeTicks); }
    catch (error) { this.cancel(player.id); throw error; }
    try { player.onScreenDisplay?.setActionBar("超電磁砲 チャージ中"); } catch {}
    return { pending: true };
  }
  cancel(id) {
    const entry = this.pending.get(id);
    if (!entry) return;
    this.pending.delete(id);
    if (entry.timer !== undefined) this.scheduler.clearRun(entry.timer);
    try { entry.player.setDynamicProperty(PENDING_KEY, undefined); } catch { /* Cleared by next join/reload. */ }
    this.sessions.invalidate(entry.player);
  }
  finish(id, entry) {
    if (this.pending.get(id) !== entry) return; // Canceled, stale callback, or already committed.
    try {
      const player = entry.player;
      if (player.isValid === false) throw new Error("プレイヤーが退出しました。");
      requireActive(player);
      if (entry.dimension !== player.dimension.id || entry.identity !== this.sessions.identity(player)
        || entry.config !== player.getDynamicProperty(KEYS.configuration)
        || entry.battle !== player.getDynamicProperty(KEYS.battle)
        || entry.fixedSlots !== this.decks.persistence.fixedSlots(player)) throw new Error("カード状態が変わったためチャージを中止しました。");
      this.resources.preflight(player, entry.card);
      const targets = this.ray(player, entry.card); // Aim is sampled again at completion; never track every tick.
      // Remove reservation before entering the existing synchronous journal. A crash before
      // beginUse has no effect; a crash after beginUse uses v1 finish-without-replay recovery.
      player.setDynamicProperty(PENDING_KEY, undefined);
      this.pending.delete(id);
      const fire = card => {
        this.resources.commit(player, card);
        return targets.map((target, targetIndex) => this.combat.attack(card, player, target, { charge: 1, targetIndex }));
      };
      this.combat.transaction(() => entry.kind === "hand"
        ? this.decks.use(player, entry.slot, fire) : fire(entry.card));
      this.sessions.invalidate(player);
      player.sendMessage("§a超電磁砲 発射");
    } catch (error) {
      this.cancel(id);
      try { entry.player.sendMessage(`§eGF: ${error.message}`); } catch {}
    }
  }
}

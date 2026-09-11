import { world, system } from "@minecraft/server";

const STAGES = ["0", "I", "II", "III", "完全腐敗"];
export function installGearControls(gear) {
  const held = new Map();
  const latched = new Set();
  const sneakCharging = new Set();
  const show = (player, text) => player.onScreenDisplay.setActionBar(text);
  system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
      try {
        const state = gear.state(player);
        if (!player.isSneaking) latched.delete(player.id);
        if (!state.charging) sneakCharging.delete(player.id);
        if (state.charging && sneakCharging.has(player.id) && !player.isSneaking) {
          gear.cancel(player);
          sneakCharging.delete(player.id);
          show(player, "§7チャージ中断：しゃがみを解除しました（トーテム未消費）");
          continue;
        }
        if (state.charging && (!state.full || !state.holdingTotem || state.combat)) {
          gear.cancel(player);
          sneakCharging.delete(player.id);
          show(player, "§7チャージ中断：装備・持ち物・戦闘状態を確認してください（トーテム未消費）");
          continue;
        }
        if (state.charging) {
          const remaining = Math.max(0, state.chargeEnd - system.currentTick);
          const filled = Math.min(16, Math.floor((160 - remaining) / 10));
          show(player, `§a${"▰".repeat(filled)}§8${"▱".repeat(16-filled)} §f${(remaining/20).toFixed(1)}秒 §7| 蘇生 ${state.revives}/4`);
          continue;
        }
        if (!state.full || !state.holdingTotem) { held.delete(player.id); continue; }
        if (player.isSneaking && !latched.has(player.id) && !state.combat && state.revives < 4) {
          latched.add(player.id);
          sneakCharging.add(player.id);
          gear.start(player);
          continue;
        }
        // Context hint once per state change, not a permanent HUD replacement.
        const key = `${state.revives}/${state.corruption}/${state.infection}/${state.combat}`;
        if (held.get(player.id) === key) continue;
        held.set(player.id, key);
        const corruption = state.corruption < 0 ? "不一致（倍率・蘇生無効）" : STAGES[state.corruption];
        const action = state.combat ? "戦闘終了後にチャージ可能" : state.revives >= 4 ? "蘇生チャージ満タン" : "トーテムを持って8秒しゃがむ → 蘇生＋1";
        show(player, `§a蘇生 ${state.revives}/4 §7| §6腐敗 ${corruption}${state.infection ? ` §7| §c感染 ${STAGES[state.infection]}` : ""}\n§f${action}`);
      } catch (error) {
        // Entity can leave between getAllPlayers and reading its components.
        if (player.isValid) console.warn(`[ZombieGear] controls failed: ${error}`);
      }
    }
  }, 5);
  world.afterEvents.playerLeave.subscribe(ev => {
    held.delete(ev.playerId); latched.delete(ev.playerId); sneakCharging.delete(ev.playerId);
  });
}

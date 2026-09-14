import { system, world } from "@minecraft/server";
import { KNOCKBACK_RESISTANCE, REVIVE_TICKS } from "./rules.js";

// Native player component groups control knockback independently of entityHurt.
// No per-item C modifier exists, so mixed sets cannot add high-stage resistance.
export function installKnockback(gear) {
  const applied = new Map(), recovery = new Map();
  function sync(player) {
    const stage = gear.corruption(player);
    let group;
    if (stage >= 0) group = (recovery.get(player.id) ?? 0) > system.currentTick ? "recovery" : `c${stage}`;
    else {
      const count = Object.values(gear.getArmor(player)).filter(i => i?.typeId.startsWith("zombiegear:zombie_")).length;
      group = count ? `partial${count}` : "off";
    }
    if (applied.get(player.id) === group) return;
    player.triggerEvent(`zombiegear:kb_${group}`);
    applied.set(player.id, group);
  }
  world.afterEvents.playerSpawn.subscribe(ev => applied.delete(ev.player.id));
  world.afterEvents.playerLeave.subscribe(ev => { applied.delete(ev.playerId); recovery.delete(ev.playerId); });
  world.afterEvents.entityDie.subscribe(ev => { applied.delete(ev.deadEntity.id); recovery.delete(ev.deadEntity.id); });
  return {
    sync,
    resistance: player => gear.corruption(player) >= 0 ? KNOCKBACK_RESISTANCE[gear.corruption(player)] : 0,
    onRevive(player) { recovery.set(player.id, system.currentTick + REVIVE_TICKS); sync(player); }
  };
}

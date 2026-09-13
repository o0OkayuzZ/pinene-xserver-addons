import { world, system } from "@minecraft/server";

export function installDiet(gear) {
  const snapshots = new Map();
  const fleshUse = new Map();
  const fleshGrace = new Map();
  const deferredGain = new Map();
  const fields = ["minecraft:player.hunger", "minecraft:player.saturation"];
  function read(player) { return fields.map(id => player.getComponent(id)?.currentValue); }
  function restore(player, values) {
    fields.forEach((id, i) => {
      const c = player.getComponent(id);
      if (c && Number.isFinite(values?.[i]) && c.currentValue > values[i]) c.setCurrentValue(values[i]);
    });
  }
  // Per-tick positive-delta guard also covers cake, custom foods and missing use-start events.
  system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
      try {
        if (!gear.isFull(player)) { snapshots.delete(player.id); fleshUse.delete(player.id); fleshGrace.delete(player.id); deferredGain.delete(player.id); continue; }
        if ((fleshGrace.get(player.id) ?? -1) >= system.currentTick) {
          snapshots.set(player.id, read(player)); continue;
        }
        const pending = deferredGain.get(player.id);
        if (pending) { restore(player, pending); deferredGain.delete(player.id); }
        const before = snapshots.get(player.id), current = read(player);
        // Native nutrition and itemCompleteUse can straddle the interval/after-event boundary.
        // Defer a gain for one tick only; an actual flesh completion must authorize it.
        if (!pending && (fleshUse.get(player.id) ?? -1) >= system.currentTick &&
            current.some((n,i) => Number.isFinite(before?.[i]) && n > before[i])) {
          deferredGain.set(player.id, before); continue;
        }
        restore(player, snapshots.get(player.id));
        snapshots.set(player.id, read(player));
      } catch (error) { if (player.isValid) console.warn(`[ZombieGear] diet: ${error}`); }
    }
  }, 1);
  world.beforeEvents.itemUse.subscribe(ev => {
    if (gear.isFull(ev.source)) {
      snapshots.set(ev.source.id, read(ev.source));
      if (ev.itemStack.typeId === "minecraft:rotten_flesh") fleshUse.set(ev.source.id, system.currentTick + 40);
      else fleshUse.delete(ev.source.id);
    }
  });
  world.beforeEvents.playerInteractWithBlock.subscribe(ev => {
    if (gear.isFull(ev.player)) snapshots.set(ev.player.id, read(ev.player));
  });
  world.afterEvents.playerInteractWithBlock.subscribe(ev => {
    if (!gear.isFull(ev.player)) return;
    restore(ev.player, snapshots.get(ev.player.id));
    snapshots.set(ev.player.id, read(ev.player));
  });
  world.afterEvents.itemCompleteUse.subscribe(ev => {
    if (!gear.isFull(ev.source)) return;
    if (ev.itemStack.typeId === "minecraft:rotten_flesh") {
      // Register native food gains immediately; the guard must not roll these back.
      deferredGain.delete(ev.source.id);
      fleshUse.delete(ev.source.id);
      fleshGrace.set(ev.source.id, system.currentTick + 1);
      snapshots.set(ev.source.id, read(ev.source));
      gear.heal(ev.source, 8);
      gear.repairArmor(ev.source, 0.10);
    } else {
      restore(ev.source, snapshots.get(ev.source.id));
      snapshots.set(ev.source.id, read(ev.source));
    }
  });
  world.afterEvents.playerLeave.subscribe(ev => {
    snapshots.delete(ev.playerId); fleshUse.delete(ev.playerId); fleshGrace.delete(ev.playerId); deferredGain.delete(ev.playerId);
  });
}

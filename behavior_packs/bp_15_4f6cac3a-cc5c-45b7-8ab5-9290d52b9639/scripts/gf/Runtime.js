import { isActive } from "./core/RuntimeGate.js";
import { CASE_COMPONENT, CASE_IDS, giveCases } from "./cases/CaseItems.js";

const installed = new WeakMap();
export function installRuntime({ world, system, decks, sessions, menu, cases, createItem, activations, grantCard, log = console }) {
  if (installed.has(world)) return installed.get(world);
  const errors = new Map(), pendingCases = new Map();
  let restoredOnline = false;
  function restore(player) {
    if (player.isValid === false) return;
    try {
      activations?.recover(player);
      if (isActive(player)) decks.load(player);
      errors.delete(player.id);
    }
    catch (error) {
      if (errors.get(player.id) !== error.message) log.warn(`[GF] ${player.id}: ${error.message}`);
      errors.set(player.id, error.message);
    }
  }
  function restoreOnlineOnce() {
    if (restoredOnline) return;
    // worldLoad handles initial early-execution; system.run handles script reload.
    let players;
    try { players = world.getAllPlayers(); } catch { return; }
    restoredOnline = true;
    for (const player of players) restore(player);
  }
  world.afterEvents.worldLoad.subscribe(restoreOnlineOnce);
  world.afterEvents.playerSpawn.subscribe(({ player }) => { activations?.cancel(player.id); sessions.invalidate(player); restore(player); });
  world.afterEvents.playerDimensionChange.subscribe(({ player }) => { activations?.cancel(player.id); sessions.invalidate(player); restore(player); });
  world.afterEvents.playerLeave.subscribe(({ playerId }) => {
    activations?.cancel(playerId);
    errors.delete(playerId); sessions.forget(playerId); pendingCases.delete(playerId);
  });
  system.run(restoreOnlineOnce); // One shot only. No periodic player polling.
  system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {
    itemComponentRegistry.registerCustomComponent(CASE_COMPONENT, {
      onUse: ({ source, itemStack }) => {
        if (source?.typeId !== "minecraft:player" || pendingCases.has(source.id)) return;
        const show = ({
          [CASE_IDS.active_attack]: cases.showActiveAttack,
          [CASE_IDS.active_defense]: cases.showActiveDefense,
          [CASE_IDS.auto_defense]: cases.showAutoDefense,
          [CASE_IDS.auto_attack]: cases.showAutoAttack,
        })[itemStack?.typeId];
        if (!show) return;
        const identity = sessions.identity(source);
        pendingCases.set(source.id, identity);
        system.run(() => {
          if (pendingCases.get(source.id) === identity) pendingCases.delete(source.id);
          if (source.isValid === false || sessions.identity(source) !== identity) return;
          // No stack mutation: cases are reusable views of the player's saved state.
          void show(source);
        });
      },
    });
  });
  system.afterEvents.scriptEventReceive.subscribe(event => {
    const player = event.sourceEntity;
    if (player?.typeId !== "minecraft:player" || player.isValid === false) return;
    if (event.id === "pinene_gf:menu") void menu(player);
    if (event.id === "pinene_gf:grant" && grantCard) {
      try {
        const match = /^(?:gf:)?([a-z0-9_]+) ([1-9][0-9]*)$/.exec(event.message?.trim() ?? "");
        if (!match) throw new Error("Usage: /scriptevent pinene_gf:grant <card_id> <amount>");
        grantCard(player, `gf:${match[1]}`, Number(match[2]), { source: "debug/scriptevent" });
      } catch (error) { player.sendMessage(`GF grant: ${error.message}`); }
    }
    if (event.id === "pinene_gf:give_cases") {
      try { giveCases(player, createItem); }
      catch (error) {
        player.sendMessage(`§cGFケース付与: ${error.message}。再実行すると不足分のみ付与します。`);
      }
    }
  });
  const runtime = { restore };
  installed.set(world, runtime);
  return runtime;
}

import { world, system, EntityDamageCause } from "@minecraft/server";
import { CardRegistry } from "./core/CardRegistry.js";
import { DeckManager } from "./deck/DeckManager.js";
import { CombatResolver } from "./combat/CombatResolver.js";
import { createCardMenu } from "./ui/CardMenu.js";
import { isActive } from "./core/RuntimeGate.js";

export const registry = new CardRegistry();
export const decks = new DeckManager(registry);
export const combat = new CombatResolver(decks, (target, damage, source) => {
  target.applyDamage(damage, { cause: EntityDamageCause.magic, ...(source ? { damagingEntity: source } : {}) });
});
const showMenu = createCardMenu(decks, combat);
const errors = new Map();
function restore(player) {
  try { decks.load(player); errors.delete(player.id); }
  catch (error) {
    if (errors.get(player.id) !== error.message) console.warn(`[GF] ${player.id}: ${error.message}`);
    errors.set(player.id, error.message);
  }
}
world.afterEvents.playerSpawn.subscribe(({ player }) => restore(player));
world.afterEvents.playerLeave.subscribe(({ playerId }) => errors.delete(playerId));
// Covers dimension re-entry and script reload without relying on ephemeral session state.
system.runInterval(() => {
  for (const player of world.getAllPlayers()) if (isActive(player)) restore(player);
}, 20);
// Core/debug entry point. Run as the player: /scriptevent pinene_gf:menu
system.afterEvents.scriptEventReceive.subscribe(event => {
  if (event.id !== "pinene_gf:menu" || event.sourceEntity?.typeId !== "minecraft:player") return;
  void showMenu(event.sourceEntity);
});

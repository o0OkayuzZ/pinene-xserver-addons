import { GameMode, system, world } from "@minecraft/server";
import { IDS } from "./config.js";

function isProtectedBlock(typeId) {
  return typeId === IDS.islandCore || typeId.startsWith("pinene_pvp:protected_");
}

const editorBypassPlayers = new Set();

export function toggleEditorProtectionBypass(player) {
  if (editorBypassPlayers.delete(player.id)) return false;
  editorBypassPlayers.add(player.id);
  return true;
}

world.beforeEvents.playerBreakBlock.subscribe((event) => {
  if (!isProtectedBlock(event.block.typeId)) return;
  if (event.player.getGameMode() === GameMode.Creative) return;
  if (editorBypassPlayers.has(event.player.id)) return;
  event.cancel = true;
  system.run(() => {
    if (event.player.isValid) {
      event.player.sendMessage("§c永久保護ブロックです。編集時は editor_bypass を有効にしてください。");
    }
  });
});

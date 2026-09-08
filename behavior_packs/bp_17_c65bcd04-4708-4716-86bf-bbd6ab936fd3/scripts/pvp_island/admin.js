import { system, world } from "@minecraft/server";
import { IDS, POC } from "./config.js";
import { ensurePocPlatform, rebuildPocPlatform } from "./island_bootstrap.js";
import { readMarkerRegistry } from "./marker_service.js";
import { readRelicLedger, recoverInterruptedRelic } from "./dragon_unlock.js";

async function handleScriptEvent(event) {
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player") return;

  if (event.id === "pinene_pvp:enter") {
    const dimension = world.getDimension(IDS.dimension);
    player.sendMessage("§ePvP島を読み込んでいます…");
    await ensurePocPlatform();
    if (!player.isValid) return;
    player.teleport({ x: 0.5, y: POC.center.y + 1, z: 0.5 }, { dimension });
    return;
  }

  if (event.id === "pinene_pvp:leave") {
    player.teleport(world.getDefaultSpawnLocation(), { dimension: world.getDimension("minecraft:overworld") });
    return;
  }

  if (event.id === "pinene_pvp:build_poc") {
    await rebuildPocPlatform();
    player.sendMessage("§aPvP島の最小足場を再生成しました。");
    return;
  }

  if (event.id === "pinene_pvp:status") {
    const markerResult = readMarkerRegistry();
    const relicResult = readRelicLedger();
    const markerStatus = markerResult.ok ? markerResult.value.entries.length : `ERROR:${markerResult.reason}`;
    const relicStatus = relicResult.ok ? relicResult.value.status : `ERROR:${relicResult.reason}`;
    player.sendMessage(`§7[pinene_pvp] relic=${relicStatus}, markers=${markerStatus}`);
    return;
  }

  if (event.id === "pinene_pvp:recover_relic") {
    const recovered = recoverInterruptedRelic(player);
    player.sendMessage(recovered
      ? "§a中断状態の竜の遺物を管理者位置へ再発行しました。"
      : "§e発行中断状態ではないため、再発行しませんでした。");
  }
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (!event.id.startsWith("pinene_pvp:")) return;
  void handleScriptEvent(event).catch((error) => {
    console.error(`[pinene_pvp] Admin script event failed (${event.id}): ${error}`);
    event.sourceEntity?.sendMessage?.("§c処理に失敗しました。コンテンツログを確認してください。");
  });
});

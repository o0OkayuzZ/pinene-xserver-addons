import { ItemStack, StructureSaveMode, system, world } from "@minecraft/server";
import { IDS, ISLAND_TEMPLATE } from "./config.js";
import { applyPackIslandTemplate, getPackIslandTiles } from "./island_template.js";
import { toggleEditorProtectionBypass } from "./protection_service.js";

const KIT = Object.freeze([
  [IDS.islandCore, 16],
  [IDS.protectedFoundation, 64],
  [IDS.protectedStructure, 64],
  [IDS.protectedGlass, 64],
  [IDS.protectedLight, 64],
  [IDS.protectedStone, 64],
  [IDS.protectedMetal, 64],
  [IDS.protectedObsidian, 64],
  [IDS.protectedWhite, 64],
  [IDS.protectedBricks, 64],
  [IDS.protectedGlowGlass, 64],
  [IDS.protectedWood, 64],
  [IDS.protectedDark, 64],
  [IDS.protectedCopper, 64],
  [IDS.protectedGold, 64],
  [IDS.protectedRed, 64],
  [IDS.protectedBlue, 64],
  [IDS.protectedGreen, 64],
  [IDS.protectedYellow, 64],
  [IDS.protectedOrange, 64],
  [IDS.protectedPurple, 64],
  [IDS.protectedCyan, 64],
  [IDS.protectedPink, 64],
  [IDS.protectedBlack, 64],
  [IDS.protectedGray, 64],
  [IDS.protectedSandstone, 64],
  [IDS.protectedPrismarine, 64],
  [IDS.protectedNetherBricks, 64],
  [IDS.protectedMossyStone, 64],
  [IDS.protectedEmerald, 64],
  [IDS.protectedAmethyst, 64],
  [IDS.protectedCobblestone, 64],
  [IDS.protectedSmoothStone, 64],
  [IDS.protectedAndesite, 64],
  [IDS.protectedPolishedAndesite, 64],
  [IDS.protectedDiorite, 64],
  [IDS.protectedPolishedDiorite, 64],
  [IDS.protectedGranite, 64],
  [IDS.protectedPolishedGranite, 64],
  [IDS.protectedDeepslate, 64],
  [IDS.protectedCobbledDeepslate, 64],
  [IDS.protectedPolishedDeepslate, 64],
  [IDS.protectedDeepslateBricks, 64],
  [IDS.protectedDeepslateTiles, 64],
  [IDS.protectedTuff, 64],
  [IDS.protectedPolishedTuff, 64],
  [IDS.protectedTuffBricks, 64],
  [IDS.protectedCalcite, 64],
  [IDS.protectedBasalt, 64],
  [IDS.protectedPolishedBasalt, 64],
  [IDS.protectedBlackstone, 64],
  [IDS.protectedPolishedBlackstone, 64],
  [IDS.protectedEndStone, 64],
  [IDS.protectedEndStoneBricks, 64],
  [IDS.protectedPurpur, 64],
  ["minecraft:structure_block", 8],
]);

const KIT_PAGE_SIZE = 27;

function encodeInteger(value) {
  return `${value < 0 ? "n" : "p"}${Math.abs(value)}`;
}

function chunkCoordinate(value) {
  return Math.floor(value / 16);
}

function parseYRange(message) {
  const values = message.trim().split(/\s+/).filter(Boolean).map(Number);
  if (values.length !== 2 || !values.every(Number.isInteger)) {
    throw new Error("Y範囲は整数2個で指定してください。例: 0 63");
  }
  const [yMin, yMax] = values;
  if (yMax < yMin) throw new Error("yMaxはyMin以上にしてください。");
  if (yMax - yMin + 1 > ISLAND_TEMPLATE.maxTileHeight) {
    throw new Error(`1タイルの高さは最大${ISLAND_TEMPLATE.maxTileHeight}です。Y方向を分割してください。`);
  }
  return { yMin, yMax };
}

function tileDescription(player, yMin, yMax) {
  const chunkX = chunkCoordinate(player.location.x);
  const chunkZ = chunkCoordinate(player.location.z);
  const encodedX = encodeInteger(chunkX);
  const encodedZ = encodeInteger(chunkZ);
  const encodedYMin = encodeInteger(yMin);
  const encodedYMax = encodeInteger(yMax);
  const shortName = `c_${encodedX}_${encodedZ}_y_${encodedYMin}_${encodedYMax}`;
  return {
    id: `${ISLAND_TEMPLATE.prefix}${shortName}`,
    snapshotId: `pinene_pvp:editor/island/${shortName}`,
    fileName: `${shortName}.mcstructure`,
    chunkX,
    chunkZ,
    from: { x: chunkX * 16, y: yMin, z: chunkZ * 16 },
    to: { x: chunkX * 16 + 15, y: yMax, z: chunkZ * 16 + 15 },
  };
}

function giveKit(player, message) {
  const requestedPage = Number.parseInt(message.trim(), 10);
  const pageCount = Math.ceil(KIT.length / KIT_PAGE_SIZE);
  const page = Number.isInteger(requestedPage) ? requestedPage : 1;
  if (page < 1 || page > pageCount) {
    throw new Error(`編集キットのページは1～${pageCount}で指定してください。`);
  }
  const start = (page - 1) * KIT_PAGE_SIZE;
  for (const [typeId, amount] of KIT.slice(start, start + KIT_PAGE_SIZE)) {
    const remainder = player.addItem(new ItemStack(typeId, amount));
    if (remainder) player.dimension.spawnItem(remainder, player.location);
  }
  player.sendMessage(`§a島編集キット ${page}/${pageCount} を付与しました。別ページは /scriptevent pinene_pvp:editor_kit <ページ番号> で取得できます。`);
}

function saveCurrentChunk(player, message) {
  if (player.dimension.id !== IDS.dimension) {
    throw new Error("この操作はピネディメンション内で実行してください。");
  }
  const { yMin, yMax } = parseYRange(message);
  const tile = tileDescription(player, yMin, yMax);
  const existing = world.structureManager.get(tile.snapshotId);
  if (existing) world.structureManager.delete(existing);
  world.structureManager.createFromWorld(tile.snapshotId, player.dimension, tile.from, tile.to, {
    includeBlocks: true,
    includeEntities: false,
    saveMode: StructureSaveMode.World,
  });
  player.sendMessage(`§aワールド内スナップショットを保存しました: ${tile.snapshotId}`);
  player.sendMessage(`§7パックに入った後のID: ${tile.id}`);
  player.sendMessage(`§e他ワールド用ファイル名: ${tile.fileName}`);
  player.sendMessage(`§7範囲: (${tile.from.x}, ${tile.from.y}, ${tile.from.z}) ～ (${tile.to.x}, ${tile.to.y}, ${tile.to.z})`);
}

function showExportGuide(player, message) {
  if (player.dimension.id !== IDS.dimension) {
    throw new Error("この操作はピネディメンション内で実行してください。");
  }
  const { yMin, yMax } = parseYRange(message);
  const tile = tileDescription(player, yMin, yMax);
  const helperLocation = { x: tile.from.x - 1, y: yMin, z: tile.from.z - 1 };
  player.dimension.setBlockType(helperLocation, "minecraft:structure_block");
  player.sendMessage(`§a補助ストラクチャーブロックを ${helperLocation.x} ${helperLocation.y} ${helperLocation.z} に設置しました。`);
  player.sendMessage(`§eStructure Name: ${tile.id}`);
  player.sendMessage("§eRelative Position: 1 0 1");
  player.sendMessage(`§eStructure Size: 16 ${yMax - yMin + 1} 16`);
  player.sendMessage(`§eExportファイル名: ${tile.fileName}`);
  player.sendMessage("§7Include EntitiesをOFF、Include BlocksをONにしてExportしてください。");
}

async function handleEditorEvent(event) {
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player") return;

  if (event.id === "pinene_pvp:editor_kit") {
    giveKit(player, event.message);
    return;
  }
  if (event.id === "pinene_pvp:editor_bypass") {
    const enabled = toggleEditorProtectionBypass(player);
    player.sendMessage(enabled
      ? "§e編集バイパスを有効化しました。このセッション中は永久保護ブロックを破壊できます。"
      : "§a編集バイパスを無効化しました。永久保護ブロックは再び破壊不能です。");
    return;
  }
  if (event.id === "pinene_pvp:editor_save_chunk") {
    saveCurrentChunk(player, event.message);
    return;
  }
  if (event.id === "pinene_pvp:editor_export_guide") {
    showExportGuide(player, event.message);
    return;
  }
  if (event.id === "pinene_pvp:editor_apply_pack") {
    const result = await applyPackIslandTemplate(true);
    player.sendMessage(`§aパック内の島タイルを${result.placed}個配置しました。`);
    return;
  }
  if (event.id === "pinene_pvp:editor_list_pack") {
    const tiles = getPackIslandTiles();
    player.sendMessage(`§7パック内の島タイル: ${tiles.length}個`);
    for (const tile of tiles.slice(0, 20)) player.sendMessage(`§8- ${tile.id}`);
  }
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (!event.id.startsWith("pinene_pvp:editor_")) return;
  void handleEditorEvent(event).catch((error) => {
    console.error(`[pinene_pvp] Editor command failed (${event.id}): ${error}`);
    event.sourceEntity?.sendMessage?.(`§c${error}`);
  });
});

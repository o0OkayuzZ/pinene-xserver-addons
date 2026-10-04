import { world, system, ItemStack } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { COOKING_RECIPES, CATEGORY_ORDER } from './cooking_data.js';
import { INVENTORY_ICONS } from './inventory_icons.generated.js';
import {
  DISCOVERY_KEY,
  discoverFromItems,
  parseDiscovery,
  isRecipeDiscovered
} from './recipe_discovery.js';

const STATE = 'pinene_cooking:knife';
const KNIFE_LIMIT = Object.freeze({ copper: 2, iron: 3, gold: 4, diamond: 6, netherite: 7 });
const RANK_ROMAN = Object.freeze(['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII']);

function isBoard(typeId) {
  return typeof typeId === 'string' && typeId.startsWith('pinene_cooking:') && typeId.endsWith('_cutting_board');
}

function inventory(player) {
  return player.getComponent('minecraft:inventory')?.container;
}

function currentItemIds(player) {
  const ids = [];
  const container = inventory(player);
  if (!container) return ids;
  for (let slot = 0; slot < container.size; slot++) {
    const stack = container.getItem(slot);
    if (stack) ids.push(stack.typeId);
  }
  return ids;
}

function syncDiscoveries(player, itemIds) {
  if (!player?.isValid) return [];
  const raw = player.getDynamicProperty(DISCOVERY_KEY);
  const next = discoverFromItems(raw, itemIds);
  const before = typeof raw === 'string' ? raw : '';
  if (next.value !== before) player.setDynamicProperty(DISCOVERY_KEY, next.value || undefined);
  return next.newly;
}

function seedInventory(player) {
  try { syncDiscoveries(player, currentItemIds(player)); } catch {}
}

function rankLabel(rank) {
  return rank === 0 ? '基礎素材' : `Rank ${RANK_ROMAN[rank] ?? rank}`;
}

function boardRank(block) {
  const material = block?.permutation?.getAllStates?.()[STATE];
  return { material, rank: KNIFE_LIMIT[material] ?? -1 };
}

function localizedItem(id) {
  try {
    return { translate: new ItemStack(id, 1).localizationKey };
  } catch {
    return { text: id };
  }
}

function ingredientBody(recipe, canCook) {
  const rawtext = [
    { text: `§7${rankLabel(recipe.rank)}§r\n${recipe.description ?? ''}\n\n§l材料§r\n` }
  ];
  for (const part of recipe.ingredients) {
    rawtext.push({ text: `§7×${part.count} §r` });
    const ids = part.ids ?? [part.id];
    ids.forEach((id, index) => {
      if (index) rawtext.push({ text: ' §8/§r ' });
      rawtext.push(localizedItem(id));
    });
    rawtext.push({ text: '\n' });
  }
  rawtext.push({ text: `\n§7完成数: §f${recipe.resultCount}§r` });
  if (!canCook) rawtext.push({ text: '\n\n§c現在のナイフではこのRankを調理できません。§r' });
  return { rawtext };
}

async function showDetail(player, block, recipe, unlocked) {
  const form = new ActionFormData();
  if (!unlocked) {
    form.title('？？？');
    form.body(`§8未発見の料理です。\n対応する素材を一度入手すると詳細が解放されます。\n\n${rankLabel(recipe.rank)}§r`);
    form.button('戻る');
  } else {
    const current = boardRank(block);
    const canCook = current.rank >= recipe.rank;
    form.title(recipe.name);
    form.body(ingredientBody(recipe, canCook));
    form.button('戻る', INVENTORY_ICONS[recipe.id]);
  }
  const response = await form.show(player);
  if (!response.canceled && player.isValid) await showRecipeGuide(player, block);
}

export async function showRecipeGuide(player, block) {
  if (!player?.isValid || !block || !isBoard(block.typeId)) return;
  seedInventory(player);
  const found = parseDiscovery(player.getDynamicProperty(DISCOVERY_KEY));
  const current = boardRank(block);
  const form = new ActionFormData();
  form.title('料理図鑑');
  form.body(
    `§7基礎素材は最初から公開。ほかの料理は対応素材を一度入手すると解放されます。§r\n` +
    `§7現在のナイフ: §f${current.rank < 0 ? '未設定' : rankLabel(current.rank)}§r`
  );

  const buttons = [];
  for (const rank of CATEGORY_ORDER) {
    const rows = COOKING_RECIPES.filter(recipe => recipe.rank === rank);
    if (!rows.length) continue;
    form.divider();
    form.header(rankLabel(rank));
    for (const recipe of rows) {
      const unlocked = isRecipeDiscovered(recipe, found);
      if (unlocked) {
        const unavailable = current.rank < recipe.rank ? '\n§8現在調理不可§r' : '';
        form.button(`${recipe.name}\n§7${rankLabel(recipe.rank)}§r${unavailable}`, INVENTORY_ICONS[recipe.id]);
      } else {
        form.button(`§8？？？\n${rankLabel(recipe.rank)}§r`);
      }
      buttons.push({ recipe, unlocked });
    }
  }

  try {
    const response = await form.show(player);
    if (response.canceled || response.selection === undefined) return;
    const selected = buttons[response.selection];
    if (selected) await showDetail(player, block, selected.recipe, selected.unlocked);
  } catch (error) {
    try { player.sendMessage('§c料理図鑑を開けませんでした。'); } catch {}
    console.warn('[pinene_cooking_guide] ' + String(error));
  }
}

world.afterEvents.playerInventoryItemChange.subscribe(event => {
  if (!event.itemStack) return;
  try { syncDiscoveries(event.player, [event.itemStack.typeId]); } catch {}
});

world.afterEvents.playerSpawn.subscribe(event => {
  system.run(() => seedInventory(event.player));
});

system.run(() => {
  for (const player of world.getAllPlayers()) seedInventory(player);
});

world.beforeEvents.playerInteractWithBlock.subscribe(event => {
  if (event.cancel || event.isFirstEvent === false || !isBoard(event.block.typeId)) return;
  const held = inventory(event.player)?.getItem(event.player.selectedSlotIndex);
  if (held?.typeId !== 'minecraft:book') return;
  event.cancel = true;
  const dimension = event.block.dimension;
  const location = { ...event.block.location };
  const typeId = event.block.typeId;
  system.run(() => {
    const block = dimension.getBlock(location);
    if (!block || block.typeId !== typeId || !event.player.isValid) return;
    showRecipeGuide(event.player, block);
  });
});

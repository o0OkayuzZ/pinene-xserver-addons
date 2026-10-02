import { ItemStack, system, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { COOKING_RECIPES } from "./cooking_data.js";

const BOARD_PREFIX = "pinene_cooking:";
const BOARD_SUFFIX = "_cutting_board";
const KNIFE_IDS = new Set([
  "pinene_cooking:copper_knife",
  "pinene_cooking:iron_knife",
  "pinene_cooking:gold_knife",
  "pinene_cooking:diamond_knife",
  "pinene_cooking:netherite_knife",
]);
const PLACED_BY_KNIFE = {
  "pinene_cooking:copper_knife": "pinene_cooking:placed_copper_knife",
  "pinene_cooking:iron_knife": "pinene_cooking:placed_iron_knife",
  "pinene_cooking:gold_knife": "pinene_cooking:placed_gold_knife",
  "pinene_cooking:diamond_knife": "pinene_cooking:placed_diamond_knife",
  "pinene_cooking:netherite_knife": "pinene_cooking:placed_netherite_knife",
};
const KNIFE_BY_PLACED = Object.fromEntries(
  Object.entries(PLACED_BY_KNIFE).map(([knife, placed]) => [placed, knife]),
);
const KNIFE_NAMES = {
  "pinene_cooking:copper_knife": "銅のナイフ",
  "pinene_cooking:iron_knife": "鉄のナイフ",
  "pinene_cooking:gold_knife": "金のナイフ",
  "pinene_cooking:diamond_knife": "ダイヤモンドのナイフ",
  "pinene_cooking:netherite_knife": "ネザライトのナイフ",
};
const KNIFE_MAX = {
  "pinene_cooking:copper_knife": 96,
  "pinene_cooking:iron_knife": 128,
  "pinene_cooking:gold_knife": 64,
  "pinene_cooking:diamond_knife": 512,
  "pinene_cooking:netherite_knife": 640,
};
const DAMAGE_KEY = "pinene_cooking:knife_damage";

function isBoardId(typeId) {
  return typeId?.startsWith(BOARD_PREFIX) && typeId.endsWith(BOARD_SUFFIX);
}
function inventory(player) {
  return player.getComponent("minecraft:inventory")?.container;
}

function boardCenter(block) {
  return {
    x: block.location.x + 0.5,
    y: block.location.y + 0.145,
    z: block.location.z + 0.5,
  };
}

function placedKnivesAt(block) {
  const center = boardCenter(block);
  return block.dimension.getEntities({ location: center, maxDistance: 0.7 })
    .filter((entity) => KNIFE_BY_PLACED[entity.typeId]);
}

function placedKnifeAt(block) {
  const found = placedKnivesAt(block);
  for (let i = 1; i < found.length; i++) {
    try { found[i].remove(); } catch {}
  }
  syncBoardKnife(block, found[0]);
  return found[0];
}
function syncBoardKnife(block, entity) {
  if (!block || !isBoardId(block.typeId)) return;
  const typeId = KNIFE_BY_PLACED[entity?.typeId];
  const material = typeId ? typeId.split(":")[1].replace("_knife", "") : "empty";
  if (block.permutation.getState("pinene_cooking:knife") !== material) {
    block.setPermutation(block.permutation.withState("pinene_cooking:knife", material));
  }
}
function entityBoard(entity) {
  const loc = entity.location;
  return entity.dimension.getBlock({ x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) });
}
function boardYaw(block) {
  const direction = block.permutation.getState("minecraft:cardinal_direction");
  const base = { south: 0, east: 90, north: 180, west: -90 }[direction] ?? 0;
  return base + 10;
}

function selectedKnife(player) {
  const inv = inventory(player);
  if (!inv) return undefined;
  const slot = player.selectedSlotIndex;
  const stack = inv.getItem(slot);
  if (!stack || !KNIFE_IDS.has(stack.typeId)) return undefined;
  return { inv, slot, stack };
}

function countItem(container, typeId) {
  let total = 0;
  if (!container) return total;
  for (let slot = 0; slot < container.size; slot++) {
    const stack = container.getItem(slot);
    if (stack?.typeId === typeId) total += stack.amount;
  }
  return total;
}
function removeItem(container, typeId, amount) {
  let remaining = amount;
  for (let slot = 0; slot < container.size && remaining > 0; slot++) {
    const stack = container.getItem(slot);
    if (stack?.typeId !== typeId) continue;
    const take = Math.min(stack.amount, remaining);
    remaining -= take;
    if (take === stack.amount) container.setItem(slot, undefined);
    else {
      stack.amount -= take;
      container.setItem(slot, stack);
    }
  }
  return remaining === 0;
}

function countIngredient(container, ingredient) {
  if (Array.isArray(ingredient?.ids) && ingredient.ids.length > 0) {
    return ingredient.ids.reduce((total, typeId) => total + countItem(container, typeId), 0);
  }
  return countItem(container, ingredient?.id);
}

function removeIngredient(container, ingredient) {
  let remaining = ingredient?.count ?? 0;
  if (remaining <= 0) return true;

  if (Array.isArray(ingredient?.ids) && ingredient.ids.length > 0) {
    for (const typeId of ingredient.ids) {
      if (remaining <= 0) break;
      const available = countItem(container, typeId);
      const take = Math.min(available, remaining);
      if (take > 0 && !removeItem(container, typeId, take)) return false;
      remaining -= take;
    }
    return remaining === 0;
  }

  return removeItem(container, ingredient?.id, remaining);
}

function giveOrDropStack(player, stack) {
  const container = inventory(player);
  if (!container) return;
  const leftover = container.addItem(stack);
  if (leftover) player.dimension.spawnItem(leftover, player.location);
}

function knifeStack(typeId, damage = 0) {
  const stack = new ItemStack(typeId, 1);
  const durability = stack.getComponent("minecraft:durability");
  if (durability) {
    durability.damage = Math.max(0, Math.min(damage, durability.maxDurability - 1));
  }
  return stack;
}

function placedDamage(entity) {
  const value = entity?.getDynamicProperty(DAMAGE_KEY);
  return typeof value === "number" ? Math.max(0, Math.floor(value)) : 0;
}

function placeKnife(player, block) {
  if (placedKnifeAt(block)) return false;
  const selected = selectedKnife(player);
  if (!selected) return false;
  const typeId = selected.stack.typeId;
  const durability = selected.stack.getComponent("minecraft:durability");
  const damage = durability?.damage ?? 0;
  selected.inv.setItem(selected.slot, undefined);
  let entity;
  try {
    entity = block.dimension.spawnEntity(PLACED_BY_KNIFE[typeId], boardCenter(block));
    entity.setRotation({ x: 0, y: boardYaw(block) });
    entity.setDynamicProperty(DAMAGE_KEY, damage);
    syncBoardKnife(block, entity);
    player.sendMessage("§a" + KNIFE_NAMES[typeId] + "をまな板に置いた。");
    return true;
  } catch (error) {
    try { entity?.remove(); } catch {}
    try { syncBoardKnife(block, undefined); } catch {}
    if (!selected.inv.getItem(selected.slot)) selected.inv.setItem(selected.slot, selected.stack);
    else giveOrDropStack(player, selected.stack);
    console.error("[pinene_cooking] placed knife spawn failed: " + error);
    return false;
  }
}

function retrieveKnife(player, entity) {
  const typeId = KNIFE_BY_PLACED[entity?.typeId];
  if (!typeId) return false;
  syncBoardKnife(entityBoard(entity), undefined);
  giveOrDropStack(player, knifeStack(typeId, placedDamage(entity)));
  try { entity.remove(); } catch {}
  player.sendMessage("§a" + KNIFE_NAMES[typeId] + "を回収した。");
  return true;
}

function damagePlacedKnife(player, entity) {
  const typeId = KNIFE_BY_PLACED[entity?.typeId];
  if (!typeId) return "missing";
  const next = placedDamage(entity) + 1;
  const max = KNIFE_MAX[typeId] ?? 1;
  if (next >= max) {
    syncBoardKnife(entityBoard(entity), undefined);
    try { entity.remove(); } catch {}
    player.sendMessage("§c" + KNIFE_NAMES[typeId] + "が壊れた。");
    return "broken";
  }
  entity.setDynamicProperty(DAMAGE_KEY, next);
  return "damaged";
}
const KNIFE_RANK_LIMIT = {
  "pinene_cooking:copper_knife": 2,
  "pinene_cooking:iron_knife": 3,
  "pinene_cooking:gold_knife": 4,
  "pinene_cooking:diamond_knife": 6,
  "pinene_cooking:netherite_knife": 7,
};
const CATEGORY_LABELS = ["素材", "Rank I", "Rank II", "Rank III", "Rank IV", "Rank V", "Rank VI", "Rank VII"];
const CATEGORY_TAB_LABELS = ["素材", "I", "II", "III", "IV", "V", "VI", "VII"];
const RECIPE_SLOT_COUNT = 12;
const CONTAINER_RETURNS = {
  "minecraft:honey_bottle": "minecraft:glass_bottle",
  "minecraft:milk_bucket": "minecraft:bucket",
};

const INVENTORY_SLOT_COUNT = 36;
const INVENTORY_BUTTON_START = 31;

const RECIPE_ICON_BY_ID = (() => {
  const map = new Map();
  for (const recipe of COOKING_RECIPES) {
    if (recipe?.id && recipe?.icon) map.set(recipe.id, recipe.icon);
    for (const ingredient of recipe?.ingredients ?? []) {
      if (ingredient?.id && ingredient?.icon && !map.has(ingredient.id)) {
        map.set(ingredient.id, ingredient.icon);
      }
    }
  }
  return map;
})();

const INVENTORY_ICON_OVERRIDES = {
  "minecraft:glass_bottle": "textures/items/potion_bottle_empty",
  "minecraft:milk_bucket": "textures/items/bucket_milk",
  "minecraft:water_bucket": "textures/items/bucket_water",
  "minecraft:lava_bucket": "textures/items/bucket_lava",
  "minecraft:bucket": "textures/items/bucket_empty",
  "minecraft:wheat_seeds": "textures/items/seeds_wheat",
  "minecraft:pumpkin_seeds": "textures/items/seeds_pumpkin",
  "minecraft:melon_seeds": "textures/items/seeds_melon",
  "minecraft:beetroot_seeds": "textures/items/seeds_beetroot",
  "minecraft:cocoa_beans": "textures/items/dye_powder_brown",
  "minecraft:cooked_beef": "textures/items/beef_cooked",
  "minecraft:cooked_porkchop": "textures/items/porkchop_cooked",
  "minecraft:cooked_chicken": "textures/items/chicken_cooked",
  "minecraft:baked_potato": "textures/items/potato_baked",
  "minecraft:wooden_sword": "textures/items/wood_sword",
  "minecraft:wooden_pickaxe": "textures/items/wood_pickaxe",
  "minecraft:wooden_axe": "textures/items/wood_axe",
  "minecraft:wooden_shovel": "textures/items/wood_shovel",
  "minecraft:wooden_hoe": "textures/items/wood_hoe",
  "minecraft:golden_sword": "textures/items/gold_sword",
  "minecraft:golden_pickaxe": "textures/items/gold_pickaxe",
  "minecraft:golden_axe": "textures/items/gold_axe",
  "minecraft:golden_shovel": "textures/items/gold_shovel",
  "minecraft:golden_hoe": "textures/items/gold_hoe",
  "minecraft:oak_planks": "textures/blocks/planks_oak",
  "minecraft:spruce_planks": "textures/blocks/planks_spruce",
  "minecraft:birch_planks": "textures/blocks/planks_birch",
  "minecraft:jungle_planks": "textures/blocks/planks_jungle",
  "minecraft:acacia_planks": "textures/blocks/planks_acacia",
  "minecraft:dark_oak_planks": "textures/blocks/planks_big_oak",
  "minecraft:mangrove_planks": "textures/blocks/mangrove_planks",
  "minecraft:cherry_planks": "textures/blocks/cherry_planks",
  "minecraft:cobblestone": "textures/blocks/cobblestone",
  "minecraft:stone": "textures/blocks/stone",
  "minecraft:dirt": "textures/blocks/dirt",
  "minecraft:crafting_table": "textures/blocks/crafting_table_front",
};

function inventoryIcon(typeId) {
  if (!typeId) return undefined;
  const recipeIcon = RECIPE_ICON_BY_ID.get(typeId);
  if (recipeIcon) return recipeIcon;
  const override = INVENTORY_ICON_OVERRIDES[typeId];
  if (override) return override;
  const separator = typeId.indexOf(":");
  const namespace = separator >= 0 ? typeId.slice(0, separator) : "minecraft";
  const id = separator >= 0 ? typeId.slice(separator + 1) : typeId;
  if (namespace === "pine" || namespace === "pinene_cooking") {
    return "textures/items/" + id;
  }
  return "textures/items/" + id;
}

function appendInventorySnapshot(form, player) {
  const container = inventory(player);
  // Vanilla layout order: 3 inventory rows (slots 9-35), then hotbar (0-8).
  const order = [];
  for (let slot = 9; slot < INVENTORY_SLOT_COUNT; slot++) order.push(slot);
  for (let slot = 0; slot < 9; slot++) order.push(slot);

  for (const slot of order) {
    const stack = container?.getItem(slot);
    if (!stack) {
      form.button(" ");
      continue;
    }
    const count = stack.amount > 1 ? String(stack.amount) : "";
    form.button(count, inventoryIcon(stack.typeId));
  }
}

function recipesForCategory(category) {
  return COOKING_RECIPES.filter((recipe) => recipe.rank === category);
}

function recipeById(id) {
  return COOKING_RECIPES.find((recipe) => recipe.id === id);
}

// Optional 3x3 recipe preview. Shapeless recipes keep the legacy compact order.
// Shaped recipes can provide recipe.layout as an array of 9 ingredient-like
// entries (or null) so the UI mirrors a vanilla crafting grid.
function recipeIngredientSlots(recipe) {
  if (!recipe) return [];
  if (Array.isArray(recipe.layout) && recipe.layout.length === 9) {
    return recipe.layout;
  }
  return recipe.ingredients ?? [];
}

function ingredientChoiceMatches(a, b) {
  if (!a || !b) return false;
  if (a.id && b.id) return a.id === b.id;
  const aIds = Array.isArray(a.ids) ? [...a.ids].sort() : [];
  const bIds = Array.isArray(b.ids) ? [...b.ids].sort() : [];
  return aIds.length > 0 && aIds.length === bIds.length &&
    aIds.every((value, index) => value === bIds[index]);
}

function recipeIngredientForSlot(recipe, slotIngredient) {
  return (recipe?.ingredients ?? []).find((ingredient) =>
    ingredientChoiceMatches(ingredient, slotIngredient)
  ) ?? slotIngredient;
}

function ingredientCountLabel(player, recipe, slotIngredient) {
  const container = inventory(player);
  const ingredient = recipeIngredientForSlot(recipe, slotIngredient);
  const required = ingredient?.count ?? slotIngredient?.count ?? 1;
  const owned = countIngredient(container, ingredient);
  const enough = owned >= required;
  return (enough ? "§f" : "§c") + owned + "/" + required;
}

function knifeRankLimit(knifeEntity) {
  const typeId = KNIFE_BY_PLACED[knifeEntity?.typeId];
  return KNIFE_RANK_LIMIT[typeId] ?? 0;
}
function canCraftRecipe(player, knifeEntity, recipe) {
  if (!recipe || !knifeEntity) return false;
  if (recipe.rank > 0 && recipe.rank > knifeRankLimit(knifeEntity)) return false;
  const container = inventory(player);
  if (!container) return false;
  return recipe.ingredients.every((ingredient) =>
    countIngredient(container, ingredient) >= ingredient.count
  );
}

function addContainerReturns(player, recipe) {
  for (const ingredient of recipe.ingredients) {
    const returnId = CONTAINER_RETURNS[ingredient.id];
    if (!returnId) continue;
    giveOrDropStack(player, new ItemStack(returnId, ingredient.count));
  }
}

function craftCookingRecipe(player, knifeEntity, recipe) {
  if (!canCraftRecipe(player, knifeEntity, recipe)) return false;
  const container = inventory(player);
  for (const ingredient of recipe.ingredients) {
    if (!removeIngredient(container, ingredient)) return false;
  }
  addContainerReturns(player, recipe);
  giveOrDropStack(player, new ItemStack(recipe.id, recipe.resultCount));
  for (let i = 0; i < Math.max(1, recipe.resultCount); i++) {
    if (damagePlacedKnife(player, knifeEntity) === "broken") break;
  }
  player.sendMessage("§6" + recipe.name + "を作った。");
  return true;
}

function recipeDetailText(recipe, knifeEntity, category) {
  const typeId = KNIFE_BY_PLACED[knifeEntity?.typeId];
  const limit = knifeRankLimit(knifeEntity);
  if (!recipe) {
    const limitText = ["", "I", "II", "III", "IV", "V", "VI", "VII"][limit];
    return "§l" + CATEGORY_LABELS[category] + "§r\n\n" +
      "このRankには現在登録されている料理がありません。" +
      "\n§7" + KNIFE_NAMES[typeId] + "：Rank " + limitText + "まで";
  }
  const rankText = recipe.rank === 0 ? "素材" : "Rank " + ["", "I", "II", "III", "IV", "V", "VI", "VII"][recipe.rank];
  const foodStats = recipe.nutrition == null ? "" :
    "\n\n§7満腹度 §f" + recipe.nutrition + "   §7飽和度 §f" + recipe.saturation;
  return "§l" + recipe.name + "§r  §8" + rankText + "\n\n" +
    recipe.description + foodStats;
}
function scheduleBoardUi(player, block, state) {
  const dimension = block.dimension;
  const location = { ...block.location };
  system.run(() => {
    const fresh = dimension.getBlock(location);
    if (!fresh || !isBoardId(fresh.typeId)) return;
    openBoard(player, fresh, state);
  });
}

async function openBoard(player, block, state = {}) {
  const knife = placedKnifeAt(block);
  if (!knife) {
    player.sendMessage("§e銅以上のナイフを手に持って、まな板に置いてください。");
    return;
  }
  const limit = knifeRankLimit(knife);
  let category = Number.isInteger(state.category) ? state.category : Math.min(2, limit);
  if (category > 0 && category > limit) category = limit;
  const categoryRecipes = recipesForCategory(category);
  let selected = recipeById(state.recipeId);
  if (!selected || selected.rank !== category) selected = categoryRecipes[0];

  const form = new ActionFormData()
    .title("pinene_cooking_ui:まな板");
  for (let rank = 0; rank <= 7; rank++) {
    const locked = rank > 0 && rank > limit;
    const prefix = rank === category ? "§a" : locked ? "§8" : "§f";
    const suffix = locked ? "  ×" : "";
    form.button(prefix + CATEGORY_TAB_LABELS[rank] + suffix);
  }

  for (let i = 0; i < RECIPE_SLOT_COUNT; i++) {
    const recipe = categoryRecipes[i];
    if (!recipe) {
      form.button(" ");
      continue;
    }
    const marker = selected?.id === recipe.id ? "§a" : "§f";
    form.button(marker + recipe.name, recipe.icon);
  }

  const ingredientSlots = recipeIngredientSlots(selected);
  for (let i = 0; i < 9; i++) {
    const ingredient = ingredientSlots[i];
    if (!ingredient) {
      form.button(" ");
      continue;
    }
    form.button(ingredientCountLabel(player, selected, ingredient), ingredient.icon);
  }
  if (selected) form.button(String(selected.resultCount), selected.icon);
  else form.button(" ");

  const craftable = !!selected && canCraftRecipe(player, knife, selected);
  form.button(craftable ? "§aクラフト" : "§8材料不足", selected?.icon);

  appendInventorySnapshot(form, player);

  const response = await form.show(player);
  if (response.canceled || response.selection == null) return;
  const index = response.selection;

  if (index <= 7) {
    if (index > 0 && index > limit) {
      player.sendMessage("§cこのナイフでは " + CATEGORY_LABELS[index] + " の料理は作れません。");
      scheduleBoardUi(player, block, { category, recipeId: selected?.id });
      return;
    }
    scheduleBoardUi(player, block, { category: index });
    return;
  }

  if (index >= 8 && index < 8 + RECIPE_SLOT_COUNT) {
    const recipe = categoryRecipes[index - 8];
    scheduleBoardUi(player, block, { category, recipeId: recipe?.id ?? selected?.id });
    return;
  }
  if (index === 30 && selected) {
    if (!craftCookingRecipe(player, knife, selected)) {
      player.sendMessage("§c材料が足りないか、このナイフでは作れません。");
    }
    scheduleBoardUi(player, block, { category, recipeId: selected.id });
    return;
  }

  if (index >= INVENTORY_BUTTON_START && index < INVENTORY_BUTTON_START + INVENTORY_SLOT_COUNT) {
    scheduleBoardUi(player, block, { category, recipeId: selected?.id });
    return;
  }

  scheduleBoardUi(player, block, { category, recipeId: selected?.id });
}

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  if (!isBoardId(event.block.typeId) || event.isFirstEvent === false) return;
  event.cancel = true;
  const player = event.player;
  const dimension = event.block.dimension;
  const location = { ...event.block.location };

  system.run(() => {
    const block = dimension.getBlock(location);
    if (!block || !isBoardId(block.typeId)) return;
    const placed = placedKnifeAt(block);
    const selected = selectedKnife(player);

    if (selected && !placed) {
      placeKnife(player, block);
      return;
    }
    if (placed && player.isSneaking) {
      retrieveKnife(player, placed);
      return;
    }
    if (selected && placed) {
      player.sendMessage("§eすでにナイフが置かれています。スニーク＋操作で回収できます。");
      return;
    }
    if (!placed) {
      player.sendMessage("§eナイフをまな板に置いてください。");
      return;
    }
    openBoard(player, block);
  });
});

world.afterEvents.playerBreakBlock.subscribe((event) => {
  const brokenId = event.brokenBlockPermutation.type.id;
  if (!isBoardId(brokenId)) return;
  const center = {
    x: event.block.location.x + 0.5,
    y: event.block.location.y + 0.145,
    z: event.block.location.z + 0.5,
  };
  const found = event.dimension.getEntities({ location: center, maxDistance: 0.7 })
    .filter((entity) => KNIFE_BY_PLACED[entity.typeId]);
  for (const entity of found) retrieveKnife(event.player, entity);
});

system.runInterval(() => {
  const dimensions = new Map();
  for (const player of world.getAllPlayers()) dimensions.set(player.dimension.id, player.dimension);
  for (const dimension of dimensions.values()) {
    for (const placedType of Object.values(PLACED_BY_KNIFE)) {
      for (const entity of dimension.getEntities({ type: placedType })) {
        const loc = entity.location;
        const block = dimension.getBlock({
          x: Math.floor(loc.x),
          y: Math.floor(loc.y),
          z: Math.floor(loc.z),
        });
        if (!block) continue; // Unloaded chunks are not destroyed boards.
        if (isBoardId(block.typeId)) { syncBoardKnife(block, entity); continue; }
        const typeId = KNIFE_BY_PLACED[entity.typeId];
        if (typeId) {
          const stack = knifeStack(typeId, placedDamage(entity));
          dimension.spawnItem(stack, entity.location);
        }
        try { entity.remove(); } catch {}
      }
    }
  }
}, 100);

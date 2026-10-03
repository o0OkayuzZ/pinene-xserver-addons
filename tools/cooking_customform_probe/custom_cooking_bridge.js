import { createPersistentCookingUi } from "./custom_cooking_ui.js";

export const CUSTOM_COOKING_TAG = "pinene_cooking:customform_test";
const LOG_PREFIX = "[pinene_cooking_customform] ";
const RP_UUID = "c81a6798-b6b1-4716-a514-c49967ad0ee2";
const MATERIAL_IMAGES = new Set(["pine:milk_bottle", "pine:butter", "pine:chocolate",
  "pine:cooking_oil", "pine:gelatin", "pine:noodles", "pine:cheese"]);

/** Preflight the existing synchronous craft operation without mutating slots. */
export function hasRoomAfterCraft(container, recipe, ItemStack, returns) {
  const slots = Array.from({ length: container.size }, (_, i) => container.getItem(i)?.clone());
  for (const ingredient of recipe.ingredients) {
    let remaining = ingredient.count;
    const ids = new Set(ingredient.ids ?? [ingredient.id]);
    for (let i = 0; i < slots.length && remaining > 0; i++) {
      const stack = slots[i];
      if (!stack || !ids.has(stack.typeId)) continue;
      const take = Math.min(stack.amount, remaining);
      remaining -= take;
      if (take === stack.amount) slots[i] = undefined;
      else stack.amount -= take;
    }
    if (remaining > 0) return false;
  }
  const outputs = [];
  for (const ingredient of recipe.ingredients) {
    const id = returns[ingredient.id];
    if (id) outputs.push(new ItemStack(id, ingredient.count));
  }
  outputs.push(new ItemStack(recipe.id, recipe.resultCount));
  for (const output of outputs) {
    let remaining = output.amount;
    for (const stack of slots) {
      if (!stack || !stack.isStackableWith(output)) continue;
      const add = Math.min(stack.maxAmount - stack.amount, remaining);
      if (add > 0) { stack.amount += add; remaining -= add; }
    }
    for (let i = 0; i < slots.length && remaining > 0; i++) {
      if (slots[i]) continue;
      const stack = output.clone();
      stack.amount = Math.min(stack.maxAmount, remaining);
      remaining -= stack.amount;
      slots[i] = stack;
    }
    if (remaining > 0) return false;
  }
  return true;
}

export function createCustomCookingBridge(host) {
  const { ui, system, world, recipes, inventory, countIngredient, countItem,
    canCraftRecipe, craftCookingRecipe, knifeRankLimit, isBoardId,
    KNIFE_BY_PLACED, ItemStack, CONTAINER_RETURNS } = host;
  const recipeMap = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const log = (event) => console.warn(LOG_PREFIX + JSON.stringify(event));
  function context(player, origin) {
    if (!player.isValid || player.dimension.id !== origin.dimension.id) return { valid: false, reason: "dimension_or_player_changed" };
    const health = player.getComponent("minecraft:health");
    if (health && health.currentValue <= 0) return { valid: false, reason: "player_dead" };
    const p = player.location, b = origin.location;
    if ((p.x - b.x - 0.5) ** 2 + (p.y - b.y) ** 2 + (p.z - b.z - 0.5) ** 2 > 36) return { valid: false, reason: "board_out_of_range" };
    const block = origin.dimension.getBlock(b);
    if (!block || block.typeId !== origin.typeId || !isBoardId(block.typeId)) return { valid: false, reason: "board_removed" };
    const container = inventory(player);
    if (!container) return { valid: false, reason: "inventory_unavailable" };
    const knives = origin.dimension.getEntities({ location: { x: b.x + 0.5, y: b.y + 0.145, z: b.z + 0.5 }, maxDistance: 0.7 })
      .filter((e) => e.isValid && KNIFE_BY_PLACED[e.typeId]);
    return { valid: true, block, container, knife: knives.length === 1 ? knives[0] : undefined };
  }
  function inspect(player, origin, recipe) {
    const ctx = context(player, origin);
    if (!ctx.valid) return ctx;
    let reason = "";
    let canCraft = false;
    const ingredients = (recipe?.ingredients ?? []).map((part) => {
      const owned = countIngredient(ctx.container, part);
      return `${part.name ?? part.id}：${owned} / ${part.count}${owned < part.count ? "（不足）" : ""}`;
    });
    if (!recipe) reason = "";
    else if (recipeMap.get(recipe.id) !== recipe) reason = "レシピが一致しません。";
    else if (!ctx.knife) reason = "まな板に使用できるナイフがありません。";
    else if (recipe.rank > knifeRankLimit(ctx.knife)) reason = "このRankの料理はまだ作れません。";
    else if (!canCraftRecipe(player, ctx.knife, recipe)) reason = "材料が不足しています。";
    else if (!hasRoomAfterCraft(ctx.container, recipe, ItemStack, CONTAINER_RETURNS)) reason = "完成品を受け取る空きが足りません。";
    else canCraft = true;
    const image = recipe && MATERIAL_IMAGES.has(recipe.id)
      ? { path: `textures/items/${recipe.id.split(":")[1]}.png`, pack: RP_UUID } : undefined;
    return { valid: true, canCraft, reason, ingredients, image,
      resultOwned: recipe ? countItem(ctx.container, recipe.id) : 0 };
  }
  const controller = createPersistentCookingUi({ ui, system, recipes, inspect, log,
    craft(player, origin, recipe) {
      const state = inspect(player, origin, recipe);
      if (!state.valid || !state.canCraft) return { ok: false, reason: state.reason };
      const ctx = context(player, origin);
      if (!ctx.valid || !ctx.knife) return { ok: false, reason: "まな板の状態が変わりました。" };
      return { ok: craftCookingRecipe(player, ctx.knife, recipe) };
    }
  });
  // Test access is explicit and per-player. Other players keep the legacy UI.
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id !== "pinene_cooking:customform") return;
    const player = event.sourceEntity;
    if (!player || player.typeId !== "minecraft:player") return;
    system.run(() => {
      if (event.message.trim() === "on") {
        if (!controller.available()) { player.sendMessage("CustomForm APIを読み込めませんでした。"); return; }
        player.addTag(CUSTOM_COOKING_TAG);
        player.sendMessage("料理の連続操作テストを有効にしました。まな板を開いてください。");
      } else if (event.message.trim() === "off") {
        controller.close(player.id, "test_disabled");
        player.removeTag(CUSTOM_COOKING_TAG);
        player.sendMessage("通常の料理画面に戻しました。");
      }
    });
  });
  world.afterEvents.playerLeave.subscribe(({ playerId }) => controller.close(playerId, "player_left"));
  system.run(() => log({ event: "ready", customForm: controller.available(), image: typeof ui.CustomForm?.prototype.image === "function" }));
  return {
    ...controller,
    enabled: (player) => player.hasTag(CUSTOM_COOKING_TAG),
    openAt: (player, block) => controller.open(player, {
      dimension: block.dimension, location: { ...block.location }, typeId: block.typeId,
    }),
  };
}

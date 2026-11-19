import { GameMode, ItemStack, system, world } from "@minecraft/server";

const CROP_ID = "pine:chili_crop";
const ITEM_ID = "pine:chili_pepper";
const AGE_STATE = "pine:age";
const COMPONENT_ID = "pine:chili_crop_logic";
const MAX_AGE = 3;
const REGROW_AGE = 1;
const GROWTH_CHANCE = 0.4;

function getAge(block) {
  try {
    return Number(block?.permutation?.getState(AGE_STATE) ?? 0);
  } catch {
    return 0;
  }
}

function setAge(block, age) {
  if (!block || block.typeId !== CROP_ID) return false;
  const next = Math.max(0, Math.min(MAX_AGE, Math.trunc(age)));
  try {
    block.setPermutation(block.permutation.withState(AGE_STATE, next));
    return true;
  } catch (error) {
    console.warn("[PineFood Chili] age update failed: " + String(error));
    return false;
  }
}

function liveBlock(dimension, location) {
  try {
    const block = dimension.getBlock(location);
    return block?.typeId === CROP_ID ? block : undefined;
  } catch {
    return undefined;
  }
}

function growCrop(event) {
  const block = event?.block;
  if (!block || block.typeId !== CROP_ID) return;
  const age = getAge(block);
  if (age >= MAX_AGE || Math.random() >= GROWTH_CHANCE) return;
  setAge(block, age + 1);
}

function harvestCrop(event) {
  const sourceBlock = event?.block;
  const player = event?.player;
  if (!sourceBlock || sourceBlock.typeId !== CROP_ID || !player || getAge(sourceBlock) !== MAX_AGE) return;

  const dimension = sourceBlock.dimension;
  const location = { ...sourceBlock.location };
  system.run(() => {
    const block = liveBlock(dimension, location);
    if (!block || getAge(block) !== MAX_AGE) return;

    const amount = 2 + Math.floor(Math.random() * 3);
    if (!setAge(block, REGROW_AGE)) return;

    // Do not consume the mature harvest if spawning its items fails.
    try {
      dimension.spawnItem(
        new ItemStack(ITEM_ID, amount),
        { x: location.x + 0.5, y: location.y + 0.45, z: location.z + 0.5 }
      );
    } catch (error) {
      if (!setAge(block, MAX_AGE)) {
        console.warn("[PineFood Chili] harvest rollback failed; inspect crop state");
      }
      console.warn("[PineFood Chili] harvest drop failed: " + String(error));
      return;
    }
    try { player.playSound("random.pop", { volume: 0.25, pitch: 1.3 }); } catch {}
  });
}

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  blockComponentRegistry.registerCustomComponent(COMPONENT_ID, {
    onTick: growCrop,
    onPlayerInteract: harvestCrop,
  });
});

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  if (event.cancel || event.isFirstEvent === false) return;
  if (event.block?.typeId !== CROP_ID || event.itemStack?.typeId !== "minecraft:bone_meal") return;

  const age = getAge(event.block);
  if (age >= MAX_AGE) return;

  event.cancel = true;
  const player = event.player;
  const dimension = event.block.dimension;
  const location = { ...event.block.location };
  const slot = player.selectedSlotIndex;

  system.run(() => {
    const block = liveBlock(dimension, location);
    if (!block) return;
    const currentAge = getAge(block);
    if (currentAge >= MAX_AGE) return;

    if (player.getGameMode() !== GameMode.Creative) {
      const inventory = player.getComponent("minecraft:inventory")?.container;
      const held = inventory?.getItem(slot);
      if (!held || held.typeId !== "minecraft:bone_meal" || held.amount < 1) return;
      if (held.amount > 1) {
        held.amount -= 1;
        inventory.setItem(slot, held);
      } else {
        inventory.setItem(slot, undefined);
      }
    }

    if (setAge(block, currentAge + 1)) {
      try { player.playSound("item.bone_meal.use", { volume: 0.5, pitch: 1.0 }); } catch {}
    }
  });
});

import { world, ItemStack } from "@minecraft/server";

const APPLE_LEAF_BLOCKS = [
  "minecraft:oak_leaves",
  "minecraft:dark_oak_leaves"
];

// Target: about 1 drop per 200 trees.
// Assuming roughly 50 broken leaves per tree => 200 * 50 = 10000 leaf breaks per drop.
const DROP_CHANCE = 0.0001;

const FOOD_EFFECTS_BY_ITEM = {
  "resetapple:blue_diamond_apple": [
    { id: "regeneration", duration: 600, amplifier: 1 },
    { id: "water_breathing", duration: 14400, amplifier: 0 },
    { id: "night_vision", duration: 14400, amplifier: 0 },
    { id: "speed", duration: 7200, amplifier: 1 }
  ],
  "resetapple:enchanted_blue_diamond_apple": [
    { id: "regeneration", duration: 1800, amplifier: 2 },
    { id: "absorption", duration: 36000, amplifier: 3 },
    { id: "resistance", duration: 24000, amplifier: 1 },
    { id: "conduit_power", duration: 36000, amplifier: 0 },
    { id: "water_breathing", duration: 36000, amplifier: 0 },
    { id: "night_vision", duration: 36000, amplifier: 0 },
    { id: "speed", duration: 24000, amplifier: 1 }
  ]
};

world.afterEvents.playerBreakBlock.subscribe((event) => {
  const blockId = event.brokenBlockPermutation.type.id;
  if (!APPLE_LEAF_BLOCKS.includes(blockId)) return;
  if (Math.random() >= DROP_CHANCE) return;

  const apple = new ItemStack("resetapple:blue_apple", 1);
  event.dimension.spawnItem(apple, event.block.location);
});

const applyConfiguredFoodEffects = (event) => {
  const itemTypeId = event.itemStack?.typeId;
  if (!itemTypeId) return;

    const effects = FOOD_EFFECTS_BY_ITEM[itemTypeId];
    if (!effects || effects.length === 0) return;

    for (const effect of effects) {
      try {
        event.source.addEffect(effect.id, effect.duration, {
          amplifier: effect.amplifier,
          showParticles: true
        });
      } catch {
        // Ignore invalid effect application and continue other effects.
      }
    }
};

if (world.afterEvents.itemCompleteUse) {
  world.afterEvents.itemCompleteUse.subscribe((event) => {
    applyConfiguredFoodEffects(event);
  });
} else if (world.afterEvents.itemUse) {
  world.afterEvents.itemUse.subscribe((event) => {
    applyConfiguredFoodEffects(event);
  });
}
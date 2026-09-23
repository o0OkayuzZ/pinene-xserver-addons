import { ItemStack, EnchantmentTypes } from "@minecraft/server";

export function packItem(stack, placedBlock = false) {
  if (!stack) return undefined;
  // These carry opaque data not reconstructible by the fields below. Refuse to
  // destroy a container containing them instead of returning a lossy substitute.
  if (!placedBlock && /(?:shulker_box|bundle|filled_map|written_book|writable_book|potion|suspicious_stew|firework_rocket|firework_star|banner|ominous_bottle|goat_horn|decorated_pot)$/.test(stack.typeId)) {
    throw Error(`Unsupported return item data: ${stack.typeId}`);
  }
  const enchantments = stack.getComponent("minecraft:enchantable")?.getEnchantments() ?? [];
  const properties = {};
  for (const key of stack.getDynamicPropertyIds()) properties[key] = stack.getDynamicProperty(key);
  return {
    typeId: stack.typeId, amount: stack.amount, nameTag: stack.nameTag,
    lore: stack.getLore(), canPlaceOn: stack.getCanPlaceOn(), canDestroy: stack.getCanDestroy(),
    keepOnDeath: stack.keepOnDeath, lockMode: stack.lockMode,
    damage: stack.getComponent("minecraft:durability")?.damage,
    enchantments: enchantments.map(e => ({ id: e.type.id, level: e.level })), properties,
  };
}

export function unpackItem(data) {
  const stack = new ItemStack(data.typeId, data.amount);
  if (data.nameTag !== undefined) stack.nameTag = data.nameTag;
  stack.setLore(data.lore ?? []);
  stack.setCanPlaceOn(data.canPlaceOn ?? []);
  stack.setCanDestroy(data.canDestroy ?? []);
  if (data.keepOnDeath !== undefined) stack.keepOnDeath = data.keepOnDeath;
  if (data.lockMode !== undefined) stack.lockMode = data.lockMode;
  const durability = stack.getComponent("minecraft:durability");
  if (durability && data.damage !== undefined) durability.damage = data.damage;
  const enchantable = stack.getComponent("minecraft:enchantable");
  for (const e of data.enchantments ?? []) enchantable?.addEnchantment({ type: EnchantmentTypes.get(e.id), level: e.level });
  for (const [key, value] of Object.entries(data.properties ?? {})) stack.setDynamicProperty(key, value);
  return stack;
}

export function permutationData(block) {
  return { typeId: block.typeId, states: block.permutation.getAllStates(), waterlogged: block.isWaterlogged };
}

export function samePermutation(block, saved) {
  if (!block || block.typeId !== saved.typeId || !!block.isWaterlogged !== !!saved.waterlogged) return false;
  const states = block.permutation.getAllStates();
  return Object.entries(saved.states).every(([key, value]) => states[key] === value);
}

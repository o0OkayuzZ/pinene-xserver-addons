// Keep the castle's inventory policy and duplicate-death protection intact.
export function shouldCreateTomb(player, allowEmpty, slots) {
  if (player.dimension.id === "infinite_castle:dungeon") return "castle";
  if (player.hasTag("dead")) return "already-processed";
  if (allowEmpty) return "create";

  const inventory = player.getComponent("minecraft:inventory")?.container;
  const equipment = player.getComponent("minecraft:equippable");
  if (inventory && equipment) {
    for (let index = 0; index < inventory.size; index++) {
      if (inventory.getItem(index)) return "create";
    }
    for (const slot of [slots.Head, slots.Chest, slots.Legs, slots.Feet, slots.Offhand]) {
      if (equipment.getEquipment(slot)) return "create";
    }
    return "empty";
  }
  // Some engine death phases do not expose containers. Use the last live state.
  return !player.hasTag("empty") || ["getHead", "getChest", "getLegs", "getFeet", "getOff"]
    .some(tag => player.hasTag(tag)) ? "create" : "empty";
}

export function clearDeathMarkers(player) {
  for (const tag of player.getTags()) {
    if (tag === "dead" || tag.startsWith("cords:") || tag.startsWith("dim:")) {
      player.removeTag(tag);
    }
  }
}

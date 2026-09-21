const PVP_DIMENSION = "pinene_pvp:pvp_island";

export function isActive(entity) {
  try { return entity?.dimension?.id === PVP_DIMENSION; } catch { return false; }
}

export function requireActive(entity) {
  if (!isActive(entity)) throw new Error("GFカードはピネディメンション内でのみ使用できます。");
}

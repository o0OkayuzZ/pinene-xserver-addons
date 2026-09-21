const PVP_DIMENSION_ID = "pinene_pvp:pvp_island";

export function isActive(entity) {
  try { return entity?.dimension?.id === PVP_DIMENSION_ID; } catch { return false; }
}

export function requireActive(entity) {
  if (!isActive(entity)) throw new Error("GFカードはピネディメンション内でのみ使用できます。");
}

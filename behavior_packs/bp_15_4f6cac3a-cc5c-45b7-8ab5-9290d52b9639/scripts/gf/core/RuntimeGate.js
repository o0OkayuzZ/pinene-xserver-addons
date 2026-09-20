import { IDS } from "../../pvp_island/config.js";

export function isActive(entity) {
  try { return entity?.dimension?.id === IDS.dimension; } catch { return false; }
}

export function requireActive(entity) {
  if (!isActive(entity)) throw new Error("GFカードはピネディメンション内でのみ使用できます。");
}

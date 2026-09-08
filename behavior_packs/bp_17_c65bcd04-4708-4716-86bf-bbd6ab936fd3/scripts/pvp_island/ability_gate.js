import { IDS } from "./config.js";

export function isPvpIsland(target) {
  const dimension = target?.dimension ?? target;
  return dimension?.id === IDS.dimension;
}

export function runIslandAbility(source, ability) {
  if (!isPvpIsland(source)) {
    source?.sendMessage?.("§cこの能力は無人島ディメンション内でのみ使用できます。");
    return false;
  }

  ability();
  return true;
}

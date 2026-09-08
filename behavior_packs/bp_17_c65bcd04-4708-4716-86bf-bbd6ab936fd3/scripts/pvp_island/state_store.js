import { world } from "@minecraft/server";

export function readJsonResult(key, fallbackFactory) {
  const raw = world.getDynamicProperty(key);
  if (raw === undefined) {
    return { ok: true, exists: false, value: fallbackFactory() };
  }
  if (typeof raw !== "string") {
    return { ok: false, exists: true, reason: "not_a_string" };
  }
  try {
    return { ok: true, exists: true, value: JSON.parse(raw) };
  } catch (error) {
    return { ok: false, exists: true, reason: `invalid_json: ${error}` };
  }
}

export function writeJson(key, value) {
  world.setDynamicProperty(key, JSON.stringify(value));
}

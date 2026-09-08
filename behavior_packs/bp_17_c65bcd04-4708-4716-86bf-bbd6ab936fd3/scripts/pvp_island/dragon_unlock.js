import { ItemStack, world } from "@minecraft/server";
import { IDS, STATE_KEYS } from "./config.js";
import { readJsonResult, writeJson } from "./state_store.js";

function emptyRelicLedger() {
  return { schemaVersion: 1, status: "not_created" };
}

const RELIC_STATUSES = new Set(["not_created", "issuing", "delivered"]);

export function readRelicLedger() {
  const result = readJsonResult(STATE_KEYS.relicState, emptyRelicLedger);
  if (!result.ok) return result;
  const ledger = result.value;
  if (ledger?.schemaVersion !== 1 || !RELIC_STATUSES.has(ledger.status)) {
    return { ok: false, exists: result.exists, reason: "invalid_relic_ledger_schema" };
  }
  return result;
}

function issueRelic(dimension, location, reason) {
  const transactionId = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  writeJson(STATE_KEYS.relicState, {
    schemaVersion: 1,
    status: "issuing",
    transactionId,
    reason,
    dimensionId: dimension.id,
    location,
  });

  const relic = new ItemStack(IDS.dragonRelic, 1);
  dimension.spawnItem(relic, location);
  writeJson(STATE_KEYS.relicState, {
    schemaVersion: 1,
    status: "delivered",
    transactionId,
    reason,
    dimensionId: dimension.id,
    location,
  });
}

world.afterEvents.entityDie.subscribe((event) => {
  if (event.deadEntity.typeId !== "minecraft:ender_dragon") return;
  const ledgerResult = readRelicLedger();
  if (!ledgerResult.ok) {
    console.error(`[pinene_pvp] Relic ledger is unreadable; refusing issuance: ${ledgerResult.reason}`);
    return;
  }
  if (ledgerResult.value.status !== "not_created") return;

  try {
    issueRelic(event.deadEntity.dimension, event.deadEntity.location, "first_ender_dragon_kill");
    world.sendMessage("§dエンダードラゴンの力が凝縮し、§5竜の遺物§dが現れた。");
  } catch (error) {
    console.error(`[pinene_pvp] Failed to create dragon relic: ${error}`);
  }
});

export function recoverInterruptedRelic(player) {
  const result = readRelicLedger();
  if (!result.ok) {
    throw new Error(`Relic ledger is unreadable: ${result.reason}`);
  }
  if (result.value.status !== "issuing") return false;
  issueRelic(player.dimension, player.location, "admin_recovery");
  return true;
}

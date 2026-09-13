// TEMPORARY POLICY requested 2026-09-13. Replace when final castle rules are decided.
// Item lore is used because Bedrock dynamic properties do not support stackable items.
// A visit-specific marker keeps carried stacks separate from newly acquired stacks.
import { world, system, EquipmentSlot } from "@minecraft/server";

export const TEMPORARY_DEATH_POLICY_ENABLED = true;
const DIMENSION = "infinite_castle:dungeon";
const SESSION = "infinite_castle:temporary_carry_session_v1";
const PENDING = "infinite_castle:temporary_death_pending_v1";
const COUNTER = "infinite_castle:temporary_carry_counter_v1";
const PREFIX = "§r§8[IC持込:";
const EQUIPMENT = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet, EquipmentSlot.Offhand];
let returnAfterDeath;

function slots(player) {
    const inventory = player.getComponent("minecraft:inventory")?.container;
    const equipment = player.getComponent("minecraft:equippable");
    if (!inventory || !equipment) throw new Error("Player inventory/equipment unavailable");
    const result = [];
    for (let i = 0; i < inventory.size; i++) {
        result.push({ get: () => inventory.getItem(i), set: item => inventory.setItem(i, item) });
    }
    for (const slot of EQUIPMENT) {
        result.push({ get: () => equipment.getEquipment(slot), set: item => {
            if (equipment.setEquipment(slot, item) === false) throw new Error(`Cannot set equipment ${slot}`);
        } });
    }
    return result;
}

function rawLore(item) {
    return item.getRawLore?.() ?? item.getLore();
}

function marker(item) {
    return item.getLore().find(line => line.startsWith(PREFIX) && line.endsWith("]"));
}

function unmark(item) {
    const line = marker(item);
    if (!line) return item;
    const index = item.getLore().indexOf(line);
    const lore = rawLore(item);
    lore.splice(index, 1);
    item.setLore(lore);
    item.keepOnDeath = line.endsWith(":1]");
    return item;
}

export function beginTemporaryCastleVisit(player) {
    if (!TEMPORARY_DEATH_POLICY_ENABLED || player.dimension.id === DIMENSION) return;
    if (player.getDynamicProperty(PENDING)) throw new Error("Castle death return is still pending");
    // Do not overwrite an existing visit on an interrupted/retried entrance.
    if (player.getDynamicProperty(SESSION)) return;
    const count = Number(world.getDynamicProperty(COUNTER) ?? 0) + 1;
    world.setDynamicProperty(COUNTER, count);
    const session = count.toString(36);
    const changes = [];
    // Prepare every clone before modifying the player. Lore overflow cancels entrance safely.
    for (const slot of slots(player)) {
        const original = slot.get();
        if (!original) continue;
        const item = unmark(original.clone());
        const lore = rawLore(item);
        if (lore.length >= 20) throw new Error("説明文が20行ある持ち物のため、仮の持ち込み保護を設定できません。");
        lore.push(`${PREFIX}${session}:${item.keepOnDeath ? 1 : 0}]`);
        item.setLore(lore);
        item.keepOnDeath = true;
        changes.push({ slot, original, item });
    }
    try {
        for (const change of changes) change.slot.set(change.item);
        player.setDynamicProperty(SESSION, session);
    } catch (error) {
        for (const change of changes) change.slot.set(change.original);
        throw error;
    }
}

export function finishTemporaryCastleVisit(player) {
    if (player.getDynamicProperty(PENDING)) return;
    for (const slot of slots(player)) {
        const item = slot.get();
        if (item && marker(item)) slot.set(unmark(item));
    }
    player.setDynamicProperty(SESSION, undefined);
}

function removeCastleLoot(player) {
    const session = player.getDynamicProperty(SESSION);
    // Players already inside at deployment have no reliable provenance. Never delete
    // unknown inventory. Treat it as a one-time migration baseline, then return them.
    if (!session) return;
    const expected = `${PREFIX}${session}:`;
    for (const slot of slots(player)) {
        const item = slot.get();
        if (item && !marker(item)?.startsWith(expected)) slot.set(undefined);
    }
}

function recover(player) {
    if (!player.getDynamicProperty(PENDING) || !returnAfterDeath) return;
    if ((player.getComponent("minecraft:health")?.currentValue ?? 0) <= 0) return;
    const hadProvenance = !!player.getDynamicProperty(SESSION);
    removeCastleLoot(player);
    // Retain provenance until return succeeds, so a teleport failure can be retried.
    returnAfterDeath(player);
    player.setDynamicProperty(PENDING, undefined);
    finishTemporaryCastleVisit(player);
    player.sendMessage(hadProvenance
        ? "§7[無限城・仮設定] 城内で入手した持ち物を失い、持ち込み品を保持して帰還しました。"
        : "§7[無限城・仮設定] 設定導入前の持ち物のため、今回は全て保持して帰還しました。次の入場から城内入手品のみ失います。");
}

export function installTemporaryCastleDeathReturn(handler) {
    returnAfterDeath = handler;
}

world.afterEvents.entityDie.subscribe(({ deadEntity: player }) => {
    if (!TEMPORARY_DEATH_POLICY_ENABLED || player.typeId !== "minecraft:player" || player.dimension.id !== DIMENSION) return;
    player.setDynamicProperty(PENDING, true);
});

world.afterEvents.playerSpawn.subscribe(({ player }) => {
    system.run(() => {
        try { recover(player); } catch (error) { console.warn(`[castle-temporary-policy] respawn: ${error}`); }
    });
});

// Reconnect/reload recovery and normal exits through other add-ons.
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        try {
            if (player.getDynamicProperty(PENDING)) recover(player);
            else if (player.dimension.id !== DIMENSION && player.getDynamicProperty(SESSION)
                && (player.getComponent("minecraft:health")?.currentValue ?? 0) > 0) {
                finishTemporaryCastleVisit(player);
            }
        } catch (error) { console.warn(`[castle-temporary-policy] recovery: ${error}`); }
    }
}, 20);

system.run(() => console.warn("[castle-temporary-policy] v1 loaded (temporary, grave disabled in castle)"));

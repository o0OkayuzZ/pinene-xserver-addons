import { ItemStack, system, world } from "@minecraft/server";
import { createSourcePartsPlan } from "./sourcePartsPlanner.js";
import { fitPlanToHeightRange } from "./sourcePartsVolumes.js";
import { restoreRoomMaterials } from "./sourceRoomMaterials.js";
import { isHealingGarden, createGardenHealing } from "./sourceHealingGarden.js";
import { isTreasureVault, createVaultReward } from "./sourceTreasureVault.js";
import {
    ROOM_ENCOUNTER_CONFIG as CONFIG, ROOM_CHEST_CANDIDATES, ROOM_SPAWN_CANDIDATES,
    ROOM_LIGHT_CANDIDATES, roomWorldPoint, roomIdentity, roomInterior,
    roomBoundsIntersect, roomContains,
} from "./sourceRoomEncounterConfig.js";

const STATE_KEY = "infinite_castle:room_encounters_v1";
const CORE_KEY = "infinite_castle:source_parts_test_state_v2";
const PLAN_KEY = "infinite_castle:source_parts_detailed_plan_v1";
const MANAGED_TAG = "ic_room_enemy_v1";
const SLOT_PREFIX = "ic_room_slot_";
const LIGHT = "minecraft:light_block_15";
const GROUND_LIGHT_COUNT = ROOM_LIGHT_CANDIDATES.filter(p => p.y === 4).length;
let state;
let lastDescriptor;
let ready = false;
let cursor = 0;
let lastError = "";
let lastWarningTick = -1200;
const lightProgress = new Map();
const missingSince = new Map();
const notices = new Map();
const healGardenPlayers = createGardenHealing();

function warn(error) {
    lastError = String(error?.message ?? error);
    if (system.currentTick - lastWarningTick < 1200) return;
    lastWarningTick = system.currentTick;
    console.warn(`[ic-encounter] ${lastError}`);
}

function ensureState() {
    if (state) return state;
    const raw = world.getDynamicProperty(STATE_KEY);
    if (raw === undefined) state = { v: 1, serial: 0, rooms: [] };
    else {
        const saved = JSON.parse(raw);
        if (saved?.v !== 1 || !Number.isSafeInteger(saved.serial) || !Array.isArray(saved.rooms)
            || saved.rooms.length > 64 || saved.rooms.some(r => typeof r.key !== "string"
                || ![r.origin?.x, r.origin?.y, r.origin?.z].every(Number.isFinite)
                || !Array.isArray(r.slots) || r.slots.length !== CONFIG.enemies.length)) {
            // Fail closed: never silently reset a corrupt reward ledger.
            throw new Error("room encounter ledger is invalid; keeping existing rewards untouched");
        }
        state = saved;
    }
    return state;
}

function persist() {
    const json = JSON.stringify(ensureState());
    if (json.length > 30000) throw new Error("room encounter ledger exceeds safe size");
    world.setDynamicProperty(STATE_KEY, json);
}

function nextToken() { return `${SLOT_PREFIX}${++state.serial}`; }
function activeRooms() { return ensureState().rooms.filter(r => !r.retired); }
function activeSlot(tag) {
    for (const room of activeRooms()) {
        const index = room.slots.findIndex(slot => slot.tag === tag && slot.phase !== "dead");
        if (index !== -1) return { room, slot: room.slots[index], index };
    }
    return null;
}
function blockAt(dimension, point) { try { return dimension.getBlock(point); } catch { return undefined; } }
function isAir(block) { return block?.typeId === "minecraft:air"; }
function containerAt(dimension, room) {
    if (!room.chest || !room.chestOwned) return undefined;
    const block = blockAt(dimension, room.chest);
    return block?.typeId === "minecraft:chest" ? block.getComponent("minecraft:inventory")?.container : undefined;
}
function entityTag(entity) { return entity.getTags().find(t => t.startsWith(SLOT_PREFIX)); }
function managedEntities(dimension) { return dimension.getEntities({ tags: [MANAGED_TAG] }); }
function notify(player, message) {
    const key = `${player.id}:${message}`;
    if (system.currentTick - (notices.get(key) ?? -1000) < 80) return;
    notices.set(key, system.currentTick);
    player.sendMessage(`[infinite_castle] ${message}`);
    if (notices.size > 128) notices.delete(notices.keys().next().value);
}

function retireRoom(room, dimension) {
    // Revoke the generation BEFORE remove(): cleanup can never unlock a chest.
    room.retired = true;
    persist();
    lastDescriptor = undefined;
    for (const entity of managedEntities(dimension)) {
        try { if (room.slots.some(s => s.tag === entityTag(entity))) entity.remove(); }
        catch (error) { warn(error); }
    }
    lightProgress.delete(room.key);
}

// Called immediately before each destructive core fill, after the live-player
// guard. Protected volumes never reach here. No /kill and no item-entity sweep.
export function prepareRoomEncounterRemoval(dimension, bounds) {
    if (dimension.id !== CONFIG.dimensionId) return;
    for (const room of ensureState().rooms) {
        const removalBounds = roomInterior(room.origin);
        removalBounds.from.y = room.origin.y; // retire before the supporting floor disappears
        if (!roomBoundsIntersect(removalBounds, bounds)) continue;
        if (!room.retired) retireRoom(room, dimension);
        // A split fill may reach the chest much later. Retry on that section,
        // including after reload/interruption; only our own inventory is cleared.
        if (room.chest && roomContains(bounds, room.chest)) {
            const container = containerAt(dimension, room);
            if (container) {
                if (container.size !== 27) throw new Error("reward chest is joined to another chest; separate it before rebuilding");
                container.clearAll();
            }
        }
    }
}

export function activateRoomEncounterPlan(plan) {
    if (plan?.dimensionId !== CONFIG.dimensionId) return;
    ensureState();
    const dimension = world.getDimension(CONFIG.dimensionId);
    const placements = plan.placements.filter(p => (p.category ?? p.variant?.category) === "room");
    if (placements.some(p => (p.variantId ?? p.variant?.id) !== CONFIG.variantId)) {
        throw new Error("unverified playable room variant: encounter placement requires a native audit");
    }
    const previous = new Map(activeRooms().map(room => [room.key, room]));
    const keys = new Set(placements.map(roomIdentity));
    for (const room of previous.values()) if (!keys.has(room.key)) retireRoom(room, dimension);
    state.rooms = placements.map(placement => {
        const key = roomIdentity(placement);
        const existing = previous.get(key);
        const kind = isHealingGarden(placement) ? "healing_garden"
            : isTreasureVault(placement) ? "treasure_vault" : "combat";
        if (existing && !existing.retired) {
            // Existing loot stays owned and accessible. Retire hostile tokens
            // before collectEnemies so migration never awards a key-holder kill.
            existing.kind = kind;
            if (kind !== "combat") {
                existing.slots.forEach(slot => { slot.phase = "dead"; });
                existing.keyDefeated = true;
            }
            return existing;
        }
        return {
            key, kind, origin: { ...placement.origin }, generation: ++state.serial,
            retired: false, keyDefeated: kind !== "combat", reward: "locked", chest: null,
            chestOwned: false, chestPlacing: false,
            slots: CONFIG.enemies.map(() => ({ tag: nextToken(), phase: kind !== "combat" ? "dead" : "new", id: null })),
        };
    });
    lightProgress.clear();
    persist();
    lastDescriptor = world.getDynamicProperty(PLAN_KEY);
    lastError = "";
}

// Separate ledger restore makes existing worlds opt into encounters without a
// destructive rebuild, and survives placement IDs changing on protected rooms.
function syncPlan() {
    const coreRaw = world.getDynamicProperty(CORE_KEY);
    const core = typeof coreRaw === "string" ? JSON.parse(coreRaw) : null;
    ready = core?.status === "complete";
    if (core?.status === "empty") {
        const dimension = world.getDimension(CONFIG.dimensionId);
        for (const room of activeRooms()) retireRoom(room, dimension);
        lastDescriptor = undefined;
        return;
    }
    if (!ready) return;
    const raw = world.getDynamicProperty(PLAN_KEY);
    if (typeof raw !== "string" || raw === lastDescriptor) return;
    const d = JSON.parse(raw);
    if (![1, 2].includes(d?.v) || d.d !== CONFIG.dimensionId || !Number.isFinite(d.s)
        || !Array.isArray(d.a) || d.a.length !== 3 || !d.a.every(Number.isFinite)) {
        ready = false;
        return;
    }
    const dimension = world.getDimension(d.d);
    const plan = createSourcePartsPlan(d.s, { x: d.a[0], y: d.a[1], z: d.a[2] }, {
        style: d.t, ...(d.v === 2 ? { topology: d.o } : {}),
    });
    restoreRoomMaterials(plan, d.m);
    plan.dimensionId = d.d;
    fitPlanToHeightRange(plan, dimension.heightRange);
    activateRoomEncounterPlan(plan);
}

function installChest(dimension, room) {
    if (room.kind === "healing_garden") return false;
    if (!room.chest) {
        const offset = room.generation % ROOM_CHEST_CANDIDATES.length;
        for (let i = 0; i < ROOM_CHEST_CANDIDATES.length; i++) {
            const point = roomWorldPoint(room.origin, ROOM_CHEST_CANDIDATES[(offset + i) % ROOM_CHEST_CANDIDATES.length]);
            if (!safeStandingPosition(dimension, point)) continue;
            // Never merge with a player's chest / adopt an unrelated inventory.
            if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([x, z]) =>
                blockAt(dimension, { x: point.x + x, y: point.y, z: point.z + z })?.typeId === "minecraft:chest")) continue;
            room.chest = point;
            room.chestPlacing = true;
            persist();
            break;
        }
        if (!room.chest) return false;
    }
    const block = blockAt(dimension, room.chest);
    if (!block) return false;
    if (isAir(block)) {
        // A claimed chest repaired after structural overwrite stays EMPTY.
        block.setType("minecraft:chest");
        room.chestOwned = true;
        room.chestPlacing = false;
        persist();
    } else if (room.chestPlacing && block.typeId === "minecraft:chest") {
        room.chestOwned = true;
        room.chestPlacing = false;
        persist();
    }
    return Boolean(containerAt(dimension, room));
}

function stockReward(dimension, room) {
    if (room.kind === "healing_garden") return;
    if (!room.keyDefeated || room.reward === "stocked") return;
    const container = containerAt(dimension, room);
    if (!container) return;
    if (container.size !== 27) throw new Error("reward chest is joined to another chest; separate it before unlocking");
    if (room.reward === "stocking") {
        // At-most-once recovery. A crash may leave a partial reward, but NEVER
        // mint it again after a player/hopper has already taken some items.
        room.reward = "stocked";
        persist();
        warn(`interrupted reward deposit in ${room.key}; retained existing contents without refill`);
        return;
    }
    const empty = [];
    for (let i = 0; i < container.size; i++) if (!container.getItem(i)) empty.push(i);
    const needed = room.kind === "treasure_vault" ? 4 : CONFIG.loot.length;
    if (empty.length < needed) return;
    const items = room.kind === "treasure_vault" ? createVaultReward()
        : CONFIG.loot.map(item => new ItemStack(item.typeId, item.amount));
    room.reward = "stocking";
    persist();
    // No yields between receipt, fixed-slot writes and commit.
    items.forEach((item, index) => container.setItem(empty[index], item));
    room.reward = "stocked";
    persist();
}

function installLights(dimension, room, budget) {
    let index = lightProgress.get(room.key) ?? 0;
    let used = 0;
    while (index < ROOM_LIGHT_CANDIDATES.length && used < budget) {
        const point = roomWorldPoint(room.origin, ROOM_LIGHT_CANDIDATES[index]);
        const block = blockAt(dimension, point);
        if (!block) break; // retry unloaded positions without loading extra chunks
        if (isAir(block)) block.setType(LIGHT);
        index++;
        used++;
    }
    lightProgress.set(room.key, index);
    return used;
}

function safeStandingPosition(dimension, point) {
    const below = blockAt(dimension, { ...point, y: point.y - 1 });
    return below?.isSolid === true && [0, 1, 2].every(dy => isAir(blockAt(dimension, { ...point, y: point.y + dy })));
}

function combatPlayer(player) {
    const mode = String(player.getGameMode()).toLowerCase();
    return mode === "survival" || mode === "adventure";
}

function collectEnemies(dimension) {
    const result = new Map();
    for (const entity of managedEntities(dimension)) {
        try {
            const tag = entityTag(entity);
            const found = activeSlot(tag);
            if (!found || result.has(tag)) { entity.remove(); continue; }
            // Adopt a spawned-but-not-committed entity after a save interruption.
            if (found.slot.id !== entity.id || found.slot.phase === "new") {
                found.slot.id = entity.id;
                found.slot.phase = "alive";
                persist();
            }
            result.set(tag, entity);
            missingSince.delete(tag);
        } catch (error) { warn(error); }
    }
    return result;
}

function spawnOne(dimension, room, players, enemies) {
    if (room.kind === "healing_garden" || room.kind === "treasure_vault") return;
    if ((lightProgress.get(room.key) ?? 0) < GROUND_LIGHT_COUNT) return;
    if (enemies.size >= CONFIG.maxLoadedEnemies || String(world.getDifficulty()).toLowerCase() === "peaceful") return;
    if (!players.some(p => combatPlayer(p) && roomContains(roomInterior(room.origin, true), p.location))) return;
    for (let index = 0; index < room.slots.length; index++) {
        const slot = room.slots[index];
        if (slot.phase === "dead" || enemies.has(slot.tag)) continue;
        if (slot.phase === "alive") {
            // Missing is NOT dead. Wait, then revoke the old token before a
            // replacement. If its chunk loads later, the stale enemy is removed.
            if (!missingSince.has(slot.tag)) missingSince.set(slot.tag, system.currentTick);
            if (system.currentTick - missingSince.get(slot.tag) < CONFIG.missingEnemyGraceTicks) continue;
            missingSince.delete(slot.tag);
            slot.tag = nextToken();
            slot.id = null;
            slot.phase = "new";
            persist();
        }
        const candidates = ROOM_SPAWN_CANDIDATES.map(p => roomWorldPoint(room.origin, p));
        const point = candidates.find(p => safeStandingPosition(dimension, p)
            && players.every(player => Math.hypot(player.location.x - p.x, player.location.y - p.y, player.location.z - p.z) >= 4)
            && [...enemies.values()].every(entity => Math.hypot(entity.location.x - p.x, entity.location.y - p.y, entity.location.z - p.z) >= 2));
        if (!point) continue;
        const config = CONFIG.enemies[index];
        let entity;
        try {
            entity = dimension.spawnEntity(config.typeId, { x: point.x + 0.5, y: point.y, z: point.z + 0.5 });
            entity.addTag(MANAGED_TAG);
            entity.addTag(slot.tag);
            entity.nameTag = config.name;
            slot.id = entity.id;
            slot.phase = "alive";
            persist();
            enemies.set(slot.tag, entity);
        } catch (error) {
            // An incompletely tagged spawn must not become an unmanaged mob.
            if (entity) try { entity.remove(); } catch {}
            slot.id = null;
            slot.phase = "new";
            throw error;
        }
        return; // maximum one new enemy per update, across the whole dimension
    }
}

export function updateRoomEncounters() {
    try {
        ensureState();
        syncPlan();
        const dimension = world.getDimension(CONFIG.dimensionId);
        const players = dimension.getPlayers();
        if (!players.length) { healGardenPlayers([], [], system.currentTick); return; }
        const enemies = collectEnemies(dimension);
        if (!ready) return; // do not write blocks or respawn during core mutation
        const rooms = activeRooms();
        healGardenPlayers(players, rooms, system.currentTick);
        // Finish lighting nearby rooms in bounded batches; no ticking areas.
        const nearby = rooms.filter(room => players.some(p => Math.hypot(
            p.location.x - room.origin.x - 21, p.location.y - room.origin.y - 10,
            p.location.z - room.origin.z - 21) < 96));
        nearby.sort((a, b) => Number(players.some(p => roomContains(roomInterior(b.origin), p.location)))
            - Number(players.some(p => roomContains(roomInterior(a.origin), p.location))));
        let lightBudget = CONFIG.lightWritesPerUpdate;
        for (const room of nearby) {
            if (lightBudget > 0) lightBudget -= installLights(dimension, room, lightBudget);
            installChest(dimension, room);
            stockReward(dimension, room);
        }
        const occupied = nearby.filter(room => !["healing_garden", "treasure_vault"].includes(room.kind) && players.some(p => combatPlayer(p)
            && roomContains(roomInterior(room.origin, true), p.location)));
        if (occupied.length) {
            // Round-robin combat avoids starving a second player's room.
            const room = occupied[cursor++ % occupied.length];
            spawnOne(dimension, room, players, enemies);
        }
        lastError = "";
    } catch (error) { ready = false; warn(error); }
}

function chestRoom(block) {
    if (block?.dimension?.id !== CONFIG.dimensionId) return null;
    return activeRooms().find(room => room.chestOwned && room.chest
        && ["x", "y", "z"].every(axis => room.chest[axis] === block.location[axis]));
}

world.beforeEvents?.playerInteractWithBlock?.subscribe(event => {
    try {
        const room = chestRoom(event.block);
        // After defeating the key holder, players can also remove items that a
        // hopper inserted before unlock, freeing space for the one-time reward.
        if (!room || room.reward === "stocked" || (room.keyDefeated && room.reward !== "stocking")) return;
        event.cancel = true;
        if (event.isFirstEvent !== false) system.run(() => notify(event.player,
            room.keyDefeated ? "宝箱を準備中です。少し待ってください。" : "この部屋の「鍵持ちの番人」を倒すと開きます。"));
    } catch (error) { warn(error); }
});

world.beforeEvents?.playerBreakBlock?.subscribe(event => {
    try { if (chestRoom(event.block)) event.cancel = true; } catch (error) { warn(error); }
});
world.beforeEvents?.explosion?.subscribe(event => {
    if (event.dimension.id !== CONFIG.dimensionId) return;
    try { event.setImpactedBlocks(event.getImpactedBlocks().filter(block => !chestRoom(block))); }
    catch (error) { warn(error); }
});

world.afterEvents?.entityDie?.subscribe(event => {
    try {
        const id = event.deadEntity.id;
        for (const room of activeRooms()) {
            const index = room.slots.findIndex(slot => slot.id === id && slot.phase === "alive");
            if (index === -1) continue;
            room.slots[index].phase = "dead";
            if (CONFIG.enemies[index].keyHolder) {
                room.keyDefeated = true;
                for (const player of world.getDimension(CONFIG.dimensionId).getPlayers()) {
                    if (roomContains(roomInterior(room.origin), player.location))
                        notify(player, "鍵持ちの番人を倒しました。この部屋の宝箱が解錠されます。");
                }
            }
            persist();
            break;
        }
    } catch (error) { warn(error); }
});

function removeStaleEntity(entity) {
    try {
        if (entity.dimension.id !== CONFIG.dimensionId || !entity.hasTag(MANAGED_TAG)) return;
        if (!activeSlot(entityTag(entity))) entity.remove();
    } catch (error) { warn(error); }
}
world.afterEvents?.entityLoad?.subscribe(event => system.run(() => removeStaleEntity(event.entity)));
world.afterEvents?.entitySpawn?.subscribe(event => {
    // Global gamerules are deliberately untouched. Allow only managed scripted
    // encounters to add hostiles in this dimension, not natural ambient spawns.
    if (String(event.cause).toLowerCase() !== "spawned") return;
    system.run(() => {
        try {
            const entity = event.entity;
            if (entity.dimension.id !== CONFIG.dimensionId || entity.hasTag(MANAGED_TAG)) return;
            if (entity.matches({ families: ["monster"] })) entity.remove();
        } catch { /* entity may have already despawned */ }
    });
});

export function roomEncounterStatus() {
    const rooms = activeRooms();
    return `rooms=${rooms.length} keyDefeated=${rooms.filter(r => r.keyDefeated).length} `
        + `gardens=${rooms.filter(r => r.kind === "healing_garden").length} `
        + `vaults=${rooms.filter(r => r.kind === "treasure_vault").length} `
        + `rewarded=${rooms.filter(r => r.reward === "stocked").length} `
        + `alive=${rooms.flatMap(r => r.slots).filter(s => s.phase === "alive").length} `
        + `ready=${ready} difficulty=${world.getDifficulty()} error=${lastError || "none"}`;
}
system.afterEvents.scriptEventReceive.subscribe(event => {
    if (event.id !== "infinite_castle:room_encounter_status" || !event.sourceEntity) return;
    try { event.sourceEntity.sendMessage(`[ic-encounter] ${roomEncounterStatus()}`); }
    catch (error) { event.sourceEntity.sendMessage(`[ic-encounter] ${error}`); }
});
system.runInterval(updateRoomEncounters, CONFIG.updateTicks);

import { system, world } from "@minecraft/server";
import { createSourcePartsPlan } from "./sourcePartsPlanner.js";
import { fitPlanToHeightRange } from "./sourcePartsVolumes.js";
import { restoreRoomMaterials } from "./sourceRoomMaterials.js";
import { createGardenHealing } from "./sourceHealingGarden.js";
import {
    ROOM_ENCOUNTER_CONFIG as CONFIG,
    ROOM_CHEST_CANDIDATES,
    ROOM_LIGHT_CANDIDATES,
    roomWorldPoint,
    roomIdentity,
    roomInterior,
    roomBoundsIntersect,
    roomContains,
} from "./sourceRoomEncounterConfig.js";
import { PHASE1, MOB_BALANCE, ENCOUNTER_TYPES, lootTableFor, slotLootTableFor } from "./phase1Config.js";
import {
    allocateRoles,
    createRoom,
    newRun,
    joinRun,
    exitRun,
    restoreCombat,
    multiplayerScaling,
    waveRoster,
    shouldStartWave2,
} from "./phase1State.js";
import { createCombatScheduler, inCone } from "./phase1Combat.js";
import { decorateSpecialRoom, decorationProtected } from "./phase1Interiors.js";
import { containsPlacement } from "./phase1Sockets.js";
import { acquireLandingArea, isSafeCastleFloor, blocksCastleProjectile } from "./phase1Landing.js";
import { deliverRoomReward } from "./phase1Rewards.js";

const STATE_KEY = "infinite_castle:phase1_v2",
    LEGACY_KEY = "infinite_castle:room_encounters_v1",
    CORE_KEY = "infinite_castle:source_parts_test_state_v2",
    PLAN_KEY = "infinite_castle:source_parts_detailed_plan_v1";
const TAG = "ic_room_enemy_v1",
    SLOT_PREFIX = "ic_room_slot_";
let state,
    plan,
    lastDescriptor,
    ready = false,
    cursor = 0,
    spawning = false,
    lastError = "",
    lastWarn = -1200,
    exitHandler,
    reconstructHandler,
    lastMovement = -10,
    mutationRevision = null;
const entities = new Map(),
    byEntity = new Map(),
    lastRoomId = new Map(),
    pendingEntries = new Map(),
    arrivals = new Map(),
    crouches = new Map(),
    lights = new Map(),
    occupants = new Map(),
    rewardRetries = new Map();
const heal = createGardenHealing(),
    dim = () => world.getDimension(CONFIG.dimensionId),
    tick = () => system.currentTick;
let observedPlayers = [];
const eligible = (p) =>
    ["survival", "adventure"].includes(String(p.getGameMode()).toLowerCase()) &&
    (p.getComponent("minecraft:health")?.currentValue ?? 1) > 0;
const members = (r) => occupants.get(r.roomInstanceId) ?? [];
const blockAt = (p) => {
    try {
        return dim().getBlock(p);
    } catch {
        return undefined;
    }
};
const air = (b) => b?.typeId === "minecraft:air" || b?.typeId === "minecraft:light_block_15";
function warn(e) {
    lastError = String(e?.message ?? e);
    if (tick() - lastWarn >= 1200) {
        lastWarn = tick();
        console.warn(`[ic-phase1] ${lastError}`);
    }
}
function persist() {
    // Active actors are discarded on every restart, so persisting their
    // tokens/queues would only consume the dynamic property's 32 KiB budget.
    const json = JSON.stringify(state, (key, value) => key === "slots" ? [] : value);
    if (json.length > 30000) throw new Error("Phase 1 ledger exceeds safe size");
    world.setDynamicProperty(STATE_KEY, json);
}
function ensureState() {
    if (state) return state;
    const raw = world.getDynamicProperty(STATE_KEY);
    if (raw === undefined) state = newRun(`ic-${Date.now().toString(36)}`);
    else {
        state = JSON.parse(raw);
        if (state.v !== 2 || !state.runId || !Array.isArray(state.rooms) || !state.participants)
            throw new Error("invalid Phase 1 ledger; rewards retained");
        state.rooms.forEach(restoreCombat);
        if (state.runState === "BUILDING") state.runState = "PENDING_RETRY";
    }
    persist();
    return state;
}
function rooms() {
    return ensureState().rooms.filter((r) => !r.retired && r.state !== "Retired");
}
function safeStanding(p) {
    return (
        isSafeCastleFloor(blockAt({ ...p, y: p.y - 1 })) &&
        [0, 1, 2].every((dy) => air(blockAt({ ...p, y: p.y + dy })))
    );
}
function safePoint(room, from, min = 0, max = 30) {
    const candidates = [];
    for (let x = 10; x <= 32; x += 4)
        for (let z = 10; z <= 32; z += 4) candidates.push(roomWorldPoint(room.origin, { x, y: 1, z }));
    const offset = Math.floor(Math.random() * candidates.length);
    for (let i = 0; i < candidates.length; i++) {
        const p = candidates[(offset + i) % candidates.length],
            d = Math.hypot(p.x - from.x, p.y - from.y, p.z - from.z);
        if (d >= min && d <= max && safeStanding(p)) return { x: p.x + 0.5, y: p.y, z: p.z + 0.5 };
    }
    return null;
}
function effect(e, id, duration, amplifier = 0) {
    const old = e.getEffect(id);
    if (old && (old.amplifier > amplifier || (old.amplifier === amplifier && old.duration >= duration)))
        return;
    e.addEffect(id, duration, { amplifier, showParticles: true });
}
function damage(p, amount, source, k = 0) {
    try {
        p.applyDamage(amount, { cause: "entityAttack", damagingEntity: source });
        if (k) {
            const dx = p.location.x - source.location.x,
                dz = p.location.z - source.location.z,
                d = Math.hypot(dx, dz) || 1;
            p.applyKnockback({ x: (dx / d) * k, z: (dz / d) * k }, 0.35);
        }
    } catch (error) {
        warn(error);
    }
}
function particle(p, id) {
    try {
        dim().spawnParticle(id, p);
    } catch (e) {
        warn(e);
    }
}
function sound(id, p, options = {}) {
    try {
        dim().playSound(id, p, { volume: 0.6, ...options });
    } catch (e) {
        warn(e);
    }
}
const combat = createCombatScheduler({
    tick,
    players: members,
    slot: (e) => byEntity.get(e.id)?.slot,
    damage,
    effect,
    particle,
    sound,
    warn,
    safeTeleport: safePoint,
    solid: (p) => blocksCastleProjectile(blockAt(p)),
    speed(e, factor) {
        const movement = e.getComponent("minecraft:movement");
        if (movement) movement.setCurrentValue(movement.currentValue * factor);
    },
    summon(room, owner, count, limit, mob) {
        queueSummons(room, owner, count, limit, mob);
    },
    unlock(room) {
        if (room.retired || !room.keyDefeated) return;
        room.unlockComplete = true;
        persist();
        stockReward(room);
        for (const p of members(room)) {
            p.onScreenDisplay.setTitle("§6封印解除", {
                subtitle: room.debug ? "§7テスト解錠（報酬なし）" : "§e宝箱の封印が解かれた",
                fadeInDuration: 5, stayDuration: 35, fadeOutDuration: 15,
            });
        }
    },
});
function containerAt(r) {
    if (!r.chestOwned || !r.chest) return null;
    const b = blockAt(r.chest);
    return b?.typeId === "minecraft:chest" ? b.getComponent("minecraft:inventory")?.container : null;
}
function cleanup(r) {
    // Revoke tokens before remove: cleanup is never a key-holder kill.
    for (const s of r.slots) s.phase = "dead";
    persist();
    for (const [id, e] of byEntity)
        if (e.room === r) {
            try {
                entities.get(id)?.remove();
            } catch (error) {
                warn(error);
            }
            entities.delete(id);
            byEntity.delete(id);
        }
    combat.clear(r);
    r.slots = [];
    delete r.emptySince;
}
function retire(r) {
    r.retired = true;
    r.state = "Retired";
    persist();
    cleanup(r);
    lights.delete(r.roomInstanceId);
    rewardRetries.delete(r.roomInstanceId);
}
export function prepareRoomEncounterRemoval(dimension, bounds) {
    if (dimension.id !== CONFIG.dimensionId) return;
    assertEncounterProtection(bounds);
    for (const r of ensureState().rooms) {
        const volume = roomInterior(r.origin);
        volume.from.y = r.origin.y;
        if (!roomBoundsIntersect(volume, bounds)) continue;
        if (!r.retired) retire(r);
        if (r.chest && roomContains(bounds, r.chest)) {
            const c = containerAt(r);
            if (c) {
                if (c.size !== 27) throw new Error("owned chest joined to unrelated chest");
                c.clearAll();
            }
        }
    }
}
export function encounterProtection() {
    return {
        revision: ensureState().protectionRevision,
        rooms: rooms()
            .filter((r) => r.exitState === "ANCHORED" || r.state === "Active")
            .map((r) => ({ placementId: r.placementId, origin: r.origin, roomInstanceId: r.roomInstanceId })),
    };
}
export function assertEncounterProtection(bounds) {
    if (mutationRevision !== null && ensureState().protectionRevision !== mutationRevision)
        throw new Error("encounter protection changed; replan required");
    for (const r of rooms())
        if (
            (r.exitState === "ANCHORED" || r.state === "Active") &&
            roomBoundsIntersect(roomInterior(r.origin), bounds)
        )
            throw new Error(`protected encounter ${r.roomInstanceId}`);
}
export function beginEncounterReconstruction() {
    mutationRevision = ensureState().protectionRevision;
    return mutationRevision;
}
export function assertEncounterRevision() {
    if (mutationRevision !== null && ensureState().protectionRevision !== mutationRevision)
        throw new Error("encounter protection changed; replan required");
}
export function endEncounterReconstruction() {
    mutationRevision = null;
}
export function prepareEncounterRoles(nextPlan, protectedNewIds = []) {
    ensureState();
    const protectedIds = new Set(protectedNewIds),
        existing = new Map(rooms().map((r) => [r.key, r]));
    const retained = nextPlan.placements
        .filter((p) => protectedIds.has(p.placementId) && existing.has(roomIdentity(p)))
        .map((p) => ({ ...existing.get(roomIdentity(p)), placementId: p.placementId }));
    const roles = allocateRoles(nextPlan, retained, rooms().length === 0);
    for (const role of roles) {
        const p = nextPlan.placements.find((p) => p.placementId === role.placementId);
        p.encounterRole = {
            kind: role.kind,
            encounterType: role.encounterType,
            interiorVariant: role.interiorVariant,
        };
        if (!protectedIds.has(p.placementId)) {
            p.materialTheme =
                role.encounterType === "elite"
                    ? "boss"
                    : ["healing_garden", "treasure_vault"].includes(role.kind)
                      ? "rare"
                      : "normal";
            p.rareRoomType = p.materialTheme === "rare" ? role.kind : undefined;
        }
    }
    return roles;
}
export function activateRoomEncounterPlan(nextPlan) {
    if (nextPlan?.dimensionId !== CONFIG.dimensionId) return;
    ensureState();
    const placements = nextPlan.placements.filter((p) => (p.category ?? p.variant?.category) === "room");
    if (placements.some((p) => (p.variantId ?? p.variant?.id) !== CONFIG.variantId))
        throw new Error("unverified playable room geometry");
    const previous = new Map(rooms().map((r) => [r.key, r]));
    if (plan && nextPlan !== plan) state.rebuildEpoch++;
    const roles = placements.every((p) => p.encounterRole)
        ? placements.map((p) => ({ placementId: p.placementId, ...p.encounterRole }))
        : allocateRoles(nextPlan, [], previous.size === 0);
    const next = placements.map((p) => {
        const old = previous.get(roomIdentity(p));
        if (old && !old.retired) {
            old.placementId = p.placementId;
            return old;
        }
        return createRoom(
            state,
            p,
            roles.find((r) => r.placementId === p.placementId),
        );
    });
    for (const r of previous.values()) if (!next.includes(r)) retire(r);
    if (!state.migrated) {
        const raw = world.getDynamicProperty(LEGACY_KEY);
        if (raw) {
            const legacy = JSON.parse(raw);
            for (const r of next) {
                const old = legacy.rooms?.find((o) => o.key === r.key && !o.retired);
                if (old) {
                    r.chest = old.chest;
                    r.chestOwned = old.chestOwned;
                    if (["stocked", "stocking"].includes(old.reward)) {
                        r.reward = "stocked";
                        r.keyDefeated = true;
                        r.unlockComplete = true;
                        r.state = "Cleared";
                    }
                }
            }
        }
        state.migrated = true;
    }
    state.rooms = next;
    state.runState = "ACTIVE";
    plan = nextPlan;
    ready = true;
    persist();
    lastDescriptor = world.getDynamicProperty(PLAN_KEY);
}
function syncPlan() {
    const rawCore = world.getDynamicProperty(CORE_KEY),
        core = typeof rawCore === "string" ? JSON.parse(rawCore) : null;
    ready = core?.status === "complete" && ensureState().runState === "ACTIVE";
    if (ensureState().runState !== "ACTIVE") return;
    if (!ready) return;
    const raw = world.getDynamicProperty(PLAN_KEY);
    if (typeof raw !== "string" || raw === lastDescriptor) return;
    const d = JSON.parse(raw);
    if (![1, 2].includes(d?.v) || d.d !== CONFIG.dimensionId || !Array.isArray(d.a))
        throw new Error("invalid physical descriptor");
    const next = createSourcePartsPlan(
        d.s,
        { x: d.a[0], y: d.a[1], z: d.a[2] },
        { style: d.t, ...(d.v === 2 ? { topology: d.o } : {}) },
    );
    restoreRoomMaterials(next, d.m);
    next.dimensionId = d.d;
    fitPlanToHeightRange(next, dim().heightRange);
    activateRoomEncounterPlan(next);
}
function installChest(r) {
    if (["entrance", "exit", "healing_garden"].includes(r.kind)) return false;
    if (!r.chest) {
        for (const local of ROOM_CHEST_CANDIDATES) {
            const p = roomWorldPoint(r.origin, local);
            if (
                !safeStanding(p) ||
                [
                    [1, 0],
                    [-1, 0],
                    [0, 1],
                    [0, -1],
                ].some(([x, z]) => blockAt({ x: p.x + x, y: p.y, z: p.z + z })?.typeId === "minecraft:chest")
            )
                continue;
            r.chest = p;
            r.chestPlacing = true;
            persist();
            break;
        }
        if (!r.chest) return false;
    }
    const b = blockAt(r.chest);
    if (!b) return false;
    if (air(b)) {
        b.setType("minecraft:chest");
        r.chestOwned = true;
        r.chestPlacing = false;
        persist();
    } else if (r.chestPlacing && b.typeId === "minecraft:chest") {
        r.chestOwned = true;
        r.chestPlacing = false;
        persist();
    }
    return !!containerAt(r);
}
function stockReward(r) {
    if (tick() < (rewardRetries.get(r.roomInstanceId) ?? 0)) return;
    const c = containerAt(r);
    if (!c) return;
    const p = r.chest;
    try {
        deliverRoomReward(r, c, {
            persist,
            insert: (slot, guaranteed) => dim().runCommand(
                `loot replace block ${p.x} ${p.y} ${p.z} slot.container ${slot} 1 loot "${slotLootTableFor(r.kind === "treasure_vault" ? "treasure_vault" : r.encounterType, guaranteed)}"`,
            ),
        });
        rewardRetries.delete(r.roomInstanceId);
    } catch (error) {
        rewardRetries.set(r.roomInstanceId, tick() + 100);
        warn(error);
    }
}
function nextSlot(r, mob, wave, priority, owner = null) {
    return {
        tag: `${SLOT_PREFIX}${state.runId}_${++state.serial}`,
        mob,
        wave,
        priority,
        owner,
        phase: "new",
        id: null,
    };
}
function startWave(r, wave) {
    const count = members(r).length;
    r.wave = wave;
    r.waveStarted = tick();
    r.keyHpMultiplier = multiplayerScaling(count).keyHpMultiplier;
    r.slots.push(
        ...waveRoster(r.encounterType, wave, count).map((s) => nextSlot(r, s.mob, wave, s.priority)),
    );
    persist();
}
function startRoom(r) {
    if (r.state !== "Dormant" || r.kind !== "combat") return;
    r.state = "Active";
    state.protectionRevision++;
    persist();
    startWave(r, 1);
}
function queueSummons(r, owner, count, limit, mob) {
    const living = r.slots.filter((s) => s.priority === 2 && s.owner === owner && s.phase !== "dead").length,
        pending = rooms()
            .flatMap((r) => r.slots)
            .filter((s) => s.phase === "new").length;
    const admitted = Math.max(0, Math.min(count, limit - living, PHASE1.enemyCap - entities.size - pending));
    for (let i = 0; i < admitted; i++) r.slots.push(nextSlot(r, mob, 0, 2, owner));
    if (admitted) persist();
}
function managedSpawnEvent(r, s) {
    const b = MOB_BALANCE[s.mob];
    return `infinite_castle:${s.mob}_${b.keyHolder ? Math.round((r.keyHpMultiplier - 1) / 0.15) + 1 : 1}`;
}
function registerEntity(r, s, e) {
    e.addTag(TAG);
    e.addTag(s.tag);
    s.id = e.id;
    s.phase = "alive";
    const b = MOB_BALANCE[s.mob];
    e.nameTag = b.name ?? { nightmare: "魘術師", rot: "腐毒術師", plague: "疫病術師" }[s.mob] ?? s.mob;
    for (const tag of e.getTags())
        if (tag.startsWith("dungeons:enchanted_mob_") || tag === "dungeons:enchanted") e.removeTag(tag);
    e.triggerEvent(managedSpawnEvent(r, s));
    // Exact effective HP through before-hurt conversion, instance scoped.
    s.targetHp = b.hp * (b.keyHolder ? r.keyHpMultiplier : 1);
    const health = e.getComponent("minecraft:health");
    if (health) {
        health.resetToMaxValue();
        s.nativeHp = health.effectiveMax;
    }
    entities.set(e.id, e);
    byEntity.set(e.id, { room: r, slot: s });
    combat.register(r, s, e);
    persist();
}
function spawnPending() {
    const queued = rooms()
        .filter((r) => r.state === "Active")
        .flatMap((room) => room.slots.filter((s) => s.phase === "new").map((slot) => ({ room, slot })));
    queued.sort(
        (a, b) =>
            a.slot.priority - b.slot.priority ||
            Number(!!MOB_BALANCE[b.slot.mob].keyHolder) - Number(!!MOB_BALANCE[a.slot.mob].keyHolder),
    );
    if (!queued.length) return;
    if (entities.size >= PHASE1.enemyCap && queued[0].slot.priority === 0) {
        const disposable = [...byEntity].find(([, e]) => e.slot.priority === 2);
        if (disposable) {
            const [id, e] = disposable;
            e.slot.phase = "dead";
            entities.get(id)?.remove();
            entities.delete(id);
            byEntity.delete(id);
            combat.remove(id);
            persist();
        }
    }
    if (entities.size >= PHASE1.enemyCap || String(world.getDifficulty()).toLowerCase() === "peaceful")
        return;
    const peers = queued.filter((q) => q.slot.priority === queued[0].slot.priority),
        { room: r, slot: s } = peers[cursor++ % peers.length];
    if (
        MOB_BALANCE[s.mob].debuffer &&
        r.slots.filter((s) => s.phase === "alive" && MOB_BALANCE[s.mob].debuffer).length >=
            (s.priority === 1 ? 3 : 2)
    )
        return;
    const point = safePoint(r, roomWorldPoint(r.origin, { x: 21, y: 1, z: 21 }), 0, 25);
    if (!point || members(r).some((p) => Math.hypot(p.location.x - point.x, p.location.z - point.z) < 3))
        return;
    let e;
    spawning = true;
    try {
        const typeId = MOB_BALANCE[s.mob].typeId;
        e = dim().spawnEntity(typeId, point, {
            initialPersistence: true,
            spawnEvent: managedSpawnEvent(r, s),
        });
        registerEntity(r, s, e);
    } catch (error) {
        try {
            e?.remove();
        } catch {}
        s.phase = "new";
        s.id = null;
        throw new Error(`spawn ${s.mob}: ${error}`);
    } finally {
        spawning = false;
    }
}
function movement(players) {
    observedPlayers = players;
    occupants.clear();
    const present = new Set();
    for (const p of players) {
        present.add(p.id);
        if (!eligible(p)) {
            lastRoomId.delete(p.id);
            pendingEntries.delete(p.id);
            crouches.delete(p.id);
            continue;
        }
        const r = rooms().find((r) => roomContains(roomInterior(r.origin), p.location));
        if (!r) {
            lastRoomId.delete(p.id);
            crouches.delete(p.id);
            continue;
        }
        const list = members(r);
        list.push(p);
        occupants.set(r.roomInstanceId, list);
        const changed = lastRoomId.get(p.id) !== r.roomInstanceId;
        if (changed) {
            lastRoomId.set(p.id, r.roomInstanceId);
            pendingEntries.set(p.id, r.roomInstanceId);
            if (state.runState === "ACTIVE" && state.participants[p.id] !== "active") {
                joinRun(state, p.id);
                persist();
            }
            if (r.kind === "exit" && r.exitState !== "ANCHORED") {
                r.exitState = "ANCHORED";
                state.protectionRevision++;
                persist();
            }
        }
        if (r.kind === "exit") {
            const c = roomWorldPoint(r.origin, { x: 21, y: 1, z: 21 }),
                at =
                    Math.hypot(p.location.x - c.x, p.location.z - c.z) <= 2 &&
                    Math.abs(p.location.y - c.y) < 2;
            if (at) {
                p.onScreenDisplay.setActionBar("しゃがむと帰還");
                if (p.isSneaking) {
                    if (!crouches.has(p.id)) crouches.set(p.id, tick());
                    if (tick() - crouches.get(p.id) >= PHASE1.exitCrouchTicks && exitHandler) {
                        crouches.delete(p.id);
                        exitHandler(p);
                    }
                } else crouches.delete(p.id);
            } else crouches.delete(p.id);
        } else crouches.delete(p.id);
    }
    for (const id of lastRoomId.keys())
        if (!present.has(id)) {
            lastRoomId.delete(id);
            crouches.delete(id);
        }
    for (const [id, roomId] of pendingEntries) {
        if (!present.has(id) || lastRoomId.get(id) !== roomId) {
            pendingEntries.delete(id);
            continue;
        }
        if (tick() < (arrivals.get(id) ?? 0) || !ready) continue;
        const r = rooms().find((r) => r.roomInstanceId === roomId);
        if (r) startRoom(r);
        pendingEntries.delete(id);
    }
}
function reconcile() {
    for (const e of dim().getEntities({ tags: [TAG] }))
        if (!byEntity.has(e.id)) {
            try {
                e.remove();
            } catch (error) {
                warn(error);
            }
        }
    for (const [id, e] of byEntity) {
        if (world.getEntity(id)) {
            delete e.slot.missingSince;
            continue;
        }
        e.slot.missingSince ??= tick();
        if (tick() - e.slot.missingSince >= CONFIG.missingEnemyGraceTicks) {
            entities.delete(id);
            byEntity.delete(id);
            combat.remove(id);
            e.slot.tag = `${SLOT_PREFIX}${state.runId}_${++state.serial}`;
            e.slot.id = null;
            e.slot.phase = "new";
            delete e.slot.missingSince;
            persist();
        }
    }
}
export function updateRoomEncounters() {
    try {
        ensureState();
        syncPlan();
        const players = dim().getPlayers();
        if (tick() - lastMovement >= PHASE1.playerCheckTicks) {
            lastMovement = tick();
            movement(players);
        }
        if (tick() % 100 === 0) reconcile();
        for (const r of rooms())
            if (r.state === "Active") {
                if (members(r).length) delete r.emptySince;
                else r.emptySince ??= tick();
                if (r.emptySince !== undefined && tick() - r.emptySince >= PHASE1.exitGraceTicks) {
                    cleanup(r);
                    r.state = r.keyDefeated ? "Cleared" : "Dormant";
                    r.wave = 0;
                    state.protectionRevision++;
                    persist();
                    continue;
                }
                if (ready && shouldStartWave2(r, tick())) startWave(r, 2);
                if (r.wave === 2 && r.slots.length && r.slots.every((s) => s.phase === "dead")) {
                    r.state = "Cleared";
                    state.protectionRevision++;
                    persist();
                }
            }
        combat.update(tick());
        if (!ready || state.runState !== "ACTIVE") return;
        heal(players, rooms(), tick());
        let budget = CONFIG.lightWritesPerUpdate,
            decoratedThisTick = false;
        for (const r of rooms())
            if (
                players.some(
                    (p) => Math.hypot(p.location.x - r.origin.x - 21, p.location.z - r.origin.z - 21) < 70,
                )
            ) {
                let i = lights.get(r.roomInstanceId) ?? 0;
                while (budget > 0 && i < ROOM_LIGHT_CANDIDATES.length) {
                    const b = blockAt(roomWorldPoint(r.origin, ROOM_LIGHT_CANDIDATES[i]));
                    if (!b) break;
                    if (air(b)) b.setType("minecraft:light_block_15");
                    i++;
                    budget--;
                }
                lights.set(r.roomInstanceId, i);
                installChest(r);
                if (!r.decorated && !decoratedThisTick && decorateSpecialRoom(dim(), r)) {
                    r.decorated = true;
                    decoratedThisTick = true;
                    persist();
                }
                stockReward(r);
            }
        spawnPending();
        lastError = "";
    } catch (e) {
        warn(e);
    }
}
function chestRoom(b) {
    return b?.dimension?.id === CONFIG.dimensionId
        ? rooms().find(
              (r) => r.chestOwned && r.chest && ["x", "y", "z"].every((a) => r.chest[a] === b.location[a]),
          )
        : null;
}
world.beforeEvents.playerInteractWithBlock.subscribe((e) => {
    try {
        const r = chestRoom(e.block);
        if (r && ((!r.unlockComplete && r.kind !== "treasure_vault") || (!r.debug && r.reward !== "stocked"))) {
            e.cancel = true;
            if (e.isFirstEvent !== false) system.run(() => {
                if (r.unlockComplete || r.kind === "treasure_vault") {
                    stockReward(r);
                    e.player.onScreenDisplay.setActionBar("§e報酬を準備しています");
                } else sound("random.anvil_land", r.chest);
            });
        }
    } catch (error) {
        warn(error);
    }
});
world.beforeEvents.playerBreakBlock.subscribe((e) => {
    try {
        if (
            chestRoom(e.block) ||
            (e.block.dimension.id === CONFIG.dimensionId &&
                rooms().some((r) => decorationProtected(r, e.block.location, e.block.typeId)))
        )
            e.cancel = true;
    } catch (error) {
        warn(error);
    }
});
world.beforeEvents.explosion.subscribe((e) => {
    if (e.dimension.id === CONFIG.dimensionId)
        e.setImpactedBlocks(
            e
                .getImpactedBlocks()
                .filter(
                    (b) =>
                        !chestRoom(b) && !rooms().some((r) => decorationProtected(r, b.location, b.typeId)),
                ),
        );
});
world.beforeEvents.entityHurt.subscribe((e) => {
    // Native attack/projectile components define raw damage. This event already
    // contains armor/Resistance mitigation; replacing it would bypass defenses.
    const victim = byEntity.get(e.hurtEntity.id);
    if (victim) {
        const { slot: s, room: r } = victim,
            a = combat.actors.get(e.hurtEntity.id);
        if (r.state !== "Active") {
            e.cancel = true;
            return;
        }
        if (s.mob === "clone") {
            e.cancel = true;
            if (!e.damageSource.damagingEntity) return;
            s.hits = (s.hits ?? 0) + 1;
            if (s.hits >= 3)
                system.run(() => {
                    s.phase = "dead";
                    e.hurtEntity.remove();
                    entities.delete(s.id);
                    byEntity.delete(s.id);
                    combat.remove(s.id);
                    persist();
                });
            return;
        }
        e.damage *= e.hurtEntity.getComponent("minecraft:health").effectiveMax / s.targetHp;
        if (
            s.mob === "iron_general" &&
            e.damageSource.damagingEntity &&
            inCone(
                e.hurtEntity.location,
                e.hurtEntity.getViewDirection(),
                e.damageSource.damagingEntity.location,
                100,
                120,
            )
        )
            e.damage *= a?.threshold ? 0.8 : 0.4;
        if (a?.transformed) e.damage *= 1.2;
    }
});
world.afterEvents.entityDie.subscribe((e) => {
    try {
        const id = e.deadEntity.id,
            entry = byEntity.get(id);
        if (!entry) return;
        const { room: r, slot: s } = entry;
        entities.delete(id);
        byEntity.delete(id);
        combat.remove(id);
        if (s.phase !== "alive" || r.retired) return;
        s.phase = "dead";
        if (MOB_BALANCE[s.mob].keyHolder && !r.keyDefeated) {
            r.keyDefeated = true;
            persist();
            if (r.chest) combat.unlockFlight(r, e.deadEntity.location, r.chest, s.mob === "crimson");
            else {
                r.unlockComplete = true;
                persist();
            }
        }
        persist();
    } catch (error) {
        warn(error);
    }
});
world.afterEvents.entityLoad.subscribe((e) =>
    system.run(() => {
        try {
            if (e.entity.hasTag(TAG) && !byEntity.has(e.entity.id)) e.entity.remove();
        } catch {}
    }),
);
world.afterEvents.entitySpawn.subscribe((e) => {
    try {
        const entity = e.entity;
        if (spawning || entity.isValid === false || byEntity.has(entity.id) ||
            entity.dimension.id !== CONFIG.dimensionId || entity.typeId === "minecraft:player") return;
        if (entity.getComponent("minecraft:projectile")) {
            // Suppress native debuffer shots; the configured coordinate
            // projectile owns the hit. Owner can be assigned after spawn.
            system.run(() => {
                try {
                    const owner = entity.getComponent("minecraft:projectile")?.owner;
                    const mob = owner && byEntity.get(owner.id)?.slot.mob;
                    if (mob && (MOB_BALANCE[mob].debuffer || mob === "clone")) entity.remove();
                    else if (mob === "skeleton" && entity.typeId === "minecraft:arrow")
                        entity.triggerEvent("infinite_castle:skeleton_arrow");
                    else if ((mob === "necromancer" || mob === "arch_curse") &&
                        entity.typeId === "dungeons:necromancer_shot")
                        entity.triggerEvent("infinite_castle:necromancer_shot");
                } catch {}
            });
            return;
        }
        if (!entity.matches({ families: ["monster"] })) return;
        const r = rooms().find(
            (r) => r.state === "Active" && roomContains(roomInterior(r.origin), entity.location),
        );
        if (!r || entities.size >= PHASE1.enemyCap) {
            entity.remove();
            return;
        }
        if (
            r.slots.filter((s) => s.owner === "native" && s.phase !== "dead").length >= 4 ||
            rooms().some((r) => r.slots.some((s) => s.phase === "new" && s.priority < 2))
        ) {
            entity.remove();
            return;
        }
        const mob =
            Object.keys(MOB_BALANCE).find(
                (k) => MOB_BALANCE[k].typeId === entity.typeId && !MOB_BALANCE[k].keyHolder,
            ) ?? "zombie";
        const s = nextSlot(r, mob, 0, 2, "native");
        r.slots.push(s);
        registerEntity(r, s, entity);
    } catch (error) {
        warn(error);
    }
});
export function phase1RunState() {
    return ensureState().runState;
}
export function phase1Snapshot() {
    return JSON.parse(JSON.stringify(ensureState()));
}
export function phase1ArrivalGrace(p) {
    arrivals.set(p.id, tick() + PHASE1.arrivalGraceTicks);
    lastRoomId.delete(p.id);
}
export function phase1Enter(p) {
    joinRun(ensureState(), p.id);
    arrivals.set(p.id, tick() + PHASE1.arrivalGraceTicks);
    lastRoomId.delete(p.id);
    persist();
}
export function phase1Exit(p) {
    if (exitRun(ensureState(), p.id)) endRun();
    persist();
}
function endRun() {
    state.runState = "ENDED_PENDING_REBUILD";
    for (const r of rooms()) {
        cleanup(r);
        r.state = r.keyDefeated ? "Cleared" : "Dormant";
        r.exitState = "UNDISCOVERED";
    }
    state.protectionRevision++;
    ready = false;
    world.setDynamicProperty("infinite_castle:source_dynamic_next_tick_v1", undefined);
    persist();
}
export function beginPhase1Run() {
    const old = ensureState();
    if (old.runState === "ACTIVE") return;
    for (const r of rooms()) retire(r);
    state = { ...newRun(`ic-${Date.now().toString(36)}-${old.serial}`), rooms: old.rooms, migrated: true };
    persist();
    lastDescriptor = undefined;
}
export function failPhase1Build() {
    ensureState().runState = "BUILD_FAILED";
    ready = false;
    persist();
}
function landingRooms() {
    const score = (r) =>
        r.kind === "entrance"
            ? 0
            : r.kind === "combat" && r.state === "Dormant"
              ? 1
              : r.kind === "healing_garden"
                ? 2
                : r.state === "Cleared"
                  ? 3
                  : 4;
    return rooms()
        .filter((r) => r.state !== "Active" && r.kind !== "treasure_vault")
        .sort((a, b) => score(a) - score(b));
}
export function phase1Landing() {
    if (!ready || ensureState().runState !== "ACTIVE") return null;
    for (const r of landingRooms()) {
        const p = safePoint(r, roomWorldPoint(r.origin, { x: 21, y: 1, z: 21 }));
        if (p) return { dimensionId: CONFIG.dimensionId, location: p };
    }
    return null;
}
export async function preparePhase1Landing() {
    if (!ready || ensureState().runState !== "ACTIVE") return null;
    for (const r of landingRooms()) {
        const bounds = roomInterior(r.origin);
        bounds.from.y -= 1;
        const target = await acquireLandingArea(world.tickingAreaManager, dim(), bounds,
            () => ready && ensureState().runState === "ACTIVE" && r.state !== "Active" && !r.retired
                ? safePoint(r, roomWorldPoint(r.origin, { x: 21, y: 1, z: 21 })) : null,
            () => new Promise(resolve => system.runTimeout(resolve, 1)));
        if (target) return target;
        await new Promise(resolve => system.runTimeout(resolve, 1));
    }
    return null;
}
export function setPhase1Handlers(h) {
    exitHandler = h.exit;
    reconstructHandler = h.reconstruct;
}
export function roomEncounterStatus(player) {
    ensureState();
    const r = player ? rooms().find((r) => roomContains(roomInterior(r.origin), player.location)) : null;
    return JSON.stringify({
        runId: state.runId,
        runState: state.runState,
        rebuildEpoch: state.rebuildEpoch,
        roomInstanceId: r?.roomInstanceId,
        encounterType: r?.encounterType,
        state: r?.state,
        wave: r?.wave,
        waveTimer: r ? tick() - r.waveStarted : 0,
        players: r ? members(r).length : 0,
        managed: `${entities.size}/45`,
        activeEncounters: rooms().filter((r) => r.state === "Active").length,
        activeRooms: rooms()
            .filter((r) => r.state === "Active")
            .map((r) => r.roomInstanceId),
        summons: [...byEntity.values()].filter((e) => e.slot.priority === 2).length,
        keyHolder: r?.keyDefeated,
        reward: r?.reward,
        rewardVersion: r?.rewardVersion,
        rewardError: r?.rewardError,
        chest: r?.chest,
        table: r?.encounterType ? lootTableFor(r.encounterType) : null,
        exit: r?.exitState,
        hardLocks: new Set([
            ...encounterProtection().rooms.map((r) => r.placementId),
            ...(plan?.placements ?? [])
                .filter((p) => observedPlayers.some((player) => containsPlacement(p, player.location)))
                .map((p) => p.placementId),
        ]).size,
        ...combat.metrics(),
        detectors: lastRoomId.size,
        reconstruction: mutationRevision !== null || !ready,
        nextReconstruction: world.getDynamicProperty("infinite_castle:source_dynamic_next_tick_v1"),
        error: lastError,
    });
}
system.afterEvents.scriptEventReceive.subscribe((e) => {
    if (e.id !== "infinite_castle:phase1_debug" || !e.sourceEntity) return;
    const p = e.sourceEntity,
        command = e.message.trim();
    try {
        if (command === "list_active") {
            const actors = [...byEntity].map(([id, entry]) => {
                const entity = entities.get(id);
                return { mob: entry.slot.mob, room: entry.room.roomInstanceId, id,
                    position: entity?.location, speed: entity?.getComponent("minecraft:movement")?.currentValue };
            });
            console.info(`[ic-actors] ${JSON.stringify({ tick: tick(), actors })}`);
            p.sendMessage(JSON.stringify(actors));
            return;
        }
        const r = rooms().find((r) => roomContains(roomInterior(r.origin), p.location));
        if (command === "end_run" || command === "reset_run") {
            endRun();
            return;
        }
        if (command === "force_reconstruction") {
            void reconstructHandler?.();
            return;
        }
        if (command === "cleanup") {
            for (const room of rooms())
                if (room.state === "Active") {
                    cleanup(room);
                    room.state = room.keyDefeated ? "Cleared" : "Dormant";
                }
            persist();
            return;
        }
        if (
            r &&
            [
                "start",
                "wave2",
                "reset_room",
                "clear_room",
                ...ENCOUNTER_TYPES.map((t) => `force_${t}`),
            ].includes(command)
        ) {
            if (command.startsWith("force_")) {
                const type = command.slice(6);
                if (
                    type === "elite" &&
                    rooms().some((other) => other !== r && other.encounterType === "elite")
                )
                    throw new Error("Elite already exists");
                cleanup(r);
                r.kind = "combat";
                r.encounterType = type;
                r.state = "Dormant";
                r.debug = true;
                startRoom(r);
            } else if (command === "start") {
                r.debug = true;
                startRoom(r);
            } else if (command === "wave2" && r.state === "Active" && r.wave === 1) {
                r.debug = true;
                startWave(r, 2);
            } else if (command === "reset_room" || command === "clear_room") {
                cleanup(r);
                r.state = command === "clear_room" ? "Cleared" : "Dormant";
                r.debug = true;
                r.wave = 0;
            }
            persist();
        }
        p.sendMessage(roomEncounterStatus(p));
    } catch (error) {
        p.sendMessage(`[ic-debug] ${error}`);
    }
});
system.runInterval(updateRoomEncounters, PHASE1.combatTicks);

import { PHASE1, ENCOUNTER_TYPES, WAVES, EXTRA_MOBS, OVERSEER_ABILITIES } from "./phase1Config.js";

export function seededRandom(seed) {
    let n = seed >>> 0;
    return () => {
        n += 0x6d2b79f5;
        let t = Math.imul(n ^ (n >>> 15), n | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
export function specialRole(roll) {
    if (!(roll >= 0 && roll < 1)) throw new Error("roll must be in [0,1)");
    return roll < PHASE1.treasureChance
        ? "treasure_vault"
        : roll < PHASE1.gardenBoundary
          ? "healing_garden"
          : "combat";
}
export function weightedEncounter(random) {
    let roll = random() * Object.values(PHASE1.weights).reduce((a, b) => a + b, 0);
    for (const [type, weight] of Object.entries(PHASE1.weights)) {
        roll -= weight;
        if (roll < 0) return type;
    }
    return "mixed";
}
export function multiplayerScaling(count) {
    const extra = Math.max(0, Math.min(3, Math.trunc(count) - 1));
    return { extra, keyHpMultiplier: 1 + 0.15 * extra };
}
export function waveRoster(type, wave, players) {
    const { extra } = multiplayerScaling(players);
    return [
        ...WAVES[type][wave - 1].map((mob) => ({ mob, priority: 0 })),
        ...EXTRA_MOBS[type].slice(0, extra).map((mob) => ({ mob, priority: 1 })),
    ];
}
export function shouldStartWave2(room, tick) {
    return (
        room.state === "Active" &&
        room.wave === 1 &&
        (tick - room.waveStarted >= PHASE1.waveTimeoutTicks ||
            room.slots.filter((s) => s.wave === 1 && s.priority < 2 && s.phase !== "dead").length <= 2)
    );
}
export function chooseDistinct(values, count, random) {
    const pool = [...values],
        chosen = [];
    while (chosen.length < count && pool.length)
        chosen.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
    return chosen;
}
export function graphDistances(plan, start) {
    const distances = new Map([[start, 0]]),
        queue = [start];
    for (let i = 0; i < queue.length; i++)
        for (const c of plan.connections ?? []) {
            const next =
                c.fromPlacementId === queue[i]
                    ? c.toPlacementId
                    : c.toPlacementId === queue[i]
                      ? c.fromPlacementId
                      : null;
            if (next != null && !distances.has(next)) {
                distances.set(next, distances.get(queue[i]) + 1);
                queue.push(next);
            }
        }
    return distances;
}
// Call before material authoring. Retained instances are passed explicitly;
// coordinate reuse alone never implies retention.
export function allocateRoles(plan, retained = [], initial = true) {
    const random = seededRandom(plan.seed),
        placements = plan.placements.filter((p) => (p.category ?? p.variant?.category) === "room");
    const result = new Map(retained.map((r) => [r.placementId, r]));
    const available = placements.filter((p) => !result.has(p.placementId));
    const put = (p, kind, encounterType = null) =>
        result.set(p.placementId, {
            placementId: p.placementId,
            kind,
            encounterType,
            interiorVariant:
                kind === "healing_garden"
                    ? Math.floor(random() * 3)
                    : kind === "treasure_vault"
                      ? Math.floor(random() * 2)
                      : 0,
        });
    let entrance = placements.find((p) => p.role === "entrance") ?? placements[0];
    if (initial && available.includes(entrance)) {
        available.splice(available.indexOf(entrance), 1);
        put(entrance, "entrance");
    }
    if (![...result.values()].some((r) => r.kind === "exit") && available.length) {
        const distances = graphDistances(plan, entrance?.placementId);
        const exit = [...available].sort(
            (a, b) => (distances.get(b.placementId) ?? -1) - (distances.get(a.placementId) ?? -1),
        )[0];
        available.splice(available.indexOf(exit), 1);
        put(exit, "exit");
    }
    for (const type of ENCOUNTER_TYPES)
        if (![...result.values()].some((r) => r.encounterType === type) && available.length) {
            const p = available.splice(Math.floor(random() * available.length), 1)[0];
            put(p, "combat", type);
        }
    for (const p of available) {
        const kind = specialRole(random());
        put(p, kind, kind === "combat" ? weightedEncounter(random) : null);
    }
    return placements.map((p) => result.get(p.placementId));
}
export function newRun(id) {
    return {
        v: 2,
        runId: id,
        runState: "BUILDING",
        rebuildEpoch: 0,
        serial: 0,
        rooms: [],
        participants: {},
        protectionRevision: 0,
    };
}
export function joinRun(run, id) {
    if (run.runState !== "ACTIVE") throw new Error("castle is not ready");
    run.participants[id] = "active";
}
export function exitRun(run, id) {
    if (!(id in run.participants)) return false;
    run.participants[id] = "exited";
    if (Object.values(run.participants).every((s) => s === "exited")) {
        run.runState = "ENDED_PENDING_REBUILD";
        return true;
    }
    return false;
}
export function createRoom(run, placement, role) {
    return {
        ...role,
        key: `${placement.variantId}@${placement.origin.x},${placement.origin.y},${placement.origin.z}`,
        origin: { ...placement.origin },
        roomInstanceId: `${run.runId}:${++run.serial}`,
        generation: run.serial,
        state: "Dormant",
        retired: false,
        wave: 0,
        waveStarted: 0,
        slots: [],
        keyDefeated: false,
        reward: "locked",
        rewardVersion: 3,
        chest: null,
        chestOwned: false,
        chestPlacing: false,
        exitState: "UNDISCOVERED",
        overseerAbilities: chooseDistinct(
            OVERSEER_ABILITIES,
            2,
            seededRandom((run.serial ^ placement.origin.x ^ placement.origin.z) >>> 0),
        ),
    };
}
export function restoreCombat(room) {
    if (room.keyDefeated) room.unlockComplete = true;
    if (room.state === "Active") {
        room.state = room.keyDefeated ? "Cleared" : "Dormant";
        room.slots = [];
        room.wave = 0;
    }
    // Reconcile interrupted insertion against the loaded chest, not the ledger
    // alone; otherwise a failed command permanently produces an empty reward.
    delete room.emptySince;
    return room;
}

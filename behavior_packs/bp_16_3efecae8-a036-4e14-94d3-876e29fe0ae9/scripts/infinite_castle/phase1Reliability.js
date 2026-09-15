export function rewardPlacementBlocked(rooms, position) {
    return rooms.some(r => r.chestOwned && r.chest && r.reward !== "stocked"
        && ["x", "y", "z"].every(a => Math.abs(r.chest[a] - position[a]) <= 1));
}

export function updateRunAbsence(run, onlineParticipants, now) {
    if (run.runState !== "ACTIVE" || onlineParticipants > 0) {
        delete run.noOnlineSince;
        return false;
    }
    run.noOnlineSince ??= now;
    return now - run.noOnlineSince >= 60000;
}

export function suspendCombatSlots(room) {
    for (const slot of room.slots) {
        if (slot.phase !== "dead") slot.phase = "suspended";
        slot.id = null;
        delete slot.missingSince;
    }
}

export function resumeCombatSlots(room) {
    for (const slot of room.slots) {
        if (slot.phase === "suspended") slot.phase = "new";
    }
}

// Runtime tokens are recreated; compact tuples retain the gameplay receipt.
export function serializeCombatSlots(slots) {
    return slots.map(s => [s.mob, s.wave, s.priority, s.phase === "dead" ? 0 : 1]);
}
export function restoreCombatSlots(slots = []) {
    return slots.map(s => Array.isArray(s)
        ? { mob: s[0], wave: s[1], priority: s[2], phase: s[3] === 0 ? "dead" : "suspended", id: null }
        : { ...s, id: null, phase: s.phase === "dead" ? "dead" : "suspended" });
}

export function combatWatchdog(room, { now, occupied, living, pending, complete }) {
    if (!occupied || living || pending || complete || room.state === "Error") {
        delete room.spawnEmptySince;
        return null;
    }
    room.spawnEmptySince ??= now;
    if (now - room.spawnEmptySince < 60) return null;
    delete room.spawnEmptySince;
    if (!room.spawnRepairAttempted) {
        room.spawnRepairAttempted = true;
        return "repair";
    }
    room.state = "Error";
    return "quarantine";
}

export function readyWatchdog(memory, { ready, now, players, busy, expected = true }) {
    if (!expected || ready || !players) {
        delete memory.since;
        delete memory.requestedAt;
        return { notice: false, request: false };
    }
    memory.since ??= now;
    const elapsed = now - memory.since;
    const request = elapsed >= 400 && !busy
        && (memory.requestedAt === undefined || now - memory.requestedAt >= 400);
    if (request) memory.requestedAt = now;
    return { notice: elapsed >= 60, request };
}

// Capture participants once at the opening of the shoji. Never chain proximity.
export function selectTransferParty(leader, players, busy, radius = 1) {
    const origin = { ...leader.location };
    const dimensionId = leader.dimension.id;
    const party = [leader];
    const seen = new Set([leader.id]);
    for (const player of players) {
        try {
            if (seen.has(player.id) || busy.has(player.id)
                || player.dimension.id !== dimensionId
                || (player.getComponent("minecraft:health")?.currentValue ?? 0) <= 0) continue;
            const p = player.location;
            const distance = (p.x-origin.x)**2 + (p.y-origin.y)**2 + (p.z-origin.z)**2;
            if (distance <= radius * radius) { party.push(player); seen.add(player.id); }
        } catch { /* A disconnected player cannot interrupt another player's transfer. */ }
    }
    return party;
}

// The landing lease must survive until every participant has finished.
export function shareTransferTarget(target, count) {
    let remaining = count;
    return Array.from({ length: count }, () => {
        let released = false;
        return { ...target, release() {
            if (released) return;
            released = true;
            if (--remaining === 0) target.release?.();
        } };
    });
}

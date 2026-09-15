const add = (o, p) => ({x:o.x+p[0],y:o.y+p[1],z:o.z+p[2]});

export function fixtureJobs(placements, sockets) {
    const jobs = new Map();
    for (const placement of placements) {
        if (!placement?.origin || !Object.values(placement.origin).every(Number.isFinite)) continue;
        for (const fixture of sockets[placement.variantId] ?? []) {
            const position = add(placement.origin, fixture.p);
            jobs.set(`${position.x},${position.y},${position.z}`, {
                position, supportPosition:add(placement.origin,fixture.s),
                support:fixture.support, hanging:fixture.hanging,
            });
        }
    }
    return [...jobs.values()];
}

export function overlapsWalkingSpace(position, placements, variants) {
    for (const placement of placements) {
        const variant=variants.get(placement.variantId);
        if (!variant) continue;
        const x=position.x-placement.origin.x, y=position.y-placement.origin.y, z=position.z-placement.origin.z;
        if (x < -2 || y < -2 || z < -2 || x > variant.size.x+2 || y > variant.size.y+2 || z > variant.size.z+2) continue;
        for (const [wy,wz,x0,x1] of variant.walkRuns ?? []) {
            if ((Math.abs(y-wy)<=2 && z===wz && x>=x0 && x<=x1)
                || (y===wy && Math.abs(z-wz)<=2 && x>=x0 && x<=x1)
                || (y===wy && z===wz && x>=x0-2 && x<=x1+2)) return true;
        }
    }
    return false;
}

export function tryPlaceFixture(dimension, job, players, permutation) {
    // A player standing/jumping into a socket delays it; no teleport or block replacement.
    if (players.some(p=>Math.abs(p.location.x-(job.position.x+0.5))<1.2
        && Math.abs(p.location.z-(job.position.z+0.5))<1.2
        && p.location.y<job.position.y+1 && p.location.y+2>job.position.y)) return 'occupied';
    const support=dimension.getBlock(job.supportPosition), target=dimension.getBlock(job.position);
    if (!support || !target) return 'unloaded';
    if (target.typeId===(job.hanging?'minecraft:light_block_6':'minecraft:light_block_8')) return 'present';
    if (target.typeId!=='minecraft:air' || support.typeId!==job.support) return 'changed';
    target.setPermutation(permutation);
    return 'placed';
}

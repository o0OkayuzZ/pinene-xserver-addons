export const TRADER_RADIUS = 96;
export function rejectNaturalTraderDuplicate(entity, cause) {
    if (entity.isValid === false) return false;
    if (cause !== "Spawned" || entity.typeId !== "minecraft:wandering_trader" || entity.nameTag) return false;
    if (entity.getProperty("pinene:natural_trader") !== true) return false;
    const nearby = entity.dimension.getEntities({ type: "minecraft:wandering_trader", location: entity.location, maxDistance: TRADER_RADIUS });
    if (!nearby.some(other => other.id !== entity.id && !other.nameTag)) return false;
    // Only the newly spawned, unnamed duplicate is removed. Existing traders and
    // their llamas, custom traders, loaded entities and named NPCs stay untouched.
    // Only untouched companions of this new duplicate may be removed. A named,
    // tamed or player-leashed llama is never a candidate.
    const companions = entity.dimension.getEntities({ type: "minecraft:trader_llama", location: entity.location, maxDistance: 16 });
    for (const llama of companions) {
        if (llama.isValid === false || llama.nameTag || (llama.getComponent?.("minecraft:is_tamed")?.tamedToPlayerId || llama.getComponent?.("minecraft:tamemount")?.tamedToPlayerId)) continue;
        const leash = llama.getComponent?.("minecraft:leashable");
        if (leash?.leashHolder?.id === entity.id) llama.remove();
    }
    entity.remove();
    return true;
}

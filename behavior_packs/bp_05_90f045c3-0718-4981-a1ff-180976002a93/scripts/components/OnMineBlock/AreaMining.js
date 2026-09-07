import { system } from "@minecraft/server";
import { afterEvents, getOrientation, getOrientationX, Vector } from "../../libraries/utils";
import { Component } from "../../libraries/Component";
const component = new Component('true_dn:area_mining', 'onMineBlock', { size: 3, shift_toggle: true, block_ids: [], block_tags: [] });
const OreRegex = /(_ore$)/;
component.subscribe(({ source: player, itemStack: item, minedBlockPermutation: broken, block: b }, params) => {
    if (params.shift_toggle && player.isSneaking)
        return;
    if (!item || !isPickValid(item, broken))
        return;
    const { dimension } = b;
    const fortune = item.getComponent('enchantable')?.getEnchantment('fortune')?.level ?? 0;
    const rotation = player.getRotation();
    const [oX, oY] = [getOrientationX(rotation.x), getOrientation(rotation.y)];
    for (let dY = -params.size; dY <= params.size; dY++) {
        for (let dXZ = -params.size; dXZ <= params.size; dXZ++) {
            if (!dXZ && !dY)
                continue;
            let x, y, z;
            if (oX >= 0) {
                x = b.x < 0 ? b.x - dY : b.x + dY;
                y = b.y;
                z = b.z < 0 ? b.z - dXZ : b.z + dXZ;
            }
            else {
                x = oY >= 3 ? b.x : b.x < 0 ? b.x - dXZ : b.x + dXZ;
                y = b.y < 0 ? b.y - dY : b.y + dY;
                z = oY < 3 ? b.z : b.z < 0 ? b.z - dXZ : b.z + dXZ;
            }
            const block = dimension.getBlock({ x, y, z });
            if (!block)
                continue;
            if (![params.block_tags].flat().some(t => block.hasTag(t)) && ![params.block_ids].flat().some(id => block.permutation.matches(id) && !block.typeId.match(/brick|_wall/)))
                continue;
            if (fortune && block.type.id.match(OreRegex))
                Fortune.set(JSON.stringify(b.location), { level: fortune, items: [] });
            block.destroy();
        }
    }
});
const Fortune = new Map();
afterEvents.entitySpawn.subscribe(({ entity }) => {
    if (entity.typeId !== 'minecraft:item')
        return;
    const key = JSON.stringify(Vector.floor(entity.location));
    const data = Fortune.get(key);
    if (!data)
        return;
    data.items.push(entity);
    Fortune.set(key, data);
    // Debounce processing to run once after all spawns
    if (data.items.length === 1) {
        system.runTimeout(() => {
            const { level, items } = Fortune.get(key);
            for (const ent of items) {
                const component = ent.getComponent('item');
                if (!component)
                    continue;
                const stack = component.itemStack;
                let bonus = 0;
                for (let i = 0; i < level; i++) {
                    if (Math.random() < 1 / (level + 2))
                        continue;
                    bonus++;
                }
                if (!bonus)
                    continue;
                stack.amount = bonus;
                ent.dimension.spawnItem(stack, ent.location);
            }
            Fortune.delete(key);
        }, 3); // Delay by ~3 ticks (~150ms)
    }
});
const Tier = [
    'wooden',
    'golden',
    'stone',
    'iron',
    'diamond',
    'netherite',
];
function isPickValid(item, block) {
    const required = block.getTags().find(t => t.endsWith('tier_destructible'))?.match(/:([0-z]*)_tier_destructible/)?.[1];
    if (!required)
        return true;
    const material = item.typeId.match(/:([0-z]*)_pickaxe/)?.[1] ?? item.getTags().find(t => t.endsWith('_tier'))?.[0].match(/:([0-z]*)_tier/)?.[1];
    if (material === required)
        return true;
    for (const tier of Tier) {
        if (tier === material)
            return false;
        if (tier === required)
            return true;
    }
}
export default component;

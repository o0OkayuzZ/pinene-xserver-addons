import { afterEvents, cloneItemStackInfo, Vector } from "./libraries/utils";
import { ItemStack, system } from "@minecraft/server";
import SmithingRecipes from "./SmithingRecipes";
import "./components/main";
const ItemTemplates = new Map();
afterEvents.worldLoad.subscribe(() => {
    ItemTemplates.set('next', new ItemStack('true:next'));
    ItemTemplates.set('empty', new ItemStack('true:empty'));
    ItemTemplates.set('invalid', new ItemStack('true:invalid'));
});
function processSmithingTable(table) {
    if (!table?.isValid) return;
    const { container: inv } = table.inventory;
    const block = table.dimension.getBlock(table.location);
    if (block?.typeId !== table.typeId) {
        const templates = [...ItemTemplates.values()].map(i => i.typeId);
        for (let i = 0; i < inv.size; i++) {
            const item = inv.getItem(i);
            if (!item || templates.includes(item.typeId))
                continue;
            table.dimension.spawnItem(item, Vector.center(table.location).add({ y: 0.5 }));
        }
        return table.remove();
    }
    const slots = Array.from({ length: 5 }, (_, i) => inv.getItem(i));
    const [template, base, addition, _, result] = slots;
    const recipe = SmithingRecipes.find(r => r.template === template?.typeId && r.base === base?.typeId && r.addition === addition?.typeId);
    inv.setItem(3, ItemTemplates.get(!template || !base || !addition || recipe ? 'next' : 'invalid'));
    if (!recipe) {
        if (!result || result.typeId === 'true:empty')
            inv.setItem(4, ItemTemplates.get('empty'));
        return;
    }
    if (result && result.typeId !== 'true:empty')
        return;
    template.amount > 1 ? inv.getSlot(0).amount-- : inv.setItem(0);
    base.amount > 1 ? inv.getSlot(1).amount-- : inv.setItem(1);
    addition.amount > 1 ? inv.getSlot(2).amount-- : inv.setItem(2);
    table.dimension.playSound('smithing_table.use', Vector.center(table.location));
    const next = cloneItemStackInfo(base, new ItemStack(recipe.result));
    next.amount = 1;
    inv.setItem(4, next);
}
system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity: table }) => {
    if (id.split(':')[1] !== 'special_smithing_table' || !table?.isValid)
        return;
    processSmithingTable(table);
}, { namespaces: ['true'] });
afterEvents.playerInteractWithBlock.subscribe(({ block, player }) => {
    if (block.typeId !== 'true:special_smithing_table') return;
    const entities = block.dimension.getEntitiesAtBlockLocation(block.location);
    const table = entities.find(e => e.typeId === 'true:special_smithing_table');
    if (!table?.isValid) return;
    try { table.runCommand('scriptevent true:special_smithing_table'); } catch {}
});
afterEvents.playerInteractWithEntity.subscribe(({ target: table }) => {
    if (table?.typeId !== 'true:special_smithing_table' || !table?.isValid) return;
    try { table.runCommand('scriptevent true:special_smithing_table'); } catch {}
});
afterEvents.playerPlaceBlock.subscribe(({ block, dimension }) => {
    if (block.typeId !== 'true:special_smithing_table' || dimension.getEntitiesAtBlockLocation(block.location).some(e => e.typeId === block.typeId))
        return;
    const permutation = block.permutation;
    const direction = permutation.getState('minecraft:cardinal_direction');
    const table = dimension.spawnEntity(block.typeId, Vector.add(block.center(), { y: 0.1 }));
    table.setRotation({ y: direction === 'north' ? 90 : direction === 'south' ? -90 : direction === 'east' ? 180 : 0, x: 0 });
    table.nameTag = 'Special Smithing Table';
});


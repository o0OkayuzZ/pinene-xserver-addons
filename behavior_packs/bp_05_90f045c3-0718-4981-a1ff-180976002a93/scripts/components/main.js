import Miscellaneous from "./Miscellaneous/index";
import OnMineBlock from "./OnMineBlock/index";
import OnUseOn from "./OnUseOn/index";
import Armor from "./Armor/index";
import { system } from "@minecraft/server";
const CustomComponents = [Armor, OnMineBlock, OnUseOn, Miscellaneous].flat();
export const Components = new Map();
system.beforeEvents.startup.subscribe(({ itemComponentRegistry: ItemRegistry }) => {
    for (const component of CustomComponents) {
        const { id, event, defaults } = component;
        const list = Components.get(event) ?? [];
        list.push(component);
        Components.set(event, list);
        try {
            ItemRegistry.registerCustomComponent(id, event.length ? {
                [event]: (data, { params }) => component.run(data, { ...defaults ?? {}, ...params }),
            } : {});
        }
        catch { }
    }
});
export default CustomComponents;

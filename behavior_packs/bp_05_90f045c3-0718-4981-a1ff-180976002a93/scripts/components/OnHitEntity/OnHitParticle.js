import { MolangVariableMap } from "@minecraft/server";
import { Vector } from "../../libraries/utils";
import { system } from "@minecraft/server";
import { Component } from "../../libraries/Component";
const component = new Component('true_dn:on_hit_particle', 'onHitEntity', { duration: 0, interval: 1, offset: [0, 0, 0] });
component.subscribe(async ({ hitEntity: target, itemStack: item }, params) => {
    if (!params.particle_id)
        throw new Error(`"${item?.typeId}" did not specify the particle ID at "true_dn:on_hit_particle"`);
    const { particle_id, color_variable, size_variable, interval, duration, offset } = params;
    const molang = new MolangVariableMap();
    if (color_variable)
        molang.setColorRGBA('variable.color', color_variable);
    if (size_variable)
        molang.setFloat('variable.size', size_variable);
    const { dimension } = target;
    const position = Vector.add(target.location, { x: offset[0], y: offset[1], z: offset[2] });
    if (duration > 0)
        return dimension.spawnParticle(particle_id, position, molang);
    const start = system.currentTick;
    while (true) {
        if (start - system.currentTick >= duration * 20 || !target.isValid)
            break;
        dimension.spawnParticle(particle_id, Vector.add(target.location, { x: offset[0], y: offset[1], z: offset[2] }), molang);
        await system.waitTicks(interval * 20);
    }
});
export default component;

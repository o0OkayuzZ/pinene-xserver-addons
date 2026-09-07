import { Component } from "../../libraries/Component";
const component = new Component('true_dn:on_hit_ignite', 'onHitEntity');
component.subscribe(({ hitEntity: target }, { duration, use_effects }) => {
    target.setOnFire(duration ?? 5, use_effects);
});
export default component;

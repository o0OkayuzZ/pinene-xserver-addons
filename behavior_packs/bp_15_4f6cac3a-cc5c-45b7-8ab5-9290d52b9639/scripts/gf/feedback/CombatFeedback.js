import { DamageTickets } from "./DamageTickets.js";
import { FloatingLabels } from "./FloatingLabels.js";

const installed = new WeakMap();
export function installCombatFeedback(world, system, cause, observe = () => {}) {
  if (installed.has(world)) return installed.get(world);
  const labels = new FloatingLabels(system);
  const tickets = new DamageTickets(system, hit => {
    try { observe(hit); } catch {}
    labels.damage(hit.target.isValid === false ? hit.ticket.anchor : hit.target, hit.damage);
  }, cause);
  world.beforeEvents.entityHurt.subscribe(event => { try { tickets.before(event); } catch { tickets.reset(); } }, { allowedDamageCauses: [cause] });
  world.afterEvents.entityHurt.subscribe(event => { try { tickets.after(event); } catch { tickets.reset(); } }, { allowedDamageCauses: [cause] });
  const feedback = {
    apply(target, damage, source, context) {
      let anchor;
      try {
        const head = target.getHeadLocation();
        anchor = { id: target.id, typeId: target.typeId, dimension: target.dimension, isValid: true, getHeadLocation: () => head };
      } catch {}
      return tickets.apply(target, damage, source, { ...context, anchor }, () => target.applyDamage(damage, { cause, ...(source ? { damagingEntity: source } : {}) }));
    },
    block(target) { try { labels.block(target); } catch {} },
    tickets, labels,
  };
  installed.set(world, feedback); return feedback;
}

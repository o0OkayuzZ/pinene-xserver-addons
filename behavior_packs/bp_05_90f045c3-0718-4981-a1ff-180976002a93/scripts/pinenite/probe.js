// Opt-in observer only. In a disposable world: /scriptevent true_dn:pinenite_probe label
// Logs expire after 60s. Never changes armor, health, damage or combat state.
import { world, system, EquipmentSlot } from '@minecraft/server';
const watching = new Map();
system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity }) => {
    if (id !== 'true_dn:pinenite_probe' || sourceEntity?.typeId !== 'minecraft:player') return;
    if (message === 'off') watching.delete(sourceEntity.id);
    else watching.set(sourceEntity.id, { label: message.slice(0, 80), until: system.currentTick + 1200 });
});
function log(phase, ev) {
    const p = ev.hurtEntity, probe = watching.get(p.id);
    if (!probe) return;
    if (probe.until <= system.currentTick) { watching.delete(p.id); return; }
    const eq = p.getComponent('minecraft:equippable'), hp = p.getComponent('minecraft:health');
    console.warn('[PineniteProbe] ' + JSON.stringify({ label: probe.label, phase, tick: system.currentTick,
        eventDamage: ev.damage, cause: ev.damageSource.cause, cancelled: ev.cancel ?? false,
        hp: hp?.currentValue, maxHp: hp?.effectiveMax,
        equipment: [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet]
            .map(slot => eq?.getEquipment(slot)?.typeId ?? 'air'),
        effects: p.getEffects().map(effect => ({ id: effect.typeId, amplifier: effect.amplifier })) }));
}
// Loaded before the Pinenite combat listener: this is the unmodified API input.
world.beforeEvents.entityHurt.subscribe(ev => log('before-pinenite', ev));
world.afterEvents.entityHurt.subscribe(ev => log('after-engine', ev));
world.afterEvents.playerLeave.subscribe(({ playerId }) => watching.delete(playerId));

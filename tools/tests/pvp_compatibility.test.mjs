import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../../behavior_packs/bp_17_c65bcd04-4708-4716-86bf-bbd6ab936fd3/scripts/elemental_status.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/, '');
const island = 'pinene_pvp:pvp_island';
function runtime() {
  const events = { entityHurt: [], projectileHitEntity: [] };
  const world = {
    afterEvents: Object.fromEntries(Object.entries(events).map(([name, handlers]) => [name, { subscribe: fn => handlers.push(fn) }])),
    getAbsoluteTime: () => 0,
  };
  vm.runInNewContext(source, { world, system: { runInterval() {} }, EquipmentSlot: { Mainhand: 'Mainhand' }, EntityDamageCause: { lightning: 'lightning' } });
  return (name, event) => events[name].forEach(fn => fn(event));
}
function entity(dimension = island) {
  const tags = new Set();
  return { id: 'entity', typeId: 'minecraft:player', dimension: { id: dimension }, damage: [],
    addTag: tag => tags.add(tag), removeTag: tag => tags.delete(tag), hasTag: tag => tags.has(tag),
    applyDamage(value) { this.damage.push(value); }, playSound() {}, sendMessage() {}, getComponent() {} };
}
for (const namespace of ['pinen', 'pinene_pvp']) {
  for (const dimension of [island, 'minecraft:overworld']) {
    test(`${namespace} wedge consumption and dimension gate: ${dimension}`, () => {
      const emit = runtime();
      const attacker = entity(dimension), target = entity(dimension);
      let held = { typeId: `${namespace}:tenrai_wedge`, get amount() { return 1; }, set amount(n) { if (n < 1) throw new RangeError('ItemStack amount must be positive'); } };
      attacker.getComponent = () => ({ getEquipment: () => held, setEquipment: (_, value) => { held = value; } });
      emit('entityHurt', { damage: 12, damageSource: { damagingEntity: attacker }, hurtEntity: target });
      assert.equal(target.hasTag('pinene_pvp:charged'), dimension === island);
      assert.equal(held === undefined, dimension === island);
    });
    test(`${namespace} arrow ability and dimension gate: ${dimension}`, () => {
      const emit = runtime(), owner = entity(dimension), target = entity(dimension);
      emit('projectileHitEntity', { projectile: { typeId: `${namespace}:shingan_arrow`, getComponent: () => ({ owner }) } });
      assert.equal(owner.hasTag('pinene_pvp:divine_sight'), dimension === island);
      emit('entityHurt', { damage: 4, damageSource: { damagingEntity: owner }, hurtEntity: target });
      assert.deepEqual(target.damage, dimension === island ? [4] : []);
      assert.equal(owner.hasTag('pinene_pvp:divine_sight'), false);
    });
  }
}
test('charged entity receives bonus lightning damage only inside the island', () => {
  const emit = runtime(), target = entity();
  target.addTag('pinene_pvp:charged');
  emit('entityHurt', { damage: 3, damageSource: { cause: 'lightning' }, hurtEntity: target });
  assert.deepEqual(target.damage, [24]);
  target.dimension.id = 'minecraft:overworld';
  emit('entityHurt', { damage: 3, damageSource: { cause: 'lightning' }, hurtEntity: target });
  assert.deepEqual(target.damage, [24]);
});

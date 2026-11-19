import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(
  new URL('../behavior_packs/bp_18_7e540260-69ce-4a82-951d-bc793e151cd5/scripts/chili_crop.js', import.meta.url), 'utf8'
).replace(/^import .*?;\s*$/gm, '');

function environment({ random = 0.5, creative = false } = {}) {
  const tasks = [], drops = [], sounds = [], warnings = [], inventory = [];
  const GameMode = { Creative: 'creative', Survival: 'survival' };
  const events = {};
  let currentBlock = true, spawnFails = false, failNextSet = false;
  class ItemStack {
    constructor(typeId, amount = 1) { this.typeId = typeId; this.amount = amount; }
  }
  class Perm {
    constructor(age) { this.age = age; }
    getState() { return this.age; }
    withState(_name, nextAge) { return new Perm(nextAge); }
  }
  const block = {
    typeId: 'pine:chili_crop',
    location: { x: 4, y: 70, z: -3 },
    permutation: new Perm(3),
    setPermutation(next) {
      if (failNextSet) { failNextSet = false; throw Error('permutation_failed'); }
      this.permutation = next;
    }
  };
  const dimension = {
    getBlock: () => currentBlock ? block : undefined,
    spawnItem(stack, loc) {
      if (spawnFails) throw Error('spawn_failed');
      drops.push({ stack, loc });
    }
  };
  block.dimension = dimension;
  const slots = {
    size: 36,
    getItem: slot => inventory[slot],
    setItem: (slot, stack) => inventory[slot] = stack
  };
  const player = {
    selectedSlotIndex: 0,
    getGameMode: () => creative ? GameMode.Creative : GameMode.Survival,
    getComponent: name => name === 'minecraft:inventory' ? { container: slots } : undefined,
    playSound: (id, options) => sounds.push({ id, options })
  };
  let component;
  const system = {
    run: callback => tasks.push(callback),
    beforeEvents: {
      startup: {
        subscribe: fn => events.startup = fn
      }
    }
  };
  const world = {
    beforeEvents: {
      playerInteractWithBlock: { subscribe: callback => events.beforeInteract = callback }
    }
  };
  const fakeMath = Object.create(Math);
  fakeMath.random = () => random;
  const sandbox = { ItemStack, GameMode, system, world, Math: fakeMath, console: { warn: text => warnings.push(text) } };
  vm.runInNewContext(source + '\nglobalThis.api={growCrop,harvestCrop,setAge};', sandbox);
  events.startup({ blockComponentRegistry: {
    registerCustomComponent: (id, value) => {
      assert.equal(id, 'pine:chili_crop_logic');
      component = value;
    }
  }});
  function flush() { while (tasks.length) tasks.shift()(); }
  function age() { return block.permutation.getState('pine:age'); }
  return {
    block, player, component, events, inventory, drops, sounds, warnings, age, flush, ItemStack,
    setAge: n => block.permutation = new Perm(n),
    removeCrop: () => currentBlock = false,
    failSpawn: () => spawnFails = true,
    failSetAgeOnce: () => failNextSet = true,
    harvest: () => component.onPlayerInteract({ block, player }),
    bonemeal: () => {
      const ev = { block, player, itemStack: inventory[0], isFirstEvent: true, cancel: false };
      events.beforeInteract(ev);
      return ev;
    }
  };
}

test('mature crop harvest gives 2-4 peppers and returns to regrowing age 1', () => {
  const e = environment();
  e.harvest();
  e.flush();
  assert.equal(e.drops.length, 1);
  assert.equal(e.drops[0].stack.typeId, 'pine:chili_pepper');
  assert.equal(e.drops[0].stack.amount, 3);
  assert.equal(e.age(), 1);
  assert(e.sounds.some(sound => sound.id === 'random.pop'));
});

test('rapid repeated harvest events cannot duplicate drops from the same crop', () => {
  const e = environment();
  e.harvest(); e.harvest(); e.harvest();
  e.flush();
  assert.equal(e.drops.length, 1);
  assert.equal(e.age(), 1);
});

test('failed item spawn restores mature harvest instead of losing peppers', () => {
  const e = environment();
  e.failSpawn();
  e.harvest(); e.flush();
  assert.equal(e.drops.length, 0);
  assert.equal(e.age(), 3);
  assert(e.warnings.some(w => w.includes('harvest drop failed')));
});

test('failed crop age change does not spawn a drop', () => {
  const e = environment();
  e.failSetAgeOnce();
  e.harvest(); e.flush();
  assert.equal(e.drops.length, 0);
  assert.equal(e.age(), 3);
});

test('removed crop cannot be harvested by a stale queued callback', () => {
  const e = environment();
  e.harvest(); e.removeCrop(); e.flush();
  assert.equal(e.drops.length, 0);
});

test('tick growth respects probability and four valid age stages', () => {
  const e = environment({ random: 0.01 });
  e.setAge(2); e.component.onTick({ block: e.block });
  assert.equal(e.age(), 3);
  e.component.onTick({ block: e.block });
  assert.equal(e.age(), 3);
  const f = environment({ random: 0.99 });
  f.setAge(1); f.component.onTick({ block: f.block });
  assert.equal(f.age(), 1);
});

test('survival bonemeal is consumed once and increases growth stage once', () => {
  const e = environment();
  e.setAge(0);
  e.inventory[0] = new e.ItemStack('minecraft:bone_meal', 2);
  const event = e.bonemeal();
  assert.equal(event.cancel, true);
  e.flush();
  assert.equal(e.age(), 1);
  assert.equal(e.inventory[0].amount, 1);
});

test('creative bonemeal grows crop without consuming the item', () => {
  const e = environment({ creative: true });
  e.setAge(1);
  e.inventory[0] = new e.ItemStack('minecraft:bone_meal', 2);
  const event = e.bonemeal(); e.flush();
  assert.equal(event.cancel, true);
  assert.equal(e.age(), 2);
  assert.equal(e.inventory[0].amount, 2);
});

test('premature crop interaction and non-bonemeal input are harmless', () => {
  const e = environment();
  e.setAge(2);
  e.harvest(); e.flush();
  assert.equal(e.drops.length, 0);
  e.inventory[0] = new e.ItemStack('minecraft:carrot', 1);
  const event = e.bonemeal();
  assert.equal(event.cancel, false);
  assert.equal(e.age(), 2);
});

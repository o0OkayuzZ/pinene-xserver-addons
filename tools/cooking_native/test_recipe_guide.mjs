import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { COOKING_RECIPES, CATEGORY_ORDER } from '../../behavior_packs/bp_19_211f47f7-5f1d-4b02-a162-e7546cf3fdc4/scripts/cooking_data.js';
import { DISCOVERY_KEY, parseDiscovery, discoverFromItems, isRecipeDiscovered } from '../../behavior_packs/bp_19_211f47f7-5f1d-4b02-a162-e7546cf3fdc4/scripts/recipe_discovery.js';

const file = new URL('../../behavior_packs/bp_19_211f47f7-5f1d-4b02-a162-e7546cf3fdc4/scripts/recipe_guide.js', import.meta.url);
const source = fs.readFileSync(file, 'utf8')
  .replace(/^import[\s\S]*?from ['"][^'"]+['"];\s*/gm, '')
  .replace(/^export /gm, '');

function createUi(responses = []) {
  const forms = [];
  const release = [];
  const tasks = [];
  const events = {};
  const inventory = Array(36).fill(undefined);
  const properties = new Map();
  const logs = [];
  let material = 'copper';
  let boardExists = true;

  class FakeForm {
    constructor() { this.buttons = []; }
    title(value) { this.titleText = value; return this; }
    body(value) { this.bodyText = value; return this; }
    button(value, icon) { this.buttons.push({ text: value, icon }); return this; }
    async show() {
      forms.push(this);
      const choice = responses.shift();
      return choice ?? { canceled: true };
    }
  }
  class FakeStack {
    constructor(id) { this.localizationKey = 'item.' + id + '.name'; }
  }

  const block = {
    typeId: 'pinene_cooking:oak_cutting_board',
    location: { x: 4, y: 70, z: 2 },
    permutation: {
      getAllStates: () => ({ 'pinene_cooking:knife': material })
    },
  };
  const dimension = { getBlock: () => boardExists ? block : undefined };
  block.dimension = dimension;
  const player = {
    id: 'user1',
    isValid: true,
    selectedSlotIndex: 0,
    getComponent: id => id === 'minecraft:inventory'
      ? { container: { size: inventory.length, getItem: slot => inventory[slot] } }
      : undefined,
    getDynamicProperty: key => properties.get(key),
    setDynamicProperty: (key, value) => properties.set(key, value),
    sendMessage: text => logs.push(text),
  };
  const world = {
    getAllPlayers: () => [],
    afterEvents: {
      playerInventoryItemChange: { subscribe: f => events.change = f },
      playerSpawn: { subscribe: f => events.spawn = f },
    },
    beforeEvents: { playerInteractWithBlock: { subscribe: f => events.click = f } },
  };
  const system = { run: f => tasks.push(f) };
  const icons = Object.fromEntries(COOKING_RECIPES.map(recipe => [recipe.id, 'textures/items/placeholder']));
  const context = { world, system, ItemStack: FakeStack, ActionFormData: FakeForm,
    COOKING_RECIPES, CATEGORY_ORDER, INVENTORY_ICONS: icons,
    DISCOVERY_KEY, parseDiscovery, discoverFromItems, isRecipeDiscovered,
    releaseCookingSession: id => release.push(id),
    console: { warn: msg => logs.push(msg) },
  };
  vm.runInNewContext(source + '\nglobalThis.api={showRecipeGuide,rankLabel};', context);
  return { ...context.api, forms, release, tasks, events, inventory,
    properties, logs, player, block,
    setMaterial: m => material = m,
    removeBoard: () => boardExists = false };
}

function availableRanks() {
  return CATEGORY_ORDER.filter(rank => COOKING_RECIPES.some(recipe => recipe.rank === rank));
}

test('recipe guide starts with a compact rank index rather than every recipe', async () => {
  const e = createUi();
  await e.showRecipeGuide(e.player, e.block);
  assert.equal(e.forms.length, 1);
  assert.equal(e.forms[0].titleText, '料理図鑑');
  assert.equal(e.forms[0].buttons.length, availableRanks().length);
  assert.match(e.forms[0].buttons[0].text, /基礎素材/);
  assert.match(e.forms[0].buttons[0].text, /発見 7\/7/);
  assert(!e.forms[0].buttons.some(b => b.text.includes('キャロットサラダ')));
});

test('rank page only shows its recipes, back returns to rank index', async () => {
  const ranks = availableRanks();
  const rank = ranks.find(r => r > 0);
  const index = ranks.indexOf(rank);
  const rows = COOKING_RECIPES.filter(r => r.rank === rank);
  const e = createUi([{ canceled: false, selection: index },
    { canceled: false, selection: rows.length }, { canceled: true }]);
  await e.showRecipeGuide(e.player, e.block);
  assert.equal(e.forms.length, 3);
  assert.equal(e.forms[1].buttons.length, rows.length + 1);
  assert.match(e.forms[1].buttons.at(-1).text, /ランク一覧へ戻る/);
  assert.equal(e.forms[2].titleText, '料理図鑑');
});

test('unavailable or undiscovered recipes are hidden until their ingredients were collected', async () => {
  const target = COOKING_RECIPES.find(recipe => recipe.id === 'pine:carrot_salad');
  assert(target && target.rank > 0);
  const rankIndex = availableRanks().indexOf(target.rank);
  const recipeIndex = COOKING_RECIPES.filter(recipe => recipe.rank === target.rank)
    .findIndex(recipe => recipe.id === target.id);
  const hidden = createUi([{ canceled: false, selection: rankIndex },
    { canceled: false, selection: recipeIndex }, { canceled: true }]);
  await hidden.showRecipeGuide(hidden.player, hidden.block);
  assert.match(hidden.forms[1].buttons[recipeIndex].text, /？？？/);
  assert.equal(hidden.forms[2].titleText, '？？？');
  assert(!JSON.stringify(hidden.forms[2].bodyText).includes('minecraft:carrot'));

  const discovered = createUi([{ canceled: false, selection: rankIndex },
    { canceled: false, selection: recipeIndex }, { canceled: true }]);
  const result = discoverFromItems('', ['minecraft:carrot']);
  discovered.properties.set(DISCOVERY_KEY, result.value);
  await discovered.showRecipeGuide(discovered.player, discovered.block);
  assert.equal(discovered.forms[2].titleText, target.name);
  assert(!discovered.forms[1].buttons[recipeIndex].text.includes('？？？'));
  assert(JSON.stringify(discovered.forms[2].bodyText).includes('item.minecraft:carrot.name'));
});

test('repeated detail/back navigation runs in one loop without nested form chains', async () => {
  const rounds = 120;
  const replies = [{ canceled: false, selection: 0 }];
  for (let n = 0; n < rounds; n++) replies.push(
    { canceled: false, selection: 0 },
    { canceled: false, selection: 0 }
  );
  replies.push({ canceled: true });
  const e = createUi(replies);
  await e.showRecipeGuide(e.player, e.block);
  assert.equal(e.forms.length, 2 + rounds * 2);
  assert.equal(e.forms[1].titleText, '基礎素材 - 料理図鑑');
});

test('book interaction cancels normal cooking, releases its reservation and schedules guide', () => {
  const e = createUi();
  e.inventory[0] = { typeId: 'minecraft:book' };
  const ev = { player: e.player, block: e.block, isFirstEvent: true, cancel: false };
  e.events.click(ev);
  assert.equal(ev.cancel, true);
  assert.deepEqual(e.release, ['user1']);
  assert(e.tasks.length > 0);
});

test('guide navigation stops safely when the cutting board is removed', async () => {
  const e = createUi([{ canceled: false, selection: 0 }]);
  // On the first form the mocked UI response resolves asynchronously.
  const work = e.showRecipeGuide(e.player, e.block);
  e.removeBoard();
  await work;
  assert.equal(e.forms.length, 1);
  assert.equal(e.logs.length, 0);
});

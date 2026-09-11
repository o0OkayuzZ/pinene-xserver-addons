const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const scriptDir = path.resolve(__dirname, '../../behavior_packs/bp_09_7c8ac348-47ad-4f71-8503-dc40a6f813f1/scripts');
let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS ' + name); }
function signal() { const callbacks = []; return { subscribe: cb => callbacks.push(cb), emit: ev => callbacks.forEach(cb => cb(ev)) }; }
const beforeEvents = Object.fromEntries(['entityHurt','entityRemove','effectAdd','itemUse'].map(x => [x,signal()]));
const afterEvents = Object.fromEntries(['entityHurt','entityDie','playerLeave','playerSpawn','itemUse','itemCompleteUse'].map(x => [x,signal()]));
let queue = [], players = [], uid = 0;
const intervals = [], objectives = new Map(), warnings = [];
const system = { currentTick: 0, run: f => queue.push(f), runInterval: (f,n) => intervals.push([f,n]) };
const world = { beforeEvents, afterEvents, getAllPlayers: () => players, getTimeOfDay: () => 14000,
  scoreboard: { getObjective: n => objectives.get(n) },
  getDimension: () => ({ runCommand: cmd => { const data = new Map(); objectives.set(cmd.split(' ')[3], { getScore: id => data.get(id), setScore: (id,n) => data.set(id,n) }); } }) };
function flush() { const work = queue; queue = []; work.forEach(f => f()); }
class ItemStack {
  constructor(typeId, amount = 1) { Object.assign(this, { typeId, amount, nameTag: undefined, keepOnDeath: false, lockMode: 'none', lore: [], destroy: [], place: [], dynamic: {}, enchantments: [], durability: { maxDurability: 110, damage: 0 } }); }
  getComponent(name) {
    if (name.endsWith('durability')) return this.durability;
    if (name.endsWith('enchantable')) return { getEnchantments: () => this.enchantments, addEnchantments: v => { this.enchantments = structuredClone(v); } };
  }
  getLore() { return this.lore; } setLore(v) { this.lore = [...v]; }
  getCanDestroy() { return this.destroy; } setCanDestroy(v) { this.destroy = [...v]; }
  getCanPlaceOn() { return this.place; } setCanPlaceOn(v) { this.place = [...v]; }
  getDynamicPropertyIds() { return Object.keys(this.dynamic); }
  getDynamicProperty(k) { return this.dynamic[k]; } setDynamicProperty(k,v) { this.dynamic[k] = v; }
  clone() { return Object.assign(new ItemStack(this.typeId), structuredClone(this)); }
}
const EquipmentSlot = { Head:'head', Chest:'chest', Legs:'legs', Feet:'feet' };
const EntityDamageCause = { entityAttack:'entityAttack', projectile:'projectile', override:'override', fire:'fire' };
function entity(gearStage = -1, isPlayer = true) {
  const e = { id: 'e'+(++uid), typeId: isPlayer ? 'minecraft:player' : 'minecraft:zombie', isValid: true, tags: new Set(), effects: {}, dynamic: {}, slots: {}, messages: [], selectedSlotIndex: 0,
    onScreenDisplay: { setActionBar(text) { this.text = text; } },
    health: { currentValue: 20, effectiveMax: 20, setCurrentValue(n) { this.currentValue = n; } },
    hunger: { currentValue: 10, setCurrentValue(n) { this.currentValue = n; } },
    saturation: { currentValue: 3, setCurrentValue(n) { this.currentValue = n; } },
    getComponent(n) {
      if (n.endsWith('health')) return this.health;
      if (n.endsWith('player.hunger')) return this.hunger;
      if (n.endsWith('player.saturation')) return this.saturation;
      if (n.endsWith('equippable')) return { getEquipment: s => this.slots[s]?.clone(), setEquipment: (s,i) => { this.slots[s] = i.clone(); return true; } };
      if (n.endsWith('inventory')) return { container: { getItem: () => this.selected, setItem: (_,i) => { this.selected = i; } } };
    },
    getEffect(n) { return this.effects[n]; },
    addEffect(n,d,o) { this.effects[n] = { duration:d, ...o }; if (n === 'health_boost') this.health.effectiveMax = 20 + 4*(o.amplifier+1); },
    removeEffect(n) { delete this.effects[n]; if (n === 'health_boost') this.health.effectiveMax = 20; },
    hasTag(t) { return this.tags.has(t); }, addTag(t) { this.tags.add(t); }, removeTag(t) { this.tags.delete(t); },
    getDynamicProperty(k) { return this.dynamic[k]; }, setDynamicProperty(k,v) { this.dynamic[k] = v; },
    sendMessage(m) { this.messages.push(m); }, extinguishFire() {}, applyDamage(n,source) { hit(source.damagingEntity,this,n,source.cause); },
    dimension: { id:'minecraft:nether' }
  };
  e.scoreboardIdentity = e.id;
  if (gearStage >= 0) equip(e,gearStage);
  if (isPlayer) players.push(e);
  return e;
}
function equip(e,n) { for (const [s,p] of Object.entries({head:'helmet',chest:'chestplate',legs:'leggings',feet:'boots'})) e.slots[s] = new ItemStack('zombiegear:zombie_'+p+(n ? '_c'+n : '')); }
function hit(attacker,victim,n,cause='entityAttack', projectile=false) {
  const ev = { hurtEntity:victim, damage:n, cancel:false, damageSource:{cause,damagingEntity:attacker,damagingProjectile:projectile ? {} : undefined} };
  beforeEvents.entityHurt.emit(ev);
  if (!ev.cancel) { victim.health.currentValue = Math.max(0,victim.health.currentValue-ev.damage); afterEvents.entityHurt.emit(ev); }
  return ev;
}
const sandbox = { world, system, ItemStack, EquipmentSlot, EntityDamageCause, console: {info(){},warn:m=>warnings.push(m),error:m=>warnings.push(m)} };
vm.createContext(sandbox);
const code = ['rules.js','combat.js','controls.js','main.js'].map(f => fs.readFileSync(path.join(scriptDir,f),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'')).join('\n');
vm.runInContext(code + '\nglobalThis.api={infectionAt,damageMultiplier,corruption,revives,tryRevive,initializePlayer,forceMaxHpState,createArmorVariantItem,setCorruption,tickChargeCompletion,getScore,setScore,SCORE};',sandbox);
flush();
const api = sandbox.api;
const near = (actual, expected) => assert.ok(Math.abs(actual-expected)<1e-8, `${actual} != ${expected}`);
function init(e,n=0) { api.initializePlayer(e); api.setScore(e,api.SCORE.revives,n); api.forceMaxHpState(e); }

test('full zombie gear has constant additive physical attack bonus', () => {
  [1.2,1.3,1.5,1.9,2.7].forEach((n,i)=>near(api.damageMultiplier(i,0,0,true),n));
  [1,1.1,1.3,1.7,2.5].forEach((n,i)=>near(api.damageMultiplier(i,0,0,false),n));
});
test('infection attack/defense and c4 severe product', () => {
  [1,.9,.8,.7].forEach((n,i)=>{near(api.damageMultiplier(-1,i,0,false),n);near(api.damageMultiplier(-1,0,i,false),1/n);});
  near(api.damageMultiplier(4,0,3,true),3.24/.7);
  near(api.damageMultiplier(4,3,3,true),3.24);
});
test('infection decay boundaries 10/15/20/25 seconds', () => {
  for (const [tick,n] of [[0,3],[200,3],[299,3],[300,2],[399,2],[400,1],[499,1],[500,0]]) assert.equal(api.infectionAt({stage:3,lastHit:0},tick),n);
});
test('HP80 full / HP20 partial / no boost removal for unrelated player', () => {
  const p=entity(0);init(p);assert.equal(p.health.effectiveMax,80);p.health.currentValue=75;delete p.slots.head;api.forceMaxHpState(p);assert.equal(p.health.currentValue,20);
  const other=entity();other.addEffect('health_boost',600,{amplifier:2});api.forceMaxHpState(other);assert.equal(other.health.effectiveMax,32);
});
test('one-time legacy charge migration keeps item IDs', () => {
  const p=entity(3);api.initializePlayer(p);assert.equal(api.revives(p),3);assert.equal(api.corruption(p),3);api.setScore(p,api.SCORE.revives,1);api.initializePlayer(p);assert.equal(api.revives(p),1);
});
test('four revives consume resources and advance all four stages', () => {
  const p=entity(0);init(p,4);
  for(let i=1;i<=4;i++){assert.equal(api.tryRevive(p),true);assert.equal(api.corruption(p),i);assert.equal(api.revives(p),4-i);}
  assert.equal(api.tryRevive(p),false);
  assert.equal(Object.keys(p.effects).sort().join(','),'health_boost,speed');
  assert.equal(p.effects.speed.duration,60);assert.equal(p.effects.speed.amplifier,1);
});
test('c4 stays c4 while independently consuming a recharged revive', () => {const p=entity(4);init(p,1);assert.ok(api.tryRevive(p));assert.equal(api.corruption(p),4);assert.equal(api.revives(p),0);});
test('mismatch does not rewrite gear or consume resources', () => {
  const p=entity(1);p.slots.head=new ItemStack('zombiegear:zombie_helmet_c4');init(p,4);const ids=Object.values(p.slots).map(i=>i.typeId);assert.equal(api.tryRevive(p),false);assert.equal(api.revives(p),4);assert.deepEqual(Object.values(p.slots).map(i=>i.typeId),ids);
});
test('swap preserves durability enchantments name lore locks and dynamic properties', () => {
  const p=entity(0);init(p,1);Object.assign(p.slots.head,{nameTag:'Named',lore:['Lore'],keepOnDeath:true,lockMode:'slot',dynamic:{'test:value':42},enchantments:[{type:'protection',level:2}],destroy:['stone'],place:['dirt']});p.slots.head.durability.damage=47;
  assert.ok(api.tryRevive(p));const i=p.slots.head;assert.equal(i.durability.damage,47);assert.equal(i.nameTag,'Named');assert.deepEqual(i.lore,['Lore']);assert.equal(i.keepOnDeath,true);assert.equal(i.lockMode,'slot');assert.equal(i.dynamic['test:value'],42);assert.equal(i.enchantments[0].level,2);assert.deepEqual(i.destroy,['stone']);
});
test('8-second charge consumes one zombie stem cell only at completion, keeps c0', () => {
  const p=entity(0);init(p);p.selected=new ItemStack('pinematerials:zonbikansaibou',2);system.currentTick=1000;afterEvents.itemUse.emit({source:p,itemStack:p.selected});assert.equal(p.selected.amount,2);system.currentTick=1159;api.tickChargeCompletion(p);assert.equal(api.revives(p),0);system.currentTick=1160;api.tickChargeCompletion(p);assert.equal(api.revives(p),1);assert.equal(p.selected.amount,1);assert.equal(api.corruption(p),0);
});
test('four zombie stem cells can fill all four revive charges', () => {
  const p=entity(0);init(p);p.selected=new ItemStack('pinematerials:zonbikansaibou',4);
  for (let i=1;i<=4;i++) { system.currentTick=10000+i*200;afterEvents.itemUse.emit({source:p,itemStack:p.selected});system.currentTick+=160;api.tickChargeCompletion(p);assert.equal(api.revives(p),i);assert.equal(p.selected?.amount ?? 0,4-i); }
  assert.equal(api.corruption(p),0);
});
test('melee infection has 40-tick pair cooldown; projectiles do not infect', () => {
  const a=entity(0), v=entity(-1,false);init(a);v.health.currentValue=1000;
  system.currentTick=2000;hit(a,v,10);near(hit(undefined,v,10,'fire').damage,10/.9);
  system.currentTick=2039;hit(a,v,10);near(hit(undefined,v,10,'fire').damage,10/.9);
  system.currentTick=2040;hit(a,v,10);near(hit(undefined,v,10,'fire').damage,10/.8);
  system.currentTick=2080;hit(a,v,10);near(hit(a,v,10).damage,14.4/.7);
  const fresh=entity(-1,false);fresh.health.currentValue=100;hit(a,fresh,1,'projectile',true);near(hit(undefined,fresh,10,'fire').damage,10);
});
test('milk clears infection and is not blocked by full-set diet', () => {
  const a=entity(0),v=entity(0);init(a);init(v);v.health.currentValue=80;system.currentTick=3000;hit(a,v,1);
  const ev={source:v,itemStack:new ItemStack('minecraft:milk_bucket'),cancel:false};beforeEvents.itemUse.emit(ev);assert.equal(ev.cancel,false);afterEvents.itemCompleteUse.emit(ev);near(hit(undefined,v,1,'fire').damage,1);
});
test('nonlethal low-HP hit cannot consume a revive', () => {const p=entity(0);init(p,1);p.health.currentValue=10;hit(undefined,p,6,'fire');flush();assert.equal(api.revives(p),1);assert.equal(p.health.currentValue,4);});
test('lethal hit revives, next queued hit still damages during recovery', () => {
  const p=entity(0);init(p,2);p.health.currentValue=5;system.currentTick=4000;assert.equal(hit(undefined,p,6,'fire').cancel,true);hit(undefined,p,8,'fire');flush();assert.equal(api.revives(p),1);assert.equal(p.health.currentValue,32);
  system.currentTick=4059;assert.equal(hit(undefined,p,2,'fire').cancel,true);flush();assert.equal(p.health.currentValue,30);
  system.currentTick=4060;assert.equal(hit(undefined,p,2,'fire').cancel,false);assert.equal(p.health.currentValue,28);
});
test('multiple same-tick lethal hits consume distinct revives; no immunity', () => {
  const p=entity(0);init(p,2);p.health.currentValue=5;system.currentTick=5000;hit(undefined,p,6,'fire');hit(undefined,p,50,'fire');hit(undefined,p,50,'fire');flush();assert.equal(api.revives(p),0);assert.equal(p.health.currentValue,0);assert.equal(api.corruption(p),2);
});
test('partial armor has no diet restriction', () => {const p=entity(0);delete p.slots.feet;const ev={source:p,itemStack:new ItemStack('minecraft:apple'),cancel:false};beforeEvents.itemUse.emit(ev);assert.equal(ev.cancel,false);});
test('full set can eat all food but keeps hunger and saturation unchanged', () => {
  const p=entity(0);init(p);p.hunger.currentValue=7;p.saturation.currentValue=1;p.health.currentValue=50;
  const stack=new ItemStack('minecraft:apple');const ev={source:p,itemStack:stack,cancel:false};beforeEvents.itemUse.emit(ev);assert.equal(ev.cancel,false);
  p.hunger.currentValue=11;p.saturation.currentValue=5;afterEvents.itemCompleteUse.emit(ev);
  assert.equal(p.hunger.currentValue,7);assert.equal(p.saturation.currentValue,1);assert.equal(p.health.currentValue,50);
  assert.equal(p.effects.nausea.duration,400);assert.equal(p.effects.blindness.duration,400);
});
test('rotten flesh is the only food that directly heals full zombie gear', () => {
  const p=entity(0);init(p);p.health.currentValue=50;p.hunger.currentValue=7;p.saturation.currentValue=1;
  const ev={source:p,itemStack:new ItemStack('minecraft:rotten_flesh'),cancel:false};beforeEvents.itemUse.emit(ev);
  p.hunger.currentValue=11;p.saturation.currentValue=5;afterEvents.itemCompleteUse.emit(ev);
  assert.equal(p.hunger.currentValue,7);assert.equal(p.saturation.currentValue,1);assert.equal(p.health.currentValue,58);
});
test('night natural healing remains a full-set zombie gear ability', () => {
  const update20=intervals.filter(([,n])=>n===20).at(-1)[0];const p=entity(0);init(p);p.health.currentValue=50;p.hunger.currentValue=12;
  update20();assert.equal(p.health.currentValue,51);
});
test('failed equipment write rolls back all slots and retains revive', () => {
  const p=entity(0);init(p,1);const get=p.getComponent.bind(p);let writes=0;
  p.getComponent=n=>{const c=get(n);if(n.endsWith('equippable')){const set=c.setEquipment;c.setEquipment=(s,i)=>++writes===2 ? false : set(s,i);}return c;};
  assert.equal(api.tryRevive(p),false);assert.equal(api.corruption(p),0);assert.equal(api.revives(p),1);
});
test('relogging with own HP boost does not restore HP80 after unequipping', () => {
  const p=entity(0);init(p);p.health.currentValue=75;afterEvents.playerLeave.emit({playerId:p.id});api.forceMaxHpState(p);delete p.slots.head;api.forceMaxHpState(p);assert.equal(p.health.effectiveMax,20);assert.equal(p.health.currentValue,20);
});
test('pre-existing external health boost is restored on removal', () => {
  const p=entity();p.addEffect('health_boost',600,{amplifier:2});equip(p,0);init(p);assert.equal(p.health.effectiveMax,80);delete p.slots.head;api.forceMaxHpState(p);assert.equal(p.health.effectiveMax,32);
});
test('infection debuffs apply once to infected mob outgoing damage', () => {
  const a=entity(0),v=entity(-1,false),target=entity(-1,false);init(a);v.health.currentValue=1000;target.health.currentValue=1000;system.currentTick=6000;
  hit(a,v,1);near(hit(v,target,10).damage,9);
  system.currentTick=6040;hit(a,v,1);near(hit(v,target,10).damage,8);
  system.currentTick=6080;hit(a,v,1);near(hit(v,target,10).damage,7);
  system.currentTick=6379;near(hit(v,target,10).damage,7);
  system.currentTick=6380;near(hit(v,target,10).damage,8);
  system.currentTick=6580;near(hit(v,target,10).damage,10);
});
test('sneak control shows progress; release cancels without eating a zombie stem cell', () => {
  const update=intervals.find(([,n])=>n===5)[0];const p=entity(0);init(p);p.selected=new ItemStack('pinematerials:zonbikansaibou');p.isSneaking=true;system.currentTick=7000;
  update();assert.equal(api.getScore(p,api.SCORE.charging),1);system.currentTick=7040;update();assert.ok(p.onScreenDisplay.text.includes('6.0'));p.isSneaking=false;update();assert.equal(api.getScore(p,api.SCORE.charging),0);assert.equal(p.selected.amount,1);
});
test('finished sneak charge needs release before another starts', () => {
  const update=intervals.find(([,n])=>n===5)[0];const p=entity(0);init(p);p.selected=new ItemStack('pinematerials:zonbikansaibou',2);p.isSneaking=true;system.currentTick=8000;update();system.currentTick=8160;api.tickChargeCompletion(p);update();assert.equal(api.revives(p),1);assert.equal(api.getScore(p,api.SCORE.charging),0);update();assert.equal(api.getScore(p,api.SCORE.charging),0);p.isSneaking=false;update();p.isSneaking=true;update();assert.equal(api.getScore(p,api.SCORE.charging),1);
});
test('full-set recovery potion restriction uses the real string effectType', () => {
  const p=entity(0);const ev={entity:p,effectType:'minecraft:regeneration',cancel:false};beforeEvents.effectAdd.emit(ev);assert.equal(ev.cancel,true);delete p.slots.feet;const partial={...ev,cancel:false};beforeEvents.effectAdd.emit(partial);assert.equal(partial.cancel,false);
});
test('milk/damage correction cannot accidentally invoke the old healing penalty', () => assert.ok(!code.includes('allowedHealMap') && !code.includes('NIGHT_BONUS') && !code.includes('REVIVE_BOOST_TICKS')));
console.log(`${checks} gameplay tests passed (API mock; not an engine test)`);

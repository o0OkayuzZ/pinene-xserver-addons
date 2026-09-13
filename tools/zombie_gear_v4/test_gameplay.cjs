const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const scriptDir = path.resolve(__dirname, '../../behavior_packs/bp_09_7c8ac348-47ad-4f71-8503-dc40a6f813f1/scripts');
let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS ' + name); }
function signal() { const callbacks = []; return { subscribe: cb => callbacks.push(cb), emit: ev => callbacks.forEach(cb => cb(ev)) }; }
const beforeEvents = Object.fromEntries(['entityHurt','entityRemove','effectAdd','itemUse','playerInteractWithBlock'].map(x => [x,signal()]));
const afterEvents = Object.fromEntries(['entityHurt','entityDie','playerLeave','playerSpawn','itemUse','itemCompleteUse','effectAdd','playerInteractWithBlock'].map(x => [x,signal()]));
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
  const e = { id: 'e'+(++uid), typeId: isPlayer ? 'minecraft:player' : 'minecraft:zombie', isValid: true, tags: new Set(), effects: {}, dynamic: {}, slots: {}, messages: [], sounds: [], fades: [], selectedSlotIndex: 0, isSneaking:true, absorption:0, nativeHits:0,
    onScreenDisplay: { setActionBar(text) { this.text = text; } },
    camera: { fade(options) { e.fades.push(options); } },
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
    triggerEvent(n) { if(n.startsWith('zombiegear:health')){this.baseHealth=n.endsWith('80')?80:20;this.health.effectiveMax=this.baseHealth+4*((this.effects.health_boost?.amplifier??-1)+1);}else this.kbEvent=n; },
    getEffect(n) { return this.effects[n]; },
    addEffect(n,d,o) { const old=this.effects[n];const ev={entity:this,effectType:n,duration:d,cancel:false};if(!old)beforeEvents.effectAdd.emit(ev);if(ev.cancel)return;this.effects[n] = { typeId:n,duration:d, ...o }; if (n === 'health_boost') this.health.effectiveMax = (this.baseHealth??20) + 4*(o.amplifier+1); if(!old)afterEvents.effectAdd.emit({entity:this,effect:this.effects[n]}); },
    removeEffect(n) { delete this.effects[n]; if (n === 'health_boost') this.health.effectiveMax = this.baseHealth??20; },
    hasTag(t) { return this.tags.has(t); }, addTag(t) { this.tags.add(t); }, removeTag(t) { this.tags.delete(t); },
    getDynamicProperty(k) { return this.dynamic[k]; }, setDynamicProperty(k,v) { this.dynamic[k] = v; },
    sendMessage(m) { this.messages.push(m); }, playSound(id,options) { this.sounds.push({id, options, target:'player'}); }, extinguishFire() {}, applyDamage(n,source) { hit(source.damagingEntity,this,n,source.cause); },
    dimension: { id:'minecraft:nether', playSound: (id,location,options) => e.sounds.push({id, location, options, target:'dimension'}) }
  };
  e.scoreboardIdentity = e.id;
  if (gearStage >= 0) equip(e,gearStage);
  if (isPlayer) players.push(e);
  return e;
}
function equip(e,n) { for (const [s,p] of Object.entries({head:'helmet',chest:'chestplate',legs:'leggings',feet:'boots'})) e.slots[s] = new ItemStack('zombiegear:zombie_'+p+(n ? '_c'+n : '')); }
function hit(attacker,victim,n,cause='entityAttack', projectile=false) {
  const previousHp=victim.health.currentValue;
  victim.health.currentValue=previousHp-n;
  const ev = { hurtEntity:victim, damage:n, cancel:false, damageSource:{cause,damagingEntity:attacker,damagingProjectile:projectile ? {} : undefined} };
  beforeEvents.entityHurt.emit(ev);
  if (!ev.cancel) { victim.nativeHits++;const absorbed=Math.min(victim.absorption,ev.damage);victim.absorption-=absorbed; victim.health.currentValue = Math.max(0,previousHp-ev.damage+absorbed); afterEvents.entityHurt.emit(ev); }
  else victim.health.currentValue=previousHp;
  return ev;
}
const sandbox = { world, system, ItemStack, EquipmentSlot, EntityDamageCause, console: {info(){},warn:m=>warnings.push(m),error:m=>warnings.push(m)} };
vm.createContext(sandbox);
const code = ['rules.js','effects.js','diet.js','knockback.js','combat.js','controls.js','main.js'].map(f => fs.readFileSync(path.join(scriptDir,f),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'')).join('\n');
vm.runInContext(code + '\nglobalThis.api={infectionAt,damageMultiplier,corruption,revives,tryRevive,initializePlayer,forceMaxHpState,createArmorVariantItem,setCorruption,tickChargeCompletion,getScore,setScore,SCORE,beginCharge,syncStrengthBoost,reviveCap,knockback};',sandbox);
flush();
const api = sandbox.api;
const near = (actual, expected) => assert.ok(Math.abs(actual-expected)<1e-8, `${actual} != ${expected}`);
function init(e,n=0) { api.initializePlayer(e); api.setScore(e,api.SCORE.revives,n); api.forceMaxHpState(e); }

test('corruption damage multiplier excludes the zombie gear strength slot bonus', () => {
  [1,1.1,1.3,1.7,2.5].forEach((n,i)=>near(api.damageMultiplier(i,0,0,true),n));
  [1,1.1,1.3,1.7,2.5].forEach((n,i)=>near(api.damageMultiplier(i,0,0,false),n));
});
test('infection attack/defense and c4 severe product', () => {
  [1,.9,.8,.7].forEach((n,i)=>{near(api.damageMultiplier(-1,i,0,false),n);near(api.damageMultiplier(-1,0,i,false),1/n);});
  near(api.damageMultiplier(4,0,3,true),3/.7);
  near(api.damageMultiplier(4,3,3,true),3);
});
test('infection decay boundaries 10/15/20/25 seconds', () => {
  for (const [tick,n] of [[0,3],[200,3],[299,3],[300,2],[399,2],[400,1],[499,1],[500,0]]) assert.equal(api.infectionAt({stage:3,lastHit:0},tick),n);
});
test('HP80 full / HP20 partial / no boost removal for unrelated player', () => {
  const p=entity(0);init(p);assert.equal(p.health.effectiveMax,80);p.health.currentValue=75;delete p.slots.head;api.forceMaxHpState(p);assert.equal(p.health.currentValue,20);
  const other=entity();other.addEffect('health_boost',600,{amplifier:2});api.forceMaxHpState(other);assert.equal(other.health.effectiveMax,32);
});
test('one-time legacy charge migration keeps item IDs', () => {
  const p=entity(3);api.initializePlayer(p);assert.equal(api.revives(p),1);assert.equal(api.corruption(p),3);api.setScore(p,api.SCORE.revives,1);api.initializePlayer(p);assert.equal(api.revives(p),1);
});
test('four revives consume resources and advance all four stages', () => {
  const p=entity(0);init(p,4);
  for(let i=1;i<=4;i++){assert.equal(api.tryRevive(p),true);assert.equal(api.corruption(p),i);assert.equal(api.revives(p),4-i);}
  assert.equal(api.tryRevive(p),false);
  assert.equal(Object.keys(p.effects).sort().join(','),'speed');
  assert.equal(p.effects.speed.duration,60);assert.equal(p.effects.speed.amplifier,1);
});
test('c4 stock clamps to zero and cannot revive',()=>{const p=entity(4);init(p,4);assert.equal(api.revives(p),0);assert.equal(api.tryRevive(p),false);});
test('revive uses visible red flash and layered local revive sounds', () => {
  const p=entity(0);init(p,1);assert.ok(api.tryRevive(p));
  assert.equal(p.fades.length,1);
  assert.equal(p.fades[0].fadeTime.holdTime,0);
  assert.ok(p.fades[0].fadeTime.fadeOutTime >= 2);
  assert.ok(p.fades[0].fadeColor.red < 0.7);
  const ids=p.sounds.map(s=>s.id);
  assert.ok(ids.filter(id=>id==='mob.warden.heartbeat').length >= 4);
  assert.ok(ids.filter(id=>id==='mob.zombie.say').length >= 4);
  assert.ok(ids.includes('mob.zombie.death'));
  assert.ok(ids.includes('random.totem'));
  assert.ok(p.sounds.some(s=>s.target==='player'));
  assert.ok(p.sounds.some(s=>s.target==='dimension'));
});
test('mixed stages use minimum C without rewriting, successful revive normalizes',()=>{
 const p=entity(4);p.slots.feet=new ItemStack('zombiegear:zombie_boots_c1');init(p,4);
 assert.equal(api.corruption(p),1);assert.equal(api.revives(p),3);assert.equal(p.slots.head.typeId,'zombiegear:zombie_helmet_c4');
 assert.ok(api.tryRevive(p));assert.equal(api.corruption(p),2);assert.equal(api.revives(p),2);
 assert.ok(Object.values(p.slots).every(i=>i.typeId.endsWith('_c2')));
});
test('swap preserves durability enchantments name lore locks and dynamic properties', () => {
  const p=entity(0);init(p,1);Object.assign(p.slots.head,{nameTag:'Named',lore:['Lore'],keepOnDeath:true,lockMode:'slot',dynamic:{'test:value':42},enchantments:[{type:'protection',level:2}],destroy:['stone'],place:['dirt']});p.slots.head.durability.damage=47;
  assert.ok(api.tryRevive(p));const i=p.slots.head;assert.equal(i.durability.damage,47);assert.equal(i.nameTag,'Named');assert.deepEqual(i.lore,['Lore']);assert.equal(i.keepOnDeath,true);assert.equal(i.lockMode,'slot');assert.equal(i.dynamic['test:value'],42);assert.equal(i.enchantments[0].level,2);assert.deepEqual(i.destroy,['stone']);
});
test('using a zombie stem cell alone does not start or complete a charge', () => {
  const p=entity(0);init(p);p.selected=new ItemStack('pinematerials:zonbikansaibou',1);system.currentTick=1000;afterEvents.itemUse.emit({source:p,itemStack:p.selected});assert.equal(api.getScore(p,api.SCORE.charging),0);system.currentTick=1160;api.tickChargeCompletion(p);assert.equal(api.revives(p),0);assert.equal(p.selected.amount,1);
});
test('8-second sneak charge consumes one zombie stem cell only at completion, keeps c0', () => {
  const p=entity(0);init(p);p.selected=new ItemStack('pinematerials:zonbikansaibou',1);system.currentTick=1000;api.beginCharge(p);assert.equal(p.selected.amount,1);system.currentTick=1159;api.tickChargeCompletion(p);assert.equal(api.revives(p),0);system.currentTick=1160;api.tickChargeCompletion(p);assert.equal(api.revives(p),1);assert.equal(p.selected,undefined);assert.equal(api.corruption(p),0);
});
test('four single-stack zombie stem cells can fill all four revive charges', () => {
  const p=entity(0);init(p);
  for (let i=1;i<=4;i++) { p.selected=new ItemStack('pinematerials:zonbikansaibou',1);system.currentTick=10000+i*200;api.beginCharge(p);system.currentTick+=160;api.tickChargeCompletion(p);assert.equal(api.revives(p),i);assert.equal(p.selected,undefined); }
  assert.equal(api.corruption(p),0);
});
test('melee infection has 40-tick pair cooldown; projectiles do not infect', () => {
  const a=entity(0), v=entity(-1,false);init(a);v.health.currentValue=1000;
  system.currentTick=2000;hit(a,v,10);near(hit(undefined,v,10,'fire').damage,10/.9);
  system.currentTick=2039;hit(a,v,10);near(hit(undefined,v,10,'fire').damage,10/.9);
  system.currentTick=2040;hit(a,v,10);near(hit(undefined,v,10,'fire').damage,10/.8);
  system.currentTick=2080;hit(a,v,10);near(hit(a,v,10).damage,12/.7);
  const fresh=entity(-1,false);fresh.health.currentValue=100;hit(a,fresh,1,'projectile',true);near(hit(undefined,fresh,10,'fire').damage,10);
});
test('milk clears infection and is not blocked by full-set diet', () => {
  const a=entity(0),v=entity(0);init(a);init(v);v.health.currentValue=80;system.currentTick=3000;hit(a,v,1);
  const ev={source:v,itemStack:new ItemStack('minecraft:milk_bucket'),cancel:false};beforeEvents.itemUse.emit(ev);assert.equal(ev.cancel,false);afterEvents.itemCompleteUse.emit(ev);near(hit(undefined,v,1,'fire').damage,1);
});
test('nonlethal low-HP hit cannot consume a revive', () => {const p=entity(0);init(p,1);p.health.currentValue=10;hit(undefined,p,6,'fire');flush();assert.equal(api.revives(p),1);assert.equal(p.health.currentValue,4);});
test('lethal hit revives, next queued hit still damages during recovery', () => {
  const p=entity(0);init(p,2);p.health.currentValue=5;system.currentTick=4000;assert.equal(hit(undefined,p,6,'fire').cancel,true);hit(undefined,p,8,'fire');flush();assert.equal(api.revives(p),1);assert.equal(p.health.currentValue,32);
  system.currentTick=4059;assert.equal(hit(undefined,p,2,'fire').cancel,false);flush();assert.equal(p.health.currentValue,30);
  system.currentTick=4060;assert.equal(hit(undefined,p,2,'fire').cancel,false);assert.equal(p.health.currentValue,28);
});
test('multiple same-tick lethal hits consume distinct revives; native remainder', () => {
  const p=entity(0);init(p,2);p.health.currentValue=5;system.currentTick=5000;hit(undefined,p,6,'fire');hit(undefined,p,50,'fire');hit(undefined,p,50,'fire');flush();flush();assert.equal(api.revives(p),0);assert.equal(p.health.currentValue,0);assert.equal(api.corruption(p),2);
});
test('post-hurt and death cannot consume stock on a dead entity',()=>{
 const p=entity(0);init(p,1);p.health.currentValue=0;
 afterEvents.entityHurt.emit({hurtEntity:p,damage:999,damageSource:{cause:'addon_magic'}});
 afterEvents.entityDie.emit({deadEntity:p,damageSource:{cause:'addon_void'}});flush();
 assert.equal(api.revives(p),1);assert.equal(api.corruption(p),0);assert.equal(p.health.currentValue,0);
 assert.equal(api.tryRevive(p),false);
});
test('partial armor has no diet restriction', () => {const p=entity(0);delete p.slots.feet;const ev={source:p,itemStack:new ItemStack('minecraft:apple'),cancel:false};beforeEvents.itemUse.emit(ev);assert.equal(ev.cancel,false);});
test('full set normal food keeps hunger and saturation unchanged but allows item buffs', () => {
  const p=entity(0);init(p);p.hunger.currentValue=7;p.saturation.currentValue=1;p.health.currentValue=50;
  const stack=new ItemStack('minecraft:apple');const ev={source:p,itemStack:stack,cancel:false};beforeEvents.itemUse.emit(ev);assert.equal(ev.cancel,false);
  p.hunger.currentValue=11;p.saturation.currentValue=5;afterEvents.itemCompleteUse.emit(ev);
  assert.equal(p.hunger.currentValue,7);assert.equal(p.saturation.currentValue,1);assert.equal(p.health.currentValue,50);
  assert.equal(p.effects.nausea,undefined);assert.equal(p.effects.blindness,undefined);
});
test('rotten flesh is the only food that directly heals full zombie gear', () => {
  const p=entity(0);init(p);p.health.currentValue=50;p.hunger.currentValue=7;p.saturation.currentValue=1;
  const ev={source:p,itemStack:new ItemStack('minecraft:rotten_flesh'),cancel:false};beforeEvents.itemUse.emit(ev);
  p.hunger.currentValue=11;p.saturation.currentValue=5;afterEvents.itemCompleteUse.emit(ev);
  assert.equal(p.hunger.currentValue,11);assert.equal(p.saturation.currentValue,5);assert.equal(p.health.currentValue,58);assert.equal(p.effects.nausea,undefined);assert.equal(p.effects.blindness,undefined);
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

test('full zombie gear manages strength in the potion slot and adds one level', () => {
  const p=entity(0);init(p);api.syncStrengthBoost(p,true);assert.equal(p.effects.strength.amplifier,0);
  const q=entity();q.addEffect('strength',500,{amplifier:1});equip(q,0);init(q);api.syncStrengthBoost(q,true);assert.equal(q.effects.strength.amplifier,2);
  delete q.slots.head;api.syncStrengthBoost(q,false);assert.equal(q.effects.strength.amplifier,1);
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
  const update=intervals.find(([,n])=>n===5)[0];const p=entity(0);init(p);p.selected=new ItemStack('pinematerials:zonbikansaibou',1);p.isSneaking=true;system.currentTick=8000;update();system.currentTick=8160;api.tickChargeCompletion(p);update();assert.equal(api.revives(p),1);assert.equal(api.getScore(p,api.SCORE.charging),0);update();assert.equal(api.getScore(p,api.SCORE.charging),0);p.isSneaking=false;update();p.selected=new ItemStack('pinematerials:zonbikansaibou',1);p.isSneaking=true;update();assert.equal(api.getScore(p,api.SCORE.charging),1);
});
test('full-set recovery potion restriction allows absorption but blocks regeneration and instant health', () => {
  const p=entity(0);const regen={entity:p,effectType:'minecraft:regeneration',cancel:false};beforeEvents.effectAdd.emit(regen);assert.equal(regen.cancel,true);
  const instant={entity:p,effectType:'minecraft:instant_health',cancel:false};beforeEvents.effectAdd.emit(instant);assert.equal(instant.cancel,true);
  const absorption={entity:p,effectType:'minecraft:absorption',cancel:false};beforeEvents.effectAdd.emit(absorption);assert.equal(absorption.cancel,false);
  p.addEffect('absorption',200,{amplifier:1});const update20=intervals.filter(([,n])=>n===20).at(-1)[0];update20();assert.equal(p.effects.absorption.amplifier,1);
  delete p.slots.feet;const partial={entity:p,effectType:'minecraft:regeneration',cancel:false};beforeEvents.effectAdd.emit(partial);assert.equal(partial.cancel,false);
});
test('milk/damage correction cannot accidentally invoke the old healing penalty', () => assert.ok(!code.includes('allowedHealMap') && !code.includes('NIGHT_BONUS') && !code.includes('REVIVE_BOOST_TICKS')));
test('all reverse transitions work even at current revive cap',()=>{
 const p=entity(4);init(p,0);
 for(let stage=3;stage>=0;stage--){p.selected=new ItemStack('pinematerials:zonbikansaibou');system.currentTick+=500;api.beginCharge(p);system.currentTick+=160;api.tickChargeCompletion(p);assert.equal(api.corruption(p),stage);assert.equal(api.revives(p),4-stage);assert.equal(p.selected,undefined);}
});
test('charge aborts on held slot change, release, or equipment change',()=>{
 for(const change of [p=>p.selectedSlotIndex++,p=>p.isSneaking=false,p=>p.slots.head=new ItemStack('zombiegear:zombie_helmet_c2')]){
 const p=entity(1);init(p,1);p.selected=new ItemStack('pinematerials:zonbikansaibou');system.currentTick+=500;api.beginCharge(p);change(p);system.currentTick+=160;api.tickChargeCompletion(p);assert.equal(api.revives(p),1);assert.equal(p.selected.amount,1);}
});
test('environmental damage allows charge; attacker damage cancels it',()=>{
 for(const cause of ['fall','drowning','fire','fireTick']) { const p=entity(0);init(p);p.health.currentValue=80;p.selected=new ItemStack('pinematerials:zonbikansaibou');system.currentTick+=500;api.beginCharge(p);hit(undefined,p,1,cause);assert.equal(api.getScore(p,api.SCORE.combatEnd),0);assert.equal(api.getScore(p,api.SCORE.charging),1); }
 const p=entity(0),attacker=entity(-1,false);init(p);p.selected=new ItemStack('pinematerials:zonbikansaibou');api.beginCharge(p);hit(attacker,p,1);assert.equal(api.getScore(p,api.SCORE.charging),0);
});
test('native damage and absorption remain active during recovery',()=>{
 const p=entity(0);init(p,2);p.health.currentValue=5;hit(undefined,p,10,'fire');flush();
 p.absorption=8;const native=p.nativeHits;assert.equal(hit(undefined,p,6,'fire').cancel,false);assert.equal(p.health.currentValue,40);assert.equal(p.absorption,2);assert.equal(p.nativeHits,native+1);
});
test('all native KB stages and mixed C1 select one group',()=>{
 [0,.1,.2,.3].forEach(()=>{});
 for(let c=0;c<=4;c++){const p=entity(c);init(p);api.knockback.sync(p);assert.equal(p.kbEvent,'zombiegear:kb_c'+c);near(api.knockback.resistance(p),[.4,.56,.72,.88,1][c]);}
 const p=entity(4);p.slots.feet=new ItemStack('zombiegear:zombie_boots_c1');api.knockback.sync(p);assert.equal(p.kbEvent,'zombiegear:kb_c1');
});
test('native silent Strength replacement is observed and restored',()=>{
 const p=entity(0);init(p);api.syncStrengthBoost(p,true);p.addEffect('strength',600,{amplifier:1});flush();api.syncStrengthBoost(p,true);assert.equal(p.effects.strength.amplifier,2);delete p.slots.head;api.syncStrengthBoost(p,false);assert.equal(p.effects.strength.amplifier,1);
});
test('equal amplifier 14 external Health Boost is preserved',()=>{
 const p=entity();p.addEffect('health_boost',600,{amplifier:14});equip(p,0);init(p);delete p.slots.head;api.forceMaxHpState(p);assert.equal(p.effects.health_boost.amplifier,14);
 const q=entity(0);init(q);q.addEffect('health_boost',500,{amplifier:2});flush();api.forceMaxHpState(q);assert.equal(q.health.effectiveMax,80);delete q.slots.head;api.forceMaxHpState(q);assert.equal(q.effects.health_boost.amplifier,2);
});
test('cake restores hunger/saturation through block interaction',()=>{
 const p=entity(0);init(p);p.hunger.currentValue=8;p.saturation.currentValue=2;
 beforeEvents.playerInteractWithBlock.emit({player:p,block:{typeId:'minecraft:cake'}});p.hunger.currentValue=10;p.saturation.currentValue=3;
 afterEvents.playerInteractWithBlock.emit({player:p,block:{typeId:'minecraft:cake'}});assert.equal(p.hunger.currentValue,8);assert.equal(p.saturation.currentValue,2);
});
test('failed cleanse rolls back mixed originals and does not consume cell',()=>{
 const p=entity(3);init(p,1);p.slots.head=new ItemStack('zombiegear:zombie_helmet_c4');p.selected=new ItemStack('pinematerials:zonbikansaibou');system.currentTick+=500;api.beginCharge(p);
 const get=p.getComponent.bind(p);let writes=0;p.getComponent=n=>{const c=get(n);if(n.endsWith('equippable')){const set=c.setEquipment;c.setEquipment=(s,i)=>++writes===3?false:set(s,i);}return c;};
 system.currentTick+=160;api.tickChargeCompletion(p);assert.equal(api.revives(p),1);assert.equal(p.selected.amount,1);assert.equal(p.slots.head.typeId,'zombiegear:zombie_helmet_c4');assert.equal(api.corruption(p),3);
});
test('legacy health ownership restores saved external boost even when loading unequipped',()=>{
 const p=entity();p.addEffect('health_boost',600,{amplifier:14});p.dynamic['zombiegear:health_boost_owned']=true;
 p.dynamic['zombiegear:prior_health_boost']=JSON.stringify({amplifier:2,end:Date.now()+20000});
 api.forceMaxHpState(p);assert.equal(p.effects.health_boost.amplifier,2);assert.equal(p.health.effectiveMax,32);
 assert.equal(p.dynamic['zombiegear:health_boost_owned'],undefined);
});
test('localized Japanese effect names block healing without blocking absorption',()=>{
 const p=entity(0);for(const name of ['再生能力 II','即時回復 II']){const e={entity:p,effectType:name,cancel:false};beforeEvents.effectAdd.emit(e);assert.equal(e.cancel,true);}
 const e={entity:p,effectType:'衝撃吸収 II',cancel:false};beforeEvents.effectAdd.emit(e);assert.equal(e.cancel,false);
});
test('removed native effect objects are harmless in deferred after events',()=>{
 const p=entity(0);init(p);const effect={get typeId(){throw Error('Removed native effect');}};
 assert.doesNotThrow(()=>afterEvents.effectAdd.emit({entity:p,effect}));
});
test('native flesh nutrition survives either side of the completion event',()=>{
 const tickDiet=intervals.find(([,n])=>n===1)[0];
 for(const nutritionFirst of [true,false]){
  const p=entity(0);init(p);p.hunger.currentValue=7;p.saturation.currentValue=1;
  const e={source:p,itemStack:new ItemStack('minecraft:rotten_flesh')};beforeEvents.itemUse.emit(e);
  if(nutritionFirst){p.hunger.currentValue=11;p.saturation.currentValue=1.8;tickDiet();}
  afterEvents.itemCompleteUse.emit(e);
  if(!nutritionFirst){p.hunger.currentValue=11;p.saturation.currentValue=1.8;}
  system.currentTick++;tickDiet();system.currentTick++;tickDiet();
  assert.equal(p.hunger.currentValue,11);assert.equal(p.saturation.currentValue,1.8);
 }
});
test('holding flesh without completing consumption cannot authorize food gains',()=>{
 const tickDiet=intervals.find(([,n])=>n===1)[0],p=entity(0);init(p);p.hunger.currentValue=7;p.saturation.currentValue=1;
 beforeEvents.itemUse.emit({source:p,itemStack:new ItemStack('minecraft:rotten_flesh')});
 p.hunger.currentValue=11;p.saturation.currentValue=2;tickDiet();system.currentTick++;tickDiet();
 assert.equal(p.hunger.currentValue,7);assert.equal(p.saturation.currentValue,1);
});
test('C2 C3 C4 C2 remains a full set at minimum C2 without passive conversion',()=>{
 const p=entity(2);p.slots.chest=new ItemStack('zombiegear:zombie_chestplate_c3');p.slots.legs=new ItemStack('zombiegear:zombie_leggings_c4');init(p,4);
 assert.equal(api.corruption(p),2);assert.equal(api.revives(p),2);assert.equal(p.health.effectiveMax,80);
 assert.equal(p.slots.chest.typeId,'zombiegear:zombie_chestplate_c3');assert.equal(p.slots.legs.typeId,'zombiegear:zombie_leggings_c4');
});
console.log(`${checks} gameplay tests passed (API mock; not an engine test)`);

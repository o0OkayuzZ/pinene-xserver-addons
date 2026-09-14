// Runs only inside a disposable test world.
import { world, system, ItemStack, EquipmentSlot, EntityDamageCause, EffectTypes, EnchantmentTypes } from "@minecraft/server";
import { corruption, revives, tryRevive, setScore, SCORE, forceMaxHpState, syncStrengthBoost, knockback, combat } from "./main.js";
const report = (name, actual, expected) => console.warn(`[ZG-FINAL] ${Math.abs(actual-expected)<0.001 ? "PASS" : "FAIL"} ${name}: actual=${actual} expected=${expected}`);
const pause = ticks => new Promise(resolve => system.runTimeout(resolve, ticks));
let started = false;
world.afterEvents.playerSpawn.subscribe(ev => {
  if (started) return; started = true;
  system.runTimeout(async () => {
    const p = ev.player;
    try {
      p.runCommand("gamemode survival @s");p.runCommand("time set midnight");
      p.runCommand("gamerule naturalregeneration false");p.runCommand("gamerule keepinventory true");
      console.warn(`[ZG-EFFECT-NAMES] ${EffectTypes.getAll().map(e=>e.getName()).join(',')}`);
      p.teleport({x:0,y:-59,z:0});
      const eq=p.getComponent("minecraft:equippable"),hp=p.getComponent("minecraft:health");
      const slots=[[EquipmentSlot.Head,"helmet"],[EquipmentSlot.Chest,"chestplate"],[EquipmentSlot.Legs,"leggings"],[EquipmentSlot.Feet,"boots"]];
      function equip(stages) {
        slots.forEach(([slot,part],i)=>eq.setEquipment(slot,new ItemStack(`zombiegear:zombie_${part}${stages[i] ? '_c'+stages[i] : ''}`)));
        forceMaxHpState(p);knockback.sync(p);
      }
      equip([0,0,0,0]);p.getComponent("minecraft:player.hunger").setCurrentValue(5);
      await pause(3);p.removeEffect('regeneration');hp.setCurrentValue(40);p.addEffect('instant_health',1,{amplifier:1});p.addEffect('regeneration',200,{amplifier:1});await pause(2);
      report('instant health blocked',hp.currentValue,40);report('regeneration blocked',p.getEffect('regeneration')?1:0,0);
      await pause(25);report("HP80",hp.effectiveMax,80);report("armor11",eq.totalArmor,11);
      // Each target is fresh, so infection from a previous hit cannot skew damage.
      equip([4,4,4,4]);
      for (const cause of [EntityDamageCause.entityAttack,EntityDamageCause.projectile,
          EntityDamageCause.fireTick,EntityDamageCause.entityExplosion,EntityDamageCause.magic,EntityDamageCause.override]) {
        const target=p.dimension.spawnEntity('minecraft:pig',{x:5,y:-59,z:0});
        const targetHP=target.getComponent('minecraft:health');const before=targetHP.currentValue;
        target.applyDamage(2,{cause,damagingEntity:p});await pause(1);
        report(`C4 source ${cause} HP loss`,before-targetHP.currentValue,cause===EntityDamageCause.entityAttack?5:2);
        report(`C4 source ${cause} infection`,combat.infectionStage(target),cause===EntityDamageCause.entityAttack?1:0);
        target.remove();
      }
      equip([0,0,0,0]);
      const b=world.beforeEvents.entityHurt.subscribe(e=>{if(e.hurtEntity.id===p.id)console.warn(`[ZG-FINAL] BEFORE damage=${e.damage} hp=${hp.currentValue} cancel=${e.cancel} cause=${e.damageSource.cause}`);});
      const a=world.afterEvents.entityHurt.subscribe(e=>{if(e.hurtEntity.id===p.id)console.warn(`[ZG-FINAL] AFTER damage=${e.damage} hp=${hp.currentValue}`);});
      setScore(p,SCORE.revives,0);hp.setCurrentValue(80);
      p.applyDamage(10,{cause:EntityDamageCause.entityAttack});await pause(25);
      console.warn(`[ZG-FINAL] armor probe native HP loss=${80-hp.currentValue}`);
      p.addEffect("absorption",600,{amplifier:1});hp.setCurrentValue(80);
      p.applyDamage(6,{cause:EntityDamageCause.override});await pause(25);
      console.warn(`[ZG-FINAL] absorption probe native HP loss=${80-hp.currentValue}`);
      p.removeEffect("absorption");setScore(p,SCORE.revives,4);hp.setCurrentValue(5);
      p.applyDamage(10,{cause:EntityDamageCause.override});await pause(3);
      report("lethal stock3",revives(p),3);report("lethal C1",corruption(p),1);report("revive HP40",hp.currentValue,40);
      await pause(22);p.addEffect("absorption",600,{amplifier:1});hp.setCurrentValue(40);
      p.applyDamage(6,{cause:EntityDamageCause.override});await pause(3);
      report("recovery absorption protects HP",hp.currentValue,40);report("recovery native stock unchanged",revives(p),3);
      await pause(22);p.removeEffect("absorption");p.addEffect("absorption",600,{amplifier:1});hp.setCurrentValue(2);
      p.applyDamage(6,{cause:EntityDamageCause.override});await pause(3);
      report("absorption prevents false lethal revive",revives(p),3);report("absorbed low HP hit",hp.currentValue,2);
      p.removeEffect("absorption");hp.setCurrentValue(40);
      p.addEffect("strength",600,{amplifier:1});await pause(5);report("external Strength II + gear III",p.getEffect("strength")?.amplifier ?? -1,2);
      eq.setEquipment(EquipmentSlot.Head,undefined);syncStrengthBoost(p,false);forceMaxHpState(p);
      report("restore Strength II",p.getEffect("strength")?.amplifier ?? -1,1);
      p.addEffect("health_boost",600,{amplifier:14});equip([0,0,0,0]);eq.setEquipment(EquipmentSlot.Head,undefined);forceMaxHpState(p);
      report("restore external health boost14",p.getEffect("health_boost")?.amplifier ?? -1,14);
      p.removeEffect("health_boost");equip([4,4,4,1]);setScore(p,SCORE.revives,4);await pause(2);
      report("mixed minimum1",corruption(p),1);report("mixed cap3",revives(p),3);
      equip([4,4,4,4]);await pause(2);report("C4 stock0",revives(p),0);
      equip([0,0,0,0]);setScore(p,SCORE.revives,4);
      for(let i=1;i<=4;i++){report(`revive transition C${i}`,tryRevive(p)?corruption(p):-1,i);report(`revive stock ${4-i}`,revives(p),4-i);}
      report("fifth denied",tryRevive(p)?1:0,0);
      // Native knockback baseline and all configured resistances, without recovery.
      await pause(80);
      p.runCommand('difficulty normal');
      const results=[];
      for (const c of [-1,0,1,2,3,4,5]) {
        if(c===-1){for(const [slot] of slots)eq.setEquipment(slot,undefined);forceMaxHpState(p);knockback.sync(p);}
        else equip(c===5?[4,4,4,1]:[c,c,c,c]);
        setScore(p,SCORE.revives,0);await pause(25);
        if(c===-1)report('native unequipped HP20',hp.effectiveMax,20);
        p.teleport({x:0,y:-63,z:0});p.clearVelocity();hp.setCurrentValue(hp.effectiveMax);
        const zombie=p.dimension.spawnEntity('minecraft:zombie',{x:1.5,y:-63,z:0});
        let attacked=false;
        const attack=world.afterEvents.entityHurt.subscribe(e=>{if(e.hurtEntity.id===p.id&&e.damageSource.damagingEntity?.id===zombie.id)attacked=true;});
        for(let t=0;t<150&&!attacked;t++)await pause(1);
        const origin={...p.location};let distance=0,vertical=0;
        if(zombie.isValid)zombie.remove();
        for(let t=0;t<12;t++){await pause(1);distance=Math.max(distance,Math.hypot(p.location.x,p.location.z));vertical=Math.max(vertical,p.location.y+63);}
        world.afterEvents.entityHurt.unsubscribe(attack);results.push({c,attacked,distance,vertical,origin});
      }
      p.runCommand('difficulty peaceful');console.warn(`[ZG-KB-PROBE] ${JSON.stringify(results)}`);
      report('native melee baseline moves',results[0].distance>0.1?1:0,1);
      report('native C4 immune',results[5].attacked&&results[5].distance<0.05?1:0,1);
      const baseline=Math.hypot(results[0].origin.x,results[0].origin.z);
      for(let i=1;i<results.length;i++){
        const measured=1-Math.hypot(results[i].origin.x,results[i].origin.z)/baseline;
        report(`native measured KB ${results[i].c===5?'mixed C1':'C'+results[i].c}`,measured,[.4,.56,.72,.88,1,.56][i-1]);
      }
      equip([0,0,0,0]);p.addEffect("health_boost",500,{amplifier:2});await pause(5);
      report("mid-gear external health boost HP80",hp.effectiveMax,80);
      eq.setEquipment(EquipmentSlot.Head,undefined);forceMaxHpState(p);
      report("mid-gear external health boost restored",p.getEffect("health_boost")?.amplifier??-1,2);
      equip([4,4,4,4]);
      world.beforeEvents.entityHurt.unsubscribe(b);world.afterEvents.entityHurt.unsubscribe(a);
      p.runCommand("give @s pinematerials:zonbikansaibou 8");p.runCommand("give @s minecraft:milk_bucket");
      p.sendMessage("[ZG FINAL] Engine probes complete. Check log; sneak with stem cells to cleanse.");
      console.warn("[ZG-FINAL] DONE");
      // Interactive native food probes: hold use through apple and rotten flesh,
      // then use the cake directly in front. No synthetic completion events.
      eq.setEquipment(EquipmentSlot.Head,undefined);forceMaxHpState(p);await pause(2);
      p.getComponent('minecraft:player.hunger').setCurrentValue(5);
      p.getComponent('minecraft:player.saturation').setCurrentValue(1);
      equip([0,0,0,0]);await pause(2);hp.setCurrentValue(40);
      p.teleport({x:0,y:-63,z:0},{rotation:{x:25,y:0}});
      const inventory=p.getComponent('minecraft:inventory').container;
      p.selectedSlotIndex=0;inventory.setItem(0,new ItemStack('minecraft:apple'));
      let phase='apple',foodBefore;
      const nutrition=()=>[p.getComponent('minecraft:player.hunger').currentValue,p.getComponent('minecraft:player.saturation').currentValue];
      const beforeFood=world.beforeEvents.itemUse.subscribe(e=>{if(e.source.id===p.id)foodBefore={nutrition:nutrition(),hp:hp.currentValue};});
      const afterFood=world.afterEvents.itemCompleteUse.subscribe(e=>{
        if(e.source.id!==p.id||!foodBefore)return;
        const n=nutrition();
        if(phase==='apple'&&e.itemStack.typeId==='minecraft:apple'){
          report('native apple hunger unchanged',n[0],foodBefore.nutrition[0]);report('native apple saturation unchanged',n[1],foodBefore.nutrition[1]);
          phase='rotten';system.run(()=>{hp.setCurrentValue(40);for(const [slot]of slots){const item=eq.getEquipment(slot);item.getComponent('minecraft:durability').damage=100;eq.setEquipment(slot,item);}inventory.setItem(0,new ItemStack('minecraft:rotten_flesh'));});
        }else if(phase==='rotten'&&e.itemStack.typeId==='minecraft:rotten_flesh'){
          report('native rotten HP8',hp.currentValue-foodBefore.hp,8);
          const initial=foodBefore.nutrition[0];
          phase='cake';system.run(()=>{
            report('native rotten hunger gain',nutrition()[0]-initial,4);
            const helmet=eq.getEquipment(EquipmentSlot.Head),durability=helmet.getComponent('minecraft:durability');
            report('native rotten repair10%',durability.damage,100-Math.ceil(durability.maxDurability*.1));
            inventory.setItem(0,undefined);p.dimension.getBlock({x:0,y:-63,z:2}).setType('minecraft:cake');p.sendMessage('[ZG FINAL] Use the cake in front.');
          });
        }
      });
      let cakeBefore;
      const beforeCake=world.beforeEvents.playerInteractWithBlock.subscribe(e=>{if(e.player.id===p.id&&e.block.typeId==='minecraft:cake')cakeBefore=nutrition();});
      const afterCake=world.afterEvents.playerInteractWithBlock.subscribe(e=>{
        if(e.player.id!==p.id||phase!=='cake'||!cakeBefore)return;
        report('native cake hunger unchanged',nutrition()[0],cakeBefore[0]);report('native cake saturation unchanged',nutrition()[1],cakeBefore[1]);
        console.warn('[ZG-FOOD] DONE');phase='done';
        system.run(()=>{for(const [slot]of slots){const item=eq.getEquipment(slot);item.getComponent('minecraft:enchantable').addEnchantment({type:EnchantmentTypes.get('protection'),level:1});eq.setEquipment(slot,item);}p.sendMessage('[ZG FINAL] Enchanted armor ready for glint check.');});
        world.beforeEvents.itemUse.unsubscribe(beforeFood);world.afterEvents.itemCompleteUse.unsubscribe(afterFood);
        world.beforeEvents.playerInteractWithBlock.unsubscribe(beforeCake);world.afterEvents.playerInteractWithBlock.unsubscribe(afterCake);
      });
      p.sendMessage('[ZG FINAL] FOOD READY: hold use to eat apple, then rotten flesh.');console.warn('[ZG-FOOD] READY');
    } catch(error) { console.error(`[ZG-FINAL] ERROR ${error.stack ?? error}`); }
  },100);
});

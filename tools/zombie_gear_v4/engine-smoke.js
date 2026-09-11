// Copy into the isolated test pack only; production does not import this file.
import { world, system, ItemStack, EquipmentSlot, EntityDamageCause } from "@minecraft/server";
import { corruption, revives, tryRevive, setScore, SCORE, forceMaxHpState } from "./main.js";
const report = (name, actual, expected) => console.warn(`[ZG-ENGINE] ${Math.abs(actual-expected)<0.001 ? "PASS" : "FAIL"} ${name}: actual=${actual} expected=${expected}`);
const pause = ticks => new Promise(resolve => system.runTimeout(() => resolve(undefined), ticks));
let started = false;
world.afterEvents.playerSpawn.subscribe(ev => {
  if (started) return;
  started = true;
  system.runTimeout(async () => {
    const p = ev.player;
    try {
      p.runCommand("gamemode survival @s");
      p.runCommand("time set midnight");
      p.runCommand("gamerule naturalregeneration false");
      p.runCommand("gamerule keepinventory true");
      p.teleport({x:0,y:-60,z:0});
      const eq=p.getComponent("minecraft:equippable");
      /** @type {[EquipmentSlot, string][]} */
      const slots=[[EquipmentSlot.Head,"helmet"],[EquipmentSlot.Chest,"chestplate"],[EquipmentSlot.Legs,"leggings"],[EquipmentSlot.Feet,"boots"]];
      for (const [slot,part] of slots) eq.setEquipment(slot,new ItemStack(`zombiegear:zombie_${part}`));
      forceMaxHpState(p);
      await pause(25);
      const hp=p.getComponent("minecraft:health");
      report("full-set max HP",hp.effectiveMax,80);
      report("iron armor total",eq.totalArmor,15);
      setScore(p,SCORE.revives,4);
      hp.setCurrentValue(80);
      let beforeNative,afterNative;
      const b=world.beforeEvents.entityHurt.subscribe(e=>{if(e.hurtEntity.id===p.id){beforeNative=e.damage;console.warn(`[ZG-ENGINE] probe before damage=${e.damage} cancel=${e.cancel}`);}});
      const a=world.afterEvents.entityHurt.subscribe(e=>{if(e.hurtEntity.id===p.id){afterNative=e.damage;console.warn(`[ZG-ENGINE] probe after damage=${e.damage}`);}});
      p.applyDamage(10,{cause:EntityDamageCause.entityAttack});
      await pause(3);
      console.warn(`[ZG-ENGINE] mitigation probe before=${beforeNative} after=${afterNative} hpLoss=${80-hp.currentValue}`);
      await pause(25);
      hp.setCurrentValue(5);
      p.applyDamage(10,{cause:EntityDamageCause.override});
      await pause(3);
      report("native lethal revive",revives(p),3);
      report("corruption c1",corruption(p),1);
      report("revive HP",hp.currentValue,40);
      p.applyDamage(5,{cause:EntityDamageCause.override});
      await pause(3);
      report("recovery still takes damage",hp.currentValue,35);
      report("speed II",p.getEffect("speed")?.amplifier ?? -1,1);
      report("no resistance",p.getEffect("resistance") ? 1 : 0,0);
      world.beforeEvents.entityHurt.unsubscribe(b);world.afterEvents.entityHurt.unsubscribe(a);
      await pause(65);
      report("speed expires",p.getEffect("speed") ? 1 : 0,0);
      for(let i=0;i<3;i++) report(`advance corruption ${i+2}`,tryRevive(p) ? corruption(p) : -1,i+2);
      report("revives exhausted",revives(p),0);
      report("fifth revive denied",tryRevive(p) ? 1 : 0,0);
      // Leave the player in c4 for third/first-person visual inspection.
      p.runCommand("give @s minecraft:totem_of_undying 4");
      p.runCommand("give @s minecraft:milk_bucket 1");
      p.sendMessage("[ZG TEST] 自動検証終了。三人称とトーテム＋しゃがみの操作を確認できます。");
      console.warn("[ZG-ENGINE] DONE");
    } catch(error) { console.error(`[ZG-ENGINE] ERROR ${error.stack ?? error}`); }
  },100);
});

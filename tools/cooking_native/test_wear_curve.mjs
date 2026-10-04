import test from 'node:test';
import assert from 'node:assert/strict';
import {WEAR_BASE_USES,sessionBreakChance,shouldBreakSession,initialUsesFromDamage,visualDamage} from '../../behavior_packs/bp_19_211f47f7-5f1d-4b02-a162-e7546cf3fdc4/scripts/wear_curve.js';

test('base lives preserve the existing knife durability ordering and values',()=>{
  assert.deepEqual(WEAR_BASE_USES,{copper:96,iron:128,gold:64,diamond:512,netherite:640});
});
for(const [material,base] of Object.entries(WEAR_BASE_USES)){
  test(material+' is guaranteed safe through the first half of its base life',()=>{
    for(let u=0;u<Math.floor(base/2);u++) assert.equal(sessionBreakChance(material,u),0);
  });
  test(material+' chance increases after the safe half-life',()=>{
    const points=[Math.floor(base*.50),Math.floor(base*.75),base,Math.floor(base*1.25),Math.floor(base*1.5)];
    const p=points.map(u=>sessionBreakChance(material,u));
    for(let i=1;i<p.length;i++) assert(p[i]>p[i-1],material+' '+p);
    assert(p.every(v=>v>=0&&v<=.95));
  });
  test(material+' legacy damage migrates to session age without reset',()=>{
    const d=Math.min(37,base-1);
    assert.equal(initialUsesFromDamage(material,d),d);
    assert.equal(visualDamage(material,d),d);
  });
  test(material+' visual damage never reaches invalid max durability',()=>{
    assert.equal(visualDamage(material,base*20),base-1);
  });
}
test('roll boundary is deterministic and never hides the probability calculation',()=>{
  const p=sessionBreakChance('gold',64);
  assert.equal(shouldBreakSession('gold',64,0),p>0);
  assert.equal(shouldBreakSession('gold',64,Math.min(.999999,p/2)),true);
  assert.equal(shouldBreakSession('gold',64,Math.min(.999999,p)),false);
});
test('probability inputs fail closed',()=>{
  for(const v of [-1,1.5,NaN,Infinity]) assert.throws(()=>sessionBreakChance('copper',v));
  assert.throws(()=>sessionBreakChance('wood',0));
  for(const r of [-.1,1,NaN,Infinity]) assert.throws(()=>shouldBreakSession('copper',50,r));
});
test('gold has a higher per-session chance than netherite at the same normalized age',()=>{
  assert(sessionBreakChance('gold',64)>sessionBreakChance('netherite',640));
});

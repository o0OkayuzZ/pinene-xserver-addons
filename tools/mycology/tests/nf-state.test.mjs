import test from 'node:test';
import assert from 'node:assert/strict';
import { NF_REGISTRY,SCRIPT_FATAL_IDS,validatePerformance,registerPerformance } from '../pack/BP/scripts/mycology/nf_registry.js';
import { NFStateManager,NF_WARNINGS } from '../pack/BP/scripts/mycology/nf_state.js';
import { NF_INTERACTIONS } from '../pack/BP/scripts/mycology/nf_interactions.js';

// Deliberately synthetic test fixtures, NOT approved gameplay definitions.
const definition=(id='NF-021',extra={})=>({id,status:'approved',duration:120,milkClear:true,
 tags:[],baseEffects:[],phases:[],stacks:{},gauges:[],fatal:{enabled:false},...extra});
const fatal=probability=>({enabled:true,condition:s=>s.severity>=3,probability,graceSeconds:30});
const manager=(defs,options={})=>new NFStateManager(new Map(defs.map(d=>[d.id,d])),options);

test('official identities stay inactive until performance is approved; 101 has no ceiling',()=>{
 assert.equal(NF_REGISTRY.size,100);
 const m=new NFStateManager(NF_REGISTRY);
 assert.throws(()=>m.infect('NF-021'),/not approved/);
 const r=new Map([['NF-101',{id:'NF-101',displayName:'official',itemId:'pinene:nf_101'}]]);
 registerPerformance(definition('NF-101',{displayName:'wrong'}),r);
 assert.equal(r.get('NF-101').displayName,'official');
 assert(new NFStateManager(r).infect('NF-101'));
});
test('exactly the approved 21 species may gain script fatality within 021–100',()=>{
 assert.equal(SCRIPT_FATAL_IDS.size,21);
 for(let n=21;n<=100;n++){
  const id=`NF-${String(n).padStart(3,'0')}`,d=definition(id,{fatal:fatal(0.1)});
  if(SCRIPT_FATAL_IDS.has(id))assert.doesNotThrow(()=>validatePerformance(d));
  else assert.throws(()=>validatePerformance(d),/forbidden/);
 }
});
test('fatal lottery runs once at severe crossing; re-eating cannot reset it',()=>{
 let draws=0,kills=0;const m=manager([definition('NF-021',{fatal:fatal(0.5)})],{random:()=>{draws++;return 0;},kill:()=>kills++});
 m.infect('NF-021');m.tick(5);assert.equal(draws,0);
 m.get('NF-021').severity=3;m.reconcile();m.tick(10);m.infect('NF-021');
 assert.equal(m.get('NF-021').fatalState.fatalExecuteAt,35);
 m.tick(20);assert.equal(draws,1);assert.equal(kills,1);assert.equal(m.states.size,0);
});
test('milk with ten seconds remaining cancels death and cleans every state',()=>{
 let kills=0;const cleaned=[];
 const m=manager([definition('NF-021',{fatal:fatal(1)}),definition('NF-091')],{
  kill:()=>kills++,cleanup:s=>cleaned.push(s.nfId)
 });
 m.infect('NF-021').severity=3;m.infect('NF-091').customData.hearingLoss=true;m.reconcile();m.tick(20);
 m.clear('milk');m.tick(100);assert.equal(kills,0);assert.equal(m.states.size,0);
 assert.deepEqual(cleaned,['NF-021','NF-091']);
});
test('failed draw never rerolls; reinfection may draw again',()=>{
 let draws=0;const m=manager([definition('NF-021',{fatal:fatal(0.2)})],{random:()=>{draws++;return 0.9;}});
 m.infect('NF-021').severity=3;m.reconcile();m.tick(40);m.reconcile();assert.equal(draws,1);
 assert.equal(m.get('NF-021').fatalState.fatalScheduled,false);
 m.clear();m.infect('NF-021').severity=3;m.reconcile();assert.equal(draws,2);
});
test('warnings are identical for winning and losing fatal draws',()=>{
 const results=[];
 for(const random of [()=>0,()=>0.99]){
  const messages=[],m=manager([definition('NF-021',{fatal:fatal(0.5)})],{random,notify:(e,id,msg)=>{if(msg)messages.push(msg);}});
  m.infect('NF-021').severity=3;m.reconcile();m.tick(15);results.push(messages);
 }
 assert.deepEqual(results[0],results[1]);assert.deepEqual(results[0],Object.values(NF_WARNINGS));
});
test('save/restore advances only online time and preserves fatal deadline',()=>{
 const defs=[definition('NF-021',{fatal:fatal(1)})],m=manager(defs);
 m.infect('NF-021').severity=3;m.reconcile();m.tick(20);
 const save=m.snapshot(),n=manager(defs);n.restore(JSON.parse(JSON.stringify(save)));
 assert.deepEqual(n.snapshot(),save);n.tick(9);assert(n.has('NF-021'));n.tick(1);assert.equal(n.states.size,0);
});
test('death reset leaves no latent state, ability data or fatal appointment',()=>{
 const m=manager([definition('NF-096',{duration:null,fatal:fatal(1)})]);
 const s=m.infect('NF-096');s.phase='latent';s.customData.maxHP=1;s.severity=3;m.reconcile();m.clear('death');
 assert.deepEqual(m.snapshot().states,[]);
 assert.equal(m.infect('NF-096').fatalState.fatalChecked,false);
});
test('stacks and gauges clamp to definition maximum and 0–100',()=>{
 const m=manager([definition('NF-040',{stacks:{growth:5},gauges:[{name:'load'}]})]);m.infect('NF-040');
 assert.equal(m.addStack('NF-040','growth',9),5);assert.equal(m.removeStack('NF-040','growth',8),0);
 assert.equal(m.addGauge('NF-040','load',110),100);assert.equal(m.reduceGauge('NF-040','load',120),0);
 assert.throws(()=>m.setGauge('NF-040','load',NaN));assert.throws(()=>m.addStack('NF-040','missing'));
});
test('suppressed symptoms return for current phase while infection keeps advancing',()=>{
 const m=manager([definition('NF-031',{phases:[{id:'early',at:0,effects:[{effect:'weakness',level:1}]},{id:'late',at:10,effects:[{effect:'weakness',level:3}]}]}),
  definition('NF-084',{duration:15,suppressEffects:['weakness']})]);
 m.infect('NF-031');m.infect('NF-084');m.tick(10);assert.deepEqual(m.symptoms(),[]);
 assert.equal(m.get('NF-031').phase,'late');m.tick(5);
 assert.deepEqual(m.symptoms(),[{effect:'weakness',level:3}]);
});
test('recovery phase and duration expire naturally, without perpetual worsening',()=>{
 const m=manager([definition('NF-093',{duration:30,phases:[{id:'fever',at:0},{id:'recovery',at:20}]})]);
 m.infect('NF-093');m.tick(20);assert.equal(m.get('NF-093').phase,'recovery');m.tick(10);assert.equal(m.states.size,0);
});
test('interaction registry removes harmful and beneficial bacteria alike',()=>{
 const m=manager([definition('NF-036',{tags:['bacterial']}),definition('NF-078'),definition('NF-101',{tags:['bacterial','beneficial']}),definition('NF-102',{tags:['viral']})],{interactions:NF_INTERACTIONS});
 for(const id of ['NF-036','NF-101','NF-102','NF-078'])m.infect(id);
 assert.deepEqual([...m.states.keys()],['NF-102','NF-078']);
});
test('coexistence, immune suppression and amnesia are exposed to approved triggers',()=>{
 const m=manager(['NF-036','NF-069','NF-056','NF-083','NF-096','NF-098'].map(id=>definition(id,{tags:id==='NF-083'?['immunosuppression']:[]})),{interactions:NF_INTERACTIONS});
 m.infect('NF-069');assert.equal(m.get('NF-069').flags.deltaCoexistence,false);
 m.infect('NF-036');assert.equal(m.get('NF-069').flags.deltaCoexistence,true);
 for(const id of ['NF-056','NF-083','NF-096','NF-098'])m.infect(id);
 assert.equal(m.get('NF-056').flags.immuneReactionSuppressed,true);
 assert.equal(m.get('NF-096').flags.immunosuppressed,true);assert.equal(m.get('NF-096').flags.immuneAmnesia,true);
});
test('HDV cannot draw fatality without HBV even when its severe predicate is true',()=>{
 const m=manager([definition('NF-069',{fatal:fatal(1)}),definition('NF-036')]);
 m.infect('NF-069').severity=3;m.reconcile();assert.equal(m.get('NF-069').fatalState.fatalChecked,false);
 m.infect('NF-036');assert.equal(m.get('NF-069').fatalState.fatalChecked,true);
});
test('malformed persisted state is rejected before replacing good state',()=>{
 const m=manager([definition()]);m.infect('NF-021');const before=m.snapshot(),bad=m.snapshot();bad.states[0].fatalState.fatalScheduled=true;
 assert.throws(()=>m.restore(bad));assert.deepEqual(m.snapshot(),before);
});

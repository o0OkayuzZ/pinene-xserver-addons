import { validatePerformance } from './nf_registry.js';

const clone=value=>JSON.parse(JSON.stringify(value));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const finite=value=>{if(!Number.isFinite(value))throw new Error('Expected finite value');return value;};
export const NF_WARNINGS=Object.freeze({
 severe:'⚠ 症状が危険域に達しています', worsening:'⚠ 症状が急速に悪化しています'
});

// Pure, per-player state container. No timers, world access or wall-clock time.
// The runtime owns ONE scheduler and only calls players with active states.
export class NFStateManager {
 constructor(registry,{random=Math.random,notify=(event,id,message=undefined)=>{},cleanup=(state,definition,reason)=>{},kill=()=>{},interactions=[]}={}) {
  this.registry=registry;this.random=random;this.notify=notify;this.cleanup=cleanup;
  this.kill=kill;this.interactions=interactions;this.states=new Map();this.onlineTime=0;
 }
 definition(id) {const d=this.registry.get(id);if(!d)throw new Error(`Unknown ${id}`);return d;}
 has(id){return this.states.has(id);}
 hasTag(tag){return [...this.states.keys()].some(id=>(this.definition(id).tags??[]).includes(tag));}
 get(id){return this.states.get(id);}
 infect(id) {
  const d=validatePerformance(this.definition(id));
  // Repeated eating is allowed, but must not reset disease/fatal clocks.
  if(this.has(id)){this.dispatch('reconsume',{nfId:id});return this.get(id);}
  const s={nfId:id,startTime:this.onlineTime,remainingTime:d.duration,
   phase:d.phases?.[0]?.at===0?d.phases[0].id:null,stacks:{},severity:0,
   flags:{},customData:{},fatalState:{fatalChecked:false,fatalScheduled:false,fatalExecuteAt:null}};
  for(const key of Object.keys(d.stacks??{}))s.stacks[key]=0;
  for(const gauge of d.gauges??[])s.customData[gauge.name]=0;
  this.states.set(id,s);
  d.onStart?.(s,this);
  this.notify('onset',id);this.reconcile();return s;
 }
 remove(id,reason='cure') {
  const s=this.get(id);if(!s)return;
  // Cleanup must succeed before dropping the record, so a retry remains possible.
  this.cleanup(s,this.definition(id),reason);
  this.states.delete(id);this.notify(reason,id);
 }
 clear(reason='milk') {
  for(const id of [...this.states.keys()])this.remove(id,reason);
 }
 getStack(id,key){return this.get(id)?.stacks[key]??0;}
 setStack(id,key,value) {
  const s=this.get(id),max=this.definition(id).stacks?.[key];
  if(!s||max===undefined)throw new Error('Unknown active stack');
  return s.stacks[key]=clamp(Math.trunc(finite(value)),0,max);
 }
 addStack(id,key,value=1){return this.setStack(id,key,this.getStack(id,key)+finite(value));}
 removeStack(id,key,value=1){return this.addStack(id,key,-finite(value));}
 getGauge(id,key){return this.get(id)?.customData[key]??0;}
 setGauge(id,key,value) {
  const s=this.get(id);
  if(!s||!(this.definition(id).gauges??[]).some(g=>g.name===key))throw new Error('Unknown active gauge');
  return s.customData[key]=clamp(finite(value),0,100);
 }
 addGauge(id,key,value){return this.setGauge(id,key,this.getGauge(id,key)+finite(value));}
 reduceGauge(id,key,value){return this.addGauge(id,key,-finite(value));}
 setPhase(id,phase) {
  const s=this.get(id);if(!s)throw new Error('Unknown active state');
  if(!(this.definition(id).phases??[]).some(p=>p.id===phase))throw new Error('Unknown phase');
  if(s.phase!==phase){s.phase=phase;this.notify('phase',id,phase);}
 }
 dispatch(event,payload={}) {
  for(const [id,s] of [...this.states]) {
   if(this.has(id))this.definition(id).triggers?.[event]?.(s,payload,this);
  }
  this.reconcile();
 }
 reconcile() {
  for(const rule of this.interactions)if(rule.matches(this))rule.apply(this);
  for(const [id,s] of this.states)this.checkFatal(s,this.definition(id));
 }
 checkFatal(s,d) {
  const f=d.fatal, state=s.fatalState;
  if(d.id==='NF-069'&&!this.has('NF-036'))return;
  if(!f?.enabled||state.fatalChecked||!f.condition(s,this))return;
  const probability=typeof f.probability==='function'?f.probability(s,this):f.probability;
  if(!Number.isFinite(probability)||probability<0||probability>1)throw new Error('Invalid fatal probability');
  const draw=this.random();
  if(!Number.isFinite(draw)||draw<0||draw>=1)throw new Error('Invalid fatal random draw');
  state.fatalChecked=true;state.fatalScheduled=draw<probability;
  state.fatalExecuteAt=state.fatalScheduled?this.onlineTime+f.graceSeconds:null;
  // Warning timing is identical for both outcomes. Never expose the draw.
  state.warningAt=this.onlineTime+Math.max(0,f.graceSeconds-15);
  state.warningSent=false;this.notify('severe',s.nfId,NF_WARNINGS.severe);
 }
 tick(seconds=1) {
  finite(seconds);if(seconds<=0)throw new Error('Time must advance');
  this.onlineTime+=seconds;
  for(const [id,s] of [...this.states]) {
   if(!this.has(id))continue;
   const d=this.definition(id),elapsed=this.onlineTime-s.startTime;
   if(s.remainingTime!==null)s.remainingTime=Math.max(0,s.remainingTime-seconds);
   // Timeline transitions are only evaluated when their boundary is crossed;
   // an event-driven phase is not overwritten on every tick.
   for(const phase of d.phases??[])if(phase.at>elapsed-seconds&&phase.at<=elapsed)this.setPhase(id,phase.id);
   d.onTick?.(s,seconds,this);
  }
  this.reconcile();
  for(const [id,s] of [...this.states]) {
   if(!this.has(id))continue;
   const f=s.fatalState;
   if(f.fatalChecked&&!f.warningSent&&this.onlineTime>=f.warningAt){f.warningSent=true;this.notify('worsening',id,NF_WARNINGS.worsening);}
   if(f.fatalScheduled&&this.onlineTime>=f.fatalExecuteAt) {
    this.clear('death');this.kill();return;
   }
   if(s.remainingTime===0)this.remove(id,'recovery');
  }
 }
 symptoms() {
  const suppressed=new Set([...this.states.keys()].flatMap(id=>this.definition(id).suppressEffects??[]));
  const result=new Map();
  for(const [id,s] of this.states) {
   const d=this.definition(id),phase=d.phases?.find(p=>p.id===s.phase);
   for(const effect of [...(d.baseEffects??[]),...(phase?.effects??[])]) {
    if(suppressed.has(effect.effect))continue;
    const old=result.get(effect.effect);
    if(!old||effect.level>old.level)result.set(effect.effect,{...effect});
   }
  }
  return [...result.values()];
 }
 snapshot(){return clone({version:1,onlineTime:this.onlineTime,states:[...this.states.values()]});}
 restore(record) {
  if(record?.version!==1||!Number.isFinite(record.onlineTime)||record.onlineTime<0||!Array.isArray(record.states))throw new Error('Invalid NF save');
  const states=new Map();
  for(const s of record.states) {
   const d=validatePerformance(this.definition(s.nfId)),f=s.fatalState;
   if(states.has(s.nfId)||!Number.isFinite(s.startTime)||s.startTime<0||s.startTime>record.onlineTime||
    !(s.remainingTime===null||Number.isFinite(s.remainingTime)&&s.remainingTime>=0)||
    !s.stacks||!s.customData||!s.flags||!Number.isFinite(s.severity)||
    !f||typeof f.fatalChecked!=='boolean'||typeof f.fatalScheduled!=='boolean'||
    f.fatalScheduled&&(!d.fatal?.enabled||!f.fatalChecked||!Number.isFinite(f.fatalExecuteAt))||
    f.fatalChecked&&(!Number.isFinite(f.warningAt)||typeof f.warningSent!=='boolean'))throw new Error('Invalid NF state');
   for(const [key,value] of Object.entries(s.stacks))if(!Number.isInteger(value)||value<0||d.stacks?.[key]===undefined||value>d.stacks[key])throw new Error('Invalid saved stack');
   for(const g of d.gauges??[])if(!Number.isFinite(s.customData[g.name])||s.customData[g.name]<0||s.customData[g.name]>100)throw new Error('Invalid saved gauge');
   states.set(s.nfId,clone(s));
  }
  this.onlineTime=record.onlineTime;this.states=states;
 }
}

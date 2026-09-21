// Rules select active states, never the full species catalog. Quantitative
// changes belong to approved species triggers, not invented common defaults.
export const NF_INTERACTIONS = [
 {id:'delta',matches:m=>m.has('NF-069'),apply:m=>{
  m.get('NF-069').flags.deltaCoexistence=m.has('NF-036');
 }},
 {id:'suppress_giant_virus',matches:m=>m.has('NF-068'),apply:m=>signalTag(m,'giant_virus','giantVirusSuppression')},
 {id:'weaken_fungi',matches:m=>m.has('NF-075'),apply:m=>signalTag(m,'fungal','fungalSuppression')},
 {id:'remove_bacteria',matches:m=>m.has('NF-078'),apply:m=>{
  // Includes beneficial bacteria. Collect targets before removal.
  for(const id of [...m.states.keys()])if(m.definition(id).tags?.includes('bacterial'))m.remove(id,'cure');
 }},
 {id:'reduce_proliferation',matches:m=>m.has('NF-081'),apply:m=>signalTag(m,'proliferation','proliferationSuppression')},
 {id:'hela_suppression',matches:m=>m.has('NF-080')&&m.has('NF-085'),apply:m=>signal(m,'NF-080','strongProliferationSuppression')},
 {id:'stop_shock',matches:m=>m.has('NF-056'),apply:m=>{
  m.get('NF-056').flags.immuneReactionSuppressed=m.has('NF-083');
 }},
 {id:'immune_context',matches:m=>m.states.size>0,apply:m=>{
  const immunosuppressed=m.hasTag('immunosuppression'),amnesia=m.has('NF-098');
  for(const id of ['NF-090','NF-094','NF-096'])if(m.has(id)){
   m.get(id).flags.immunosuppressed=immunosuppressed;
   if(id==='NF-096')m.get(id).flags.immuneAmnesia=amnesia;
   // Approved triggers decide thresholds, probability and phase transitions.
   m.definition(id).onImmuneContext?.(m.get(id),{immunosuppressed,amnesia},m);
  }
 }}
];
function signal(m,id,event){m.definition(id).onInteraction?.(m.get(id),event,m);}
function signalTag(m,tag,event){
 for(const id of [...m.states.keys()])if(m.has(id)&&m.definition(id).tags?.includes(tag))signal(m,id,event);
}

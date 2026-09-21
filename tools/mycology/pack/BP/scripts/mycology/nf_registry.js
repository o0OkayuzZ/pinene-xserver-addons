import { NETHER_FUNGI } from './registry.js';

// Identity comes exclusively from the adopted master. Gameplay is opt-in: a
// common architecture specification is not approval of 80 invented recipes.
export const NF_REGISTRY = new Map(NETHER_FUNGI.map(entry => [entry.id, {
 id:entry.id, displayName:entry.nameJa, itemId:entry.itemId,
 status:'awaiting_performance', tags:[], baseEffects:[], phases:[],
 stacks:{}, gauges:[], triggers:{}, fatal:{enabled:false}, milkClear:true
}]));
export const SCRIPT_FATAL_IDS = new Set([
 '021','031','033','036','041','051','055','056','058','059','066',
 '069','086','088','090','091','092','093','094','096','100'
].map(number=>`NF-${number}`));
export const NF_TAGS = Object.freeze([
 'bacterial','viral','fungal','parasite','toxin','prion','beneficial','archaea',
 'neural','gastrointestinal','respiratory','hemorrhagic','hepatic',
 'proliferation','immune_reaction','immunosuppression','latent','giant_virus'
]);

export function validatePerformance(definition) {
 const d=definition, number=Number(d.id?.slice(3));
 if(!/^NF-\d{3,}$/.test(d.id)||number<1)throw new Error('Invalid NF ID');
 if(d.status!=='approved')throw new Error(`${d.id}: performance is not approved`);
 if(d.duration!==null&&(!Number.isFinite(d.duration)||d.duration<=0))throw new Error(`${d.id}: explicit duration required (null for indefinite)`);
 if(d.milkClear!==true)throw new Error(`${d.id}: milk must clear NF state`);
 for(const maximum of Object.values(d.stacks??{}))if(!Number.isInteger(maximum)||maximum<0)throw new Error('Invalid stack maximum');
 let previous=-1;
 for(const phase of d.phases??[]) {
  if(!Number.isFinite(phase.at)||phase.at<0||phase.at<=previous||typeof phase.id!=='string')throw new Error('Invalid phase timeline');
  previous=phase.at;
 }
 if(d.fatal?.enabled) {
  if(number>=21&&number<=100&&!SCRIPT_FATAL_IDS.has(d.id))throw new Error(`${d.id}: scripted fatality forbidden`);
  if(typeof d.fatal.condition!=='function'||!Number.isFinite(d.fatal.graceSeconds)||d.fatal.graceSeconds<0)throw new Error('Incomplete fatal definition');
  if(typeof d.fatal.probability!=='function'&&(!Number.isFinite(d.fatal.probability)||d.fatal.probability<0||d.fatal.probability>1))throw new Error('Invalid fatal probability');
 }
 return d;
}

// NF-101+ is accepted once its identity is in the master; no numerical ceiling.
export function registerPerformance(definition, registry=NF_REGISTRY) {
 const identity=registry.get(definition.id);
 if(!identity)throw new Error('Register the official NF identity first');
 validatePerformance(definition);
 registry.set(definition.id,{...identity,...definition,
  id:identity.id,displayName:identity.displayName,itemId:identity.itemId});
}

import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const source=await readFile(new URL('BP/scripts/combat.js',root),'utf8');
const {CONFIG:C,boneSpikePose,sampleBoneSpike,boneSpikeSegment,spikeTouchesPlayer}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const snapshots=[],plans=[];
let seed=72119;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(let tick=-10;tick<122;tick++){
 const feet={x:Math.sin(Math.max(0,tick)*.045)*1.4,y:0,z:Math.sin(Math.max(0,tick)*.065)*.7};
 if(tick>=0&&tick<80&&tick%C.boneSpawnInterval===0){
  plans.push({...sampleBoneSpike(feet,random,tick/C.boneSpawnInterval),bornAt:tick});
 }
 const bones=plans.map(p=>({...p,age:tick-p.bornAt,pose:boneSpikePose(tick-p.bornAt,p.length)}))
  .filter(b=>b.age<C.spikeWarningTicks+C.spikeRiseTicks+C.spikeHoldTicks+C.spikeRetreatTicks);
 const hit=bones.some(b=>{const s=boneSpikeSegment(b,b.pose);return b.pose.damaging&&spikeTouchesPlayer(s.start,s.end,feet);});
 snapshots.push({tick,feet,bones,hit,spawned:plans.length});
}
await mkdir(new URL('dist/',root),{recursive:true});
await writeFile(new URL('dist/bone_attack_timeline.json',root),JSON.stringify(snapshots));
console.log('Angled spike snapshots:',snapshots.length);

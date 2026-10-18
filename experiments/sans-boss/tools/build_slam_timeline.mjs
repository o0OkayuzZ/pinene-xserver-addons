import{readFile,writeFile}from'node:fs/promises';
const root=new URL('../',import.meta.url),src=await readFile(new URL('BP/scripts/combat.js',root),'utf8');
const{CONFIG:C,slamPhase,slamPreviewHeight,sampleBoneSpike,boneSpikePose}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const snapshots=[],plans=[];let seed=72119;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(let age=-10;age<146;age++){
 const feet={x:1.2+(age<34?0:Math.sin((age-34)*.04)*1.2),y:slamPreviewHeight(age),z:0};
 if(age>=34&&age<114&&(age-34)%C.boneSpawnInterval===0)plans.push({...sampleBoneSpike(feet,random,(age-34)/C.boneSpawnInterval),bornAt:age});
 const bones=plans.map(b=>({...b,pose:boneSpikePose(age-b.bornAt,b.length)})).filter(b=>age-b.bornAt<32);
 snapshots.push({age,feet,phase:age<0?'ready':age>=26?'impact':slamPhase(age),soul:age>=0&&age<34,bones});
}
await writeFile(new URL('dist/slam_attack_timeline.json',root),JSON.stringify(snapshots));console.log('Slam snapshots:',snapshots.length);

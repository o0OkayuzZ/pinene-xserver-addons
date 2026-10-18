import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const source=await readFile(new URL('BP/scripts/combat.js',root),'utf8');
const {CONFIG:C,bonePose,boneTouchesPlayer}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const snapshots=[];
for(const type of ['low','tall']) {
  const height=type==='low'?1:2.6;
  for(let age=-8;age<100;age++) {
    const movingTicks=Math.max(0,Math.min(C.boneLifeTicks,age-C.boneWarningTicks+1));
    const z=7-movingTicks*C.boneSpeed;
    const oldZ=7-Math.max(0,movingTicks-1)*C.boneSpeed;
    const travel=Math.max(0,Math.min(1,(age-20)/16));
    const jump=type==='low'&&age>=38&&age<=56?1.35*Math.sin((age-38)/18*Math.PI):0;
    const feet={x:type==='tall'?.5-1.5*travel:.5,y:jump,z:0};
    const pose=bonePose(Math.max(0,age),height);
    const visible=age>=0&&age<C.boneWarningTicks+C.boneLifeTicks+C.boneRetreatTicks;
    const bones=Array.from({length:12},(_,i)=>i).filter(i=>i!==4&&i!==5).map(i=>({
      x:i-5.5,z,oldZ,height:pose.height,offsetY:pose.offsetY,
      hit:visible&&pose.damaging&&boneTouchesPlayer({x:i-5.5,y:0,z:oldZ},{x:i-5.5,y:0,z},pose.height,feet)}));
    snapshots.push({type,age,height,pose,visible,bones,feet,hit:bones.some(b=>b.hit)});
  }
}
if(snapshots.some(s=>s.hit))throw Error('Preview dodges should clear both wall variants');
await mkdir(new URL('dist/',root),{recursive:true});
await writeFile(new URL('dist/bone_attack_timeline.json',root),JSON.stringify(snapshots));
console.log('Bone snapshots:',snapshots.length);

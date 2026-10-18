// Offline snapshots share the ring plan, timing and combat rules with Bedrock.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const source = await readFile(new URL('BP/scripts/combat.js', root), 'utf8');
const rules = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const { CONFIG: C, add, subtract, scale, normalize, beamTouchesPlayer,
  blasterRingPlan, blasterHover, blastWidth, blastRecoil, addKarmaDebt, karmaPulse } = rules;
const slots = blasterRingPlan({x:0,y:0,z:0}, Math.PI/2, 6);
let health = 20, debt = 0, nextAt = 0;
const snapshots = [];
for (let tick = -10; tick < 108; tick++) {
  const travel = Math.max(0, Math.min(1, (tick-29)/14));
  const feet = {x:travel*6,y:0,z:0};
  const blasters = slots.map(slot => {
    const age = tick-slot.delay;
    const fireEnd = C.blasterWarningTicks+C.blasterFireTicks;
    const visible = age>=0 && age<fireEnd+C.blasterDepartureTicks;
    const rayVisible = age>=0 && age<fireEnd;
    const firing = age>=C.blasterWarningTicks && rayVisible;
    if (age <= C.blasterWarningTicks-C.blasterAimLockTicks-1) {
      slot.originNow=add(slot.origin,blasterHover(Math.max(0,age)));
      slot.direction=normalize(subtract(add(feet,{x:0,y:1,z:0}),slot.originNow));
    }
    const origin=slot.originNow, direction=slot.direction;
    const end=add(origin,scale(direction,C.beamLength));
    return {age,visible,rayVisible,firing,origin,direction,end,
      arrival:Math.max(0,Math.min(1,age/C.blasterArrivalTicks)),
      departure:age>=fireEnd?Math.min(1,(age-fireEnd+1)/C.blasterDepartureTicks):0,
      width:firing?blastWidth(age-C.blasterWarningTicks):C.warningLineWidth,
      recoil:firing?blastRecoil(age-C.blasterWarningTicks):0,
      hit:firing&&beamTouchesPlayer(origin,end,feet,C.beamRadius)};
  });
  const contacts=blasters.filter(b=>b.hit).length;
  const applied=Math.min(health,C.maxDamagePerTick,contacts*C.blasterDamagePerTick);
  health-=applied;
  if (contacts && health>0) {
    debt=addKarmaDebt(debt,C.karmaPerContactTick,health);
    nextAt=tick+C.karmaGraceTicks;
  }
  let pulse=0;
  if (tick>=nextAt && debt>0) {
    pulse=karmaPulse(debt,health,C.maxDamagePerTick-applied);
    health-=pulse;debt-=pulse;nextAt=tick+C.karmaDrainInterval;
  }
  snapshots.push({tick,blasters,feet,hit:contacts>0,pulse,health,debt,
    visible:blasters.some(b=>b.visible),firing:blasters.some(b=>b.firing)});
}
if (!snapshots.some(s=>s.blasters.filter(b=>b.visible).length===6)) throw Error('Missing encirclement');
if (!snapshots.some(s=>s.hit) || !snapshots.some(s=>s.pulse>0 && !s.hit)) throw Error('Missing damage/KARMA phase');
if (snapshots.at(-1).debt!==0 || snapshots.at(-1).health<=0) throw Error('Preview must escape and clear KARMA');
await mkdir(new URL('dist/',root),{recursive:true});
const destination=new URL('dist/blaster_attack_timeline.json',root);
await writeFile(destination,JSON.stringify(snapshots));
console.log(destination.pathname, 'Final HP',health);

// Preview snapshots from the same pure combat rules used by the Bedrock runtime.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const source = await readFile(new URL('BP/scripts/combat.js', root), 'utf8');
const rules = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const { CONFIG: C, add, subtract, scale, normalize, beamTouchesPlayer,
  blasterHover, blastWidth, blastRecoil, addKarmaDebt, karmaPulse } = rules;
let health = 20, debt = 0, nextAt = 0;
let origin, direction;
const snapshots = [];
for (let tick = -10; tick < 108; tick++) {
  const visible = tick >= 0 && tick < C.blasterWarningTicks + C.blasterFireTicks;
  const firing = tick >= C.blasterWarningTicks && visible;
  const feet = { x: Math.max(0, Math.min(3, (tick-31)*0.6)), y: 0, z: 0 };
  if (tick <= C.blasterWarningTicks - C.blasterAimLockTicks - 1) {
    origin = add({ x:0, y:2.5, z:10 }, blasterHover(Math.max(0,tick)));
    direction = normalize(subtract(add(feet,{ x:0,y:1,z:0 }),origin));
  }
  const end = add(origin,scale(direction,C.beamLength));
  const hit = firing && beamTouchesPlayer(origin,end,feet,C.beamRadius);
  let applied = 0, pulse = 0;
  if (hit) {
    applied = C.blasterDamagePerTick;
    health -= applied;
    debt = addKarmaDebt(debt,C.karmaPerContactTick,health);
    nextAt = tick+C.karmaGraceTicks;
  }
  if (tick >= nextAt && debt > 0) {
    pulse = karmaPulse(debt,health,C.maxDamagePerTick-applied);
    health -= pulse; debt -= pulse;
    nextAt = tick+C.karmaDrainInterval;
  }
  snapshots.push({ tick,visible,firing,origin,direction,end,feet,hit,pulse,health,debt,
    width: firing ? blastWidth(tick-C.blasterWarningTicks) : C.warningLineWidth,
    recoil: firing ? blastRecoil(tick-C.blasterWarningTicks) : 0 });
}
if (!snapshots.some(s=>s.pulse>0 && !s.visible)) throw new Error('Preview must show residual karma after the attack.');
if (!snapshots.some(s=>s.visible && !s.firing) || !snapshots.some(s=>s.hit)) throw new Error('Missing attack phase.');
if (snapshots.at(-1).debt!==0) throw new Error('Preview must show the karma finishing.');
await mkdir(new URL('dist/',root),{recursive:true});
const destination = new URL('dist/blaster_attack_timeline.json',root);
await writeFile(destination,JSON.stringify(snapshots));
console.log(destination.pathname);

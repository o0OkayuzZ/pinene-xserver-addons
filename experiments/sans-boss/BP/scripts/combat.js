// Pure encounter rules: shared by the Bedrock runtime and deterministic tests.
export const CONFIG = Object.freeze({
  hitChancePerWarp: 0.02,
  warpInterval: 50,
  dodgeWarpCooldown: 6,
  encounterRadius: 32,
  attackInterval: 65,
  slamLiftAt: 10,
  slamDropAt: 22,
  slamTimeoutTicks: 60,
  slamRecoveryTicks: 8,
  slamImpactDamage: 1,
  boneSpawnInterval: 5,
  boneStreamCount: 16,
  spikeWarningTicks: 10,
  spikeRiseTicks: 4,
  spikeHoldTicks: 10,
  spikeRetreatTicks: 8,
  boneWarningTicks: 18,
  boneRiseTicks: 6,
  boneRetreatTicks: 8,
  boneLifeTicks: 65,
  boneSpeed: 0.24,
  boneDamagePerTick: 0.5,
  blasterWarningTicks: 24,
  blasterFireTicks: 16,
  blasterCollapseTicks: 8,
  blasterDamagePerTick: 0.75,
  karmaPerContactTick: 0.25,
  karmaMax: 6,
  karmaGraceTicks: 10,
  karmaDrainInterval: 4,
  karmaDamagePerPulse: 0.25,
  blasterAimLockTicks: 8,
  warningLineWidth: 0.025,
  blasterSpawnInterval: 4,
  blasterRingRadius: 8,
  blasterArrivalTicks: 10,
  blasterDepartureTicks: 10,
  beamRadius: 0.45,
  beamLength: 28,
  maxBosses: 4,
  maxHazardsPerBoss: 24,
  maxBlastersPerBoss: 6,
  maxDamagePerTick: 1,
});

export function hitChance(warps, step = CONFIG.hitChancePerWarp) {
  const count = Number.isFinite(warps) ? Math.max(0, Math.floor(warps)) : 0;
  return Math.min(1, count * step);
}

export function shouldDodge(warps, roll) {
  return roll >= hitChance(warps);
}

export function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(v, n) {
  return { x: v.x * n, y: v.y * n, z: v.z * n };
}

export function distanceSquared(a, b) {
  const d = subtract(a, b);
  return d.x * d.x + d.y * d.y + d.z * d.z;
}

export function normalize(v) {
  const length = Math.hypot(v.x, v.y, v.z);
  return length > 0.0001 ? scale(v, 1 / length) : { x: 0, y: 0, z: 1 };
}

export function pointSegmentDistanceSquared(point, start, end) {
  const segment = subtract(end, start);
  const offset = subtract(point, start);
  const lengthSquared = distanceSquared(start, end);
  const t = lengthSquared > 0 ? Math.max(0, Math.min(1,
    (offset.x * segment.x + offset.y * segment.y + offset.z * segment.z) / lengthSquared)) : 0;
  return distanceSquared(point, add(start, scale(segment, t)));
}

// A swept moving bone against the player's standing/sneaking vertical capsule.
// This catches a fast wall even if it passes through a player between ticks.
export function boneTouchesPlayer(previous, current, boneHeight, feet, playerHeight = 1.8) {
  if (feet.y + playerHeight < current.y || feet.y > current.y + boneHeight) return false;
  const p = { x: feet.x, y: 0, z: feet.z };
  const a = { x: previous.x, y: 0, z: previous.z };
  const b = { x: current.x, y: 0, z: current.z };
  return pointSegmentDistanceSquared(p, a, b) <= 0.46 * 0.46;
}

export function beamTouchesPlayer(start, end, feet, radius, playerHeight = 1.8) {
  // Sample the capsule at five heights, including feet and head. Avoid the old
  // chest-only test, which lets beams miss crouching players or their legs.
  for (let i = 0; i <= 4; i++) {
    const point = { x: feet.x, y: feet.y + playerHeight * i / 4, z: feet.z };
    if (pointSegmentDistanceSquared(point, start, end) <= (radius + 0.3) ** 2) return true;
  }
  return false;
}

export function accumulatedDamage(previous, amount) {
  return Math.min(CONFIG.maxDamagePerTick, previous + Math.max(0, amount));
}

export function healthAfterTick(health, damage) {
  return Math.max(0, health - Math.max(0, damage));
}

// Karma is a bounded, non-lethal remaining health debt. It does not bypass
// the one-HP floor; another direct hit is needed to finish a player there.
export function addKarmaDebt(previous, added, health) {
  return Math.max(0, Math.min(CONFIG.karmaMax, health - 1, previous + Math.max(0, added)));
}

export function karmaPulse(debt, health, capacity = CONFIG.maxDamagePerTick) {
  return Math.max(0, Math.min(debt, health - 1, capacity, CONFIG.karmaDamagePerPulse));
}

export function blasterHover(age) {
  return { x: Math.sin(age * 0.08) * 0.10, y: Math.sin(age * 0.14) * 0.20,
    z: (Math.cos(age * 0.08) - 1) * 0.08 };
}

export function blastWidth(age) {
  const elapsed = Math.max(0, age);
  const collapse = Math.max(0, Math.min(1,
    (elapsed - (CONFIG.blasterFireTicks - CONFIG.blasterCollapseTicks)) / CONFIG.blasterCollapseTicks));
  const envelope = 1 - collapse * collapse * (3 - 2 * collapse);
  return (0.9 + 0.15 * Math.exp(-elapsed / 2)) * envelope;
}

export function blastRecoil(age) {
  return Math.exp(-Math.max(0, age) / 4);
}

// Alternate opposite sides, filling the full ring rather than one frontal fan.
export function blasterRingPlan(center, baseAngle, count) {
  const total = Math.max(0, Math.min(CONFIG.maxBlastersPerBoss, Math.floor(count)));
  const slots = [];
  for (let i = 0; i < Math.ceil(total / 2); i++) {
    slots.push(i);
    if (i + Math.ceil(total / 2) < total) slots.push(i + Math.ceil(total / 2));
  }
  return slots.map((slot, index) => {
    const angle = baseAngle + slot * Math.PI * 2 / total;
    return { delay: index * CONFIG.blasterSpawnInterval, origin: {
      x: center.x + Math.cos(angle) * CONFIG.blasterRingRadius,
      y: center.y + 2.5 + (slot % 2) * 0.65,
      z: center.z + Math.sin(angle) * CONFIG.blasterRingRadius,
    }};
  });
}

// Warning has no damage, including the rising animation. The active bounce's
// visible height is also the swept collision height; retreat has no damage.
export function bonePose(age, height) {
  const activeAge = age - CONFIG.boneWarningTicks;
  if (activeAge < 0) {
    const p = Math.max(0, Math.min(1, (age - (CONFIG.boneWarningTicks - CONFIG.boneRiseTicks)) / CONFIG.boneRiseTicks));
    const rise = 1 - (1-p) ** 3;
    return {height, offsetY:-(height+.035)*(1-rise), damaging:false, warning:age < CONFIG.boneWarningTicks-CONFIG.boneRiseTicks};
  }
  if (activeAge < CONFIG.boneLifeTicks) {
    const bounce = 1 + 0.10*Math.exp(-activeAge/4)*Math.sin(activeAge*Math.PI/3);
    return {height:height*bounce, offsetY:0, damaging:true, warning:false};
  }
  const p = Math.min(1, (activeAge-CONFIG.boneLifeTicks+1)/CONFIG.boneRetreatTicks);
  return {height, offsetY:-(height+.035)*p*p, damaging:false, warning:false};
}

// A rigid bone slides along its own tilted axis, rather than stretching.
export function boneSpikePose(age, length) {
  const a = age - CONFIG.spikeWarningTicks;
  let presence = 0;
  if (a >= 0 && a < CONFIG.spikeRiseTicks) presence = 1 - (1 - (a + 1) / CONFIG.spikeRiseTicks) ** 3;
  else if (a >= CONFIG.spikeRiseTicks && a < CONFIG.spikeRiseTicks + CONFIG.spikeHoldTicks) presence = 1;
  else if (a >= CONFIG.spikeRiseTicks + CONFIG.spikeHoldTicks) {
    const t = Math.min(1, (a - CONFIG.spikeRiseTicks - CONFIG.spikeHoldTicks + 1) / CONFIG.spikeRetreatTicks);
    presence = 1 - t*t*(3-2*t);
  }
  return { presence, slide: -length*.38 - (length*.62 + .08) * (1-presence),
    warning: age >= 0 && a < 0, damaging: a >= 0 && a < CONFIG.spikeRiseTicks + CONFIG.spikeHoldTicks };
}

// Seed values are injected so the preview can reproduce the runtime's plans.
export function boneSpikePlan(center, azimuth, tilt, radius, length) {
  const t = tilt * Math.PI / 180, a = azimuth * Math.PI / 180;
  const direction = { x: -Math.sin(t)*Math.cos(a), y: Math.cos(t), z: Math.sin(t)*Math.sin(a) };
  // Lean toward the intended point, with the foot planted around it.
  const base = {x:center.x+Math.cos(a)*radius, y:center.y, z:center.z-Math.sin(a)*radius};
  return {base, direction, tilt, azimuth, length};
}

export function boneSpikeSegment(plan, pose) {
  const visibleLength = Math.max(0, plan.length + pose.slide);
  return {start:plan.base, end:add(plan.base, scale(plan.direction, visibleLength))};
}

// Exact distance from a tilted bone segment to a player's vertical capsule.
export function spikeTouchesPlayer(start, end, feet, height = 1.8) {
  const u=subtract(end,start), v={x:0,y:height,z:0}, w=subtract(start,feet);
  const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
  const a=dot(u,u),b=dot(u,v),c=dot(v,v),d=dot(u,w),e=dot(v,w);
  if (a < 1e-10) return false;
  let s=0,t=0,den=a*c-b*b;
  if (den>1e-10) s=Math.max(0,Math.min(1,(b*e-c*d)/den));
  t=(b*s+e)/c;
  if(t<0){t=0;s=Math.max(0,Math.min(1,-d/a));}
  else if(t>1){t=1;s=Math.max(0,Math.min(1,(b-d)/a));}
  const delta=subtract(add(start,scale(u,s)),add(feet,scale(v,t)));
  return dot(delta,delta) <= .46**2;
}

// Alternate left/right hemispheres while varying each bone inside its side.
export function sampleBoneSpike(center, random = Math.random, index = 0, heading = 0) {
  const azimuth = ((index % 2)*180 + heading + (random()-.5)*100 + 720) % 360;
  return {...boneSpikePlan(center, azimuth, 2+26*Math.pow(random(),1.25),
    .35+random()*1.25, 2.2+random()*.6), side:index%2===0?'left':'right'};
}

export function slamPhase(age) {
  return age < CONFIG.slamLiftAt ? 'warning' : age < CONFIG.slamDropAt ? 'lift' : 'drop';
}

// Choreography only: runtime landing is observed from actual engine physics.
export function slamPreviewHeight(age) {
  if(age<CONFIG.slamLiftAt)return 0;
  if(age<CONFIG.slamDropAt){const t=(age-CONFIG.slamLiftAt)/(CONFIG.slamDropAt-CONFIG.slamLiftAt);return 1.6*(1-(1-t)**3);}
  const t=Math.min(1,(age-CONFIG.slamDropAt)/4);return 1.6*(1-t*t);
}

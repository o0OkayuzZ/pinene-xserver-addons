// Pure encounter rules: shared by the Bedrock runtime and deterministic tests.
export const CONFIG = Object.freeze({
  hitChancePerWarp: 0.02,
  warpInterval: 50,
  dodgeWarpCooldown: 6,
  encounterRadius: 32,
  attackInterval: 65,
  boneWarningTicks: 18,
  boneLifeTicks: 65,
  boneSpeed: 0.24,
  boneDamagePerTick: 0.5,
  blasterWarningTicks: 24,
  blasterFireTicks: 16,
  blasterDamagePerTick: 0.75,
  beamRadius: 0.45,
  beamLength: 28,
  maxBosses: 4,
  maxHazardsPerBoss: 24,
  maxBlastersPerBoss: 3,
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

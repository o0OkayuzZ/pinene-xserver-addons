// Phase 1 provisional values. HP units; attributes are tags, never multipliers.
export const balance = Object.freeze({
  blackFlash: Object.freeze({ baseDamage: 8, exponent: 2.5, scale: 0.1, cap: 40 }),
  railgun: Object.freeze({ maxRange: 64, chargeTicks: 40, baseDamage: 12,
    fullChargeDamage: 24, curveExponent: 1, maxTargets: 3, penetrationMultiplier: 0.75,
    cooldownTicks: 100, ammoItemId: null }),
  accelerator: Object.freeze({ reflectionMultiplier: 1, maxReflectionDepth: 1 }),
  runtime: Object.freeze({ ticksPerSecond: 20, millisecondsPerSecond: 1000 }),
});

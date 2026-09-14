// Pure rules: ticks are 20 Hz. Infection is sampled before the current hit.
export const CORRUPTION_ATTACK_BONUS = Object.freeze([0, 0.1, 0.3, 0.7, 1.5]);
export const CORRUPTION_ATTACK = Object.freeze(CORRUPTION_ATTACK_BONUS.map(n => 1 + n));
export const INFECTION_ATTACK = Object.freeze([1, 0.9, 0.8, 0.7]);
export const INFECTION_INCOMING = Object.freeze([1, 1.1, 1.2, 1.3]);
export const MAX_REVIVES = 4;
export const REVIVE_TICKS = 60;
export const REVIVE_SPEED_AMPLIFIER = 1;
export const INFECTION_CD = 40;

export function clampStage(value, max = 4) {
  return Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;
}

export function infectionAt(record, tick) {
  if (!record) return 0;
  const steps = Math.max(0, Math.floor((tick - record.lastHit - 200) / 100));
  return Math.max(0, record.stage - steps);
}

export function damageMultiplier(corruption, attackerInfection, victimInfection) {
  const corruptionBonus = corruption >= 0 ? CORRUPTION_ATTACK_BONUS[clampStage(corruption)] : 0;
  const attack = 1 + corruptionBonus;
  const infectionAttack = INFECTION_ATTACK[clampStage(attackerInfection, 3)];
  const incoming = INFECTION_INCOMING[clampStage(victimInfection, 3)];
  return attack * infectionAttack * incoming;
}

export const KNOCKBACK_RESISTANCE = Object.freeze([0.40, 0.56, 0.72, 0.88, 1]);
export function reviveCap(stage) { return stage < 0 ? MAX_REVIVES : MAX_REVIVES - clampStage(stage); }

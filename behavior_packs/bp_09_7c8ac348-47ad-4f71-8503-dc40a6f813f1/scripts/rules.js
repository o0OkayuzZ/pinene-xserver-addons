// Pure rules: ticks are 20 Hz. Infection is sampled before the current hit.
export const CORRUPTION_ATTACK_BONUS = Object.freeze([0, 0.1, 0.3, 0.7, 1.5]);
export const CORRUPTION_ATTACK = Object.freeze(CORRUPTION_ATTACK_BONUS.map(n => 1 + n));
export const INFECTION_ATTACK = Object.freeze([1, 0.9, 0.8, 0.7]);
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

export function damageMultiplier(corruption, attackerInfection, victimInfection, fullSet) {
  const corruptionBonus = corruption >= 0 ? CORRUPTION_ATTACK_BONUS[clampStage(corruption)] : 0;
  const attack = 1 + corruptionBonus;
  const infectionAttack = INFECTION_ATTACK[clampStage(attackerInfection, 3)];
  // A 30% defense loss is represented as dividing incoming damage by 0.7.
  const defense = 1 / INFECTION_ATTACK[clampStage(victimInfection, 3)];
  const severe = fullSet && victimInfection === 3 ? 1.2 : 1;
  return attack * infectionAttack * defense * severe;
}

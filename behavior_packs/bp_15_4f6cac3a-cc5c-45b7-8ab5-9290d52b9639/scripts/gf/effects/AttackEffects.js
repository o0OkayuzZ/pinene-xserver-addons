export function nonnegative(value, name) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid ${name}`);
  return value;
}
export function powerDamage(baseDamage, exponent, scale, cap) {
  [baseDamage, exponent, scale, cap].forEach((v, i) => nonnegative(v, `power parameter ${i}`));
  if (exponent === 0 || cap === 0) throw new Error("Invalid power exponent/cap");
  if (baseDamage === 0 || scale === 0) return 0;
  // Log space avoids overflow even for very large, finite inputs.
  return Math.min(cap, Math.exp(Math.min(Math.log(cap), exponent * Math.log(baseDamage) + Math.log(scale))));
}
export function railgunDamage(parameters, charge = 1, targetIndex = 0) {
  nonnegative(charge, "charge"); nonnegative(targetIndex, "target index");
  const { baseDamage, fullChargeDamage, curveExponent, penetrationMultiplier } = parameters;
  return nonnegative((baseDamage + (fullChargeDamage - baseDamage) * Math.min(1, charge) ** curveExponent)
    * penetrationMultiplier ** targetIndex, "railgun damage");
}
export function attackContext(card, source, target, options = {}) {
  const p = card.effect.parameters;
  const baseDamage = options.baseDamage ?? p?.baseDamage ?? card.effect.damage;
  let damage;
  switch (card.effect.type) {
    case "damage": damage = nonnegative(baseDamage, "damage"); break;
    case "powerDamage": damage = powerDamage(baseDamage, p.exponent, p.scale, p.cap); break;
    case "railgun": damage = railgunDamage(p, options.charge, options.targetIndex); break;
    default: throw new Error("Unknown attack effect");
  }
  return { damage, baseDamage, attributes: [...card.attributes], source, target, cardId: card.id,
    effectType: card.effect.type, reflected: false, reflectionDepth: 0, metadata: {} };
}
export function normalizeAttack(attack, source, target) {
  nonnegative(attack.damage, "damage");
  const baseDamage = attack.baseDamage ?? attack.damage;
  nonnegative(baseDamage, "base damage");
  const reflectionDepth = attack.reflectionDepth ?? 0;
  if (!Number.isSafeInteger(reflectionDepth) || reflectionDepth < 0) throw new Error("Invalid reflection depth");
  return { ...attack, baseDamage, source: source ?? attack.source, target, reflected: attack.reflected ?? false,
    reflectionDepth, metadata: attack.metadata ?? {} };
}

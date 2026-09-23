import { nonnegative, powerDamage } from "./AttackEffects.js";
export function validateEffect(card) {
  const e = card.effect, p = e?.parameters;
  if (card.category === "attack") {
    if (e?.type === "damage") { if (!(nonnegative(e.damage, "damage") > 0)) throw new Error("Invalid attack"); return; }
    if (e?.type === "powerDamage") { powerDamage(p.baseDamage, p.exponent, p.scale, p.cap); return; }
    if (e?.type === "railgun") {
      for (const key of ["maxRange", "chargeTicks", "baseDamage", "fullChargeDamage", "curveExponent", "maxTargets", "penetrationMultiplier", "cooldownTicks"]) nonnegative(p[key], key);
      if (p.maxRange <= 0 || p.curveExponent <= 0 || p.fullChargeDamage < p.baseDamage
        || !Number.isSafeInteger(p.chargeTicks) || p.chargeTicks < 1 || !Number.isSafeInteger(p.maxTargets) || p.maxTargets < 1
        || p.penetrationMultiplier > 1 || !Number.isSafeInteger(p.cooldownTicks)
        || !(p.ammoItemId === null || typeof p.ammoItemId === "string" && /^[a-z0-9_]+:[a-z0-9_./-]+$/.test(p.ammoItemId))) throw new Error("Invalid railgun");
      return;
    }
  } else if (card.category === "defense") {
    if (e?.type === "nullify") return;
    if (e?.type === "reduce" && Number.isFinite(e.multiplier) && e.multiplier >= 0 && e.multiplier < 1) return;
    if (e?.type === "nullifyReflect") {
      nonnegative(p.reflectionMultiplier, "reflection multiplier");
      if (!Number.isSafeInteger(p.maxReflectionDepth) || p.maxReflectionDepth < 0) throw new Error("Invalid reflection limit");
      return;
    }
  }
  throw new Error("Invalid card effect/category");
}

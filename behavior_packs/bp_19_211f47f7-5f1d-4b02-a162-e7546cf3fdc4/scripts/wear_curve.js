export const WEAR_BASE_USES = Object.freeze({
  copper:96, iron:128, gold:64, diamond:512, netherite:640
});
const SAFE_FRACTION = 0.5;
const SCALE = 0.7;
const SHAPE = 3;
function base(material) {
  const value=WEAR_BASE_USES[material];
  if(!Number.isSafeInteger(value)||value<=0) throw new TypeError('unknown knife material');
  return value;
}
function hazardAt(material,uses) {
  if(!Number.isSafeInteger(uses)||uses<0) throw new RangeError('uses must be a nonnegative safe integer');
  const x=uses/base(material);
  const y=Math.max(0,(x-SAFE_FRACTION)/SCALE);
  return Math.pow(y,SHAPE);
}
/** Conditional probability that the knife fails on the NEXT used cooking session. */
export function sessionBreakChance(material,usesBefore) {
  const before=hazardAt(material,usesBefore);
  const after=hazardAt(material,usesBefore+1);
  const probability=1-Math.exp(-(after-before));
  return Math.max(0,Math.min(0.95,probability));
}
export function shouldBreakSession(material,usesBefore,roll) {
  if(typeof roll!=='number'||!Number.isFinite(roll)||roll<0||roll>=1)
    throw new RangeError('roll must be in [0,1)');
  return roll<sessionBreakChance(material,usesBefore);
}
export function initialUsesFromDamage(material,damage) {
  const max=base(material);
  if(!Number.isSafeInteger(damage)||damage<0) throw new RangeError('damage must be a nonnegative safe integer');
  return Math.min(damage,max-1);
}
export function visualDamage(material,uses) {
  const max=base(material);
  if(!Number.isSafeInteger(uses)||uses<0) throw new RangeError('uses must be a nonnegative safe integer');
  return Math.min(max-1,uses);
}

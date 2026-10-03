/**
 * PURE, NON-ENGINE durability preflight. This file is NOT imported by the game.
 * Plans only make sense BEFORE a native transaction commits. Calling this from
 * an after-event cannot undo materials already spent or reject a completed batch.
 * The billing unit is mandatory: no silent change to legacy recipe/output policy.
 */
const UNITS = new Set(['recipe_execution', 'output_item']);
const MODES = new Set(['exact', 'up_to']);
function integer(name, value, min, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be a safe integer in [${min}, ${max}]`);
  }
}
/** @param {{maxDurability:number, damage:number, requestedOperations:number,
 * resultCount:number, unit:'recipe_execution'|'output_item', mode:'exact'|'up_to'}} input */
export function planKnifeWear(input) {
  if (!input || typeof input !== 'object') throw new TypeError('input is required');
  const {maxDurability, damage, requestedOperations, resultCount, unit, mode} = input;
  integer('maxDurability', maxDurability, 1);
  integer('damage', damage, 0, maxDurability);
  integer('requestedOperations', requestedOperations, 0, 65536);
  integer('resultCount', resultCount, 1, 64);
  if (!UNITS.has(unit)) throw new TypeError('an explicit billing unit is required');
  if (!MODES.has(mode)) throw new TypeError('an explicit batch mode is required');
  const remaining = maxDurability - damage;
  const costPerOperation = unit === 'recipe_execution' ? 1 : resultCount;
  const affordable = Math.floor(remaining / costPerOperation);
  const acceptedOperations = mode === 'exact' && requestedOperations > affordable
    ? 0 : Math.min(requestedOperations, affordable);
  const cost = acceptedOperations * costPerOperation;
  const nextDamage = damage + cost;
  return Object.freeze({
    remaining, costPerOperation, requestedOperations, acceptedOperations,
    rejectedOperations: requestedOperations - acceptedOperations,
    producedItems: acceptedOperations * resultCount,
    cost, nextDamage, remainingAfter: maxDurability - nextDamage,
    breaks: acceptedOperations > 0 && nextDamage === maxDurability,
    reason: requestedOperations === 0 ? 'no_op'
      : acceptedOperations === 0 ? 'insufficient_durability'
      : acceptedOperations < requestedOperations ? 'partial_capacity' : 'allowed',
  });
}

// These are EVIDENCE REQUIREMENTS, NOT fictitious Minecraft API methods.
export const NATIVE_GATE_REQUIREMENTS = Object.freeze([
  'preCommitAuthority', 'trustworthyOperationCount', 'atomicKnifeAndRecipeCommit',
  'batchLimitEngineVerified', 'metadataRetentionEngineVerified',
  'playerAndBoardIdentityVerified',
]);
/** @param {Record<string, boolean>|undefined} evidence */
export function nativeIntegrationGate(evidence) {
  const missing = NATIVE_GATE_REQUIREMENTS.filter(key => evidence?.[key] !== true);
  return Object.freeze({allowed: missing.length === 0, missing: Object.freeze(missing)});
}

/** Read-only candidate interpretation; does NOT establish event granularity.
 * Returned bottles/buckets, missing stacks and ambiguous recipe IDs must not be
 * billed as additional crafts. Only a real engine test can validate this model.
 * @param {{typeId?:string,amount?:number}|undefined} stack
 * @param {Array<{id:string,resultCount:number}>} recipes
 */
export function describeCraftOutput(stack, recipes) {
  if (!stack?.typeId || !Number.isSafeInteger(stack.amount) || stack.amount <= 0)
    return Object.freeze({kind:'unusable_output', chargeAllowed:false});
  const matches = recipes.filter(recipe => recipe.id === stack.typeId);
  if (!matches.length) return Object.freeze({kind:'untracked_output', chargeAllowed:false});
  if (matches.length !== 1) return Object.freeze({kind:'ambiguous_output', chargeAllowed:false});
  const count = matches[0].resultCount;
  integer('recipe.resultCount', count, 1, 64);
  if (stack.amount % count !== 0)
    return Object.freeze({kind:'nonintegral_batch', chargeAllowed:false});
  return Object.freeze({kind:'candidate_only', candidateOperations:stack.amount/count,
    chargeAllowed:false});
}

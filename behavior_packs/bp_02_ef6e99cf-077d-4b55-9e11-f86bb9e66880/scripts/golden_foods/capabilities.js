// Enable only after the corresponding on-device acceptance test passes.
// These three one-shot adapters exist below; persistent/attribute features do not.
export const CAPABILITIES = Object.freeze({
  cleanse_on_consume: false,
  extinguish_on_consume: false,
  reduce_existing_effect_duration_once: false,
});
export const DEFERRED = Object.freeze([
  "prevent_effects", "reduce_incoming_effect_duration", "exhaustion_reduction",
  "energy_reserve", "heat_exposure_regeneration", "poison_to_regeneration",
  "same_id_vanilla_edibility",
]);


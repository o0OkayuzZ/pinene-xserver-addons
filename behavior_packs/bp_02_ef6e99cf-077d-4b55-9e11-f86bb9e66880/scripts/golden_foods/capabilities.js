// Phase 1 counters are implemented by the persistent effectAdd adapter.
// Unrelated deferred capabilities remain disabled.
export const CAPABILITIES = Object.freeze({
  cleanse_on_consume: true,
  prevent_effects: true,
  reduce_incoming_effect_duration: true,
  poison_to_regeneration: true,
  extinguish_on_consume: false,
  reduce_existing_effect_duration_once: false,
});
export const DEFERRED = Object.freeze([
  "exhaustion_reduction",
  "energy_reserve", "heat_exposure_regeneration",
  "same_id_vanilla_edibility",
]);


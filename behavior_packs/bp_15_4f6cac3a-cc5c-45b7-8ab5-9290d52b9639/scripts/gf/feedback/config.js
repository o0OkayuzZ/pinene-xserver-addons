export const feedbackConfig = Object.freeze({
  entityId: "pinene:gf_damage_number", ticketTicks: 2, maxRecords: 256,
  lifetimeTicks: 25, boldTicks: 5, headOffset: 0.35,
  perTargetLimit: 3, globalLimit: 96,
  colours: Object.freeze([
    Object.freeze({ below: 4, code: "§c" }), Object.freeze({ below: 10, code: "§6" }),
    Object.freeze({ below: 20, code: "§e" }), Object.freeze({ below: 50, code: "§a" }),
    Object.freeze({ below: 100, code: "§b" }), Object.freeze({ below: Infinity, code: "§d" }),
  ]),
});
export function formatDamage(value) {
  if (!Number.isFinite(value) || value < 0) throw new Error("Invalid damage number");
  return Number(value.toFixed(2)).toString();
}
export function damageColour(value, thresholds = feedbackConfig.colours) {
  if (!Number.isFinite(value) || value < 0) throw new Error("Invalid damage colour value");
  return (thresholds.find(entry => value < entry.below) ?? thresholds.at(-1)).code;
}

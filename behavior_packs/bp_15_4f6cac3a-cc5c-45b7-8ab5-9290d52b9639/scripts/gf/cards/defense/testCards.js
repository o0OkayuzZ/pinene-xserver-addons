export const defenseCards = [
  { id: "gf:red_shield", name: "Red Shield", category: "defense", activation: "automatic", attributes: ["red"], effect: { type: "nullify" } },
  { id: "gf:blue_shield", name: "Blue Shield", category: "defense", activation: "automatic", attributes: ["blue"], effect: { type: "nullify" } },
  { id: "gf:colorless_guard", name: "Colorless Guard", category: "defense", activation: "automatic", attributes: ["colorless", "red", "blue", "yellow", "purple"], effect: { type: "reduce", multiplier: 0.5 } },
];

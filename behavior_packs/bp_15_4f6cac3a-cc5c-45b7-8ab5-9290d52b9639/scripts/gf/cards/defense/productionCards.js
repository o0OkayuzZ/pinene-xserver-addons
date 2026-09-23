import { balance } from "../balance.js";
export const productionDefenseCards = [
  { id: "gf:accelerator", name: "一方通行", attributes: ["purple"], category: "defense", activation: "manual",
    description: "紫属性のGF攻撃を完全無効化し反射（再反射なし）",
    modes: Object.freeze({ defense: Object.freeze({ enabled: true }), thrown: Object.freeze({ enabled: false }) }),
    effect: { type: "nullifyReflect", parameters: balance.accelerator } },
];

import { balance } from "../balance.js";
export const productionAttackCards = [
  { id: "gf:black_flash_arrow", name: "黒閃の矢", attributes: ["purple"], category: "attack", activation: "manual",
    description: `威力を${balance.blackFlash.exponent}乗系で増幅`, effect: { type: "powerDamage", parameters: balance.blackFlash } },
  { id: "gf:railgun", name: "超電磁砲", attributes: ["yellow"], category: "attack", activation: "manual",
    description: `チャージ後に直線貫通攻撃（最大${balance.railgun.maxRange} blocks）`, effect: { type: "railgun", parameters: balance.railgun } },
];

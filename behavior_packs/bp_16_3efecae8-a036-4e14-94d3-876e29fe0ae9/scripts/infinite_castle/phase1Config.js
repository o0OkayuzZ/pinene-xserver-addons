// Phase 1 tuning. Physical placement and authored geometry are independent.
export const PHASE1 = Object.freeze({
    dynamicReconstructionIntervalMinutes: 15,
    protectionHops: 0,
    reconstructionCandidateAttempts: 4,
    playerCheckTicks: 10,
    combatTicks: 5,
    enemyCap: 45,
    waveTimeoutTicks: 900,
    exitGraceTicks: 200,
    arrivalGraceTicks: 60,
    exitCrouchTicks: 30,
    weights: { guard: 26, curse: 19, wraith: 19, heavy: 17, mixed: 19 },
    treasureChance: 0.03,
    gardenBoundary: 0.08,
});
export const ENCOUNTER_TYPES = Object.freeze(["guard", "curse", "wraith", "heavy", "mixed", "elite"]);
export const LABELS = Object.freeze({
    guard: "衛兵部屋",
    curse: "呪術部屋",
    wraith: "怨霊部屋",
    heavy: "重装部屋",
    mixed: "混成部屋",
    elite: "Elite部屋",
});
export const MOB_BALANCE = Object.freeze({
    zombie: { typeId: "minecraft:zombie", hp: 70, damage: 8 },
    skeleton: { typeId: "minecraft:skeleton", hp: 65, damage: 8 },
    vanguard: { typeId: "dungeons:vanguard", hp: 90, damage: 9 },
    royal_guard: { typeId: "dungeons:royal_guard", hp: 140, damage: 14 },
    necromancer: { typeId: "dungeons:necromancer", hp: 110, damage: 4 },
    wraith: { typeId: "dungeons:wraith", hp: 95, damage: 9 },
    nightmare: { typeId: "dungeons:illusioner", hp: 120, damage: 4, debuffer: true },
    rot: { typeId: "minecraft:witch", hp: 130, damage: 4, debuffer: true },
    plague: { typeId: "dungeons:drowned_necromancer", hp: 145, damage: 3, debuffer: true },
    enchanted_vanguard: { typeId: "dungeons:enchanted_vanguard", hp: 180, damage: 12 },
    enchanted_royal_guard: { typeId: "dungeons:enchanted_royal_guard", hp: 260, damage: 17 },
    captain: { typeId: "dungeons:royal_guard", hp: 360, damage: 14, name: "城郭隊長", keyHolder: true },
    arch_curse: { typeId: "dungeons:necromancer", hp: 330, damage: 4, name: "大呪術師", keyHolder: true },
    wraith_lord: { typeId: "dungeons:wraith", hp: 340, damage: 9, name: "怨霊主", keyHolder: true },
    iron_general: { typeId: "dungeons:royal_guard", hp: 480, damage: 14, name: "黒鉄守将", keyHolder: true },
    overseer: { typeId: "dungeons:endersent", hp: 400, damage: 14, name: "無限城の監守", keyHolder: true },
    crimson: {
        typeId: "dungeons:enchanted_royal_guard",
        hp: 650,
        damage: 17,
        name: "深紅の鍵守",
        keyHolder: true,
    },
    clone: { typeId: "dungeons:illusioner", hp: 120, damage: 0 },
});
export const WAVES = Object.freeze({
    guard: [
        ["vanguard", "vanguard", "royal_guard", "skeleton", "skeleton", "zombie"],
        ["captain", "vanguard", "royal_guard", "skeleton"],
    ],
    curse: [
        ["vanguard", "vanguard", "necromancer", "nightmare", "zombie"],
        ["arch_curse", "necromancer", "rot", "plague", "vanguard"],
    ],
    wraith: [
        ["wraith", "wraith", "vanguard", "skeleton", "skeleton"],
        ["wraith_lord", "wraith", "wraith", "vanguard", "zombie"],
    ],
    heavy: [
        ["royal_guard", "royal_guard", "vanguard", "vanguard"],
        ["iron_general", "royal_guard", "royal_guard", "vanguard"],
    ],
    mixed: [
        ["vanguard", "vanguard", "royal_guard", "necromancer", "wraith", "nightmare"],
        ["overseer", "royal_guard", "plague", "rot", "skeleton"],
    ],
    elite: [
        ["enchanted_vanguard", "enchanted_vanguard", "enchanted_royal_guard", "wraith"],
        ["crimson", "enchanted_royal_guard", "plague", "nightmare"],
    ],
});
export const EXTRA_MOBS = Object.freeze({
    guard: ["vanguard", "skeleton", "royal_guard"],
    curse: ["necromancer", "vanguard", "zombie"],
    wraith: ["wraith", "skeleton", "vanguard"],
    heavy: ["royal_guard", "vanguard", "royal_guard"],
    mixed: ["vanguard", "wraith", "royal_guard"],
    elite: ["enchanted_vanguard", "wraith", "enchanted_royal_guard"],
});
export const PLAGUE_POOL = Object.freeze([
    ["poison", 120, 0],
    ["hunger", 200, 0],
    ["blindness", 60, 0],
    ["weakness", 160, 0],
    ["nausea", 120, 0],
]);
export const OVERSEER_ABILITIES = Object.freeze([
    "weak_command",
    "weak_summon",
    "weak_fire",
    "weak_breach",
    "plague_bolt",
]);
// /loot adds "loot_tables/" and ".json" itself (unlike nested table entries).
export const lootTableFor = (type) => `chests/infinite_castle/${type}`;
export const slotLootTableFor = (type, guaranteed = false) => `chests/infinite_castle/slots/${type}${guaranteed ? "_base" : ""}`;

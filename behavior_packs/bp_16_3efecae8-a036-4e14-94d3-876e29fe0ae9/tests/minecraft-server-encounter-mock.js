const signals = new Map();
function signal(name) {
    return { subscribe(callback) { if (!signals.has(name)) signals.set(name, []); signals.get(name).push(callback); } };
}
const properties = new Map();
const blocks = new Map();
const entities = new Map();
let players = [];
let rooms = [];
let tick = 0;
let serial = 0;
let difficulty = "Normal";
let deferred = [];
let unloaded = false;
export const metrics = { spawns: 0, removals: 0, writes: 0, stockWrites: 0 };
export class EnchantmentType { constructor(id) { this.id = id; } }
export class ItemStack {
    constructor(typeId, amount = 1) { this.typeId = typeId; this.amount = amount; this.enchantments = []; }
    getComponent(id) {
        if (id === "minecraft:enchantable" && this.typeId === "minecraft:enchanted_book") {
            return { addEnchantment: value => this.enchantments.push(value) };
        }
    }
}
export class BlockVolume { constructor(from, to) { this.from = from; this.to = to; } }
export class BlockPermutation { static resolve(typeId, states = {}) { return { typeId, states }; } }
export const StructureAnimationMode = { Layers: "Layers", None: "None" };
const key = p => `${p.x},${p.y},${p.z}`;
function inventory() {
    const contents = Array(27);
    return {
        size: 27, getItem(i) { return contents[i]; },
        setItem(i, value) { metrics.stockWrites++; contents[i] = value; },
        clearAll() { contents.fill(undefined); },
    };
}
export const dimension = {
    id: "infinite_castle:dungeon", heightRange: { min: -64, max: 512 },
    getPlayers() { return players; },
    getBlock(point) {
        if (unloaded) return undefined;
        const p = { x: Math.floor(point.x), y: Math.floor(point.y), z: Math.floor(point.z) };
        if (!blocks.has(key(p))) {
            const floor = rooms.some(r => p.y === r.origin.y && p.x >= r.origin.x && p.x <= r.origin.x + 42
                && p.z >= r.origin.z && p.z <= r.origin.z + 42);
            const block = {
                dimension, location: p, typeId: floor ? "minecraft:oak_planks" : "minecraft:air",
                get isSolid() { return !["minecraft:air", "minecraft:light_block_15"].includes(this.typeId); },
                get isAir() { return this.typeId === "minecraft:air"; },
                setType(typeId) { metrics.writes++; this.typeId = typeId; this.container = typeId === "minecraft:chest" ? inventory() : undefined; },
                getComponent() { return this.container ? { container: this.container } : undefined; },
            };
            blocks.set(key(p), block);
        }
        return blocks.get(key(p));
    },
    getEntities(query = {}) {
        return [...entities.values()].filter(e => e.loaded && e.dimension.id === this.id
            && (!query.tags || query.tags.every(tag => e.hasTag(tag))));
    },
    spawnEntity(typeId, location) {
        metrics.spawns++;
        const tags = new Set();
        const entity = {
            id: `enemy${++serial}`, typeId, location, dimension: this, loaded: true,
            addTag(tag) { tags.add(tag); }, hasTag(tag) { return tags.has(tag); }, getTags() { return [...tags]; },
            matches(q) { return q.families?.includes("monster") && !["minecraft:wolf", "minecraft:item"].includes(typeId); },
            remove() { entities.delete(this.id); metrics.removals++; },
        };
        entities.set(entity.id, entity);
        emit("entitySpawn", { entity, cause: "Spawned" });
        return entity;
    },
};
export const world = {
    beforeEvents: { playerInteractWithBlock: signal("interact"), playerBreakBlock: signal("break"), explosion: signal("explosion") },
    afterEvents: { entityDie: signal("die"), entitySpawn: signal("entitySpawn"), entityLoad: signal("entityLoad") },
    getDynamicProperty(key) { return properties.get(key); },
    setDynamicProperty(key, value) { if (value === undefined) properties.delete(key); else properties.set(key, value); },
    getDimension() { return dimension; }, getDifficulty() { return difficulty; },
    getAllPlayers() { return players; }, getEntity(id) { return entities.get(id)?.loaded ? entities.get(id) : undefined; },
};
export const system = {
    get currentTick() { return tick; },
    afterEvents: { scriptEventReceive: signal("command") },
    run(callback) { deferred.push(callback); }, runInterval() { return 1; },
};
export function emit(name, event) { for (const callback of signals.get(name) ?? []) callback(event); }
export function advance() { tick += 5; const work = deferred; deferred = []; work.forEach(callback => callback()); }
export function setup(plan) { rooms = plan.placements.filter(p => p.category === "room"); }
export function setPlayers(value) { players = value; }
export function setDifficulty(value) { difficulty = value; }
export function setUnloaded(value) { unloaded = value; }
export function resetSubscriptions() { signals.clear(); deferred = []; }
export function allEntities() { return [...entities.values()]; }
export function kill(entity) { entities.delete(entity.id); emit("die", { deadEntity: entity, damageSource: {} }); }

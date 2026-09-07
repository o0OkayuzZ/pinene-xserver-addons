import { world, Entity, Player, ItemStack, Block } from "@minecraft/server";
import { EquipmentSlot } from "@minecraft/server";
export const afterEvents = world.afterEvents;
export const beforeEvents = world.beforeEvents;
export function cloneItemStackInfo(item, next) {
    next.nameTag = item.nameTag;
    next.amount = item.amount;
    next.keepOnDeath = item.keepOnDeath;
    next.lockMode = item.lockMode;
    next.setCanDestroy(item.getCanDestroy());
    next.setLore(item.getLore());
    const durability1 = item.durability;
    if (durability1) {
        const durability2 = next.durability;
        durability2.damage = durability1.damage;
    }
    const ench1 = item.enchantable;
    if (ench1) {
        const ench2 = next.enchantable;
        ench2?.addEnchantments(ench1.getEnchantments());
    }
    return next;
}
export function getOrientation(rotY) {
    switch (true) {
        case rotY > 70 && rotY < 170:
            return 4;
        case rotY > -45 && rotY < 65:
            return 1;
        case rotY > -100 && rotY < -10:
            return 3;
        case rotY >= 148 || rotY < -100:
            return 2;
    }
}
export function getOrientationX(rotX) {
    switch (true) {
        case rotX > 20 && rotX < -20:
            return -1;
        case rotX > 37:
            return 1;
        case rotX < -37:
            return 0;
        default:
            return -1;
    }
}
export class Vector {
    x;
    y;
    z;
    static up = { x: 0, y: 1, z: 0 };
    static down = { x: 0, y: -1, z: 0 };
    static forward = { x: 0, y: 0, z: 1 };
    static back = { x: 0, y: 0, z: -1 };
    static left = { x: -1, y: 0, z: 0 };
    static right = { x: 1, y: 0, z: 0 };
    static zero = { x: 0, y: 0, z: 0 };
    constructor(x, y, z) {
        if (typeof x === 'object') {
            this.x = x.x;
            this.y = x.y;
            this.z = x.z;
        }
        else {
            this.x = x;
            this.y = y;
            this.z = z;
        }
    }
    floor() {
        return Vector.floor(this);
    }
    center() {
        return Vector.center(this);
    }
    equals(other) {
        return Vector.equals(this, other);
    }
    length() {
        return Vector.length(this);
    }
    multiply(value) {
        // @ts-ignore
        return Vector.multiply(this, value);
    }
    add(other) {
        return Vector.add(this, other);
    }
    subtract(other) {
        return Vector.subtract(this, other);
    }
    cross(other) {
        return Vector.cross(this, other);
    }
    distance(other) {
        return Vector.distance(this, other);
    }
    normalize() {
        return Vector.normalize(this);
    }
    horizontalMagnitude() {
        return Vector.horizontalMagnitude(this);
    }
    static floor(vector) {
        return new Vector(Math.floor(vector.x), Math.floor(vector.y), Math.floor(vector.z));
    }
    static center(vector) {
        return Vector.add(Vector.floor(vector), { x: 0.5, z: 0.5 });
    }
    static equals(vectorA, vectorB) {
        return JSON.stringify(Vector.floor(vectorA)) === JSON.stringify(Vector.floor(vectorB));
    }
    static length(vector) {
        return Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
    }
    static multiply(vectorA, value) {
        return new Vector(vectorA.x * (typeof value === 'number' ? value : value.x ?? 1), vectorA.y * (typeof value === 'number' ? value : value.y ?? 1), vectorA.z * (typeof value === 'number' ? value : value.z ?? 1));
    }
    static add(vectorA, vectorB) {
        return new Vector(vectorA.x + (vectorB.x ?? 0), vectorA.y + (vectorB.y ?? 0), vectorA.z + (vectorB.z ?? 0));
    }
    static subtract(vectorA, vectorB) {
        return new Vector(vectorA.x - (vectorB.x ?? 0), vectorA.y - (vectorB.y ?? 0), vectorA.z - (vectorB.z ?? 0));
    }
    static cross(vectorA, vectorB) {
        return new Vector(vectorA.y * vectorB.z - vectorA.z * vectorB.y, vectorA.z * vectorB.x - vectorA.x * vectorB.z, vectorA.x * vectorB.y - vectorA.y * vectorB.x);
    }
    static distance(vectorA, vectorB) {
        return Math.sqrt(Math.pow(vectorA.x - vectorB.x, 2)
            + Math.pow(vectorA.y - vectorB.y, 2)
            + Math.pow(vectorA.z - vectorB.z, 2));
    }
    static normalize(vector) {
        const len = Vector.length(vector);
        return new Vector(vector.x / len, vector.y / len, vector.z / len);
    }
    static dot(a, b) {
        return a.x * b.x + a.y * b.y + a.z * b.z;
    }
    static abs(vector) {
        return new Vector(Math.abs(vector.x), Math.abs(vector.y), Math.abs(vector.z));
    }
    static horizontalMagnitude(vector) {
        return Math.sqrt(vector.x * vector.x + vector.z * vector.z);
    }
}
// @ts-ignore
Entity.prototype.isPlayer = function () {
    return this.typeId === "minecraft:player";
};
Object.defineProperties(Entity.prototype, {
    health: {
        get: function () {
            return this.getComponent('health');
        }
    },
    inventory: {
        get: function () {
            return this.getComponent('inventory');
        }
    },
    equippable: {
        get: function () {
            return this.getComponent('equippable');
        }
    }
});
Player.prototype.getMainhand = function () {
    return this.equippable.getEquipment(EquipmentSlot.Mainhand);
};
Object.defineProperties(Block.prototype, {
    inventory: {
        get: function () {
            const inventory = this.getComponent('inventory');
            if (inventory)
                return inventory;
            throw new Error('MC error: Please do /reload');
        }
    },
});
Block.prototype.destroy = function (drop = true) {
    const gr = world.gameRules.doTileDrops;
    world.gameRules.doTileDrops = drop;
    const { dimension, x, y, z } = this;
    dimension.runCommand(`setblock ${x} ${y} ${z} air destroy`);
    world.gameRules.doTileDrops = gr;
};
ItemStack.prototype.damage = function (damage = 1, useUnbreaking = true) {
    const durability = this.durability;
    if (!durability)
        return this;
    if (useUnbreaking) {
        const unbreaking = this.enchantable?.getEnchantment('unbreaking')?.level ?? 0;
        if (unbreaking > 0) {
            const skipChance = unbreaking / (unbreaking + 1);
            if (Math.random() < skipChance)
                return this;
        }
        const damageChance = durability.getDamageChance(unbreaking);
        const roll = Math.random() * 100;
        if (roll > damageChance)
            return this;
    }
    durability.damage = Math.min(durability.damage + damage, durability.maxDurability);
    return durability.damage < durability.maxDurability ? this : undefined;
};
Object.defineProperties(ItemStack.prototype, {
    durability: {
        get: function () {
            return this.getComponent('durability');
        }
    },
    enchantable: {
        get: function () {
            return this.getComponent('enchantable');
        }
    },
});

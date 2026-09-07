export const apiVec3 = new class apiVec3 {
    constructor() {
        this.offsetDirection = {
            "East": { x: 1, y: 0, z: 0 },
            "West": { x: -1, y: 0, z: 0 },
            "Down": { x: 0, y: -1, z: 0 },
            "Up": { x: 0, y: 1, z: 0 },
            "North": { x: 0, y: 0, z: -1 },
            "South": { x: 0, y: 0, z: 1 }
        };
    }
    create(x = 0, y = 0, z = 0) { return { x: x, y: y, z: z }; }
    divide(vector, divider) {
        return {
            x: vector["x"] / divider,
            y: vector["y"] / divider,
            z: vector["z"] / divider
        };
    }
    multiply(vector, amount) {
        return {
            x: vector["x"] * amount,
            y: vector["y"] * amount,
            z: vector["z"] * amount
        };
    }
    offset(vector, offset) {
        return {
            x: vector["x"] + offset["x"],
            y: vector["y"] + offset["y"],
            z: vector["z"] + offset["z"]
        };
    }
    floor(vector) {
        return {
            x: Math.floor(vector["x"]),
            y: Math.floor(vector["y"]),
            z: Math.floor(vector["z"])
        };
    }
    reduce(vector, value, on) {
        const newVec = { x: vector["x"], y: vector["y"], z: vector["z"] };
        newVec[on] += value;
        return newVec;
    }
    compare(vector1, vector2, floor = false) {
        const vec1 = floor ? this.floor(vector1) : vector1, vec2 = floor ? this.floor(vector2) : vector2;
        if (vec1.x != vec2.x)
            return false;
        if (vec1.y != vec2.y)
            return false;
        if (vec1.z != vec2.z)
            return false;
        return true;
    }
    distance3(vector1, vector2) { return Math.sqrt((vector1.x - vector2.x) ** 2 + (vector1.y - vector2.y) ** 2 + (vector1.z - vector2.z) ** 2); }
    distanceXYZ(vector1, vector2) { return { x: (vector2.x - vector1.x), y: (vector2.y - vector1.y), z: (vector2.z - vector1.z) }; }
};

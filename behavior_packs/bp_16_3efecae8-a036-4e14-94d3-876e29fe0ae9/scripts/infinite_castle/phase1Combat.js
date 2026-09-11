import { PLAGUE_POOL, MOB_BALANCE } from "./phase1Config.js";
import { chooseDistinct } from "./phase1State.js";

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export function inCone(origin, facing, point, range, degrees) {
    const dx = point.x - origin.x,
        dz = point.z - origin.z,
        d = Math.hypot(dx, dz);
    return (
        Math.abs(point.y - origin.y) < 3 &&
        d <= range &&
        (d === 0 || (dx * facing.x + dz * facing.z) / d >= Math.cos((degrees * Math.PI) / 360))
    );
}
const abilities = {
    wraith: [["wraith_bolt", 60, 20]],
    nightmare: [
        ["nightmare_bolt", 180, 0],
        ["nightmare_wave", 480, 40],
    ],
    rot: [
        ["rot_bolt", 160, 0],
        ["rot_pool", 280, 40],
    ],
    plague: [
        ["plague_bolt", 160, 0],
        ["plague_wave", 360, 40],
    ],
    captain: [
        ["command", 440, 40],
        ["formation", 360, 30],
        ["sweep", 140, 20],
    ],
    arch_curse: [
        ["summon", 360, 40],
        ["curse_mark", 240, 30],
    ],
    wraith_lord: [
        ["fire", 160, 30],
        ["ghost_step", 280, 14],
    ],
    iron_general: [["breach", 180, 32]],
    crimson: [
        ["crimson_command", 360, 30],
        ["blood_mark", 180, 40],
    ],
};
const weak = {
    weak_command: [480, 40],
    weak_summon: [440, 40],
    weak_fire: [200, 30],
    weak_breach: [220, 32],
    plague_bolt: [180, 0],
};

// All timers, projectiles and zones live in one scheduler. No entity intervals.
export function createCombatScheduler(api) {
    const actors = new Map(),
        casts = [],
        zones = [],
        bolts = [],
        flights = [];
    const fx = (p, id = "minecraft:basic_flame_particle") => api.particle(p, id);
    const GOLD = "infinite_castle:key_gold", CRIMSON = "infinite_castle:key_crimson";
    function keyShape(p, angle, id) {
        const point = (x, y) => fx({ x: p.x + Math.cos(angle) * x, y: p.y + y, z: p.z + Math.sin(angle) * x }, id);
        // A readable, rotating key silhouette: bow, shaft, and two teeth.
        for (let i = 0; i < 20; i++) {
            const a = i * Math.PI / 10;
            point(Math.cos(a) * 0.34, 0.65 + Math.sin(a) * 0.34);
        }
        for (let i = 0; i < 11; i++) point(0, 0.31 - i * 0.1);
        for (const y of [-0.4, -0.65]) for (let i = 1; i <= 3; i++) point(i * 0.1, y);
    }
    function sealRing(p, radius, height = 0) {
        for (let i = 0; i < 32; i++) {
            const a = i * Math.PI / 16;
            fx({ x: p.x + Math.cos(a) * radius, y: p.y + height, z: p.z + Math.sin(a) * radius }, GOLD);
        }
    }
    function ring(p, r, id) {
        for (let i = 0; i < 16; i++) {
            const a = (i * Math.PI) / 8;
            fx({ x: p.x + Math.cos(a) * r, y: p.y + 0.15, z: p.z + Math.sin(a) * r }, id);
        }
    }
    const players = (r) => api.players(r);
    function effect(p, id, ticks, amplifier = 0) {
        api.effect(p, id, ticks, amplifier);
    }
    function plague(p, count = 1) {
        for (const [id, ticks, amp] of chooseDistinct(PLAGUE_POOL, count, Math.random))
            effect(p, id, ticks, amp);
    }
    function allies(a, radius, seconds, ids, eliteOnly = false) {
        for (const other of actors.values())
            if (
                other.room === a.room &&
                distance(a.entity.location, other.entity.location) <= radius &&
                (!eliteOnly || other.slot.mob.startsWith("enchanted_") || other.slot.mob === "crimson")
            )
                for (const id of ids) effect(other.entity, id, seconds * 20);
    }
    function zone(a, position, radius, duration, mode, period = 20) {
        zones.push({
            room: a.room,
            source: a.entity,
            position: { ...position },
            radius,
            until: api.tick() + duration,
            next: api.tick(),
            period,
            mode,
        });
    }
    function bolt(a, p, kind) {
        if (!p) return;
        const origin = { ...a.entity.location, y: a.entity.location.y + 1.3 },
            dest = { ...p.location, y: p.location.y + 1 };
        const d = distance(origin, dest) || 1;
        bolts.push({
            room: a.room,
            source: a.entity,
            position: origin,
            velocity: {
                x: ((dest.x - origin.x) / d) * 0.45,
                y: ((dest.y - origin.y) / d) * 0.45,
                z: ((dest.z - origin.z) / d) * 0.45,
            },
            kind,
            until: api.tick() + 80,
        });
    }
    function hitBolt(b, p) {
        api.damage(p, MOB_BALANCE[api.slot(b.source)?.mob]?.damage ?? 4, b.source);
        if (b.kind === "nightmare_bolt") {
            effect(p, "blindness", 80);
            effect(p, "darkness", 140);
        }
        if (b.kind === "rot_bolt") {
            const poisoned = !!p.getEffect("poison"),
                old = p.getEffect("hunger")?.duration ?? 0;
            effect(p, "poison", 160);
            effect(p, "hunger", poisoned ? Math.min(400, Math.max(240, old) + 100) : 240, 1);
        }
        if (b.kind === "plague_bolt") plague(p, 2);
    }
    function cast(a, id, delay, tick) {
        const party = players(a.room),
            origin = { ...a.entity.location };
        const selected = chooseDistinct(party, id === "blood_mark" && party.length > 1 ? 2 : 1, Math.random);
        const points = selected.map((p) => ({ ...p.location }));
        casts.push({
            a,
            id,
            due: tick + delay,
            origin,
            points,
            targets: selected.map((p) => p.id),
            facing: a.entity.getViewDirection(),
        });
        if (delay) {
            ring(
                origin,
                id === "wraith_burst" ? 7 : id === "nightmare_wave" ? 8 : id === "plague_wave" ? 9 : 4.5,
            );
            points.forEach((p) => ring(p, id === "blood_mark" ? 2.5 : 2));
        }
    }
    function execute(c, tick) {
        const { a, id, origin, points, facing } = c;
        if (!actors.has(a.entity.id) || a.room.state !== "Active") return;
        const party = players(a.room),
            target = party.find((p) => c.targets.includes(p.id));
        if (id.endsWith("_bolt")) {
            bolt(a, target, id);
            return;
        }
        switch (id) {
            case "command":
                allies(a, 10, 8, ["speed", "strength"]);
                a.lastCommand = tick;
                break;
            case "weak_command":
                allies(a, 8, 6, ["speed", "strength"]);
                break;
            case "formation":
                allies(a, 7, 6, ["resistance"]);
                break;
            case "crimson_command":
                allies(a, 12, 7, ["strength", "speed", "resistance"], true);
                break;
            case "summon":
            case "weak_summon":
                api.summon(a.room, a.entity.id, 2, id === "summon" ? 4 : 3, "zombie");
                break;
            case "curse_mark":
                if (target) {
                    effect(target, "weakness", 160);
                    effect(target, "hunger", 200, 1);
                }
                break;
            case "forbidden":
                zone(a, origin, 8, 240, "forbidden");
                effect(a.entity, "slowness", 240, 1);
                break;
            case "nightmare_wave":
                party
                    .filter((p) => distance(p.location, origin) <= 8)
                    .forEach((p) => effect(p, "blindness", 60));
                break;
            case "plague_wave":
                party.filter((p) => distance(p.location, origin) <= 9).forEach((p) => plague(p));
                break;
            case "rot_pool":
                for (const p of points) zone(a, p, 2.5, 140, "rot");
                break;
            case "fire":
            case "weak_fire": {
                const center = points[0] ?? origin,
                    count = id === "fire" ? 3 : 2;
                for (let i = 0; i < count; i++)
                    zone(
                        a,
                        { x: center.x + (i - 1) * 3, y: center.y, z: center.z + (i % 2) * 3 },
                        2,
                        140,
                        "fire",
                    );
                break;
            }
            case "ghost_step": {
                const point = api.safeTeleport(a.room, a.entity.location, 6, 12);
                if (point) a.entity.teleport(point);
                break;
            }
            case "wraith_burst":
                for (const p of party) {
                    const d = distance(p.location, origin);
                    if (d >= 3 && d <= 7) api.damage(p, 18, a.entity, 1.8);
                }
                break;
            case "sweep":
            case "breach":
            case "weak_breach":
                for (const p of party)
                    if (
                        inCone(
                            origin,
                            facing,
                            p.location,
                            id === "sweep" ? 4.5 : 5,
                            id === "sweep" ? 120 : 90,
                        )
                    )
                        api.damage(
                            p,
                            id === "sweep" ? 14 : id === "breach" ? 20 : 16,
                            a.entity,
                            id === "sweep" ? 1 : 1.8,
                        );
                break;
            case "blood_mark":
                for (const p of party)
                    if (points.some((q) => distance(p.location, q) <= 2.5)) api.damage(p, 18, a.entity);
                break;
            case "transform":
                a.transformed = true;
                api.speed(a.entity, 1.25);
                for (const p of party)
                    if (distance(p.location, origin) <= 8) api.damage(p, 10, a.entity, 1.5);
                break;
        }
    }
    function register(room, slot, entity) {
        const tick = api.tick(),
            spec =
                slot.mob === "overseer"
                    ? room.overseerAbilities.map((id) => [id, ...weak[id]])
                    : (abilities[slot.mob] ?? []);
        actors.set(entity.id, {
            room,
            slot,
            entity,
            spec,
            next: new Map(spec.map(([id, cd]) => [id, tick + cd])),
            threshold: false,
            transformed: false,
            lastCommand: -10000,
        });
    }
    function update(tick) {
        for (const a of actors.values()) {
            if (a.room.state !== "Active") continue;
            try {
                const h = a.entity.getComponent("minecraft:health"),
                    fraction = h.currentValue / h.effectiveMax;
                if (!a.threshold && fraction <= (a.slot.mob === "iron_general" ? 0.3 : 0.5)) {
                    a.threshold = true;
                    if (a.slot.mob === "nightmare") api.summon(a.room, a.entity.id, 2, 2, "clone");
                    if (a.slot.mob === "plague")
                        for (let i = 0; i < 3; i++) {
                            const pos = api.safeTeleport(a.room, a.entity.location, 2, 8);
                            if (pos) zone(a, pos, 3, 300, "plague", 80);
                        }
                    if (a.slot.mob === "arch_curse") cast(a, "forbidden", 0, tick);
                    if (a.slot.mob === "wraith_lord") cast(a, "wraith_burst", 50, tick);
                    if (a.slot.mob === "crimson") {
                        effect(a.entity, "slowness", 60, 255);
                        cast(a, "transform", 60, tick);
                    }
                    if (a.slot.mob === "iron_general") api.speed(a.entity, 1.3);
                }
                for (const [id, cd, delay] of a.spec)
                    if (tick >= a.next.get(id)) {
                        if (id === "formation" && tick - a.lastCommand < 120) continue;
                        if (id === "ghost_step") effect(a.entity, "invisibility", 14);
                        cast(a, id, delay, tick);
                        const factor =
                            a.slot.mob === "iron_general" && a.threshold ? 0.7 : a.transformed ? 0.75 : 1;
                        a.next.set(id, tick + Math.round(cd * factor));
                    }
            } catch (error) {
                api.warn(error);
            }
        }
        for (let i = casts.length - 1; i >= 0; i--) {
            const c = casts[i];
            if (tick >= c.due) {
                casts.splice(i, 1);
                execute(c, tick);
            } else if (tick % 10 === 0) {
                ring(c.origin, c.id === "wraith_burst" ? 7 : 4.5);
                c.points.forEach((p) => ring(p, 2.5));
            }
        }
        for (let i = zones.length - 1; i >= 0; i--) {
            const z = zones[i];
            if (tick >= z.until || z.room.state !== "Active") {
                zones.splice(i, 1);
                continue;
            }
            if (tick < z.next) continue;
            z.next = tick + z.period;
            ring(z.position, z.radius);
            if (z.mode === "forbidden") {
                const a = actors.get(z.source.id);
                if (a) allies(a, 8, 2, ["strength", "resistance"]);
                continue;
            }
            for (const p of players(z.room))
                if (distance(p.location, z.position) <= z.radius) {
                    if (z.mode === "fire") api.damage(p, 4, z.source);
                    if (z.mode === "plague") plague(p);
                    if (z.mode === "rot") {
                        effect(p, "poison", 40);
                        effect(p, "hunger", 40);
                    }
                }
        }
        for (let i = bolts.length - 1; i >= 0; i--) {
            const b = bolts[i];
            let done = tick >= b.until || b.room.state !== "Active";
            // Sweep substeps so a five-tick update cannot tunnel through walls/players.
            for (let step = 0; step < 5 && !done; step++) {
                for (const axis of ["x", "y", "z"]) b.position[axis] += b.velocity[axis];
                done = api.solid(b.position);
                const hit = players(b.room).find(
                    (p) => distance({ ...p.location, y: p.location.y + 1 }, b.position) < 0.9,
                );
                if (hit) {
                    hitBolt(b, hit);
                    done = true;
                }
            }
            if (done) bolts.splice(i, 1);
            else fx(b.position, "minecraft:witchspell_emitter");
        }
        for (let i = flights.length - 1; i >= 0; i--) {
            const f = flights[i], age = tick - f.start;
            if (f.room.retired) { flights.splice(i, 1); continue; }
            if (age < 60) {
                const t = Math.max(0, (age - 15) / 45), smooth = t * t * (3 - 2 * t), p = {};
                for (const axis of ["x", "y", "z"]) p[axis] = f.from[axis] + (f.to[axis] - f.from[axis]) * smooth;
                p.y += 1.5 + Math.sin(t * Math.PI) * 2.5;
                const color = f.crimson && age < 25 ? CRIMSON : GOLD;
                keyShape(p, age * 0.08, color);
                if (f.previous) for (let j = 1; j <= 6; j++) {
                    const q = {};
                    for (const axis of ["x", "y", "z"]) q[axis] = f.previous[axis] + (p[axis] - f.previous[axis]) * j / 6;
                    fx(q, color);
                }
                f.previous = p;
                sealRing(f.to, 0.9, 0.1);
                if (age % 15 === 0) api.sound("random.orb", p, { volume: 0.8, pitch: 0.7 + age / 70 });
            } else {
                if (!f.arrived) {
                    f.arrived = true;
                    fx(f.to, "dungeons:open_gold_chest");
                    api.sound("random.levelup", f.to, { volume: 1.5, pitch: 0.85 });
                    api.sound("random.chestopen", f.to, { volume: 1.2, pitch: 0.7 });
                    api.unlock(f.room);
                }
                const expansion = Math.min(1, (age - 60) / 25);
                sealRing(f.to, 0.5 + expansion * 3.5, 0.25);
                sealRing(f.to, 0.4 + expansion * 1.8, 0.5 + expansion * 1.6);
            }
            if (age >= 90) {
                flights.splice(i, 1);
            }
        }
    }
    return {
        register,
        update,
        actors,
        remove(id) {
            actors.delete(id);
        },
        clear(room) {
            for (const [id, a] of actors) if (a.room === room) actors.delete(id);
            for (const list of [casts, zones, bolts, flights])
                for (let i = list.length - 1; i >= 0; i--)
                    if ((list[i].room ?? list[i].a?.room) === room) list.splice(i, 1);
        },
        unlockFlight(room, from, to, crimson) {
            if (flights.some(f => f.room === room)) return;
            fx(from, "dungeons:open_gold_chest");
            api.sound("random.orb", from, { volume: 1, pitch: 0.6 });
            flights.push({ room, from: { ...from }, to: { x: to.x + 0.5, y: to.y + 0.8, z: to.z + 0.5 }, crimson, start: api.tick() });
        },
        metrics() {
            return {
                hazards: zones.length,
                abilityTimers: [...actors.values()].reduce((n, a) => n + a.next.size, 0) + casts.length,
                projectiles: bolts.length,
            };
        },
    };
}

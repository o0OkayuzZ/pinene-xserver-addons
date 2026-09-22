import { world, system } from "@minecraft/server";

const PROJECTILE_ID = "pinene:bomb_bolt_projectile";

const EXPLOSION_PROFILES = Object.freeze({
  "pinene:bomb_crossbow": { depth: 0, radius: 4 },
  "pinene:bomb_crossbow_awakened_1": { depth: 1, radius: 5 },
  "pinene:bomb_crossbow_awakened_2": { depth: 2, radius: 6 },
  "pinene:bomb_crossbow_awakened_3": { depth: 3, radius: 7 }
});

const PROFILE_BY_DEPTH = Object.freeze([
  EXPLOSION_PROFILES["pinene:bomb_crossbow"],
  EXPLOSION_PROFILES["pinene:bomb_crossbow_awakened_1"],
  EXPLOSION_PROFILES["pinene:bomb_crossbow_awakened_2"],
  EXPLOSION_PROFILES["pinene:bomb_crossbow_awakened_3"]
]);

const exploded = new Set();

function weaponProfile(owner) {
  if (!owner?.isValid || owner.typeId !== "minecraft:player") return PROFILE_BY_DEPTH[0];
  try {
    const held = owner.getComponent("minecraft:equippable")?.getEquipment("Mainhand");
    return EXPLOSION_PROFILES[held?.typeId] ?? PROFILE_BY_DEPTH[0];
  } catch {
    return PROFILE_BY_DEPTH[0];
  }
}

function projectileProfile(projectile) {
  const raw = Number(projectile.getDynamicProperty("pinene:bomb_depth") ?? 0);
  const depth = Number.isFinite(raw) ? Math.max(0, Math.min(3, Math.trunc(raw))) : 0;
  return PROFILE_BY_DEPTH[depth];
}

// Capture awakening depth at launch, not at impact. Switching weapons after firing
// must never change the projectile's explosion power.
world.afterEvents.entitySpawn.subscribe((event) => {
  const projectile = event.entity;
  if (!projectile?.isValid || projectile.typeId !== PROJECTILE_ID) return;
  const owner = projectile.getComponent("minecraft:projectile")?.owner;
  const profile = weaponProfile(owner);
  projectile.setDynamicProperty("pinene:bomb_depth", profile.depth);
});

function detonate(projectile, location, dimension) {
  if (!projectile?.isValid || projectile.typeId !== PROJECTILE_ID) return;
  const projectileId = projectile.id;
  if (exploded.has(projectileId)) return;
  exploded.add(projectileId);

  const profile = projectileProfile(projectile);
  const owner = projectile.getComponent("minecraft:projectile")?.owner;
  const safeOwner = owner?.isValid ? owner : undefined;

  // Real Bedrock explosion:
  // - terrain destruction ON
  // - fire generation explicitly OFF
  // - explosion radius scales with awakening depth
  try {
    const options = {
      breaksBlocks: true,
      causesFire: false
    };
    if (safeOwner) options.source = safeOwner;
    dimension.createExplosion(location, profile.radius, options);
  } catch (error) {
    console.warn(`[BombCrossbow] explosion failed at depth ${profile.depth}: ${error}`);
  }

  system.run(() => {
    try {
      if (projectile.isValid) projectile.remove();
    } finally {
      exploded.delete(projectileId);
    }
  });
}

world.afterEvents.projectileHitBlock.subscribe((event) => {
  const projectile = event.projectile;
  if (projectile?.typeId !== PROJECTILE_ID) return;
  detonate(projectile, event.location, event.dimension);
});

world.afterEvents.projectileHitEntity.subscribe((event) => {
  const projectile = event.projectile;
  if (projectile?.typeId !== PROJECTILE_ID) return;
  const hit = event.getEntityHit()?.entity;
  const dimension = hit?.dimension ?? projectile.dimension;
  detonate(projectile, event.location, dimension);
});

console.info("[BombCrossbow] v0.2 awakening-depth terrain explosion runtime loaded");

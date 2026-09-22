import { world, system, EntityDamageCause } from "@minecraft/server";

const PROJECTILE_ID = "pinene:bomb_bolt_projectile";
const EXPLOSION_RADIUS = 4;
const MAX_EXPLOSION_DAMAGE = 12;
const MIN_EXPLOSION_DAMAGE = 4;
const exploded = new Set();

function canDamage(target, owner) {
  if (!target?.isValid) return false;
  if (!target.getComponent("minecraft:health")) return false;
  if (target.typeId === PROJECTILE_ID) return false;

  if (target.typeId === "minecraft:player") {
    try {
      if (target.getGameMode() === "Creative") return false;
    } catch {}
    if (target === owner) return true;
    if (owner?.typeId === "minecraft:player" && world.gameRules.pvp === false) return false;
  }

  return true;
}

function damageAtDistance(distance) {
  return Math.max(MIN_EXPLOSION_DAMAGE, MAX_EXPLOSION_DAMAGE - Math.floor(distance) * 2);
}

function applyBlastKnockback(target, location) {
  const dx = target.location.x - location.x;
  const dz = target.location.z - location.z;
  const length = Math.hypot(dx, dz);
  if (length < 0.001) return;
  try {
    target.applyKnockback({ x: (dx / length) * 0.85, z: (dz / length) * 0.85 }, 0.3);
  } catch {}
}

function detonate(projectile, location, dimension) {
  if (!projectile?.isValid || projectile.typeId !== PROJECTILE_ID) return;
  const projectileId = projectile.id;
  if (exploded.has(projectileId)) return;
  exploded.add(projectileId);

  const owner = projectile.getComponent("minecraft:projectile")?.owner;
  const safeOwner = owner?.isValid ? owner : undefined;

  try {
    dimension.spawnParticle("minecraft:explosion_particle", location);
  } catch {}
  try {
    dimension.playSound("random.explode", location, { volume: 1.15, pitch: 0.8 });
  } catch {}

  for (const target of dimension.getEntities({ location, maxDistance: EXPLOSION_RADIUS })) {
    if (!canDamage(target, safeOwner)) continue;

    const distance = Math.hypot(
      target.location.x - location.x,
      target.location.y - location.y,
      target.location.z - location.z
    );
    const damage = damageAtDistance(distance);
    try {
      const options = safeOwner
        ? { cause: EntityDamageCause.entityExplosion, damagingEntity: safeOwner }
        : { cause: EntityDamageCause.entityExplosion };
      target.applyDamage(damage, options);
      applyBlastKnockback(target, location);
    } catch {}
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

console.info("[BombCrossbow] v0.1 runtime loaded");

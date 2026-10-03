import { world, system, EntityDamageCause } from "@minecraft/server";

import { getDirection, makeVector } from "main.js";
const id = "accelerate";

world.afterEvents.entitySpawn.subscribe((e) => {
  const entity = e.entity;
  if (!entity || !entity.isValid || entity.typeId !== "minecraft:arrow") return;
  const projectile = entity.getComponent("projectile");
  if (!projectile) return;
  if (projectile.owner.hasTag("dungeons:enchanted_mob_" + id)) {
    const v = entity.getVelocity();
    entity.applyImpulse({
      x: v.x * 1.5,
      y: v.y,
      z: v.z * 1.5,
    });
  }
});

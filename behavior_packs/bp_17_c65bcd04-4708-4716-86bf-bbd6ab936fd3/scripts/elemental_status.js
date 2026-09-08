import { world, system, EquipmentSlot, EntityDamageCause } from "@minecraft/server";

const CHARGED = "pinene_pvp:charged";
const DIVINE_SIGHT = "pinene_pvp:divine_sight";
const WEDGE = "pinene_pvp:tenrai_wedge";
const SIGHT_ARROW = "pinene_pvp:shingan_arrow";
const PINE_DIMENSION = "pinene_pvp:pvp_island";
const DIMENSIONS = [PINE_DIMENSION, "overworld", "nether", "the_end"];
const expiry = new Map();

function addTimedTag(entity, tag, ticks) {
  try {
    entity.addTag(tag);
    expiry.set(`${entity.id}:${tag}`, world.getAbsoluteTime() + ticks);
  } catch {}
}

function removeTimedTag(entity, tag) {
  try { entity.removeTag(tag); } catch {}
  expiry.delete(`${entity.id}:${tag}`);
}

world.afterEvents.entityHurt.subscribe((event) => {
  const attacker = event.damageSource?.damagingEntity;
  const target = event.hurtEntity;
  if (!attacker || !target || attacker.typeId !== "minecraft:player") return;
  if (attacker.dimension.id !== PINE_DIMENSION) return;
  try {
    const equip = attacker.getComponent("minecraft:equippable");
    const held = equip?.getEquipment(EquipmentSlot.Mainhand);
    if (held?.typeId !== WEDGE) return;
    addTimedTag(target, CHARGED, 200);
    held.amount -= 1;
    equip?.setEquipment(EquipmentSlot.Mainhand, held.amount > 0 ? held : undefined);
    attacker.playSound("ambient.weather.thunder");
  } catch {}
});

world.afterEvents.entityHurt.subscribe((event) => {
  const target = event.hurtEntity;
  if (!target) return;
  try {
    if (target.hasTag(CHARGED) && event.damageSource?.cause === EntityDamageCause.lightning) {
      target.applyDamage(Math.max(1, Math.pow(event.damage, 3) - event.damage));
    }
    const attacker = event.damageSource?.damagingEntity;
    if (!attacker || attacker.dimension.id !== PINE_DIMENSION || !attacker.hasTag(DIVINE_SIGHT)) return;
    const extra = Math.max(0, Math.pow(event.damage, 1.5) - event.damage);
    if (extra > 0) target.applyDamage(extra);
    removeTimedTag(attacker, DIVINE_SIGHT);
  } catch {}
});

world.afterEvents.projectileHitEntity.subscribe((event) => {
  const projectile = event.projectile;
  if (!projectile || projectile.typeId !== SIGHT_ARROW) return;
  try {
    const owner = projectile.getComponent("minecraft:projectile")?.owner;
    if (owner && owner.dimension.id === PINE_DIMENSION) {
      addTimedTag(owner, DIVINE_SIGHT, 200);
      owner.sendMessage("§d§l神眼 発動！§r §7次の一撃の威力 = ダメージ^1.5");
      owner.playSound("random.orb");
    }
  } catch {}
});

system.runInterval(() => {
  const now = world.getAbsoluteTime();
  for (const player of world.getAllPlayers()) {
    if (player.dimension.id !== PINE_DIMENSION) continue;
    const held = player.getComponent("minecraft:equippable")?.getEquipment("Mainhand");
    if (player.dimension.id === PINE_DIMENSION && player.hasTag(DIVINE_SIGHT)) {
      player.onScreenDisplay.setActionBar("§d§l神眼 発動中§r §7| 次の一撃の威力 = ダメージ^1.5");
    } else if (held?.typeId === WEDGE) {
      player.onScreenDisplay.setActionBar(player.dimension.id === PINE_DIMENSION
        ? "§e天雷の楔 §7| 攻撃対象を帯電状態にする | 雷ダメージ = 元のダメージ^3"
        : "§7天雷の楔 §8| ピネディメンション内で能力発動 | 雷ダメージ = 元のダメージ^3");
    } else if (held?.typeId === SIGHT_ARROW) {
      player.onScreenDisplay.setActionBar(player.dimension.id === PINE_DIMENSION
        ? "§b神眼の矢 §7| 命中後、次の一撃の威力 = ダメージ^1.5"
        : "§7神眼の矢 §8| ピネディメンション内で能力発動 | 次の一撃 = ダメージ^1.5");
    }
  }
  for (const dimensionId of DIMENSIONS) {
    for (const entity of world.getDimension(dimensionId).getEntities()) {
      for (const tag of [CHARGED, DIVINE_SIGHT]) {
        const end = expiry.get(`${entity.id}:${tag}`);
        if (end !== undefined && now >= end) removeTimedTag(entity, tag);
      }
      if (entity.hasTag(CHARGED)) {
        try { entity.dimension.spawnParticle("minecraft:critical_hit_emitter", { x: entity.location.x, y: entity.location.y + 1, z: entity.location.z }); } catch {}
      }
    }
  }
}, 20);

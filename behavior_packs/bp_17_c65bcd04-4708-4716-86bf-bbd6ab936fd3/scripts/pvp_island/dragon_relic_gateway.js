import { system, world } from "@minecraft/server";
import { IDS, POC } from "./config.js";

const pending = new Set();
const returnPoints = new Map();
const CHARGE_TICKS = 30;

function playSound(player, sound, volume = 1, pitch = 1) {
  try { player.playSound(sound, { volume, pitch }); } catch {}
}

function particle(dimension, id, location) {
  try { dimension.spawnParticle(id, location); } catch {}
}

function actionbar(player, text) {
  try { player.onScreenDisplay?.setActionBar?.(text); } catch {}
}

function effectLocation(player, center) {
  let view;
  try { view = player.getViewDirection(); } catch { view = { x: 0, y: 0, z: 1 }; }
  return {
    x: center.x - view.x * 0.35,
    y: center.y + 0.45,
    z: center.z - view.z * 0.35,
  };
}

function relicCenter(block) {
  return { x: block.location.x + 0.5, y: block.location.y + 0.8, z: block.location.z + 0.5 };
}

function ring(dimension, center, radius, count, particleId) {
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count;
    particle(dimension, particleId, {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + 0.05 + Math.sin(angle * 2) * 0.08,
      z: center.z + Math.sin(angle) * radius,
    });
  }
}

function chargeFx(player, center, progress) {
  const dimension = player.dimension;
  ring(dimension, center, 0.65 + progress * 0.35, 28, "minecraft:endrod");
  riftFx(player, center, progress);
  slashFx(player, center, progress);
  for (let i = 0; i < 5; i += 1) {
    const angle = (Math.random() * Math.PI * 2) + progress * 10;
    const radius = 0.15 + Math.random() * 0.6;
    particle(dimension, "minecraft:portal_direction", {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + 0.1 + Math.random() * (0.5 + progress * 1.2),
      z: center.z + Math.sin(angle) * radius,
    });
  }
}

function riftFx(player, center, progress) {
  const dimension = player.dimension;
  let view;
  try { view = player.getViewDirection(); } catch { view = { x: 0, y: 0, z: 1 }; }
  const length = Math.hypot(view.x, view.z) || 1;
  const side = { x: -view.z / length, z: view.x / length };
  const pulse = 0.92 + Math.sin(progress * Math.PI * 8) * 0.08;
  for (let i = 0; i < 56; i += 1) {
    const t = (i / 33) * Math.PI * 2;
    const width = Math.cos(t) * (0.7 + progress * 0.3) * pulse;
    const height = Math.sin(t) * 1.25;
    const point = {
      x: center.x + side.x * width - view.x * 0.18,
      y: center.y + 0.65 + height,
      z: center.z + side.z * width - view.z * 0.18,
    };
    particle(dimension, i % 3 === 0 ? "minecraft:dragon_breath_trail" : "minecraft:portal_direction", point);
  }
  for (let i = 0; i < 20; i += 1) {
    particle(dimension, "minecraft:basic_smoke_particle", {
      x: center.x + side.x * ((Math.random() - 0.5) * 0.35) - view.x * 0.2,
      y: center.y + 0.65 + (Math.random() - 0.5) * 1.8,
      z: center.z + side.z * ((Math.random() - 0.5) * 0.35) - view.z * 0.2,
    });
  }
}

function slashFx(player, center, progress) {
  const dimension = player.dimension;
  let view;
  try { view = player.getViewDirection(); } catch { view = { x: 0, y: 0, z: 1 }; }
  const length = Math.hypot(view.x, view.z) || 1;
  const side = { x: -view.z / length, z: view.x / length };
  const visible = Math.max(0.18, progress);
  const offsets = [-0.42, 0, 0.42];
  for (let claw = 0; claw < offsets.length; claw += 1) {
    const offset = offsets[claw];
    const tilt = (claw - 1) * 0.12;
    for (let i = 0; i < 14; i += 1) {
      const along = (i / 13) * 2 - 1;
      if (Math.abs(along) > visible) continue;
      const point = {
        x: center.x + side.x * (offset + along * tilt) - view.x * 0.28,
        y: center.y + 0.72 + along * 0.62,
        z: center.z + side.z * (offset + along * tilt) - view.z * 0.28,
      };
      particle(dimension, i % 3 === 0 ? "minecraft:basic_flame_particle" : "minecraft:lava_particle", point);
      if (i % 4 === 0) particle(dimension, "minecraft:endrod", point);
    }
  }
}

function arrivalFx(dimension, center) {
  ring(dimension, center, 0.8, 48, "minecraft:endrod");
  for (let i = 0; i < 45; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 0.9;
    particle(dimension, "minecraft:dragon_breath_trail", {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.random() * 1.8,
      z: center.z + Math.sin(angle) * radius,
    });
  }
  playSoundAt(dimension, "mob.endermen.portal", center, 1, 0.8);
  playSoundAt(dimension, "random.totem", center, 0.7, 1.2);
}

function playSoundAt(dimension, sound, location, volume = 1, pitch = 1) {
  try { dimension.playSound(sound, location, { volume, pitch }); } catch {}
}

function saveReturnPoint(player) {
  returnPoints.set(player.id, {
    dimensionId: player.dimension.id,
    location: { ...player.location },
  });
}

function getDestination(player) {
  const saved = returnPoints.get(player.id);
  if (player.dimension.id === IDS.dimension && saved) {
    return { dimension: world.getDimension(saved.dimensionId), location: saved.location, returning: true };
  }
  if (player.dimension.id === IDS.dimension) {
    return {
      dimension: world.getDimension("minecraft:overworld"),
      location: world.getDefaultSpawnLocation(),
      returning: true,
    };
  }
  saveReturnPoint(player);
  return {
    dimension: world.getDimension(IDS.dimension),
    location: { x: POC.center.x + 0.5, y: POC.center.y + 1, z: POC.center.z + 0.5 },
    returning: false,
  };
}

export function startDragonRelicTransfer(player, block) {
  if (pending.has(player.id)) return;
  pending.add(player.id);
  const center = relicCenter(block);
  const effectCenter = effectLocation(player, center);
  const target = getDestination(player);
  const label = target.returning ? "竜の遺物が帰還の道を開いている…" : "竜の遺物が異空間への道を開いている…";
  actionbar(player, label);
  particle(player.dimension, "pinene_pvp:dragon_relic_rift", effectCenter);
  playSound(player, "mob.enderdragon.growl", 0.7, 1.1);
  playSound(player, "mob.endermen.portal", 0.8, 0.7);
  actionbar(player, label);

  system.runTimeout(() => {
    if (!pending.has(player.id)) return;
    pending.delete(player.id);
    try {
      player.teleport(target.location, { dimension: target.dimension, checkForBlocks: true });
      playSound(player, "mob.endermen.portal", 1.0, 1.0);
      playSound(player, "random.totem", 0.6, 1.2);
      actionbar(player, target.returning ? "帰還しました" : "ピネディメンションへ到着しました");
    } catch (error) {
      console.warn(`[pinene_pvp] Dragon relic transfer failed: ${error}`);
      actionbar(player, "転送に失敗しました");
    }
  }, CHARGE_TICKS);
}

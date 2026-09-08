import { ItemStack, system, world } from "@minecraft/server";
import { IDS } from "./config.js";
import { startDragonRelicTransfer } from "./dragon_relic_gateway.js";

const COMPONENT_ID = "pinene_pvp:dragon_relic_display_sync";
const DISPLAY_RADIUS = 0.45;
const RECONCILE_INTERVAL = 100;
const DROPPED_RELIC_INTERVAL = 10;
const DROPPED_PICKUP_RADIUS = 1.25;
const DROPPED_PICKUP_LOCK = "pinene_pvp:pickup_locked";
const DIMENSION_IDS = [
  IDS.dimension,
  "minecraft:overworld",
  "minecraft:nether",
  "minecraft:the_end",
];

function displayCenter(blockLocation) {
  return {
    x: Math.floor(blockLocation.x) + 0.5,
    y: Math.floor(blockLocation.y),
    z: Math.floor(blockLocation.z) + 0.5,
  };
}

function displaysAt(dimension, blockLocation) {
  if (!dimension || !blockLocation) return [];
  try {
    return dimension.getEntities({
      type: IDS.dragonRelicDisplay,
      location: displayCenter(blockLocation),
      maxDistance: DISPLAY_RADIUS,
    });
  } catch {
    return [];
  }
}

function ensureDisplay(dimension, blockLocation) {
  if (!dimension || !blockLocation) return;

  let block;
  try {
    block = dimension.getBlock(blockLocation);
  } catch {
    return;
  }
  if (!block || block.typeId !== IDS.dragonRelicBlock) return;

  const existing = displaysAt(dimension, blockLocation);
  if (existing.length > 0) {
    for (let index = 1; index < existing.length; index += 1) {
      try {
        existing[index].remove();
      } catch {
      }
    }
    return;
  }

  try {
    const display = dimension.spawnEntity(IDS.dragonRelicDisplay, displayCenter(blockLocation));
    display.setRotation({ x: 0, y: 0 });
  } catch (error) {
    console.error(`[pinene_pvp] Dragon relic display spawn failed: ${error}`);
  }
}

function removeDisplays(dimension, blockLocation) {
  for (const display of displaysAt(dimension, blockLocation)) {
    try {
      display.remove();
    } catch {
    }
  }
}

function captureBlockEvent(componentEvent, callback) {
  const block = componentEvent?.block;
  if (!block) return;
  const dimension = componentEvent.dimension ?? block.dimension;
  const location = { ...block.location };
  system.run(() => callback(dimension, location));
}

system.beforeEvents.startup.subscribe(({ blockComponentRegistry }) => {
  blockComponentRegistry.registerCustomComponent(COMPONENT_ID, {
    onPlace: (event) => captureBlockEvent(event, ensureDisplay),
    onTick: (event) => captureBlockEvent(event, ensureDisplay),
    onBreak: (event) => captureBlockEvent(event, removeDisplays),
    onPlayerInteract: (event) => {
      if (event?.player && event?.block) startDragonRelicTransfer(event.player, event.block);
    },
  });
});

function reconcileDisplays() {
  for (const dimensionId of DIMENSION_IDS) {
    let dimension;
    let displays;
    try {
      dimension = world.getDimension(dimensionId);
      displays = dimension.getEntities({ type: IDS.dragonRelicDisplay });
    } catch {
      continue;
    }

    const occupiedAnchors = new Set();
    for (const display of displays) {
      let location;
      try {
        location = display.location;
      } catch {
        continue;
      }

      const blockLocation = {
        x: Math.floor(location.x),
        y: Math.floor(location.y + 0.01),
        z: Math.floor(location.z),
      };
      const anchorKey = `${blockLocation.x},${blockLocation.y},${blockLocation.z}`;

      let block;
      try {
        block = dimension.getBlock(blockLocation);
      } catch {
        continue;
      }
      if (!block) continue;

      if (block.typeId !== IDS.dragonRelicBlock || occupiedAnchors.has(anchorKey)) {
        try {
          display.remove();
        } catch {
        }
        continue;
      }
      occupiedAnchors.add(anchorKey);
    }
  }
}

system.runInterval(reconcileDisplays, RECONCILE_INTERVAL);

function convertDroppedItem(entity) {
  try {
    if (!entity || entity.typeId !== "minecraft:item") return;
    const itemComponent = entity.getComponent("minecraft:item");
    if (itemComponent?.itemStack?.typeId !== IDS.dragonRelic) return;

    const dimension = entity.dimension;
    const location = { ...entity.location };
    const velocity = entity.getVelocity();
    const droppedRelic = dimension.spawnEntity(IDS.dragonRelicDropped, location);
    droppedRelic.addTag(DROPPED_PICKUP_LOCK);
    try {
      droppedRelic.applyImpulse(velocity);
    } catch {
    }
    entity.remove();

    system.runTimeout(() => {
      try {
        droppedRelic.removeTag(DROPPED_PICKUP_LOCK);
      } catch {
      }
    }, 10);
  } catch (error) {
    console.error(`[pinene_pvp] Dragon relic dropped-item conversion failed: ${error}`);
  }
}

world.afterEvents.entitySpawn.subscribe((event) => {
  system.run(() => convertDroppedItem(event.entity));
});

function pickupDroppedRelic(entity) {
  if (entity.hasTag(DROPPED_PICKUP_LOCK)) return false;

  let players;
  try {
    players = entity.dimension.getPlayers({
      location: entity.location,
      maxDistance: DROPPED_PICKUP_RADIUS,
    });
  } catch {
    return false;
  }

  for (const player of players) {
    try {
      const inventory = player.getComponent("minecraft:inventory")?.container;
      if (!inventory) continue;
      const remainder = inventory.addItem(new ItemStack(IDS.dragonRelic, 1));
      if (remainder) continue;
      entity.remove();
      player.playSound("random.pop", { volume: 0.2, pitch: 1.6 });
      return true;
    } catch {
    }
  }
  return false;
}

function reconcileDroppedRelics() {
  for (const dimensionId of DIMENSION_IDS) {
    let dimension;
    try {
      dimension = world.getDimension(dimensionId);
    } catch {
      continue;
    }

    try {
      for (const itemEntity of dimension.getEntities({ type: "minecraft:item" })) {
        convertDroppedItem(itemEntity);
      }
      for (const droppedRelic of dimension.getEntities({ type: IDS.dragonRelicDropped })) {
        pickupDroppedRelic(droppedRelic);
      }
    } catch {
    }
  }
}

system.runInterval(reconcileDroppedRelics, DROPPED_RELIC_INTERVAL);

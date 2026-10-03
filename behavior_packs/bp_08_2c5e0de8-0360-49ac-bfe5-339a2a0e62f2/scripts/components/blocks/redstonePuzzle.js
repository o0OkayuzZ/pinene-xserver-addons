import { world, system, BlockVolume } from "@minecraft/server";
system.beforeEvents.startup.subscribe((event) => {
  event.blockComponentRegistry.registerCustomComponent(
    "dungeons:redstone_puzzle_piece",
    {
      beforeOnPlayerPlace(e) {
        const block = e.block;
        const neighbours = [
          block.east(),
          block.west(),
          block.north(),
          block.south(),
        ];
        var firstNeighbour = undefined;
        for (const neigh of neighbours) {
          if (!firstNeighbour && neigh.typeId == e.permutationToPlace.type.id)
            firstNeighbour = neigh;
        }
        if (!firstNeighbour) return;
        const state = firstNeighbour.permutation.getState("dungeons:section");
        if (state < 5) {
          e.permutationToPlace = e.permutationToPlace.withState(
            "dungeons:section",
            state + 1,
          );
        }
      },
    },
  );
  event.blockComponentRegistry.registerCustomComponent(
    "dungeons:redstone_puzzle_button",
    {
      beforeOnPlayerPlace(e) {
        const block = e.block;
        const neighbours = [
          block.east(),
          block.west(),
          block.north(),
          block.south(),
          block.east(2),
          block.west(2),
          block.north(2),
          block.south(2),
        ];
        var firstNeighbour = undefined;
        for (const neigh of neighbours) {
          if (!firstNeighbour && neigh.typeId == e.permutationToPlace.type.id)
            firstNeighbour = neigh;
        }
        if (!firstNeighbour) return;
        const state = firstNeighbour.permutation.getState("dungeons:section");
        if (state < 4) {
          e.permutationToPlace = e.permutationToPlace.withState(
            "dungeons:section",
            state + 1,
          );
        }
      },
    },
  );
  event.blockComponentRegistry.registerCustomComponent(
    "dungeons:redstone_puzzle_button_pressed",
    {
      onTick(e, p) {
        const block = e.block;
        const dim = e.dimension;
        const params = p.params;
        const offSound = params.off_sound;

        const perm = block.permutation;
        const open = perm.getState("dungeons:pressed");
        if (open == true) {
          if (offSound) dim.playSound(offSound, block.location);
          const newPerm = perm.withState("dungeons:pressed", false);
          block.setPermutation(newPerm);
        }
      },
    },
  );
});

world.beforeEvents.playerInteractWithBlock.subscribe((e) => {
  const player = e.player;
  const block = e.block;
  if (!block) return;
  const dim = block.dimension;
  if (block.getComponent("dungeons:redstone_puzzle_button")) {
    const perm = block.permutation;
    const pressed = perm.getState("dungeons:pressed");
    if (pressed) return;
    if (player.isSneaking) {
      const equippable = player.getComponent("equippable");
      if (equippable.getEquipment("Mainhand")) return;
    }
    const comp = block.getComponent("dungeons:redstone_puzzle_button");
    if (!comp) return;
    if (player.getDynamicProperty("dungeons:button_interact_cooldown")) return;
    player.setDynamicProperty("dungeons:button_interact_cooldown", 4);
    e.cancel = true;
    system.run(() => {
      const params = comp.customComponentParameters.params;
      const onSound = params.on_sound;

      if (pressed == false) {
        if (onSound) dim.playSound(onSound, block.location);
        const newPerm = perm.withState("dungeons:pressed", true);
        block.setPermutation(newPerm);
        pressedButton(block, dim);
      }
    });
  }
});

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    const cd = player.getDynamicProperty("dungeons:button_interact_cooldown");
    if (!cd) continue;
    if (cd <= 0) {
      player.setDynamicProperty("dungeons:button_interact_cooldown", null);
    } else {
      player.setDynamicProperty("dungeons:button_interact_cooldown", cd - 1);
    }
  }
});

function activatePiece(block, dim) {
  dim.playSound("tile.piston.out", block.location);
  for (const part of block.getParts()) {
    part.setPermutation(part.permutation.withState("dungeons:active", true));
  }
}

function deactivatePiece(block, dim) {
  dim.playSound("tile.piston.in", block.location);
  for (const part of block.getParts()) {
    part.setPermutation(part.permutation.withState("dungeons:active", false));
  }
}

function toggle(block, dim) {
  const perm = block.permutation;
  if (perm.getState("dungeons:active")) {
    deactivatePiece(block, dim);
    return false;
  } else {
    activatePiece(block, dim);
    return true;
  }
}

function pressedButton(block, dim) {
  const vol = new BlockVolume(
    { x: block.x + 4, y: block.y, z: block.z + 4 },
    { x: block.x - 4, y: block.y, z: block.z - 4 },
  );
  const id = block.permutation.getState("dungeons:section");
  var sec1,
    sec2,
    sec3,
    sec4,
    sec5 = undefined;
  for (const blockLoc of vol.getBlockLocationIterator()) {
    const blockCheck = dim.getBlock(blockLoc);
    if (blockCheck.getComponent("dungeons:redstone_puzzle_piece")) {
      const basePiece = blockCheck.getParts()[0];
      const perm = basePiece.permutation;
      if (perm.getState("dungeons:section") == 1) sec1 = basePiece;
      if (perm.getState("dungeons:section") == 2) sec2 = basePiece;
      if (perm.getState("dungeons:section") == 3) sec3 = basePiece;
      if (perm.getState("dungeons:section") == 4) sec4 = basePiece;
      if (perm.getState("dungeons:section") == 5) sec5 = basePiece;
    }
  }
  if (!sec1 || !sec2 || !sec3 || !sec4 || !sec5)
    return console.warn("invalid puzzle formation");
  const secs = [sec1, sec2, sec3, sec4, sec5];
  var allActive = true;
  for (const sec of secs)
    if (!sec.permutation.getState("dungeons:active")) allActive = false;
  if (allActive) return;
  if (id == 1) {
    const activeStates = secs.map((s) =>
      s.permutation.getState("dungeons:active"),
    );
    const newStates = new Array(secs.length).fill(false);

    for (let i = 0; i < secs.length; i++) {
      if (!activeStates[i]) continue;
      const targetIndex = i === 0 ? secs.length - 1 : i - 1;
      newStates[targetIndex] = true;
    }

    for (let i = 0; i < secs.length; i++) {
      if (newStates[i] && !activeStates[i]) {
        activatePiece(secs[i], dim);
      } else if (!newStates[i] && activeStates[i]) {
        deactivatePiece(secs[i], dim);
      }
    }
  } else if (id == 2) {
    toggle(sec2, dim);
    toggle(sec4, dim);
  } else if (id == 3) {
    toggle(sec2, dim);
    toggle(sec3, dim);
    toggle(sec4, dim);
  } else if (id == 4) {
    const activeStates = secs.map((s) =>
      s.permutation.getState("dungeons:active"),
    );
    const newStates = new Array(secs.length).fill(false);
    for (let i = 0; i < secs.length; i++) {
      if (!activeStates[i]) continue;
      const targetIndex = i === secs.length - 1 ? 0 : i + 1;
      newStates[targetIndex] = true;
    }
    for (let i = 0; i < secs.length; i++) {
      if (newStates[i] && !activeStates[i]) {
        activatePiece(secs[i], dim);
      } else if (!newStates[i] && activeStates[i]) {
        deactivatePiece(secs[i], dim);
      }
    }
  }
  allActive = true;
  for (const sec of secs) if (!sec.permutation.getState("dungeons:active")) allActive = false;
  if (!allActive) return;

  findBars(sec3, dim);
}

function findBars(sec3, dim) {
  const barsVol = new BlockVolume(
    {
      x: sec3.x - 12,
      y: sec3.y - 3,
      z: sec3.z - 12,
    },
    {
      x: sec3.x + 12,
      y: sec3.y + 3,
      z: sec3.z + 12,
    },
  );
  var firstBars = undefined;
  var dist = 99999;
  for (const checkLoc of barsVol.getBlockLocationIterator()) {
    const isBar = dim.getBlock(checkLoc);
    if (isBar.typeId == "minecraft:iron_bars") {
      const newDist = getDistance(isBar.location, sec3.location);
      if (newDist > dist) continue;
      dist = newDist;
      firstBars = isBar;
    }
  }
  if (firstBars) {
    breakBars(firstBars, dim);
  }
}

function getDistance(loc1, loc2) {
  return Math.hypot(loc2.x - loc1.x, loc2.y - loc1.y, loc2.z - loc1.z);
}

const canBeReplaced = [
    "minecraft:iron_bars"
]

function breakBars(block, dim) {
  var verticalCol = [block];
  for (let i = 0; i < 2; i++) {
    if (canBeReplaced.includes(block.above(i + 1).typeId)) {
      verticalCol.push(block.above(i + 1));
    } else break;
  }
  for (let i = 0; i < 2; i++) {
    if (canBeReplaced.includes(block.below(i + 1).typeId)) {
      verticalCol.push(block.below(i + 1));
    } else break;
  }
  dim.playSound("block.key_lock.opened", block.center(), { pitch: 0.3 });
  breakBlock(block, true);
  for (const check of verticalCol) {
    breakBlock(check, false);
    hozCol(check);
  }
}

function hozCol(block) {
    const horizontalCol = []
    for (let i = 0; i < 5; i++) {
        if (canBeReplaced.includes(block.west(i + 1).typeId)) {
            horizontalCol.push(block.west(i + 1))
        } else break;
    }
    for (let i = 0; i < 5; i++) {
        if (canBeReplaced.includes(block.east(i + 1).typeId)) {
            horizontalCol.push(block.east(i + 1))
        } else break;
    }
    for (let i = 0; i < 5; i++) {
        if (canBeReplaced.includes(block.north(i + 1).typeId)) {
            horizontalCol.push(block.north(i + 1))
        } else break;
    }
    for (let i = 0; i < 5; i++) {
        if (canBeReplaced.includes(block.south(i + 1).typeId)) {
            horizontalCol.push(block.south(i + 1))
        } else break;
    }
    for (let i = 0; i < horizontalCol.length; i++) {
        system.runTimeout(() => {
            const check2 = horizontalCol[i]
            breakBlock(check2, false)
            breakBlock(check2.east(), false)
            breakBlock(check2.north(), false)
            breakBlock(check2.west(), false)
            breakBlock(check2.south(), false)
        })
    }
}

function breakBlock(block, bypass) {
    if (canBeReplaced.includes(block.typeId) || bypass) {
        block.setType("air")
        block.dimension.spawnParticle("dungeons:tuff", block.center())
        system.runTimeout(() => {
            block.dimension.playSound("break.heavy_core", block.location, { volume: 1, pitch: Math.random() / 2 + 0.7 })
        }, Math.floor(Math.random() * 5))
    }
}


/*

puzzle 1:

5 pieces 4 buttons

button 1: moves all active pieces down, one to its left goes up
button 2: toggles state for the 2 and 4th pieces
button 3: toggles state for the 2,3,4 pieces
button4: same as 1, but in the opposite direction

*/

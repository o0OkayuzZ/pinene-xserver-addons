import { system, world, GameMode, ItemStack, LocationInUnloadedChunkError } from "@minecraft/server";

const ORE_ITEM_MAP = {
	"coal": "minecraft:coal",
	"copper": "minecraft:raw_copper",
	"diamond": "minecraft:diamond",
	"echo": "minecraft:echo_shard",
	"emerald": "minecraft:emerald",
	"gold": "minecraft:raw_gold",
	"iron": "minecraft:raw_iron",
	"lapis_lazuli": "minecraft:lapis_lazuli",
	"netherite": "minecraft:netherite_scrap",
	"redstone": "minecraft:redstone",
	"quartz": "minecraft:quartz",
	"amethyst": "minecraft:amethyst_shard"
};

const ROSE_QUARTZ_POOL = [
	"minecraft:coal",
	"minecraft:raw_copper",
	"minecraft:diamond",
	"minecraft:echo_shard",
	"minecraft:emerald",
	"minecraft:raw_gold",
	"minecraft:raw_iron",
	"minecraft:lapis_lazuli",
	"minecraft:netherite_scrap",
	"minecraft:redstone"
];

const NORMAL_CLUSTER_CHANCE = [0.02, 0.05, 0.08, 0.12];
const ROSE_QUARTZ_CHANCE = [0.25, 0.5, 0.75, 1.0];


function parseOreNameFromTypeId(typeId) {
	return typeId.replace(/^wx:(?:large_|medium_|small_|budding_)?/, "").replace(/_(?:bud|cluster|budding)$/, "");
}

function stageIds(ore) {
	return {
		small: `wx:small_${ore}_bud`,
		medium: `wx:medium_${ore}_bud`,
		large: `wx:large_${ore}_bud`
	};
}

function randomInt(minInclusive, maxInclusive) {
	return Math.floor(Math.random() * (maxInclusive - minInclusive + 1)) + minInclusive;
}

function choose(arr) {
	return arr[Math.floor(Math.random() * arr.length)];
}

function isSurvival(player) {
	return player?.getGameMode?.() === GameMode.Survival;
}

function getHeldTool(player) {
	const inv = player?.getComponent("minecraft:inventory")?.container;
	return inv?.getItem(player?.selectedSlotIndex);
}

function getEnchantable(player) {
	return getHeldTool(player)?.getComponent("minecraft:enchantable");
}

function hasEnchant(player, id) {
	const ench = getEnchantable(player);
	try {
		if (ench?.hasEnchantment) return ench.hasEnchantment(id);
	} catch {}
	try {
		if (ench?.includes) return ench.includes(id);
	} catch {}
	try {
		return !!ench?.getEnchantment?.(id);
	} catch {}
	return false;
}

function getFortuneLevel(player) {
	const ench = getEnchantable(player);
	try {
		const f = ench?.getEnchantment?.("minecraft:fortune");
		if (f?.level !== undefined) return Math.min(3, Math.max(0, f.level));
	} catch {}
	return hasEnchant(player, "minecraft:fortune") ? 1 : 0;
}

function hasSilkTouch(player) {
	return hasEnchant(player, "minecraft:silk_touch");
}

function isPickaxe(player) {
	const tool = getHeldTool(player);
	return !!tool?.typeId?.endsWith("_pickaxe");
}

function damageHeldTool(player) {
	const inv = player?.getComponent("minecraft:inventory")?.container;
	const slot = player?.selectedSlotIndex;
	const item = inv?.getItem(slot);
	const durability = item?.getComponent("minecraft:durability");
	if (!item || !durability) return;

	durability.damage += 1;
	if (durability.damage >= durability.maxDurability) {
		inv?.setItem(slot, undefined);
		return;
	}
	inv?.setItem(slot, item);
}

function setAttachedFaceOnBuddingNeighbor(block) {
	const ore = parseOreNameFromTypeId(block.typeId);
	const neighbors = {
		above: block.above(),
		below: block.below(),
		north: block.north(),
		south: block.south(),
		east: block.east(),
		west: block.west()
	};

	const faceForNeighbor = {
		south: "north",
		north: "south",
		east: "west",
		west: "east",
		above: "down",
		below: "up"
	};

	for (const dir of Object.keys(neighbors)) {
		const n = neighbors[dir];
		if (!n) continue;
		if (n.typeId === `wx:budding_${ore}`) {
			const currentFace = block.permutation.getState("minecraft:block_face");
			if (currentFace !== faceForNeighbor[dir]) {
				block.setPermutation(block.permutation.withState("minecraft:block_face", faceForNeighbor[dir]));
			}
			break;
		}
	}
}

function tickBuddingGrowth(block) {
	const ore = parseOreNameFromTypeId(block.typeId);
	const ids = stageIds(ore);
	const upgradeMap = {
		[ids.small]: ids.medium,
		[ids.medium]: ids.large,
		[ids.large]: `wx:${ore}_cluster`
	};

	const neighbors = {
		above: block.above(),
		below: block.below(),
		north: block.north(),
		south: block.south(),
		east: block.east(),
		west: block.west()
	};

	const growable = new Set(Object.keys(upgradeMap));
	for (const dir of Object.keys(neighbors)) {
		const n = neighbors[dir];
		if (!n) continue;
		if (n.typeId === `wx:budding_${ore}` && growable.has(block.typeId)) {
			block.setType(upgradeMap[block.typeId]);
			setAttachedFaceOnBuddingNeighbor(block);
		}
	}
}

function randomBudSpawnFromGrowth(block) {
	const ore = parseOreNameFromTypeId(block.typeId);
	const neighbors = {
		above: block.above(),
		below: block.below(),
		north: block.north(),
		south: block.south(),
		east: block.east(),
		west: block.west()
	};

	const buddingDirs = [];
	for (const dir of Object.keys(neighbors)) {
		const n = neighbors[dir];
		if (n && n.typeId === "minecraft:air") buddingDirs.push(dir);
	}
	if (buddingDirs.length === 0) return;

	if (Math.floor(Math.random() * 3) !== 1) return;
	const target = neighbors[choose(buddingDirs)];
	if (!target || target.typeId !== "minecraft:air") return;

	target.dimension.setBlockType(target.location, `wx:small_${ore}_bud`);
	target.setPermutation(target.permutation.withState("wx:placed_on_budding", true));
	setAttachedFaceOnBuddingNeighbor(target);
}


function tickBuddingNeighbor(block) {
	const ore = parseOreNameFromTypeId(block.typeId);
	const ids = stageIds(ore);
	const upgradeMap = {
		[ids.small]: ids.medium,
		[ids.medium]: ids.large,
		[ids.large]: `wx:${ore}_cluster`
	};

	const dirs = ["above", "below", "north", "south", "east", "west"];
	const dir = choose(dirs);
	const target = block[dir]();
	if (!target) return;

	if (upgradeMap[target.typeId] !== undefined) {
		target.setType(upgradeMap[target.typeId]);
		setAttachedFaceOnBuddingNeighbor(target);
	} else if (target.typeId === "minecraft:air" && Math.random() < 0.2) {
		target.dimension.setBlockType(target.location, `wx:small_${ore}_bud`);
		target.setPermutation(target.permutation.withState("wx:placed_on_budding", true));
		setAttachedFaceOnBuddingNeighbor(target);
	}
}
function syncHasBudState(block) {
	const neighbors = {
		above: block.above(),
		below: block.below(),
		north: block.north(),
		south: block.south(),
		east: block.east(),
		west: block.west()
	};

	const opposite = {
		south: "north",
		north: "south",
		east: "west",
		west: "east",
		above: "up",
		below: "down"
	};

	const ore = parseOreNameFromTypeId(block.typeId);
	for (const dir of Object.keys(neighbors)) {
		const n = neighbors[dir];
		if (!n) continue;

		const valid = n.typeId.startsWith("wx") && (n.typeId.endsWith("_bud") || n.typeId.endsWith("_cluster")) && new RegExp(`^wx:(?:small_|medium_|large_)?${ore}(_(bud|cluster|budding))?$`).test(n.typeId);
		if (!valid) continue;

		const face = n.permutation.getState("minecraft:block_face");
		const hasBud = n.permutation.getState("wx:has_bud");
		if (hasBud === true) continue;

		if (opposite[dir] !== face || hasBud !== true) {
			n.setPermutation(n.permutation.withState("minecraft:block_face", opposite[dir]));
			n.setPermutation(n.permutation.withState("wx:has_bud", true));
		}
	}
}

function spawnAtCenter(block, itemId, count = 1) {
	if (!itemId || count <= 0) return;
	const dim = world.getDimension(block.dimension.id);
	dim.spawnItem(new ItemStack(itemId, count), block.center());
}

function breakBlockWithNaturalDrops(block) {
	const { x, y, z } = block.location;
	block.dimension.runCommand(`setblock ${x} ${y} ${z} air destroy`);
}

function handleGrowthBreakDrop(event) {
	const block = event.block;
	const brokenId = event.brokenBlockPermutation?.type?.id ?? block?.typeId;
	if (!brokenId?.startsWith("wx:")) return;
	if (!brokenId.endsWith("_bud")) return;

	const player = event.player;
	if (!player || !isSurvival(player) || !isPickaxe(player)) return;
	if (!hasSilkTouch(player)) return;

	spawnAtCenter(block, brokenId, 1);
}

function handleClusterBreakDrop(event) {
	const block = event.block;
	const brokenId = event.brokenBlockPermutation?.type?.id ?? block.typeId;
	if (!brokenId.startsWith("wx:") || !brokenId.endsWith("_cluster")) return;

	const player = event.player;
	if (!player || !isSurvival(player) || !isPickaxe(player)) return;

	if (hasSilkTouch(player)) {
		spawnAtCenter(block, brokenId, 1);
		return;
	}

	const ore = parseOreNameFromTypeId(brokenId);
	const fortune = getFortuneLevel(player);

	if (ore === "quartz") {
		const ranges = [
			[2, 4],
			[4, 8],
			[6, 12],
			[8, 16]
		];
		const [minCount, maxCount] = ranges[fortune] ?? ranges[3];
		spawnAtCenter(block, "minecraft:quartz", randomInt(minCount, maxCount));
		return;
	}

	if (ore === "rose_quartz") {
		const chance = ROSE_QUARTZ_CHANCE[fortune] ?? 1.0;
		if (Math.random() < chance) {
			spawnAtCenter(block, choose(ROSE_QUARTZ_POOL), 1);
		}
		return;
	}

	const itemId = ORE_ITEM_MAP[ore];
	if (!itemId) return;
	const chance = NORMAL_CLUSTER_CHANCE[fortune] ?? 0.12;
	if (Math.random() < chance) {
		spawnAtCenter(block, itemId, 1);
	}
}

function handleBuddingBreakDrop(event) {
	const block = event.block;
	const brokenId = event.brokenBlockPermutation?.type?.id ?? block.typeId;
	if (!brokenId.startsWith("wx:budding_")) return;

	const neighbors = {
		above: block.above(),
		below: block.below(),
		north: block.north(),
		south: block.south(),
		east: block.east(),
		west: block.west()
	};

	const ore = parseOreNameFromTypeId(brokenId);
	for (const dir of Object.keys(neighbors)) {
		const n = neighbors[dir];
		if (!n) continue;
		if (!n.typeId.startsWith("wx:")) continue;
		if (!(n.typeId.endsWith("_bud") || n.typeId.endsWith("_cluster"))) continue;
		if (parseOreNameFromTypeId(n.typeId) !== ore) continue;
		// Remove neighboring growth without natural drops to avoid fortune side-effects.
		n.dimension.setBlockType(n.location, "minecraft:air");
	}
}

const buddingComponent = {
	onPlace(event) {
		if (event.block.permutation.getState("wx:placed_on_budding") === true) setAttachedFaceOnBuddingNeighbor(event.block);
	},
	onRandomTick(event) {
		try {
			tickBuddingNeighbor(event.block);
		} catch (e) {
			if (e?.name === LocationInUnloadedChunkError.name) return;
			console.error(e);
		}
	},
	onPlayerBreak(event) {
		handleBuddingBreakDrop(event);
	}
};

const growthComponent = {
	onPlayerBreak(event) {
		handleGrowthBreakDrop(event);
	}
};

const clusterLootComponent = {
	onPlayerBreak(event) {
		handleClusterBreakDrop(event);
	}
};

system.beforeEvents.startup.subscribe((event) => {
	event.blockComponentRegistry.registerCustomComponent("wx:budding", buddingComponent);
	event.blockComponentRegistry.registerCustomComponent("wx:growth", growthComponent);
	event.blockComponentRegistry.registerCustomComponent("wx:cluster_loot", clusterLootComponent);
});

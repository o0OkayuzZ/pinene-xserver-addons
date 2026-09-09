import "./mycology/index.js";
import { world, ItemStack, system, BlockPermutation, EntityDamageCause } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";
import "./meitetsu_chest.js";

function safeSubscribe(eventSignal, handler) {
    if (!eventSignal || typeof eventSignal.subscribe !== "function") return;
    eventSignal.subscribe(handler);
}

// ============================================================
// ピネディメンション固有ステータス
// ============================================================
// 独自の状態異常はタグで保持する。武器側からは applyPineCharged / applyPineDivineSight を呼ぶ。
const PINE_CHARGED_TAG = "pinene:charged";
const PINE_DIVINE_SIGHT_TAG = "pinene:divine_sight";
const PINE_TENRAI_WEDGE_ITEM_ID = "pinen:tenrai_wedge";
const PINE_SHINGAN_ARROW_ENTITY_ID = "pinen:shingan_arrow";
const PINE_LIGHTNING_GUARD_TAG = "pinene:lightning_guard";
const pineStatusExpiry = new Map();

function pineStatusKey(entity, tag) {
    return `${entity?.id ?? entity?.name ?? "unknown"}:${tag}`;
}

function addPineTimedTag(entity, tag, durationTicks) {
    if (!entity) return false;
    try {
        entity.addTag(tag);
        pineStatusExpiry.set(pineStatusKey(entity, tag), system.currentTick + Math.max(1, durationTicks));
        return true;
    } catch {
        return false;
    }
}

function removePineTimedTag(entity, tag) {
    try {
        entity.removeTag(tag);
    } catch {
    }
    pineStatusExpiry.delete(pineStatusKey(entity, tag));
}

function applyPineCharged(entity, durationTicks = 200) {
    return addPineTimedTag(entity, PINE_CHARGED_TAG, durationTicks);
}

function applyPineDivineSight(entity, durationTicks = 200) {
    return addPineTimedTag(entity, PINE_DIVINE_SIGHT_TAG, durationTicks);
}

function pineHasTag(entity, tag) {
    try {
        return entity?.hasTag?.(tag) === true;
    } catch {
        return false;
    }
}

function pineLightningStrike(entity) {
    try {
        entity.dimension.spawnEntity("minecraft:lightning_bolt", entity.location);
    } catch {
    }
}

// 状態の期限切れ処理と、帯電中の雷引き寄せ。
system.runInterval(() => {
    for (const [key, expiry] of pineStatusExpiry) {
        if (system.currentTick < expiry) continue;
        const separator = key.lastIndexOf(":");
        const tag = key.slice(separator + 1);
        for (const dimensionId of ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"]) {
            try {
                for (const entity of world.getDimension(dimensionId).getEntities()) {
                    if (`${entity.id ?? entity.name ?? "unknown"}:${tag}` !== key) continue;
                    removePineTimedTag(entity, tag);
                    break;
                }
            } catch {
            }
        }
        pineStatusExpiry.delete(key);
    }

    if (system.currentTick % 40 !== 0) return;
    for (const dimensionId of ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"]) {
        try {
            for (const entity of world.getDimension(dimensionId).getEntities({ tags: [PINE_CHARGED_TAG] })) {
                if (Math.random() < 0.2) pineLightningStrike(entity);
            }
        } catch {
        }
    }
}, 1);

// 雷撃と神眼の追加ダメージ処理。afterEvents のため、元の攻撃に追加ダメージを重ねる。
safeSubscribe(world?.afterEvents?.entityHurt, (event) => {
    const hurtEntity = event?.hurtEntity;
    if (!hurtEntity) return;

    if (pineHasTag(hurtEntity, PINE_CHARGED_TAG) && event.damageSource?.cause === EntityDamageCause.lightning) {
        try {
            hurtEntity.addTag(PINE_LIGHTNING_GUARD_TAG);
            hurtEntity.applyDamage(Math.max(1, event.damage), { cause: EntityDamageCause.magic });
        } catch {
        } finally {
            try { hurtEntity.removeTag(PINE_LIGHTNING_GUARD_TAG); } catch { }
        }
    }

    const attacker = event.damageSource?.damagingEntity;
    if (!attacker || attacker.typeId !== "minecraft:player") return;
    if (!pineHasTag(attacker, PINE_DIVINE_SIGHT_TAG)) return;

    try {
        // 元のダメージを D としたとき、合計を D^1.5 にする。
        // 追加分だけを与えることで、元の攻撃と合わせて累乗値になる。
        const poweredDamage = Math.pow(Math.max(0, event.damage), 1.5);
        const bonusDamage = Math.max(0, poweredDamage - event.damage);
        if (bonusDamage <= 0) {
            removePineTimedTag(attacker, PINE_DIVINE_SIGHT_TAG);
            return;
        }
        hurtEntity.applyDamage(bonusDamage, {
            cause: EntityDamageCause.magic,
            damagingEntity: attacker
        });
        removePineTimedTag(attacker, PINE_DIVINE_SIGHT_TAG);
    } catch {
    }
});

// ============================================================
// ピネ Waystone
// アイテムを使うと、共有地点の登録・移動・削除メニューを開く。
// Simple Waystone の識別子やスクリプトには依存しない独自実装。
// ============================================================

const PINE_WAYSTONE_COMPONENT_ID = "pinene:waystone_menu";
const PINE_WAYSTONE_DATA_KEY = "pinene:waystones_v1";
const PINE_WAYSTONE_LIMIT = 64;
const PINE_WAYSTONE_NAME_LIMIT = 30;
const pineWaystoneMenuLocks = new Set();

function readPineWaystones() {
    try {
        const raw = world.getDynamicProperty(PINE_WAYSTONE_DATA_KEY);
        if (typeof raw !== "string" || raw.length === 0) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((entry) =>
            entry &&
            typeof entry.name === "string" &&
            typeof entry.dimensionId === "string" &&
            Number.isFinite(entry.x) &&
            Number.isFinite(entry.y) &&
            Number.isFinite(entry.z)
        );
    } catch {
        return [];
    }
}

function writePineWaystones(entries) {
    world.setDynamicProperty(PINE_WAYSTONE_DATA_KEY, JSON.stringify(entries));
}

function pineWaystoneDimensionLabel(dimensionId) {
    if (dimensionId === "minecraft:overworld") return "オーバーワールド";
    if (dimensionId === "minecraft:nether") return "ネザー";
    if (dimensionId === "minecraft:the_end") return "ジ・エンド";
    return dimensionId.replace("minecraft:", "");
}

function pineWaystoneLocationText(entry) {
    return `${pineWaystoneDimensionLabel(entry.dimensionId)}  ${entry.x}, ${entry.y}, ${entry.z}`;
}

function sanitizePineWaystoneName(value) {
    return String(value ?? "")
        .replace(/[\r\n\t]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, PINE_WAYSTONE_NAME_LIMIT);
}

async function registerPineWaystone(player) {
    const current = readPineWaystones();
    if (current.length >= PINE_WAYSTONE_LIMIT) {
        player.sendMessage(`§c登録上限（${PINE_WAYSTONE_LIMIT}地点）に達しています。`);
        return;
    }

    const location = player.location;
    const dimensionId = player.dimension.id;
    const form = new ModalFormData()
        .title("ウェイストーンを登録")
        .textField(
            `現在地: ${pineWaystoneDimensionLabel(dimensionId)}  ${Math.floor(location.x)}, ${Math.floor(location.y)}, ${Math.floor(location.z)}`,
            "地点名を入力",
            { defaultValue: "", tooltip: "1～30文字で入力してください" }
        );
    const result = await form.show(player);
    if (result.canceled) return;

    const name = sanitizePineWaystoneName(result.formValues?.[0]);
    if (!name) {
        player.sendMessage("§c地点名を入力してください。");
        return;
    }

    // フォーム表示中に別プレイヤーが登録しても、古い一覧で上書きしないよう再読込する。
    const entries = readPineWaystones();
    if (entries.length >= PINE_WAYSTONE_LIMIT) {
        player.sendMessage(`§c登録上限（${PINE_WAYSTONE_LIMIT}地点）に達しています。`);
        return;
    }
    if (entries.some((entry) => entry.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
        player.sendMessage("§c同じ名前の地点がすでに登録されています。");
        return;
    }

    entries.push({
        name,
        dimensionId,
        x: Math.floor(location.x),
        y: Math.floor(location.y),
        z: Math.floor(location.z),
        createdBy: player.name,
        createdAt: Date.now()
    });
    try {
        writePineWaystones(entries);
        player.sendMessage(`§a「${name}」を登録しました。`);
        player.playSound("random.orb");
    } catch {
        player.sendMessage("§c地点を保存できませんでした。");
    }
}

async function teleportWithPineWaystone(player) {
    const entries = readPineWaystones();
    if (entries.length === 0) {
        player.sendMessage("§7登録されている地点はありません。");
        return;
    }

    const form = new ActionFormData().title("登録地点へ移動").body("移動先を選んでください。");
    for (const entry of entries) {
        form.button(`${entry.name}\n§8${pineWaystoneLocationText(entry)}`);
    }
    const result = await form.show(player);
    if (result.canceled || result.selection === undefined) return;
    const entry = entries[result.selection];
    if (!entry) return;

    try {
        const dimension = world.getDimension(entry.dimensionId);
        player.teleport(
            { x: entry.x + 0.5, y: entry.y, z: entry.z + 0.5 },
            { dimension, checkForBlocks: true }
        );
        player.sendMessage(`§b「${entry.name}」へ移動しました。`);
        player.playSound("mob.endermen.portal");
    } catch {
        player.sendMessage("§c移動先が塞がれているか、現在利用できません。");
    }
}

async function deletePineWaystone(player) {
    const entries = readPineWaystones();
    if (entries.length === 0) {
        player.sendMessage("§7削除できる地点はありません。");
        return;
    }

    const list = new ActionFormData().title("登録地点を削除").body("削除する地点を選んでください。");
    for (const entry of entries) {
        list.button(`${entry.name}\n§8${pineWaystoneLocationText(entry)}`);
    }
    const selected = await list.show(player);
    if (selected.canceled || selected.selection === undefined) return;
    const entry = entries[selected.selection];
    if (!entry) return;

    const confirm = await new MessageFormData()
        .title("削除の確認")
        .body(`「${entry.name}」を登録地点から削除しますか？`)
        .button1("削除する")
        .button2("戻る")
        .show(player);
    if (confirm.canceled || confirm.selection !== 0) return;

    // 確認画面中に共有一覧が変わっても、別の地点を誤削除しないよう再読込する。
    const latest = readPineWaystones();
    const index = latest.findIndex((candidate) =>
        candidate.name === entry.name &&
        candidate.dimensionId === entry.dimensionId &&
        candidate.x === entry.x &&
        candidate.y === entry.y &&
        candidate.z === entry.z
    );
    if (index < 0) {
        player.sendMessage("§7その地点はすでに削除されています。");
        return;
    }
    latest.splice(index, 1);
    try {
        writePineWaystones(latest);
        player.sendMessage(`§e「${entry.name}」を削除しました。`);
    } catch {
        player.sendMessage("§c地点を削除できませんでした。");
    }
}

async function openPineWaystoneMenu(player) {
    const lockKey = player.id ?? player.name;
    if (pineWaystoneMenuLocks.has(lockKey)) return;
    pineWaystoneMenuLocks.add(lockKey);
    try {
        const entries = readPineWaystones();
        const result = await new ActionFormData()
            .title("ウェイストーン")
            .body(`共有登録地点: ${entries.length} / ${PINE_WAYSTONE_LIMIT}`)
            .button("現在地を登録")
            .button("登録地点へ移動")
            .button("登録地点を削除")
            .show(player);
        if (result.canceled) return;
        if (result.selection === 0) await registerPineWaystone(player);
        if (result.selection === 1) await teleportWithPineWaystone(player);
        if (result.selection === 2) await deletePineWaystone(player);
    } catch {
        player.sendMessage("§cウェイストーンの画面を開けませんでした。");
    } finally {
        pineWaystoneMenuLocks.delete(lockKey);
    }
}

system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {
    itemComponentRegistry.registerCustomComponent(PINE_WAYSTONE_COMPONENT_ID, {
        onUse: ({ source }) => {
            if (!source) return;
            system.run(() => openPineWaystoneMenu(source));
        }
    });
});

// ============================================================
// フュギュア設置・回収システム
// フュギュアアイテムをブロックに向かって使う → エンティティとして設置
// 設置済みフュギュアを攻撃する → アイテムとして回収
// ============================================================

// 全フィギュアのロジック定義を1か所に集約。
// item/entity の別名を受けて、旧版ワールド内の在庫や設置済み個体も回収できるようにする。
const FIGURE_DEFINITIONS = [
    {
        itemId: "myname:figure_fossil",
        entityId: "myname:figure_fossil_placed",
    },
    {
        itemId: "myname:figure_spiral",
        entityId: "myname:figure_spiral_placed",
    },
    {
        itemId: "myname:figure_oyu",
        entityId: "myname:figure_oyu_placed",
        itemAliases: ["myname:oyu"],
        entityAliases: ["myname:oyu_placed"],
    },
    {
        itemId: "myname:utyuuneko",
        entityId: "myname:utyuuneko_placed",
        itemAliases: ["myname:figure_utyuuneko"],
        entityAliases: ["myname:figure_utyuuneko_placed"],
    },
    {
        itemId: "myname:jack",
        entityId: "myname:jack_placed",
        itemAliases: ["myname:figure_jack"],
        entityAliases: ["myname:figure_jack_placed"],
    },
    {
        itemId: "myname:mimikkyu",
        entityId: "myname:mimikkyu_placed",
        itemAliases: ["myname:figure_mimikkyu"],
        entityAliases: ["myname:figure_mimikkyu_placed"],
    },
    {
        itemId: "myname:soubraze",
        entityId: "myname:soubraze_placed",
        itemAliases: ["myname:figure_soubraze"],
        entityAliases: ["myname:figure_soubraze_placed"],
    },
    {
        itemId: "myname:goamagara",
        entityId: "myname:goamagara_placed",
        itemAliases: ["myname:figure_goamagara"],
        entityAliases: ["myname:figure_goamagara_placed"],
    },
    {
        itemId: "myname:shini",
        entityId: "myname:shini_placed",
        itemAliases: ["myname:figure_shini", "myname:shinitagatteiru"],
        entityAliases: ["myname:figure_shini_placed", "myname:shinitagatteiru_placed"],
    },
    {
        itemId: "myname:hitomoshi",
        entityId: "myname:hitomoshi_placed",
        itemAliases: ["myname:figure_hitomoshi"],
        entityAliases: ["myname:figure_hitomoshi_placed"],
    },
    {
        itemId: "myname:gengar",
        entityId: "myname:gengar_placed",
        itemAliases: ["myname:figure_gengar"],
        entityAliases: ["myname:figure_gengar_placed"],
    },
    {
        itemId: "myname:metamon",
        entityId: "myname:metamon_placed",
        itemAliases: ["myname:figure_metamon"],
        entityAliases: ["myname:figure_metamon_placed"],
    },
    {
        itemId: "myname:meltan",
        entityId: "myname:meltan_placed",
        itemAliases: ["myname:figure_meltan"],
        entityAliases: ["myname:figure_meltan_placed"],
    },
];

const FIGURE_PLACE_MAP = {};
const FIGURE_PICKUP_MAP = {};

for (const entry of FIGURE_DEFINITIONS) {
    const itemIds = [entry.itemId, ...(entry.itemAliases ?? [])];
    const entityIds = [entry.entityId, ...(entry.entityAliases ?? [])];

    for (const itemId of itemIds) {
        FIGURE_PLACE_MAP[itemId] = entry.entityId;
    }
    for (const entityId of entityIds) {
        FIGURE_PICKUP_MAP[entityId] = entry.itemId;
    }
}

const PICKUP_MARKER_TAG = "pinene:figure_picked_up";

// Slightly sink placed figures so they don't appear to float above blocks.
const FIGURE_Y_OFFSET = -0.02;

function normalizeYaw(yaw) {
    let value = yaw % 360;
    if (value < 0) value += 360;
    return value;
}

function quantizeYaw45(yaw) {
    return Math.round(yaw / 45) * 45;
}

function getPlayerYaw(player) {
    const rot = player?.getRotation?.();
    if (rot && typeof rot.y === "number") return rot.y;

    const view = player?.getViewDirection?.();
    if (!view) return 0;
    return (Math.atan2(-view.x, view.z) * 180) / Math.PI;
}

// Location-based fine offset keeps placement deterministic while allowing small orientation variation.
function getLocationFineYaw(location) {
    const x = Math.floor(location.x);
    const z = Math.floor(location.z);
    const bucket = Math.abs((x * 734287 + z * 912271) % 4);
    return [-10, -4, 4, 10][bucket];
}

function consumeHeldItem(player, itemId) {
    const inv = player.getComponent("minecraft:inventory")?.container;
    if (!inv) return false;
    const slot = player.selectedSlotIndex;
    const heldItem = inv.getItem(slot);
    if (!heldItem || heldItem.typeId !== itemId) return false;

    if (heldItem.amount > 1) {
        heldItem.amount -= 1;
        inv.setItem(slot, heldItem);
    } else {
        inv.setItem(slot, undefined);
    }
    return true;
}

// ============================================================
// 特殊襲撃イベント（judas）
// ============================================================
/* Removed failed special-raid prototype.

const JUDAS_RAID_BOTTLE_ITEM_ID = "myname:judas_raid_bottle";
const JUDAS_TAG = "myname:judas_boss";
const JUDAS_OWNER_PREFIX = "judas_owner:";
const JUDAS_OWNER_ID_PREFIX = "judas_owner_id:";
const JUDAS_SUMMONED_BOSS_TAG = "myname:judas_summoned_boss";
const JUDAS_SUMMONED_SWARM_TAG = "myname:judas_summoned_swarm";
const JUDAS_MINION_WAVE_SIZE = 8;
const JUDAS_WARP_INTERVAL = 80;
const JUDAS_SUMMON_INTERVAL = 80;
const JUDAS_SWARM_SUMMON_INTERVAL = 20;
const JUDAS_OPENING_SUMMON_COUNT = 1;
const JUDAS_OPENING_RETRY_COUNT = 4;
const JUDAS_OPENING_RETRY_TICKS = 20;
const JUDAS_SPAWN_RETRY_COUNT = 8;
const JUDAS_SPAWN_RETRY_TICKS = 10;
const JUDAS_RETARGET_INTERVAL = 20;
const JUDAS_WITHER_GROUND_INTERVAL = 2;
const JUDAS_SUMMON_KEEP_RADIUS = 36;
const judasSpawnPendingOwners = new Set();

const RAID_SWARM_MOBS = [
    "minecraft:zombie",
    "minecraft:husk",
    "minecraft:skeleton",
    "minecraft:stray",
    "minecraft:witch",
    "minecraft:creeper",
    "minecraft:pillager",
    "minecraft:vindicator"
];

const JUDAS_SUMMON_MOBS = [
    "myname:judas_mini_wither",
    "myname:judas_mini_warden",
    "myname:judas_mini_ender_dragon",
    "minecraft:ravager",
    "minecraft:vindicator",
    "minecraft:evoker",
    "minecraft:wither_skeleton",
    "minecraft:hoglin"
];

const JUDAS_OPENING_BOSSES = [
    "myname:judas_mini_wither",
    "myname:judas_mini_warden",
    "myname:judas_mini_ender_dragon"
];

function randomInt(min, max) {
    const safeMin = Math.ceil(min);
    const safeMax = Math.floor(max);
    return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
}

function getOwnerKey(player) {
    if (!player) return undefined;
    if (player.id) return `id:${player.id}`;
    return `name:${player.name}`;
}

function randomAround(origin, minRadius = 3, maxRadius = 10, yOffset = 0) {
    const angle = Math.random() * Math.PI * 2;
    const radius = minRadius + Math.random() * (maxRadius - minRadius);
    return {
        x: origin.x + Math.cos(angle) * radius,
        y: origin.y + yOffset,
        z: origin.z + Math.sin(angle) * radius
    };
}

function safeHasTag(entity, tag) {
    try {
        return !!entity?.hasTag?.(tag);
    } catch {
        return false;
    }
}

function safeGetEntityLocation(entity) {
    try {
        if (!entity) return undefined;
        const loc = entity.location;
        if (!loc) return undefined;
        return { x: loc.x, y: loc.y, z: loc.z };
    } catch {
        return undefined;
    }
}

function escapeSelectorName(name) {
    return String(name ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function retargetSummonedMobToOwner(entity, owner) {
    if (!entity || !owner) return;
    try {
        const ownerName = escapeSelectorName(owner.name);
        // 0 damage is used only to refresh hostility toward the owner player.
        void entity.runCommandAsync(`damage @s 0 entity_attack entity @a[name="${ownerName}",c=1]`);
    } catch {
    }
}

function spawnEntityWithRetries(dimension, typeIds, origin, options = {}) {
    const attempts = options.attempts ?? 16;
    const minRadius = options.minRadius ?? 2;
    const maxRadius = options.maxRadius ?? 8;
    const minYOffset = options.minYOffset ?? 0;
    const maxYOffset = options.maxYOffset ?? 3;

    for (const typeId of typeIds) {
        for (let i = 0; i < attempts; i++) {
            const loc = randomAround(origin, minRadius, maxRadius, randomInt(minYOffset, maxYOffset));
            try {
                const entity = dimension.spawnEntity(typeId, loc);
                if (entity) return entity;
            } catch {
            }
        }
    }

    return undefined;
}

function trySummonWithCommandAndTag(judas, owner, typeId, summonTag) {
    if (!judas || !owner) return;
    const origin = safeGetEntityLocation(judas);
    if (!origin) return;

    const loc = randomAround(origin, 3, 10, 1);
    const x = Math.floor(loc.x);
    const y = Math.floor(loc.y);
    const z = Math.floor(loc.z);

    try {
        void judas.dimension.runCommandAsync(`summon ${typeId} ${x} ${y} ${z}`);
    } catch {
        return;
    }

    system.runTimeout(() => {
        try {
            const found = judas.dimension.getEntities({
                type: typeId,
                location: { x, y, z },
                maxDistance: 24
            });
            for (const entity of found) {
                if (safeHasTag(entity, JUDAS_OWNER_PREFIX + owner.name)) continue;
                try {
                    entity.addTag(summonTag);
                    entity.addTag(JUDAS_OWNER_PREFIX + owner.name);
                    if (owner.id) entity.addTag(JUDAS_OWNER_ID_PREFIX + owner.id);
                } catch {
                }
                if (summonTag === JUDAS_SUMMONED_BOSS_TAG) {
                    applyJudasSummonedBossDebuff(entity);
                }
                retargetSummonedMobToOwner(entity, owner);
                break;
            }
        } catch {
        }
    }, 2);
}

function applyJudasSummonedBossDebuff(entity) {
    if (!entity) return;
    entity.addTag(JUDAS_SUMMONED_BOSS_TAG);

    try {
        const health = entity.getComponent("minecraft:health");
        if (health) {
            const half = Math.max(1, Math.floor(health.defaultValue * 0.5));
            health.setCurrentValue(half);
        }
    } catch {
    }

    // Keep summoned boss mobs at half-size and lower combat performance.
    try {
        void entity.runCommandAsync("attribute @s minecraft:scale base set 0.5");
    } catch {
    }
    try {
        void entity.runCommandAsync("effect @s weakness 9999 1 true");
    } catch {
    }
    try {
        void entity.runCommandAsync("effect @s slowness 9999 1 true");
    } catch {
    }
}

function spawnRaidSwarmNear(player, count) {
    if (!player || player.typeId !== "minecraft:player") return;
    const center = player.location;

    for (let i = 0; i < count; i++) {
        const typeId = RAID_SWARM_MOBS[Math.floor(Math.random() * RAID_SWARM_MOBS.length)];
        const loc = randomAround(center, 6, 18, 0);
        try {
            player.dimension.spawnEntity(typeId, loc);
        } catch {
        }
    }
}

function spawnJudas(player) {
    if (!player || player.typeId !== "minecraft:player") return;
    const judas = spawnEntityWithRetries(player.dimension, ["myname:judas_boss"], player.location, {
        attempts: 48,
        minRadius: 2,
        maxRadius: 12,
        minYOffset: 1,
        maxYOffset: 5
    });

    if (!judas) return;

    try {
        judas.nameTag = "judas";
    } catch {
    }
    try {
        judas.addTag(JUDAS_TAG);
        judas.addTag(JUDAS_OWNER_PREFIX + player.name);
        if (player.id) judas.addTag(JUDAS_OWNER_ID_PREFIX + player.id);
    } catch {
    }

    // Make judas durable but non-attacking.
    try {
        void judas.runCommandAsync("effect @s resistance 9999 1 true");
    } catch {
    }
    try {
        void judas.runCommandAsync("effect @s fire_resistance 9999 1 true");
    } catch {
    }
    try {
        void judas.runCommandAsync("effect @s glowing 30 0 true");
    } catch {
    }

    return judas;
}

function getTaggedPlayerName(entity, prefix) {
    try {
        const tag = entity.getTags().find((value) => value.startsWith(prefix));
        if (!tag) return undefined;
        return tag.slice(prefix.length);
    } catch {
        return undefined;
    }
}

function findOwnerPlayer(entity) {
    const ownerId = getTaggedPlayerName(entity, JUDAS_OWNER_ID_PREFIX);
    if (ownerId) {
        const byId = world.getAllPlayers().find((player) => player.id === ownerId);
        if (byId) return byId;
    }
    const ownerName = getTaggedPlayerName(entity, JUDAS_OWNER_PREFIX);
    if (!ownerName) return undefined;
    return world.getAllPlayers().find((player) => player.name === ownerName);
}

function findNearestPlayerInSameDimension(entity, maxDistance = 160) {
    const entityLoc = safeGetEntityLocation(entity);
    if (!entityLoc) return undefined;
    let best;
    let bestSq = maxDistance * maxDistance;

    for (const player of world.getAllPlayers()) {
        let sameDimension = false;
        try {
            sameDimension = player.dimension?.id === entity.dimension?.id;
        } catch {
        }
        if (!sameDimension) continue;

        const dx = player.location.x - entityLoc.x;
        const dy = player.location.y - entityLoc.y;
        const dz = player.location.z - entityLoc.z;
        const d2 = (dx * dx) + (dy * dy) + (dz * dz);
        if (d2 < bestSq) {
            bestSq = d2;
            best = player;
        }
    }

    return best;
}

function summonJudasWave(judas, owner, count) {
    if (!judas || !owner) return;
    const origin = safeGetEntityLocation(judas);
    if (!origin) return;

    for (let i = 0; i < count; i++) {
        const summonType = JUDAS_SUMMON_MOBS[Math.floor(Math.random() * JUDAS_SUMMON_MOBS.length)];
        try {
            const spawned = spawnEntityWithRetries(judas.dimension, [summonType], origin, {
                attempts: 12,
                minRadius: 2,
                maxRadius: 8,
                minYOffset: 0,
                maxYOffset: 2
            });
            if (!spawned) {
                trySummonWithCommandAndTag(judas, owner, summonType, JUDAS_SUMMONED_BOSS_TAG);
                continue;
            }
            try {
                spawned.addTag(JUDAS_OWNER_PREFIX + owner.name);
                if (owner.id) spawned.addTag(JUDAS_OWNER_ID_PREFIX + owner.id);
            } catch {
            }
            applyJudasSummonedBossDebuff(spawned);
            retargetSummonedMobToOwner(spawned, owner);
        } catch {
        }
    }
}

function spawnJudasTaggedMob(judas, owner, typeId, tag) {
    if (!judas || !owner) return undefined;
    const origin = safeGetEntityLocation(judas);
    if (!origin) return undefined;

    try {
        const spawned = spawnEntityWithRetries(judas.dimension, [typeId], origin, {
            attempts: 28,
            minRadius: 2,
            maxRadius: 10,
            minYOffset: 0,
            maxYOffset: 3
        });
        if (!spawned) return undefined;

        try {
            spawned.addTag(tag);
            spawned.addTag(JUDAS_OWNER_PREFIX + owner.name);
            if (owner.id) spawned.addTag(JUDAS_OWNER_ID_PREFIX + owner.id);
        } catch {
        }

        return spawned;
    } catch {
        return undefined;
    }
}

function summonOpeningBosses(judas, owner) {
    let success = 0;

    for (const typeId of JUDAS_OPENING_BOSSES) {
        const spawned = spawnJudasTaggedMob(judas, owner, typeId, JUDAS_SUMMONED_BOSS_TAG);
        if (!spawned) {
            trySummonWithCommandAndTag(judas, owner, typeId, JUDAS_SUMMONED_BOSS_TAG);
            continue;
        }
        applyJudasSummonedBossDebuff(spawned);
        retargetSummonedMobToOwner(spawned, owner);
        success += 1;
    }

    return success;
}

function beginJudasEncounter(owner, judas) {
    if (!owner || !judas) return;

    try {
        void judas.runCommandAsync("effect @s glowing 600 0 true");
    } catch {
    }

    const openingBossCount = summonOpeningBosses(judas, owner);
    summonJudasSwarmWave(judas, owner, 1);

    for (let i = 1; i <= JUDAS_OPENING_RETRY_COUNT; i++) {
        system.runTimeout(() => {
            summonJudasWave(judas, owner, 1);
        }, JUDAS_OPENING_RETRY_TICKS * i);
    }

    if (openingBossCount >= 2) {
        owner.sendMessage("[特殊襲撃] judas + 縮小ウィザー + 縮小ウォーデン出現。以降は継続召喚。");
    } else if (openingBossCount === 1) {
        owner.sendMessage("[特殊襲撃] judas と一部ボスが出現。継続召喚で補充される。");
    } else {
        owner.sendMessage("[特殊襲撃] judas は出現。初動ボス召喚に失敗したため継続召喚へ移行。");
    }
}

function summonJudasSwarmWave(judas, owner, count) {
    if (!judas || !owner) return;
    const origin = safeGetEntityLocation(judas);
    if (!origin) return;

    for (let i = 0; i < count; i++) {
        const summonType = RAID_SWARM_MOBS[Math.floor(Math.random() * RAID_SWARM_MOBS.length)];
        try {
            const spawned = spawnEntityWithRetries(judas.dimension, [summonType], origin, {
                attempts: 8,
                minRadius: 4,
                maxRadius: 14,
                minYOffset: 0,
                maxYOffset: 2
            });
            if (!spawned) continue;
            try {
                spawned.addTag(JUDAS_SUMMONED_SWARM_TAG);
                spawned.addTag(JUDAS_OWNER_PREFIX + owner.name);
                if (owner.id) spawned.addTag(JUDAS_OWNER_ID_PREFIX + owner.id);
            } catch {
            }
            retargetSummonedMobToOwner(spawned, owner);
        } catch {
        }
    }
}

function forceSummonedMobsTargetOwner(owner, nowTick, summonTag) {
    if (!owner) return;

    let tagged = [];
    try {
        tagged = owner.dimension.getEntities({
            tags: [summonTag, JUDAS_OWNER_PREFIX + owner.name]
        });
    } catch {
        return;
    }

    const keepRadiusSq = JUDAS_SUMMON_KEEP_RADIUS * JUDAS_SUMMON_KEEP_RADIUS;
    for (const mob of tagged) {
        const mobLoc = safeGetEntityLocation(mob);
        if (!mobLoc) continue;

        const dx = mobLoc.x - owner.location.x;
        const dy = mobLoc.y - owner.location.y;
        const dz = mobLoc.z - owner.location.z;
        const distSq = (dx * dx) + (dy * dy) + (dz * dz);

        if (distSq > keepRadiusSq) {
            try {
                mob.teleport(randomAround(owner.location, 5, 9, 0), {
                    dimension: owner.dimension,
                    keepVelocity: false,
                    checkForBlocks: true
                });
            } catch {
            }
        }

        if ((nowTick % JUDAS_RETARGET_INTERVAL) === 0) {
            retargetSummonedMobToOwner(mob, owner);
        }

        if (mob.typeId === "myname:judas_mini_wither" && (nowTick % JUDAS_WITHER_GROUND_INTERVAL) === 0) {
            try {
                mob.teleport({
                    x: mobLoc.x,
                    y: Math.max(owner.location.y - 1, mobLoc.y - 0.8),
                    z: mobLoc.z
                }, {
                    dimension: owner.dimension,
                    keepVelocity: false,
                    checkForBlocks: true
                });
            } catch {
            }
        }
    }
}

function tickJudasBosses() {
    const tick = system.currentTick;

    for (const dimId of ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"]) {
        let dimension;
        try {
            dimension = world.getDimension(dimId);
        } catch {
            continue;
        }

        let judases = [];
        try {
            judases = dimension.getEntities({ tags: [JUDAS_TAG] });
        } catch {
            continue;
        }

        for (const judas of judases) {
            const owner = findOwnerPlayer(judas) ?? findNearestPlayerInSameDimension(judas);
            if (!owner) continue;

            forceSummonedMobsTargetOwner(owner, tick, JUDAS_SUMMONED_BOSS_TAG);
            forceSummonedMobsTargetOwner(owner, tick, JUDAS_SUMMONED_SWARM_TAG);

            if ((tick % JUDAS_WARP_INTERVAL) === 0) {
                try {
                    const target = randomAround(owner.location, 4, 9, 0);
                    judas.teleport(target, {
                        dimension: owner.dimension,
                        keepVelocity: false,
                        checkForBlocks: true
                    });
                } catch {
                }
            }

            if ((tick % JUDAS_SUMMON_INTERVAL) === 0) {
                summonJudasWave(judas, owner, JUDAS_MINION_WAVE_SIZE);
            }

            if ((tick % JUDAS_SWARM_SUMMON_INTERVAL) === 0) {
                summonJudasSwarmWave(judas, owner, 6);
            }
        }
    }
}

function startSpecialRaidByBottle(player) {
    if (!player || player.typeId !== "minecraft:player") return;
    const ownerKey = getOwnerKey(player);
    if (!ownerKey) return;
    if (judasSpawnPendingOwners.has(ownerKey)) {
        player.sendMessage("[特殊襲撃] いま出現処理中。少し待って。\n");
        return;
    }

    judasSpawnPendingOwners.add(ownerKey);

    const trySpawn = (attempt) => {
        const judas = spawnJudas(player);
        if (judas) {
            judasSpawnPendingOwners.delete(ownerKey);
            beginJudasEncounter(player, judas);
            return;
        }

        if (attempt >= JUDAS_SPAWN_RETRY_COUNT) {
            judasSpawnPendingOwners.delete(ownerKey);
            player.sendMessage("[特殊襲撃] judas の出現に失敗。空間を広くして再使用して。\n");
            return;
        }

        system.runTimeout(() => {
            trySpawn(attempt + 1);
        }, JUDAS_SPAWN_RETRY_TICKS);
    };

    trySpawn(0);
}

*/
function placeFigure(player, itemId, location) {
    if (!(itemId in FIGURE_PLACE_MAP)) return;
    if (!player || player.typeId !== "minecraft:player") return;

    system.run(() => {
        if (!consumeHeldItem(player, itemId)) return;
        try {
            const entity = player.dimension.spawnEntity(FIGURE_PLACE_MAP[itemId], location);
            const baseYaw = quantizeYaw45(getPlayerYaw(player));
            const fineYaw = getLocationFineYaw(location);
            const finalYaw = normalizeYaw(baseYaw + fineYaw);
            if (typeof entity?.setRotation === "function") {
                entity.setRotation({ x: 0, y: finalYaw });
            }
        } catch (error) {
            // Return the item if entity spawn fails (e.g., invalid/unknown entity definition).
            player.dimension.spawnItem(new ItemStack(itemId, 1), location);
            player.sendMessage("[Figure] 設置に失敗しました: " + String(error));
        }
    });
}

function tryPickupFigureEntity(entity) {
    const itemId = FIGURE_PICKUP_MAP[entity?.typeId];
    if (!itemId) return false;

    const loc = { ...entity.location };
    entity.addTag(PICKUP_MARKER_TAG);
    entity.dimension.spawnItem(new ItemStack(itemId, 1), loc);
    entity.remove();
    return true;
}

// フュギュアアイテムをブロックに使う → 設置
safeSubscribe(world?.afterEvents?.itemUseOn, (event) => {
    const itemId = event.itemStack.typeId;
    const block = event.block;
    const spawnLoc = {
        x: block.location.x + 0.5,
        y: block.location.y + 1 + FIGURE_Y_OFFSET,
        z: block.location.z + 0.5
    };
    placeFigure(event.source, itemId, spawnLoc);
});

// 一部環境で itemUseOn が来ない場合のフォールバック
safeSubscribe(world?.afterEvents?.itemUse, (event) => {
    const itemId = event.itemStack.typeId;
    if (!(itemId in FIGURE_PLACE_MAP)) return;
    const player = event.source;
    if (!player || player.typeId !== "minecraft:player") return;

    const view = player.getViewDirection();
    const spawnLoc = {
        x: player.location.x + view.x * 1.5,
        y: player.location.y + FIGURE_Y_OFFSET,
        z: player.location.z + view.z * 1.5
    };
    placeFigure(player, itemId, spawnLoc);
});

// 通常攻撃(ぶったたく)でも回収できるようにする。
safeSubscribe(world?.afterEvents?.entityHitEntity, (event) => {
    const attacker = event.damagingEntity;
    if (!attacker) return;

    // 天雷の楔は命中時に帯電を付与し、武器を1個消費する。
    if (attacker.typeId === "minecraft:player") {
        try {
            tryPickupFigureEntity(event.hitEntity);
        } catch {
        }
        try {
            const held = attacker.getComponent("minecraft:inventory")?.container?.getItem(attacker.selectedSlotIndex);
            if (held?.typeId === PINE_TENRAI_WEDGE_ITEM_ID) {
                applyPineCharged(event.hitEntity, 200);
                consumeHeldItem(attacker, PINE_TENRAI_WEDGE_ITEM_ID);
                attacker.playSound("ambient.weather.thunder");
            }
        } catch {
        }
        return;
    }

    // 神眼の矢は、矢の所有者へ「次の一撃をD^1.5」にする神眼を付与する。
    if (attacker.typeId === PINE_SHINGAN_ARROW_ENTITY_ID) {
        try {
            const owner = attacker.getComponent("minecraft:projectile")?.owner;
            if (owner?.typeId === "minecraft:player") {
                applyPineDivineSight(owner, 200);
            }
        } catch {
        }
    }
});

// バージョン差で entityHitEntity が来ない場合のフォールバック。
safeSubscribe(world?.afterEvents?.entityHurt, (event) => {
    const attacker = event.damageSource?.damagingEntity;
    if (!attacker || attacker.typeId !== "minecraft:player") return;
    try {
        tryPickupFigureEntity(event.hurtEntity);
    } catch {
    }
});

// 旧フィギュア系と同じく、インタラクト回収はしゃがみ時のみ有効。
safeSubscribe(world?.afterEvents?.playerInteractWithEntity, (event) => {
    if (!event.player?.isSneaking) return;
    try {
        tryPickupFigureEntity(event.target);
    } catch {
    }
});

// 設置済みフュギュアが倒された → アイテムとして回収
safeSubscribe(world?.afterEvents?.entityDie, (event) => {
    const entity = event.deadEntity;
    if (!entity) return;
    if (safeHasTag(entity, PICKUP_MARKER_TAG)) return;

    let typeId;
    try {
        typeId = entity.typeId;
    } catch {
        return;
    }

    const itemId = FIGURE_PICKUP_MAP[typeId];
    if (!itemId) return;

    const loc = safeGetEntityLocation(entity);
    if (!loc) return;

    try {
        entity.dimension.spawnItem(new ItemStack(itemId, 1), loc);
    } catch {
    }
});

// Trader reroll is owned by BP22 entity JSON (minecraft:interact + environment_sensor).
// Keep this script focused on Figure placement/pickup only.

const MYSTERY_FOSSIL_SOURCE_BLOCK_ID = "minecraft:suspicious_sand";
const MYSTERY_FOSSIL_FINISHED_BLOCK_ID = "myname:mystery_fossil";
const MYSTERY_FOSSIL_BRUSHABLE_BLOCK_IDS = [MYSTERY_FOSSIL_SOURCE_BLOCK_ID, MYSTERY_FOSSIL_FINISHED_BLOCK_ID];
const MYSTERY_FOSSIL_STAGE_KEY = "myname:brush_stage";
const MYSTERY_FOSSIL_STAGE_KEYS = ["myname:brush_stage", "brush_stage"];
const MYSTERY_FOSSIL_FINISHED_STAGE = 3;
const MYSTERY_FOSSIL_PENDING_TTL = 80;
const MYSTERY_FOSSIL_GLOW_STAGES = [0, 0, 1, 1, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3];
const MYSTERY_FOSSIL_GLOW_STEP_TICKS = 8;
const MYSTERY_FOSSIL_PARTICLE_BURST_BY_STAGE = [0, 0, 1, 2];
const MYSTERY_FOSSIL_FINAL_BURST_WINDOW = 6;
const MYSTERY_FOSSIL_FINAL_MEGA_MULTIPLIER = 2.2;
const MYSTERY_FOSSIL_STAGE_SWAP_DURING_PROGRESS = false;
const MYSTERY_FOSSIL_ENABLE_SOLAR_BURST = false;
const MYSTERY_FOSSIL_ENABLE_STUCK_LIGHT_SCRUB = false;
const MYSTERY_FOSSIL_SOLAR_BURST_TTL = 100;
const MYSTERY_FOSSIL_XP_ORB_COUNT = 64;
const MYSTERY_FOSSIL_STUCK_LIGHT_SCAN_RADIUS = 8;
const MYSTERY_FOSSIL_STUCK_LIGHT_SCAN_MIN_Y = -4;
const MYSTERY_FOSSIL_STUCK_LIGHT_SCAN_MAX_Y = 8;
const MYSTERY_FOSSIL_STUCK_LIGHT_SCAN_LIMIT_PER_PASS = 256;
const mysteryFossilPending = new Map();
const mysteryFossilSequences = new Map();
const mysteryFossilSolarBursts = new Map();
const MYSTERY_FOSSIL_REWARDS = [
    { itemId: "myname:figure_oyu", weight: 6, amount: 1 },
    { itemId: "myname:figure_fossil", weight: 6, amount: 1 },
    { itemId: "myname:figure_spiral", weight: 6, amount: 1 },
    { itemId: "myname:utyuuneko", weight: 6, amount: 1 },
    { itemId: "myname:jack", weight: 6, amount: 1 },
    { itemId: "myname:mimikkyu", weight: 6, amount: 1 },
    { itemId: "myname:soubraze", weight: 6, amount: 1 },
    { itemId: "myname:goamagara", weight: 6, amount: 1 },
    { itemId: "myname:shini", weight: 6, amount: 1 },
    { itemId: "myname:mystery_fossil", weight: 10, amount: 1 },
    { itemId: "minecraft:emerald", weight: 8, amount: 1 },
    { itemId: "pinecd:cd_01", weight: 4, amount: 1 },
    { itemId: "pinecd:cd_02", weight: 4, amount: 1 },
    { itemId: "pinecd:cd_03", weight: 4, amount: 1 },
    { itemId: "pinecd:cd_04", weight: 4, amount: 1 },
    { itemId: "pinecd:cd_05", weight: 4, amount: 1 },
    { itemId: "pinecd:cd_06", weight: 4, amount: 1 },
    { itemId: "pinecd:cd_07", weight: 4, amount: 1 },
    { itemId: "pinecd:cd_08", weight: 4, amount: 1 },
    { itemId: "pinecd:cd_09", weight: 4, amount: 1 },
    { itemId: "pinecd:cd_10", weight: 4, amount: 1 },
    { itemId: "pinecd:cd_11", weight: 4, amount: 1 },
    { itemId: "pinecd:cd_12", weight: 4, amount: 1 },
    { itemId: "pinecd:cd_13", weight: 4, amount: 1 },
    { itemId: "pinecd:cd_14", weight: 4, amount: 1 },
    { itemId: "pinecd:cd_15", weight: 4, amount: 1 },
    { itemId: "pinecd:cd_16", weight: 4, amount: 1 },
    { itemId: "pinecd:cd_17", weight: 4, amount: 1 },
    { itemId: "pinecd:cd_18", weight: 4, amount: 1 },
    { itemId: "pinecd:cd_19", weight: 4, amount: 1 },
    { itemId: "waystone:waystone", weight: 8, amount: 1 },
    { itemId: "myname:hitomoshi", weight: 6, amount: 1 },
    { itemId: "myname:gengar", weight: 6, amount: 1 },
    { itemId: "myname:metamon", weight: 6, amount: 1 },
    { itemId: "myname:meltan", weight: 6, amount: 1 }
];

function chooseMysteryFossilReward() {
    const totalWeight = MYSTERY_FOSSIL_REWARDS.reduce((sum, reward) => sum + reward.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const reward of MYSTERY_FOSSIL_REWARDS) {
        roll -= reward.weight;
        if (roll <= 0) return reward;
    }
    return MYSTERY_FOSSIL_REWARDS[0];
}

function getHeldItemTypeIdFromPlayer(player) {
    try {
        const inv = player?.getComponent?.("minecraft:inventory")?.container;
        const slot = player?.selectedSlotIndex;
        if (!inv || typeof slot !== "number") return undefined;
        return inv.getItem(slot)?.typeId;
    } catch {
        return undefined;
    }
}

function toFossilKey(dimensionId, location) {
    return `${dimensionId}:${location.x},${location.y},${location.z}`;
}

function getFossilCenter(location) {
    return { x: location.x + 0.5, y: location.y + 0.5, z: location.z + 0.5 };
}

function toSolarBurstPositions(location) {
    const positions = [];
    for (let y = 0; y <= 3; y++) {
        for (let dx = -3; dx <= 3; dx++) {
            for (let dz = -3; dz <= 3; dz++) {
                const distSq = (dx * dx) + (dz * dz);
                if (distSq > 10) continue;
                positions.push({ x: location.x + dx, y: location.y + y, z: location.z + dz });
            }
        }
    }
    return positions;
}

function sortSolarPositionsForFade(center, positions) {
    return [...positions].sort((a, b) => {
        const da = ((a.x - center.x) * (a.x - center.x)) + ((a.y - center.y) * (a.y - center.y)) + ((a.z - center.z) * (a.z - center.z));
        const db = ((b.x - center.x) * (b.x - center.x)) + ((b.y - center.y) * (b.y - center.y)) + ((b.z - center.z) * (b.z - center.z));
        return db - da;
    });
}

function setLightBlock15(block) {
    if (!block) return false;
    const tryPermutations = [
        () => BlockPermutation.resolve("minecraft:light_block", { "block_light_level": 15 }),
        () => BlockPermutation.resolve("minecraft:light_block", { "minecraft:block_light_level": 15 }),
        () => BlockPermutation.resolve("minecraft:light_block", { "block_light_level": "15" }),
        () => BlockPermutation.resolve("minecraft:light_block", { "minecraft:block_light_level": "15" }),
        () => BlockPermutation.resolve("minecraft:light_block")
    ];

    for (const makePermutation of tryPermutations) {
        try {
            block.setPermutation(makePermutation());
            return true;
        } catch {
        }
    }
    return false;
}

function tryClearLightBlockByCommand(dimension, pos) {
    try {
        const cmd = `setblock ${pos.x} ${pos.y} ${pos.z} air replace`;
        void dimension.runCommandAsync(cmd);
        return true;
    } catch {
        return false;
    }
}

function clearLightBlockIfPresent(dimension, pos, block) {
    const target = block ?? dimension.getBlock(pos);
    if (!target || target.typeId !== "minecraft:light_block") {
        return;
    }

    try {
        target.setType("minecraft:air");
    } catch {
        tryClearLightBlockByCommand(dimension, pos);
    }
}

function triggerMysteryFossilSolarBurst(dimension, location) {
    if (!MYSTERY_FOSSIL_ENABLE_SOLAR_BURST) return;

    const key = toFossilKey(dimension.id, location);
    const positions = toSolarBurstPositions(location);
    const placed = [];

    // Safety scrub for old stuck light blocks from previous runs.
    for (const pos of positions) {
        clearLightBlockIfPresent(dimension, pos);
    }

    for (const pos of positions) {
        const block = dimension.getBlock(pos);
        if (!block) continue;
        if (block.typeId !== "minecraft:air" && block.typeId !== "minecraft:light_block") continue;
        const placedByApi = setLightBlock15(block);
        if (placedByApi) {
            placed.push({ x: pos.x, y: pos.y, z: pos.z });
        }
    }

    if (placed.length > 0) {
        const ordered = sortSolarPositionsForFade(location, placed);
        mysteryFossilSolarBursts.set(key, {
            dimensionId: dimension.id,
            startedAt: system.currentTick,
            expiresAt: system.currentTick + MYSTERY_FOSSIL_SOLAR_BURST_TTL,
            clearedCount: 0,
            positions: ordered
        });
    }
}

function tickMysteryFossilSolarBursts() {
    const now = system.currentTick;

    for (const [key, burst] of mysteryFossilSolarBursts.entries()) {
        if (!burst) continue;

        let dimension;
        try {
            dimension = world.getDimension(burst.dimensionId);
        } catch {
            mysteryFossilSolarBursts.delete(key);
            continue;
        }

        const life = Math.max(1, burst.expiresAt - burst.startedAt);
        const elapsed = Math.max(0, now - burst.startedAt);
        const progress = Math.max(0, Math.min(1, elapsed / life));
        const targetCleared = Math.floor(progress * burst.positions.length);

        while (burst.clearedCount < targetCleared) {
            const pos = burst.positions[burst.clearedCount];
            burst.clearedCount += 1;
            if (!pos) continue;
            const block = dimension.getBlock(pos);
            clearLightBlockIfPresent(dimension, pos, block);
        }

        if (now < burst.expiresAt) {
            mysteryFossilSolarBursts.set(key, burst);
            continue;
        }

        while (burst.clearedCount < burst.positions.length) {
            const pos = burst.positions[burst.clearedCount];
            burst.clearedCount += 1;
            if (!pos) continue;
            const block = dimension.getBlock(pos);
            clearLightBlockIfPresent(dimension, pos, block);
        }

        mysteryFossilSolarBursts.delete(key);
    }
}

function scrubStuckMysteryFossilLightBlocks() {
    if (!MYSTERY_FOSSIL_ENABLE_STUCK_LIGHT_SCRUB) return;

    let removed = 0;
    const radius = MYSTERY_FOSSIL_STUCK_LIGHT_SCAN_RADIUS;

    for (const player of world.getAllPlayers()) {
        if (removed >= MYSTERY_FOSSIL_STUCK_LIGHT_SCAN_LIMIT_PER_PASS) break;

        const dimension = player.dimension;
        const baseX = Math.floor(player.location.x);
        const baseY = Math.floor(player.location.y);
        const baseZ = Math.floor(player.location.z);

        // Fast-path cleanup: wipe all light_block in a wide box around each player.
        // This catches leftovers from older versions even when local block iteration misses some.
        try {
            const x1 = baseX - radius;
            const y1 = baseY + MYSTERY_FOSSIL_STUCK_LIGHT_SCAN_MIN_Y;
            const z1 = baseZ - radius;
            const x2 = baseX + radius;
            const y2 = baseY + MYSTERY_FOSSIL_STUCK_LIGHT_SCAN_MAX_Y;
            const z2 = baseZ + radius;
            const cmd = `fill ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} air replace minecraft:light_block`;
            void dimension.runCommandAsync(cmd);
        } catch {
        }

        for (let dy = MYSTERY_FOSSIL_STUCK_LIGHT_SCAN_MIN_Y; dy <= MYSTERY_FOSSIL_STUCK_LIGHT_SCAN_MAX_Y; dy++) {
            if (removed >= MYSTERY_FOSSIL_STUCK_LIGHT_SCAN_LIMIT_PER_PASS) break;
            for (let dx = -radius; dx <= radius; dx++) {
                if (removed >= MYSTERY_FOSSIL_STUCK_LIGHT_SCAN_LIMIT_PER_PASS) break;
                for (let dz = -radius; dz <= radius; dz++) {
                    if (removed >= MYSTERY_FOSSIL_STUCK_LIGHT_SCAN_LIMIT_PER_PASS) break;
                    const pos = { x: baseX + dx, y: baseY + dy, z: baseZ + dz };
                    const block = dimension.getBlock(pos);
                    if (!block || block.typeId !== "minecraft:light_block") continue;
                    clearLightBlockIfPresent(dimension, pos, block);
                    removed += 1;
                }
            }
        }
    }
}

function spawnMysteryFossilXpOrbBurst(dimension, center) {
    for (let i = 0; i < MYSTERY_FOSSIL_XP_ORB_COUNT; i++) {
        const offsetX = (Math.random() - 0.5) * 1.2;
        const offsetY = Math.random() * 0.8;
        const offsetZ = (Math.random() - 0.5) * 1.2;
        try {
            dimension.spawnEntity("minecraft:xp_orb", {
                x: center.x + offsetX,
                y: center.y + offsetY,
                z: center.z + offsetZ
            });
        } catch {
        }
    }
}

function grantMysteryFossilXp(dimension, center) {
    // Always spawn visible XP orbs so the reward is clear in-game.
    spawnMysteryFossilXpOrbBurst(dimension, center);
    system.runTimeout(() => {
        spawnMysteryFossilXpOrbBurst(dimension, center);
    }, 6);
}

function spawnMysteryFossilBrushTickFx(dimension, location) {
    const center = getFossilCenter(location);
    for (let i = 0; i < 3; i++) {
        const offsetX = (Math.random() - 0.5) * 0.35;
        const offsetY = 0.05 + Math.random() * 0.35;
        const offsetZ = (Math.random() - 0.5) * 0.35;
        try {
            dimension.spawnParticle("minecraft:endrod", {
                x: center.x + offsetX,
                y: center.y + offsetY,
                z: center.z + offsetZ
            });
        } catch {
        }
    }
}

function setMysteryFossilStage(dimension, location, stage) {
    const block = dimension.getBlock(location);
    if (!block) return false;

    if (block.typeId !== MYSTERY_FOSSIL_FINISHED_BLOCK_ID) {
        try {
            block.setType(MYSTERY_FOSSIL_FINISHED_BLOCK_ID);
        } catch {
            // If this world is still using another block source, keep sequence alive anyway.
        }
    }

    const updated = dimension.getBlock(location);
    if (!updated) return false;

    for (const key of MYSTERY_FOSSIL_STAGE_KEYS) {
        try {
            updated.setPermutation(updated.permutation.withState(key, stage));
            break;
        } catch {
        }
    }

    // Do not abort the sequence when state write is unavailable.
    return true;
}

function spawnMysteryFossilGlowFx(dimension, location, stage, burstScale = 1) {
    const center = getFossilCenter(location);
    const safeStage = Math.max(0, Math.min(3, stage));
    const burst = Math.max(1, Math.floor(MYSTERY_FOSSIL_PARTICLE_BURST_BY_STAGE[safeStage] * burstScale));

    for (let i = 0; i < burst; i++) {
        const offsetX = (Math.random() - 0.5) * 0.6;
        const offsetY = 0.15 + Math.random() * 0.7;
        const offsetZ = (Math.random() - 0.5) * 0.6;
        try {
            dimension.spawnParticle("minecraft:endrod", {
                x: center.x + offsetX,
                y: center.y + offsetY,
                z: center.z + offsetZ
            });
        } catch {
        }
    }
}

function beginMysteryFossilSequence(dimension, location) {
    const key = toFossilKey(dimension.id, location);

    // Convert sand to fossil once at sequence start so it does not remain sand,
    // while keeping intermediate stage swaps disabled to avoid blinking.
    try {
        const block = dimension.getBlock(location);
        if (block && block.typeId !== MYSTERY_FOSSIL_FINISHED_BLOCK_ID) {
            block.setType(MYSTERY_FOSSIL_FINISHED_BLOCK_ID);
        }
    } catch {
    }

    mysteryFossilSequences.set(key, {
        dimensionId: dimension.id,
        x: location.x,
        y: location.y,
        z: location.z,
        nextTick: system.currentTick,
        stageIndex: 0
    });
}

function completeMysteryFossilSequence(seq, key) {
    let dimension;
    try {
        dimension = world.getDimension(seq.dimensionId);
    } catch {
        mysteryFossilSequences.delete(key);
        return;
    }

    const location = { x: seq.x, y: seq.y, z: seq.z };
    const center = getFossilCenter(location);
    const reward = chooseMysteryFossilReward();

    for (let i = 0; i < 320; i++) {
        const angle = (Math.PI * 2 * i) / 32;
        const radius = 0.8 + Math.random() * 1.1;
        try {
            dimension.spawnParticle("minecraft:endrod", {
                x: center.x + Math.cos(angle) * radius,
                y: center.y + 0.1 + Math.random() * 2.2,
                z: center.z + Math.sin(angle) * radius
            });
        } catch {
        }
    }

    for (let i = 0; i < 180; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 1.15;
        try {
            dimension.spawnParticle("minecraft:endrod", {
                x: center.x + Math.cos(angle) * radius,
                y: center.y + 0.8 + Math.random() * 2.4,
                z: center.z + Math.sin(angle) * radius
            });
        } catch {
        }
    }
    // Apply smoke across the whole 1-block radius area around the center.
    for (let dx = -1; dx <= 1.0001; dx += 0.2) {
        for (let dz = -1; dz <= 1.0001; dz += 0.2) {
            if ((dx * dx) + (dz * dz) > 1.0) continue;
            for (let i = 0; i < 4; i++) {
                try {
                    dimension.spawnParticle("minecraft:basic_smoke_particle", {
                        x: center.x + dx + (Math.random() - 0.5) * 0.12,
                        y: center.y + Math.random() * 2.8,
                        z: center.z + dz + (Math.random() - 0.5) * 0.12
                    });
                } catch {
                }
            }
        }
    }

    // Add a taller central plume so the dish reveal feels dramatic.
    for (let i = 0; i < 140; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 0.45;
        try {
            dimension.spawnParticle("minecraft:basic_smoke_particle", {
                x: center.x + Math.cos(angle) * radius,
                y: center.y + 0.2 + Math.random() * 3.4,
                z: center.z + Math.sin(angle) * radius
            });
        } catch {
        }
    }
    try {
        dimension.playSound("random.totem", center);
    } catch {
    }
    try {
        dimension.playSound("beacon.power", center);
    } catch {
    }

    let didSpawnReward = false;
    try {
        dimension.spawnItem(new ItemStack(reward.itemId, reward.amount), center);
        didSpawnReward = true;
    } catch {
    }
    if (!didSpawnReward) {
        try {
            dimension.spawnItem(new ItemStack("minecraft:emerald", 3), center);
        } catch {
        }
    }

    grantMysteryFossilXp(dimension, center);

    const block = dimension.getBlock(location);
    if (block) {
        try {
            block.setType("minecraft:air");
        } catch {
        }
    }
    triggerMysteryFossilSolarBurst(dimension, location);
    mysteryFossilSequences.delete(key);
}

function tickMysteryFossilSequences() {
    const now = system.currentTick;

    for (const [key, seq] of mysteryFossilSequences.entries()) {
        if (!seq) continue;

        let dimension;
        try {
            dimension = world.getDimension(seq.dimensionId);
        } catch {
            mysteryFossilSequences.delete(key);
            continue;
        }

        const location = { x: seq.x, y: seq.y, z: seq.z };
        const currentVisualIndex = Math.max(0, Math.min(MYSTERY_FOSSIL_GLOW_STAGES.length - 1, seq.stageIndex - 1));
        const currentVisualStage = MYSTERY_FOSSIL_GLOW_STAGES[currentVisualIndex] ?? 0;
        let burstScale = 1;
        if (currentVisualStage >= MYSTERY_FOSSIL_FINISHED_STAGE) {
            const finalStartIndex = Math.max(0, MYSTERY_FOSSIL_GLOW_STAGES.length - MYSTERY_FOSSIL_FINAL_BURST_WINDOW);
            const finalProgress = Math.max(0, seq.stageIndex - finalStartIndex);
            burstScale = 1 + finalProgress * 0.9;
            if (seq.stageIndex >= MYSTERY_FOSSIL_GLOW_STAGES.length - 2) {
                burstScale *= MYSTERY_FOSSIL_FINAL_MEGA_MULTIPLIER;
            }
        }
        if (seq.stageIndex % 3 === 0) {
            spawnMysteryFossilGlowFx(dimension, location, currentVisualStage, burstScale);
        }

        if (seq.nextTick > now) continue;

        if (seq.stageIndex >= MYSTERY_FOSSIL_GLOW_STAGES.length) {
            completeMysteryFossilSequence(seq, key);
            continue;
        }

        const targetStage = MYSTERY_FOSSIL_GLOW_STAGES[seq.stageIndex];
        const ok = MYSTERY_FOSSIL_STAGE_SWAP_DURING_PROGRESS
            ? setMysteryFossilStage(dimension, location, targetStage)
            : true;
        if (!ok) {
            // Only stop when the block position itself is invalid/unloaded.
            mysteryFossilSequences.delete(key);
            continue;
        }

        if (targetStage >= MYSTERY_FOSSIL_FINISHED_STAGE) {
            try {
                dimension.playSound("beacon.activate", getFossilCenter(location));
            } catch {
            }
            if (seq.stageIndex % 2 === 0) {
                try {
                    dimension.playSound("random.orb", getFossilCenter(location));
                } catch {
                }
            }
        }

        seq.stageIndex += 1;
        seq.nextTick = now + MYSTERY_FOSSIL_GLOW_STEP_TICKS;
        mysteryFossilSequences.set(key, seq);
    }
}

function markPendingMysteryFossil(event) {
    const player = event?.player;
    const block = event?.block;
    if (!player || !block) return;
    if (!MYSTERY_FOSSIL_BRUSHABLE_BLOCK_IDS.includes(block.typeId)) return;

    const heldItemId = getHeldItemTypeIdFromPlayer(player);
    if (heldItemId !== "minecraft:brush") return;

    spawnMysteryFossilBrushTickFx(block.dimension, block.location);

    const key = toFossilKey(block.dimension.id, block.location);
    mysteryFossilPending.set(key, {
        dimensionId: block.dimension.id,
        x: block.location.x,
        y: block.location.y,
        z: block.location.z,
        expiresAt: system.currentTick + MYSTERY_FOSSIL_PENDING_TTL
    });
}

function finalizePendingMysteryFossils() {
    const now = system.currentTick;
    for (const [key, value] of mysteryFossilPending.entries()) {
        if (!value || value.expiresAt <= now) {
            mysteryFossilPending.delete(key);
            continue;
        }

        let dimension;
        try {
            dimension = world.getDimension(value.dimensionId);
        } catch {
            mysteryFossilPending.delete(key);
            continue;
        }

        const block = dimension.getBlock({ x: value.x, y: value.y, z: value.z });
        if (!block) {
            mysteryFossilPending.delete(key);
            continue;
        }

        if (block.typeId === MYSTERY_FOSSIL_SOURCE_BLOCK_ID || block.typeId === MYSTERY_FOSSIL_FINISHED_BLOCK_ID) {
            beginMysteryFossilSequence(dimension, { x: value.x, y: value.y, z: value.z });
            mysteryFossilPending.delete(key);
            continue;
        }

        if (!MYSTERY_FOSSIL_BRUSHABLE_BLOCK_IDS.includes(block.typeId)) {
            mysteryFossilPending.delete(key);
        }
    }
}

safeSubscribe(world?.afterEvents?.playerInteractWithBlock, markPendingMysteryFossil);
system.runInterval(finalizePendingMysteryFossils, 2);
system.runInterval(tickMysteryFossilSequences, 1);
system.runInterval(tickMysteryFossilSolarBursts, 2);
system.runInterval(scrubStuckMysteryFossilLightBlocks, 20);


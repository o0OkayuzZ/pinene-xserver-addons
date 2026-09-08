import { EnchantmentTypes, ItemStack, system, world } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

const CHEST_ID = "pinene:meitetsu_chest";
const ANCHOR_ID = "pinene:meitetsu_chest_container";
const SLOT_COUNT = 27;
const MAX_STORAGE_BYTES = 30000;

const OWNER_KEY = "pinene:meitetsu_owner:";
const STORAGE_KEY = "pinene:meitetsu_storage:";
const NATIVE_KEY = "pinene:meitetsu_native:";
const LEGACY_OWNER_KEY = "pinene:mt_own:";
const LEGACY_STORAGE_KEYS = ["pinene:mt_store:", "pinene:meitetsu_store:"];
const PASSWORD_KEYS = ["pinene:meitetsu_password:", "pinene:mt_pass:"];
const OBSOLETE_ACCESS_KEY = "pinene:meitetsu_access:";

const pendingClaims = new Set();
const pendingRepairs = new Set();
const messageTicks = new Map();

const PASSCODE_KEY = "pinene:meitetsu_passcode_v2:";
const accessTickets = new Map();
const activeForms = new Set();
const failedAttempts = new Map();

function passcodeState(key) {
    const raw = property(PASSCODE_KEY + key);
    if (raw === undefined) return { valid: true, present: false };
    try {
        const value = JSON.parse(raw);
        if (typeof value.code !== "string" || value.code.length < 4 || value.code.length > 32
            || typeof value.revision !== "string") return { valid: false, present: true };
        return { valid: true, present: true, raw, ...value };
    } catch {
        return { valid: false, present: true };
    }
}

function forgetAccess(key) {
    accessTickets.delete(key);
}

function mayAccess(key, playerId) {
    const owner = ownerState(key);
    if (!owner.valid || !owner.ownerId) return false;
    const password = passcodeState(key);
    if (!password.valid || !password.present) return false;
    if (owner.ownerId === playerId) return true;
    const ticket = accessTickets.get(key)?.get(playerId);
    return !!ticket && ticket.raw === password.raw
        && ticket.entityId === nativeState(key).entityId && ticket.expires > system.currentTick;
}

function formContext(reference, playerId, entityId) {
    const player = livePlayer(playerId);
    const block = liveBlock(reference);
    if (!player || !block) return undefined;
    if (player.dimension.id !== reference.dimensionId) return undefined;
    const p = player.location;
    if ((p.x - block.x - 0.5) ** 2 + (p.y - block.y - 0.5) ** 2
        + (p.z - block.z - 0.5) ** 2 > 64) return undefined;
    const result = validatedNativeAnchor(block, reference.key);
    if (!result.ok || result.anchor.id !== entityId) return undefined;
    const owner = ownerState(reference.key);
    if (!owner.valid || !owner.ownerId) return undefined;
    return { player, block, owner, result };
}

async function editPasscode(reference, playerId, entityId) {
    let context = formContext(reference, playerId, entityId);
    if (!context || context.owner.ownerId !== playerId) return;
    const previous = property(PASSCODE_KEY + reference.key);
    const response = await new ModalFormData().title("冥鉄の箱：パスワード設定")
        .textField("この箱専用の合言葉（4〜32文字）", "合言葉")
        .textField("確認のため、もう一度入力", "同じ合言葉").show(context.player);
    if (response.canceled) return;
    const code = response.formValues?.[0];
    if (typeof code !== "string" || code.length < 4 || code.length > 32
        || code.trim().length === 0 || code !== response.formValues?.[1]) {
        tell(context.player, "§c4〜32文字の同じ合言葉を2回入力してください。");
        return;
    }
    context = formContext(reference, playerId, entityId);
    if (!context || context.owner.ownerId !== playerId
        || property(PASSCODE_KEY + reference.key) !== previous) return;
    const record = JSON.stringify({ code, revision: entityId + ":" + Date.now() + ":" + system.currentTick });
    setProperty(PASSCODE_KEY + reference.key, record);
    if (property(PASSCODE_KEY + reference.key) !== record) throw new Error("passcode save failed");
    forgetAccess(reference.key);
    tell(context.player, "§aパスワードを設定しました。中央・ふたをもう一度操作すると開けます。");
}

async function enterPasscode(reference, playerId, entityId) {
    let context = formContext(reference, playerId, entityId);
    if (!context) return;
    const password = passcodeState(reference.key);
    if (!password.valid || !password.present) {
        tell(context.player, "§eこの箱は管理者のパスワード設定待ちです。");
        return;
    }
    if ((failedAttempts.get(playerId) ?? 0) > system.currentTick) {
        tell(context.player, "§e少し待ってからパスワードを入力してください。");
        return;
    }
    const response = await new ModalFormData().title("冥鉄の箱：ロック解除")
        .textField("この箱の合言葉", "パスワード").show(context.player);
    if (response.canceled) return;
    context = formContext(reference, playerId, entityId);
    if (!context || property(PASSCODE_KEY + reference.key) !== password.raw) return;
    if (response.formValues?.[0] !== password.code) {
        failedAttempts.set(playerId, system.currentTick + 100);
        tell(context.player, "§cパスワードが違います。5秒後に再入力できます。");
        return;
    }
    let tickets = accessTickets.get(reference.key);
    if (!tickets) accessTickets.set(reference.key, tickets = new Map());
    tickets.set(playerId, { raw: password.raw, entityId, expires: system.currentTick + 600 });
    tell(context.player, "§a認証しました。30秒以内に、しゃがまず中央・ふたをもう一度操作してください。");
}

async function manageChest(reference, playerId, entityId) {
    let context = formContext(reference, playerId, entityId);
    if (!context || context.owner.ownerId !== playerId) return;
    const response = await new ActionFormData().title("冥鉄の箱：管理")
        .body("開くには中央・ふたを通常操作してください。回収すると箱と中身がその場にドロップします。")
        .button("パスワードを設定・変更")
        .button("箱と中身を回収")
        .button("採掘モードにする")
        .button("閉じる").show(context.player);
    if (response.canceled) return;
    context = formContext(reference, playerId, entityId);
    if (!context || context.owner.ownerId !== playerId) return;
    if (response.selection === 0) {
        await editPasscode(reference, playerId, entityId);
    } else if (response.selection === 2) {
        context.result.anchor.triggerEvent("pinene:enable_mining");
        // Keep the origin in the same block cell so identity and storage lookups remain valid.
        // Moving above the 14/16-high block also clears old client-side entity hitboxes.
        context.result.anchor.teleport({
            x: context.block.x + 0.5,
            y: context.block.y + 15 / 16,
            z: context.block.z + 0.5
        }, { dimension: context.block.dimension, checkForBlocks: false });
        console.info(`[meitetsu_chest] mining mode: storage raised at ${reference.key}`);
        tell(context.player, "§a採掘モードにしました。箱の側面の中央を左クリック長押しで壊してください。右クリックすると通常の状態に戻ります。");
    } else if (response.selection === 1) {
        const confirm = await new ActionFormData().title("箱を回収しますか？")
            .body("箱と中身をその場にドロップします。管理者とパスワードの登録は解除されます。")
            .button("回収する").button("やめる").show(context.player);
        if (confirm.canceled || confirm.selection !== 0) return;
        context = formContext(reference, playerId, entityId);
        if (!context || context.owner.ownerId !== playerId) return;
        if (drainNativeStorage(context.block, reference.key, true)) {
            tell(context.player, "§a箱と中身を回収しました。再設置後は新しく管理者登録できます。");
        } else {
            tell(context.player, "§c回収を完了できませんでした。箱を確認してもう一度操作してください。");
        }
    }
}

function queueChestForm(block, playerId, mode) {
    if (activeForms.has(playerId)) return;
    const reference = blockReference(block);
    const marker = nativeState(reference.key);
    if (!marker.valid || !marker.present) {
        queueOwnerPrepare(block, playerId);
        return;
    }
    activeForms.add(playerId);
    system.run(() => {
        const task = mode === "manage" ? manageChest : mode === "set" ? editPasscode : enterPasscode;
        task(reference, playerId, marker.entityId).catch(() => {
            const player = livePlayer(playerId);
            if (player) tell(player, "§e画面を表示できませんでした。ほかの画面を閉じて、もう一度箱を操作してください。");
            console.warn("[meitetsu_chest] chest form could not be completed");
        }).finally(() => activeForms.delete(playerId));
    });
}

function handleLockedInteraction(block, player) {
    const key = chestKey(block);
    const owner = ownerState(key);
    if (owner.ownerId === player.id) {
        if (player.isSneaking) queueChestForm(block, player.id, "manage");
        else if (!passcodeState(key).present || !passcodeState(key).valid) queueChestForm(block, player.id, "set");
        else queueOwnerPrepare(block, player.id);
    } else {
        queueChestForm(block, player.id, "enter");
    }
}

const UNSAFE_LEGACY_ITEM_IDS = new Set([
    "minecraft:axolotl_bucket",
    "minecraft:bee_nest",
    "minecraft:beehive",
    "minecraft:banner",
    "minecraft:cod_bucket",
    "minecraft:compass",
    "minecraft:crossbow",
    "minecraft:decorated_pot",
    "minecraft:firework_rocket",
    "minecraft:firework_star",
    "minecraft:filled_map",
    "minecraft:goat_horn",
    "minecraft:lingering_potion",
    "minecraft:lodestone_compass",
    "minecraft:map",
    "minecraft:ominous_bottle",
    "minecraft:player_head",
    "minecraft:potion",
    "minecraft:pufferfish_bucket",
    "minecraft:salmon_bucket",
    "minecraft:shield",
    "minecraft:skull",
    "minecraft:splash_potion",
    "minecraft:suspicious_stew",
    "minecraft:tadpole_bucket",
    "minecraft:tipped_arrow",
    "minecraft:tropical_fish_bucket",
    "minecraft:writable_book",
    "minecraft:written_book"
]);

function chestKey(block) {
    return `${block.dimension.id};${block.x};${block.y};${block.z}`;
}

function blockReference(block) {
    return {
        dimensionId: block.dimension.id,
        location: { x: block.x, y: block.y, z: block.z },
        key: chestKey(block)
    };
}

function liveBlock(reference) {
    try {
        const block = world.getDimension(reference.dimensionId).getBlock(reference.location);
        return block?.typeId === CHEST_ID ? block : undefined;
    } catch {
        return undefined;
    }
}

function livePlayer(playerId) {
    return world.getAllPlayers().find((player) => player.id === playerId);
}

function tell(player, message, cooldownKey = "") {
    try {
        if (cooldownKey) {
            const key = `${player.id}|${cooldownKey}`;
            const now = system.currentTick;
            if ((messageTicks.get(key) ?? -1000) + 20 > now) return;
            messageTicks.set(key, now);
        }
        player.sendMessage(message);
    } catch {
    }
}

function tellLater(playerId, message, cooldownKey = "") {
    system.run(() => {
        const player = livePlayer(playerId);
        if (player) tell(player, message, cooldownKey);
    });
}

function property(id) {
    return world.getDynamicProperty(id);
}

function setProperty(id, value) {
    world.setDynamicProperty(id, value);
}

function ownerState(key) {
    for (const prefix of [OWNER_KEY, LEGACY_OWNER_KEY]) {
        const value = property(prefix + key);
        if (value === undefined) continue;
        return typeof value === "string" && value.length > 0
            ? { valid: true, ownerId: value, prefix }
            : { valid: false };
    }
    return { valid: true, ownerId: undefined };
}

function nativeState(key) {
    const value = property(NATIVE_KEY + key);
    if (value === undefined) return { present: false, valid: true };
    if (typeof value !== "string" || !value.startsWith("v1:") || value.length <= 3) {
        return { present: true, valid: false };
    }
    return { present: true, valid: true, entityId: value.slice(3), marker: value };
}

function clearObsoleteSecurity(key) {
    for (const prefix of PASSWORD_KEYS) setProperty(prefix + key, undefined);
}

function clearChestState(key) {
    forgetAccess(key);
    for (const prefix of [
        PASSCODE_KEY,
        OWNER_KEY,
        LEGACY_OWNER_KEY,
        STORAGE_KEY,
        ...LEGACY_STORAGE_KEYS,
        NATIVE_KEY,
        ...PASSWORD_KEYS
    ]) {
        setProperty(prefix + key, undefined);
    }
}

function purgeObsoleteSecurity() {
    for (const id of world.getDynamicPropertyIds()) {
        if (id.startsWith(OBSOLETE_ACCESS_KEY) || PASSWORD_KEYS.some((prefix) => id.startsWith(prefix))) {
            setProperty(id, undefined);
        }
    }
}

function utf8ByteLength(value) {
    let bytes = 0;
    for (const character of value) {
        const codePoint = character.codePointAt(0);
        bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
    }
    return bytes;
}

function unsafeLegacyItem(item) {
    return UNSAFE_LEGACY_ITEM_IDS.has(item.id)
        || /(?:_banner|_bundle|_shulker_box)$/.test(item.id)
        || /(?:_helmet|_chestplate|_leggings|_boots)$/.test(item.id)
        || item.id === "minecraft:bundle";
}

function readLegacySlots(key) {
    let raw;
    let source;
    for (const prefix of [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]) {
        const value = property(prefix + key);
        if (value === undefined) continue;
        raw = value;
        source = prefix;
        break;
    }
    if (raw === undefined) {
        return { ok: true, present: false, slots: Array(SLOT_COUNT).fill(null) };
    }
    if (typeof raw !== "string" || utf8ByteLength(raw) > MAX_STORAGE_BYTES) {
        return { ok: false, present: true, source };
    }

    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return { ok: false, present: true, source };
        if (parsed.slice(SLOT_COUNT).some((item) => item !== null && item !== undefined)) {
            return { ok: false, present: true, source };
        }
        const slots = Array.from({ length: SLOT_COUNT }, (_, index) => parsed[index] ?? null);
        for (const item of slots) {
            if (item === null) continue;
            if (typeof item !== "object" || typeof item.id !== "string" || item.id.length < 1) {
                return { ok: false, present: true, source };
            }
            if (!Number.isInteger(item.count) || item.count < 1 || item.count > 255) {
                return { ok: false, present: true, source };
            }
            if (item.name !== undefined && typeof item.name !== "string") return { ok: false, present: true, source };
            if (item.lore !== undefined && (!Array.isArray(item.lore) || item.lore.some((line) => typeof line !== "string"))) {
                return { ok: false, present: true, source };
            }
            if (item.rawLore !== undefined && !Array.isArray(item.rawLore)) return { ok: false, present: true, source };
            if (item.keepOnDeath !== undefined && typeof item.keepOnDeath !== "boolean") return { ok: false, present: true, source };
            if (item.lockMode !== undefined && typeof item.lockMode !== "string") return { ok: false, present: true, source };
            if (item.canDestroy !== undefined && (!Array.isArray(item.canDestroy) || item.canDestroy.some((id) => typeof id !== "string"))) {
                return { ok: false, present: true, source };
            }
            if (item.canPlaceOn !== undefined && (!Array.isArray(item.canPlaceOn) || item.canPlaceOn.some((id) => typeof id !== "string"))) {
                return { ok: false, present: true, source };
            }
            if (item.dynamicProperties !== undefined && (!item.dynamicProperties || typeof item.dynamicProperties !== "object" || Array.isArray(item.dynamicProperties))) {
                return { ok: false, present: true, source };
            }
            if (item.damage !== undefined && (!Number.isFinite(item.damage) || item.damage < 0)) {
                return { ok: false, present: true, source };
            }
            if (item.unbreakable !== undefined && typeof item.unbreakable !== "boolean") return { ok: false, present: true, source };
            if (item.enchantments !== undefined && (!Array.isArray(item.enchantments) || item.enchantments.some((entry) =>
                !entry || typeof entry.id !== "string" || !Number.isInteger(entry.level) || entry.level < 1))) {
                return { ok: false, present: true, source };
            }
        }
        return { ok: true, present: true, source, slots };
    } catch {
        return { ok: false, present: true, source };
    }
}

function createItem(saved) {
    const stack = new ItemStack(saved.id, saved.count);
    if (saved.name !== undefined) stack.nameTag = saved.name;
    const lore = Array.isArray(saved.rawLore) ? saved.rawLore : saved.lore;
    if (Array.isArray(lore)) stack.setLore(lore);
    if (saved.keepOnDeath) stack.keepOnDeath = true;
    if (saved.lockMode !== undefined) stack.lockMode = saved.lockMode;
    if (Array.isArray(saved.canDestroy)) stack.setCanDestroy(saved.canDestroy);
    if (Array.isArray(saved.canPlaceOn)) stack.setCanPlaceOn(saved.canPlaceOn);
    if (saved.dynamicProperties && typeof saved.dynamicProperties === "object") {
        for (const [id, value] of Object.entries(saved.dynamicProperties)) stack.setDynamicProperty(id, value);
    }
    if (Number.isFinite(saved.damage) || saved.unbreakable === true) {
        const durability = stack.getComponent("minecraft:durability");
        if (!durability) throw new Error(`missing durability component: ${saved.id}`);
        if (Number.isFinite(saved.damage)) durability.damage = saved.damage;
        if (saved.unbreakable === true) durability.unbreakable = true;
    }
    if (Array.isArray(saved.enchantments) && saved.enchantments.length > 0) {
        const enchantable = stack.getComponent("minecraft:enchantable");
        if (!enchantable) throw new Error(`missing enchantable component: ${saved.id}`);
        for (const savedEnchantment of saved.enchantments) {
            const type = EnchantmentTypes.get(savedEnchantment.id);
            if (!type) throw new Error(`unknown enchantment: ${savedEnchantment.id}`);
            enchantable.addEnchantment({ type, level: savedEnchantment.level });
        }
    }
    if (saved.dyeColor !== undefined) {
        const dyeable = stack.getComponent("minecraft:dyeable");
        if (!dyeable) throw new Error(`missing dyeable component: ${saved.id}`);
        dyeable.color = saved.dyeColor;
    }
    return stack;
}

function normalizedValue(value) {
    if (Array.isArray(value)) return value.map(normalizedValue);
    if (value && typeof value === "object") {
        const normalized = {};
        for (const key of Object.keys(value).sort()) normalized[key] = normalizedValue(value[key]);
        return normalized;
    }
    return value;
}

function sameValue(first, second) {
    return JSON.stringify(normalizedValue(first)) === JSON.stringify(normalizedValue(second));
}

function normalizedEnchantments(entries) {
    return entries
        .map((entry) => `${entry.type?.id ?? entry.id}:${entry.level}`)
        .sort()
        .join("|");
}

function verifyItem(actual, saved) {
    if (!actual || actual.typeId !== saved.id || actual.amount !== saved.count) return false;
    if (saved.name !== undefined && actual.nameTag !== saved.name) return false;
    if (Array.isArray(saved.rawLore) && !sameValue(actual.getRawLore(), saved.rawLore)) return false;
    if (!Array.isArray(saved.rawLore) && Array.isArray(saved.lore) && !sameValue(actual.getLore(), saved.lore)) return false;
    if (saved.keepOnDeath !== undefined && actual.keepOnDeath !== saved.keepOnDeath) return false;
    if (saved.lockMode !== undefined && actual.lockMode !== saved.lockMode) return false;
    if (Array.isArray(saved.canDestroy) && !sameValue(actual.getCanDestroy(), saved.canDestroy)) return false;
    if (Array.isArray(saved.canPlaceOn) && !sameValue(actual.getCanPlaceOn(), saved.canPlaceOn)) return false;
    if (saved.dynamicProperties && typeof saved.dynamicProperties === "object") {
        const actualProperties = {};
        for (const id of actual.getDynamicPropertyIds()) actualProperties[id] = actual.getDynamicProperty(id);
        if (!sameValue(actualProperties, saved.dynamicProperties)) return false;
    }
    if (Number.isFinite(saved.damage) && actual.getComponent("minecraft:durability")?.damage !== saved.damage) return false;
    if (saved.unbreakable === true && actual.getComponent("minecraft:durability")?.unbreakable !== true) return false;
    if (Array.isArray(saved.enchantments)) {
        const actualEnchantments = actual.getComponent("minecraft:enchantable")?.getEnchantments() ?? [];
        if (normalizedEnchantments(actualEnchantments) !== normalizedEnchantments(saved.enchantments)) return false;
    }
    if (saved.dyeColor !== undefined && !sameValue(actual.getComponent("minecraft:dyeable")?.color, saved.dyeColor)) return false;
    return true;
}

function anchorsAt(block) {
    try {
        return block.dimension.getEntitiesAtBlockLocation(block.location)
            .filter((entity) => entity.typeId === ANCHOR_ID && entity.isValid !== false);
    } catch {
        return [];
    }
}

function blockForAnchor(anchor) {
    try {
        const { x, y, z } = anchor.location;
        return anchor.dimension.getBlock({ x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) });
    } catch {
        return undefined;
    }
}

function alignAnchor(block, anchor) {
    try {
        const target = { x: block.x + 0.5, y: block.y, z: block.z + 0.5 };
        const current = anchor.location;
        if (Math.abs(current.x - target.x) > 0.001
            || Math.abs(current.y - target.y) > 0.001
            || Math.abs(current.z - target.z) > 0.001) {
            anchor.teleport(target, { dimension: block.dimension, checkForBlocks: false });
        }
        return true;
    } catch {
        return false;
    }
}

function alignStoredAnchor(anchor) {
    const block = blockForAnchor(anchor);
    if (!block || block.typeId !== CHEST_ID) return false;
    const native = nativeState(chestKey(block));
    if (!native.valid || !native.present || native.entityId !== anchor.id) return false;
    const anchors = anchorsAt(block);
    if (anchors.length !== 1 || anchors[0].id !== anchor.id) return false;
    if (!alignAnchor(block, anchor)) return false;
    anchor.triggerEvent("pinene:enable_opening");
    return true;
}

function alignLoadedAnchors() {
    for (const dimensionId of ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"]) {
        try {
            for (const anchor of world.getDimension(dimensionId).getEntities({ type: ANCHOR_ID })) {
                alignStoredAnchor(anchor);
            }
        } catch {
        }
    }
}

function nativeContainer(anchor) {
    try {
        const container = anchor.getComponent("minecraft:inventory")?.container;
        return container?.size === SLOT_COUNT ? container : undefined;
    } catch {
        return undefined;
    }
}

function containerIsEmpty(container) {
    for (let slot = 0; slot < container.size; slot++) {
        if (container.getItem(slot)) return false;
    }
    return true;
}

function spawnAnchor(block) {
    return block.dimension.spawnEntity(ANCHOR_ID, {
        x: block.x + 0.5,
        y: block.y,
        z: block.z + 0.5
    });
}

function validatedNativeAnchor(block, key) {
    const state = nativeState(key);
    if (!state.present || !state.valid) return { ok: false, reason: "marker" };
    const anchors = anchorsAt(block);
    if (anchors.length !== 1) return { ok: false, reason: "count" };
    const anchor = anchors[0];
    if (anchor.id !== state.entityId) return { ok: false, reason: "identity" };
    const container = nativeContainer(anchor);
    if (!container) return { ok: false, reason: "inventory" };
    return { ok: true, anchor, container };
}

function clearContainer(container) {
    for (let slot = 0; slot < container.size; slot++) container.setItem(slot, undefined);
}

function migrateLegacyStorage(block, key) {
    const legacy = readLegacySlots(key);
    if (!legacy.ok) return { ok: false, reason: "legacy" };

    const existing = anchorsAt(block);
    if (existing.length > 1) return { ok: false, reason: "duplicate" };
    let anchor = existing[0];
    let created = false;
    try {
        if (!anchor) {
            anchor = spawnAnchor(block);
            created = true;
        }
        const container = nativeContainer(anchor);
        if (!container || !containerIsEmpty(container)) throw new Error("native inventory is not empty");

        const unsafe = legacy.slots.find((saved) => saved && unsafeLegacyItem(saved));
        if (unsafe) throw new Error(`legacy item requires manual recovery: ${unsafe.id}`);
        const prepared = legacy.slots.map((saved) => saved ? createItem(saved) : undefined);
        for (let slot = 0; slot < SLOT_COUNT; slot++) {
            if (prepared[slot]) container.setItem(slot, prepared[slot]);
        }
        for (let slot = 0; slot < SLOT_COUNT; slot++) {
            const saved = legacy.slots[slot];
            const actual = container.getItem(slot);
            if (saved ? !verifyItem(actual, saved) : !!actual) throw new Error(`verification failed at slot ${slot}`);
        }

        const marker = `v1:${anchor.id}`;
        setProperty(NATIVE_KEY + key, marker);
        if (property(NATIVE_KEY + key) !== marker) throw new Error("native marker write failed");
        return { ok: true, anchor, container, migrated: legacy.present };
    } catch (error) {
        try {
            const container = anchor && nativeContainer(anchor);
            if (container) clearContainer(container);
            setProperty(NATIVE_KEY + key, undefined);
            if (created && anchor?.isValid !== false) anchor.remove();
        } catch {
        }
        console.error(`[meitetsu_chest] migration failed for ${key}: ${error}`);
        return { ok: false, reason: "migration" };
    }
}

function prepareOwnedChest(block, player, key) {
    const owner = ownerState(key);
    if (!owner.valid || owner.ownerId !== player.id) return { ok: false, reason: "owner" };

    let native = nativeState(key);
    let result;
    let changed = false;
    if (!native.present) {
        result = migrateLegacyStorage(block, key);
        if (!result.ok) return result;
        changed = true;
    } else {
        if (!native.valid) return { ok: false, reason: "marker" };
        result = validatedNativeAnchor(block, key);
        if (!result.ok) return result;
    }

    if (property(OWNER_KEY + key) !== player.id) {
        setProperty(OWNER_KEY + key, player.id);
        changed = true;
    }
    clearObsoleteSecurity(key);
    if (!alignAnchor(block, result.anchor)) return { ok: false, reason: "position" };
    result.anchor.triggerEvent("pinene:enable_opening");
    return { ok: true, changed, anchor: result.anchor, container: result.container };
}

function claimChest(reference, playerId) {
    const player = livePlayer(playerId);
    const block = liveBlock(reference);
    if (!player || !block) return;

    const owner = ownerState(reference.key);
    if (!owner.valid) {
        tell(player, "§c管理者データが壊れているため、安全のため登録を中止しました。");
        return;
    }
    if (owner.ownerId) {
        tell(player, owner.ownerId === player.id
            ? "§aこの冥鉄の箱はあなたが管理者です。"
            : "§c先に別のプレイヤーが管理者登録しました。");
        return;
    }

    let result;
    const native = nativeState(reference.key);
    if (native.present) {
        if (!native.valid) {
            tell(player, "§c収納の識別データが壊れているため、安全のため登録を中止しました。");
            return;
        }
        result = validatedNativeAnchor(block, reference.key);
        if (!result.ok || !containerIsEmpty(result.container)) {
            tell(player, "§c所有者不明の収納データを検出したため、登録できません。管理者による復旧が必要です。");
            return;
        }
    } else {
        const legacy = readLegacySlots(reference.key);
        if (!legacy.ok || legacy.slots.some(Boolean)) {
            console.warn(`[meitetsu_chest] refused claim for ownerless stored chest: ${reference.key}`);
            tell(player, "§c中身のある旧式の箱ですが所有者情報がありません。管理者による復旧が必要です。");
            return;
        }
        result = migrateLegacyStorage(block, reference.key);
        if (!result.ok) {
            tell(player, "§c収納の準備に失敗しました。中身は変更していません。");
            return;
        }
    }

    try {
        setProperty(OWNER_KEY + reference.key, player.id);
        if (property(OWNER_KEY + reference.key) !== player.id) throw new Error("owner write verification failed");
        clearObsoleteSecurity(reference.key);
        player.playSound("random.levelup");
        tell(player, "§a冥鉄の箱の管理者になりました。次の操作でパスワードを設定できます。しゃがみ操作で管理・回収メニューを開きます。");
    } catch (error) {
        console.error(`[meitetsu_chest] owner claim failed for ${reference.key}: ${error}`);
        tell(player, "§c管理者情報の保存に失敗しました。箱は安全のためロックされています。");
    }
}

function repairReason(reason) {
    switch (reason) {
        case "legacy": return "旧収納データを読み取れません";
        case "duplicate":
        case "count": return "収納エンティティが重複または欠損しています";
        case "identity": return "収納エンティティの識別情報が一致しません";
        case "inventory": return "27枠収納を取得できません";
        default: return "収納を安全に準備できません";
    }
}

function queueClaim(block, playerId) {
    const reference = blockReference(block);
    if (pendingClaims.has(reference.key)) {
        tellLater(playerId, "§e管理者を登録中です。少し待ってからもう一度操作してください。", "claim-busy");
        return;
    }
    pendingClaims.add(reference.key);
    system.run(() => {
        try {
            claimChest(reference, playerId);
        } finally {
            pendingClaims.delete(reference.key);
        }
    });
}

function queueOwnerPrepare(block, playerId) {
    const reference = blockReference(block);
    if (pendingRepairs.has(reference.key)) return;
    pendingRepairs.add(reference.key);
    system.run(() => {
        try {
            const player = livePlayer(playerId);
            const currentBlock = liveBlock(reference);
            if (!player || !currentBlock) return;
            const result = prepareOwnedChest(currentBlock, player, reference.key);
            if (!result.ok) {
                tell(player, `§c${repairReason(result.reason)}。中身を保護するため箱をロックしました。`);
                return;
            }

            if (result.changed) {
                player.playSound("random.orb");
                tell(player, "§a収納を修復しました。箱のふたをもう一度操作してください。");
            } else {
                tell(player, "§e箱のふたを操作するとチェスト画面が開きます。", "open-hint");
            }
        } catch (error) {
            console.error(`[meitetsu_chest] owner preparation failed for ${reference.key}: ${error}`);
            const player = livePlayer(playerId);
            if (player) tell(player, "§c収納の準備に失敗しました。中身は変更していません。");
        } finally {
            pendingRepairs.delete(reference.key);
        }
    });
}

function ownerMayOpen(block, anchor, player) {
    const key = chestKey(block);
    const owner = ownerState(key);
    if (!owner.valid || !mayAccess(key, player.id)) return false;
    const native = nativeState(key);
    if (!native.valid || !native.present || native.entityId !== anchor.id) return false;
    const anchors = anchorsAt(block);
    if (anchors.length !== 1 || anchors[0].id !== anchor.id) return false;
    if (!nativeContainer(anchor)) return false;
    return true;
}

function cancelBreak(event, message, cooldownKey) {
    event.cancel = true;
    console.info(`[meitetsu_chest] mining denied (${cooldownKey}) at ${chestKey(event.block)}`);
    tellLater(event.player.id, message, cooldownKey);
}

world.afterEvents.playerPlaceBlock.subscribe((event) => {
    const block = event.block;
    if (!block || block.typeId !== CHEST_ID) return;
    const key = chestKey(block);
    try {
        const existing = anchorsAt(block);
        const owner = ownerState(key);
        const native = nativeState(key);
        const legacy = readLegacySlots(key);
        const protectedState = existing.length > 0
            || native.present || !native.valid
            || !owner.valid || !!owner.ownerId
            || !legacy.ok || legacy.slots.some(Boolean);
        if (protectedState) {
            tell(event.player, "§eこの座標に保護された収納または管理者データを検出しました。上書きせず維持します。");
            return;
        }

        clearChestState(key);
        const anchor = spawnAnchor(block);
        const container = nativeContainer(anchor);
        if (!container || !containerIsEmpty(container)) throw new Error("new native inventory is unavailable");
        const marker = `v1:${anchor.id}`;
        setProperty(NATIVE_KEY + key, marker);
        if (property(NATIVE_KEY + key) !== marker) throw new Error("new native marker write failed");
        tell(event.player, "§b冥鉄の箱§fを設置しました。しゃがみながら操作した最初の一人が管理者になります。");
    } catch (error) {
        console.error(`[meitetsu_chest] placement setup failed for ${key}: ${error}`);
        tell(event.player, "§c収納の初期化に失敗しました。箱はロック状態です。");
    }
});

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const block = event.block;
    if (!block || block.typeId !== CHEST_ID) return;
    event.cancel = true;
    if (event.isFirstEvent === false) return;

    const key = chestKey(block);
    const owner = ownerState(key);
    if (!owner.valid) {
        tellLater(event.player.id, "§c管理者データが壊れているため、安全のためロックされています。", "owner-corrupt");
        return;
    }
    if (owner.ownerId) {
        handleLockedInteraction(block, event.player);
        return;
    }
    if (!event.player.isSneaking) {
        tellLater(event.player.id, "§e未登録の箱です。しゃがみながら操作すると管理者登録できます。", "claim-hint");
        return;
    }
    queueClaim(block, event.player.id);
});

world.beforeEvents.playerInteractWithEntity?.subscribe((event) => {
    const anchor = event.target;
    if (!anchor || anchor.typeId !== ANCHOR_ID) return;

    const block = blockForAnchor(anchor);
    if (!block || block.typeId !== CHEST_ID) {
        event.cancel = true;
        tellLater(event.player.id, "§c対応する冥鉄の箱がないため、この収納はロックされています。", "orphan");
        return;
    }

    const key = chestKey(block);
    const owner = ownerState(key);
    if (!owner.valid) {
        event.cancel = true;
        tellLater(event.player.id, "§c管理者データが壊れているため、安全のためロックされています。", "owner-corrupt");
        return;
    }
    if (owner.ownerId) {
        if (!(owner.ownerId === event.player.id && event.player.isSneaking)
            && ownerMayOpen(block, anchor, event.player)) {
            accessTickets.get(key)?.delete(event.player.id);
            console.info(`[meitetsu_chest] native container interaction allowed for ${event.player.id} at ${key}`);
            return;
        }
        event.cancel = true;
        handleLockedInteraction(block, event.player);
        return;
    }

    event.cancel = true;
    if (!event.player.isSneaking) {
        tellLater(event.player.id, "§e未登録の箱です。しゃがみながら操作すると管理者登録できます。", "claim-hint");
        return;
    }
    queueClaim(block, event.player.id);
});

world.afterEvents.entityLoad?.subscribe((event) => {
    const anchor = event.entity;
    if (!anchor || anchor.typeId !== ANCHOR_ID) return;
    system.run(() => alignStoredAnchor(anchor));
});

world.beforeEvents.playerBreakBlock.subscribe((event) => {
    const block = event.block;
    if (!block || block.typeId !== CHEST_ID) return;
    const key = chestKey(block);

    const owner = ownerState(key);
    if (!owner.valid) {
        cancelBreak(event, "§c管理者データが壊れているため、中身を保護して破壊を中止しました。", "break-corrupt");
        return;
    }
    if (!owner.ownerId) {
        cancelBreak(event, "§e回収するには、先にしゃがみながら箱を操作して管理者登録してください。", "break-unregistered");
        return;
    }
    if (owner.ownerId !== event.player.id) {
        cancelBreak(event, "§cこの冥鉄の箱を壊せるのは登録済みの管理者だけです。", "break-owner");
        return;
    }

    const native = nativeState(key);
    if (native.present) {
        const result = validatedNativeAnchor(block, key);
        if (!native.valid || !result.ok) {
            cancelBreak(event, "§c収納本体を確認できないため、中身を保護して破壊を中止しました。", "break-native");
            return;
        }
        console.info(`[meitetsu_chest] owner mining allowed at ${key}`);
        return;
    }

    if (!native.valid || anchorsAt(block).length > 0) {
        cancelBreak(event, "§c収納状態を確認できないため、先に箱を操作して修復してください。", "break-repair");
        return;
    }
    const legacy = readLegacySlots(key);
    if (!legacy.ok || legacy.slots.some(Boolean)) {
        cancelBreak(event, owner.ownerId
            ? "§e旧収納の中身を保護しています。先に箱を一度操作して移行してください。"
            : "§c所有者不明の旧収納を保護するため、破壊を中止しました。", "break-legacy");
    }
});

function drainNativeStorage(block, key, recoverBlock = false) {
    const result = validatedNativeAnchor(block, key);
    if (!result.ok) return false;
    const saved = [];
    const drops = [];
    const permutation = recoverBlock ? block.permutation : undefined;
    let blockChanged = false;
    let contentsChanged = false;
    try {
        for (let slot = 0; slot < result.container.size; slot++) {
            saved.push(result.container.getItem(slot));
        }
        const location = { x: block.x + 0.5, y: block.y + 0.5, z: block.z + 0.5 };
        for (const item of saved) {
            if (item) drops.push(block.dimension.spawnItem(item, location));
        }
        if (recoverBlock) drops.push(block.dimension.spawnItem(new ItemStack(CHEST_ID, 1), location));
        contentsChanged = true;
        clearContainer(result.container);
        if (!containerIsEmpty(result.container)) throw new Error("inventory clear failed");
        if (recoverBlock) {
            block.setType("minecraft:air");
            blockChanged = true;
        }
        result.anchor.remove();
    } catch (error) {
        // No awaits: rollback completes before another player can collect staged drops.
        try {
            for (const drop of drops) drop.remove();
            if (contentsChanged) {
                for (let slot = 0; slot < saved.length; slot++) result.container.setItem(slot, saved[slot]);
            }
            if (blockChanged) block.setPermutation(permutation);
        } catch (rollbackError) {
            console.error(`[meitetsu_chest] recovery rollback failed at ${key}: ${rollbackError}`);
        }
        console.error(`[meitetsu_chest] native drop failed for ${key}: ${error}`);
        return false;
    }
    clearChestState(key);
    return true;
}

world.afterEvents.playerBreakBlock.subscribe((event) => {
    if (event.brokenBlockPermutation?.type?.id !== CHEST_ID) return;
    const block = event.block;
    const key = chestKey(block);
    const native = nativeState(key);
    if (native.present && native.valid) {
        if (!drainNativeStorage(block, key)) {
            console.error(`[meitetsu_chest] protected data remains at ${key}; replace the block at the same position to recover it`);
        }
        return;
    }

    const legacy = readLegacySlots(key);
    if (legacy.ok && !legacy.slots.some(Boolean) && anchorsAt(block).length === 0) {
        clearChestState(key);
    } else {
        console.error(`[meitetsu_chest] retained unexpected protected state after break at ${key}`);
    }
});

system.run(() => {
    try {
        purgeObsoleteSecurity();
        alignLoadedAnchors();
    } catch (error) {
        console.warn(`[meitetsu_chest] obsolete password cleanup failed: ${error}`);
    }
});

console.log("[meitetsu_chest] password native container with owner recovery menu loaded");

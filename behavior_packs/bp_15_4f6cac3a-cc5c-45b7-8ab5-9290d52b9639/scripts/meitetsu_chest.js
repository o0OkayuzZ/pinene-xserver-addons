import { EnchantmentTypes, ItemStack, system, world } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

const CHEST_ID = "pinene:meitetsu_chest";
const OWNER_KEY = "pinene:meitetsu_owner:";
const PASSWORD_KEY = "pinene:meitetsu_password:";
const STORAGE_KEY = "pinene:meitetsu_storage:";
const LEGACY_OWNER_KEY = "pinene:mt_own:";
const LEGACY_PASSWORD_KEY = "pinene:mt_pass:";
const LEGACY_STORAGE_KEY = "pinene:mt_store:";
const SLOT_COUNT = 27;
const MAX_PASSWORD_LENGTH = 16;
const openForms = new Set();

function showForm(player, form, onResponse) {
    if (openForms.has(player.id)) return;
    openForms.add(player.id);
    form.show(player)
        .then((response) => {
            openForms.delete(player.id);
            onResponse(response);
        })
        .catch(() => openForms.delete(player.id));
}

function chestKey(block) {
    return `${block.dimension.id};${block.x};${block.y};${block.z}`;
}

function property(key) {
    return world.getDynamicProperty(key);
}

function setProperty(key, value) {
    world.setDynamicProperty(key, value);
}

function compatibleProperty(currentPrefix, legacyPrefix, key) {
    const currentValue = property(currentPrefix + key);
    return currentValue !== undefined ? currentValue : property(legacyPrefix + key);
}

function clearChestState(key) {
    for (const prefix of [
        OWNER_KEY,
        PASSWORD_KEY,
        STORAGE_KEY,
        LEGACY_OWNER_KEY,
        LEGACY_PASSWORD_KEY,
        LEGACY_STORAGE_KEY
    ]) {
        setProperty(prefix + key, undefined);
    }
}

function readSlots(key) {
    try {
        const stored = compatibleProperty(STORAGE_KEY, LEGACY_STORAGE_KEY, key);
        const saved = JSON.parse(stored || "[]");
        if (!Array.isArray(saved)) return Array(SLOT_COUNT).fill(null);
        return Array.from({ length: SLOT_COUNT }, (_, index) => {
            const item = saved[index];
            return item && typeof item.id === "string" && Number.isInteger(item.count) && item.count > 0
                ? { ...item, id: item.id, count: item.count }
                : null;
        });
    } catch {
        return Array(SLOT_COUNT).fill(null);
    }
}

function saveSlots(key, slots) {
    setProperty(STORAGE_KEY + key, JSON.stringify(slots));
}

function itemLabel(item) {
    if (item.name) return item.name;
    return item.id.replace(/^minecraft:/, "").replace(/_/g, " ");
}

function itemIconPath(typeId) {
    const path = typeId.split(":").pop();
    const aliases = {
        enchanted_golden_apple: "apple_golden",
        experience_bottle: "experience_bottle",
        firework_rocket: "fireworks",
        firework_star: "fireworks_charge",
        melon_slice: "melon",
        music_disc_5: "record_5",
        nether_brick: "netherbrick",
        repeater: "repeater",
        comparator: "comparator"
    };
    return `textures/items/${aliases[path] || path}`;
}

function serializeItem(item) {
    const saved = { id: item.typeId, count: item.amount, maxStackSize: item.maxAmount || 64 };
    if (item.nameTag) saved.name = item.nameTag;
    try {
        const lore = item.getLore();
        if (lore.length > 0) saved.lore = lore;
    } catch {
    }
    try {
        const durability = item.getComponent("minecraft:durability");
        if (durability?.damage > 0) saved.damage = durability.damage;
    } catch {
    }
    try {
        const enchantments = item.getComponent("minecraft:enchantable")?.getEnchantments() ?? [];
        if (enchantments.length > 0) {
            saved.enchantments = enchantments.map((enchantment) => ({
                id: enchantment.type.id,
                level: enchantment.level
            }));
        }
    } catch {
    }
    return saved;
}

function sameItem(first, second) {
    const normalize = (item) => JSON.stringify({
        id: item.id,
        name: item.name,
        lore: item.lore,
        damage: item.damage,
        enchantments: item.enchantments
    });
    return normalize(first) === normalize(second);
}

function storeItem(slots, item, requestedAmount) {
    let remaining = requestedAmount;
    const maxStackSize = Math.max(1, item.maxStackSize || 64);

    for (const stored of slots) {
        if (!stored || !sameItem(stored, item) || stored.count >= maxStackSize) continue;
        const moved = Math.min(remaining, maxStackSize - stored.count);
        stored.count += moved;
        remaining -= moved;
        if (remaining === 0) return requestedAmount;
    }

    for (let index = 0; index < slots.length && remaining > 0; index++) {
        if (slots[index]) continue;
        const moved = Math.min(remaining, maxStackSize);
        slots[index] = { ...item, count: moved };
        remaining -= moved;
    }
    return requestedAmount - remaining;
}

function createItem(item, amount) {
    const stack = new ItemStack(item.id, amount);
    try { if (item.name) stack.nameTag = item.name; } catch { }
    if (Array.isArray(item.lore)) {
        try { stack.setLore(item.lore); } catch { }
    }
    if (Number.isFinite(item.damage)) {
        try { stack.getComponent("minecraft:durability").damage = item.damage; } catch { }
    }
    if (Array.isArray(item.enchantments)) {
        try {
            const enchantable = stack.getComponent("minecraft:enchantable");
            for (const enchantment of item.enchantments) {
                const type = EnchantmentTypes.get(enchantment.id);
                if (type) enchantable.addEnchantment({ type, level: enchantment.level });
            }
        } catch {
        }
    }
    return stack;
}

function stackBatchSize(item, requestedAmount) {
    const numericAmount = Number(requestedAmount);
    const requested = Number.isFinite(numericAmount) ? Math.max(1, Math.floor(numericAmount)) : 1;
    const probe = createItem(item, 1);
    return Math.max(1, Math.min(requested, probe.maxAmount, 255));
}

function runForPlayer(playerId, callback) {
    system.run(() => {
        const player = world.getAllPlayers().find((candidate) => candidate.id === playerId);
        if (player) callback(player);
    });
}

world.afterEvents.playerPlaceBlock.subscribe((event) => {
    const block = event.block;
    if (!block || block.typeId !== CHEST_ID) return;

    const key = chestKey(block);
    clearChestState(key);
    setProperty(OWNER_KEY + key, event.player.id);
    saveSlots(key, Array(SLOT_COUNT).fill(null));
    event.player.sendMessage("§b冥鉄の箱§fを設置しました。しゃがみながら使うとパスワードを設定できます。");
});

world.beforeEvents.playerBreakBlock.subscribe((event) => {
    const block = event.block;
    if (!block || block.typeId !== CHEST_ID) return;

    const key = chestKey(block);
    const ownerId = compatibleProperty(OWNER_KEY, LEGACY_OWNER_KEY, key);
    if (!ownerId || event.player.id === ownerId) return;
    event.cancel = true;
    event.player.sendMessage("§cこの冥鉄の箱は設置者しか壊せません。");
});

world.afterEvents.playerBreakBlock.subscribe((event) => {
    const block = event.block;
    if (!block || event.brokenBlockPermutation?.type?.id !== CHEST_ID) return;

    const key = chestKey(block);
    for (const item of readSlots(key)) {
        if (!item) continue;
        try {
            let remaining = item.count;
            while (remaining > 0) {
                const amount = stackBatchSize(item, remaining);
                block.dimension.spawnItem(createItem(item, amount), {
                    x: block.x + 0.5,
                    y: block.y + 0.5,
                    z: block.z + 0.5
                });
                remaining -= amount;
            }
        } catch {
        }
    }
    clearChestState(key);
});

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const block = event.block;
    if (!block || block.typeId !== CHEST_ID) return;
    if (event.isFirstEvent === false) return;

    event.cancel = true;
    const key = chestKey(block);
    const playerId = event.player.id;
    const ownerKey = OWNER_KEY + key;
    let ownerId = compatibleProperty(OWNER_KEY, LEGACY_OWNER_KEY, key);
    if (!ownerId) {
        ownerId = playerId;
        setProperty(ownerKey, ownerId);
    } else if (property(ownerKey) === undefined) {
        setProperty(ownerKey, ownerId);
    }
    const isOwner = ownerId === playerId;

    runForPlayer(playerId, (player) => {
        if (isOwner) {
            if (player.isSneaking) showPasswordSettings(player, key);
            else showChest(player, key, true);
            return;
        }

        const password = compatibleProperty(PASSWORD_KEY, LEGACY_PASSWORD_KEY, key);
        if (typeof password !== "string" || password.length === 0) {
            player.sendMessage("§cこの冥鉄の箱は設置者のみ開けます。");
            return;
        }
        promptPassword(player, key);
    });
});

function showChest(player, key, isOwner) {
    const slots = readSlots(key);
    const usedSlots = slots.filter(Boolean).length;
    const lockStatus = compatibleProperty(PASSWORD_KEY, LEGACY_PASSWORD_KEY, key) ? "§6施錠中" : "§7未設定";
    const form = new ActionFormData()
        .title("§l冥鉄の箱")
        .body(`§7保管スロット  §f${usedSlots} / ${SLOT_COUNT}\n§7セキュリティ  ${lockStatus}`)
        .button(`§l中身を見る\n§r§8${usedSlots}個のスロットを使用中`)
        .button("§l所持品から預ける\n§r§8インベントリ内のアイテムを選択");
    if (isOwner) form.button("§lロック設定\n§r§8パスワードを変更・解除");

    showForm(player, form, (response) => {
        if (response.canceled) return;
        if (response.selection === 0) showContents(player, key, isOwner);
        else if (response.selection === 1) showDepositInventory(player, key);
        else if (isOwner && response.selection === 2) showPasswordSettings(player, key);
    });
}

function showDepositInventory(player, key) {
    const inventory = player.getComponent("minecraft:inventory")?.container;
    if (!inventory) return;

    const inventoryItems = [];
    for (let slot = 0; slot < inventory.size; slot++) {
        const item = inventory.getItem(slot);
        if (item) inventoryItems.push({ slot, item });
    }
    if (inventoryItems.length === 0) {
        player.sendMessage("§7預けられるアイテムがありません。");
        return;
    }

    const form = new ActionFormData()
        .title("§l冥鉄の箱 §r§8- 預ける")
        .body("§7インベントリから預けるアイテムを選択してください。")
        .button("§lすべて預ける\n§r§8入る分だけ一括収納", "textures/ui/arrow_dark_right_stretch");
    for (const { slot, item } of inventoryItems) {
        form.button(
            `§f${item.nameTag || item.typeId.replace(/^minecraft:/, "").replace(/_/g, " ")}\n§8所持枠 ${slot + 1}  §7x${item.amount}`,
            itemIconPath(item.typeId)
        );
    }

    showForm(player, form, (response) => {
        if (response.canceled) return;
        if (response.selection === 0) {
            depositAllInventory(player, key);
            return;
        }
        const selected = inventoryItems[response.selection - 1];
        if (!selected) return;
        chooseDepositAmount(player, key, selected.slot);
    });
}

function depositAllInventory(player, key) {
    const inventory = player.getComponent("minecraft:inventory")?.container;
    if (!inventory) return;

    const slots = readSlots(key);
    let movedTotal = 0;
    const pendingInventoryUpdates = [];
    for (let inventorySlot = 0; inventorySlot < inventory.size; inventorySlot++) {
        const inventoryItem = inventory.getItem(inventorySlot);
        if (!inventoryItem) continue;

        const moved = storeItem(slots, serializeItem(inventoryItem), inventoryItem.amount);
        if (moved === 0) continue;
        movedTotal += moved;
        pendingInventoryUpdates.push({
            slot: inventorySlot,
            remainingAmount: inventoryItem.amount - moved
        });
    }

    if (movedTotal === 0) {
        player.sendMessage("§c箱に収納できる空きがありません。");
        return;
    }
    saveSlots(key, slots);
    for (const update of pendingInventoryUpdates) {
        const inventoryItem = inventory.getItem(update.slot);
        if (!inventoryItem) continue;
        if (update.remainingAmount <= 0) {
            inventory.setItem(update.slot, undefined);
        } else {
            inventoryItem.amount = update.remainingAmount;
            inventory.setItem(update.slot, inventoryItem);
        }
    }
    player.playSound("random.orb");
    player.sendMessage(`§a所持品から合計${movedTotal}個を預けました。`);
}

function chooseDepositAmount(player, key, inventorySlot) {
    const inventory = player.getComponent("minecraft:inventory")?.container;
    const item = inventory?.getItem(inventorySlot);
    if (!item) return;
    if (item.amount === 1) {
        depositInventorySlot(player, key, inventorySlot, 1);
        return;
    }

    const form = new ModalFormData()
        .title("預ける個数")
        .slider("個数", 1, item.amount, 1, item.amount);
    showForm(player, form, (response) => {
        if (response.canceled) return;
        depositInventorySlot(player, key, inventorySlot, Number(response.formValues[0]));
    });
}

function depositInventorySlot(player, key, inventorySlot, requestedAmount) {
    const inventory = player.getComponent("minecraft:inventory")?.container;
    const inventoryItem = inventory?.getItem(inventorySlot);
    if (!inventory || !inventoryItem) return;

    const slots = readSlots(key);
    const numericAmount = Number(requestedAmount);
    if (!Number.isFinite(numericAmount)) return;
    const amount = Math.max(1, Math.min(Math.floor(numericAmount), inventoryItem.amount));
    const storedItem = serializeItem(inventoryItem);
    const moved = storeItem(slots, storedItem, amount);
    if (moved === 0) {
        player.sendMessage("§c箱は満杯です。");
        return;
    }

    saveSlots(key, slots);
    if (moved >= inventoryItem.amount) {
        inventory.setItem(inventorySlot, undefined);
    } else {
        inventoryItem.amount -= moved;
        inventory.setItem(inventorySlot, inventoryItem);
    }
    player.playSound("random.orb");
    player.sendMessage(`§a${moved}個を冥鉄の箱へ預けました。`);
}

function showContents(player, key, isOwner) {
    const slots = readSlots(key);
    const populatedSlots = slots
        .map((item, index) => item ? { item, index } : null)
        .filter(Boolean);
    if (populatedSlots.length === 0) {
        player.sendMessage("§7冥鉄の箱は空です。");
        return;
    }

    const form = new ActionFormData()
        .title("§l冥鉄の箱 §r§8- 中身")
        .body("§7取り出すアイテムを選択してください。");
    for (const { item, index } of populatedSlots) {
        form.button(
            `§f${itemLabel(item)}\n§8スロット ${index + 1}  §7x${item.count}`,
            itemIconPath(item.id)
        );
    }
    form.button("§8戻る");
    showForm(player, form, (response) => {
            if (response.canceled) return;
            if (response.selection === populatedSlots.length) {
                showChest(player, key, isOwner);
                return;
            }
            const selected = populatedSlots[response.selection];
            if (selected) withdrawSlot(player, key, selected.index);
        });
}

function withdrawSlot(player, key, slotIndex) {
    const slots = readSlots(key);
    const stored = slots[slotIndex];
    const inventory = player.getComponent("minecraft:inventory")?.container;
    if (!stored || !inventory) return;

    try {
        let remainingCount = stored.count;
        let movedTotal = 0;
        while (remainingCount > 0) {
            const amount = stackBatchSize(stored, remainingCount);
            const remainder = inventory.addItem(createItem(stored, amount));
            const moved = remainder ? amount - remainder.amount : amount;
            if (moved < 1) break;
            movedTotal += moved;
            remainingCount -= moved;
            if (moved < amount) break;
        }
        if (movedTotal < 1) {
            player.sendMessage("§cインベントリに空きがありません。");
            return;
        }
        stored.count -= movedTotal;
        if (stored.count <= 0) slots[slotIndex] = null;
        saveSlots(key, slots);
        player.playSound("random.pop");
        player.sendMessage(`§a${movedTotal}個を取り出しました。`);
    } catch (error) {
        console.error(`[meitetsu_chest] withdrawal failed for ${stored.id}: ${error}`);
        player.sendMessage("§cこのアイテムは取り出せません。ログに原因を記録しました。");
    }
}

function showPasswordSettings(player, key) {
    const form = new ModalFormData()
        .title("冥鉄の箱: パスワード")
        .textField("空欄でパスワードを解除", "1-16文字");
    showForm(player, form, (response) => {
            if (response.canceled) return;
            const password = String(response.formValues[0] ?? "").trim();
            if (password.length > MAX_PASSWORD_LENGTH) {
                player.sendMessage("§cパスワードは16文字以内にしてください。");
                return;
            }
            setProperty(PASSWORD_KEY + key, password || undefined);
            player.sendMessage(password ? "§aパスワードを設定しました。" : "§aパスワードを解除しました。");
            player.playSound("random.levelup");
        });
}

function promptPassword(player, key) {
    const form = new ModalFormData()
        .title("冥鉄の箱: ロック中")
        .textField("パスワード", "入力");
    showForm(player, form, (response) => {
            if (response.canceled) return;
            if (String(response.formValues[0] ?? "").trim() !== compatibleProperty(PASSWORD_KEY, LEGACY_PASSWORD_KEY, key)) {
                player.sendMessage("§cパスワードが違います。");
                return;
            }
            player.playSound("random.levelup");
            showChest(player, key, false);
        });
}

console.log("[meitetsu_chest] block form container loaded");

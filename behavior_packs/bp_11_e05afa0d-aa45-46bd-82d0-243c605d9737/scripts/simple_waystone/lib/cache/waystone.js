import { globalCachePlayerWaystones, globalCacheWaystones, globalCacheWaystonesPublic } from "./global";
import { exitDirection } from "../../ui/infoUI";
export const waystoneCache = new class WaystoneCache {
    getPlayerCache(playerId) {
        const cache = globalCachePlayerWaystones.get(playerId);
        if (cache)
            return cache;
        const empty = { private: new Set(), public: new Set(), claim: new Set(), favorite: { private: new Set(), public: new Set() } };
        globalCachePlayerWaystones.set(playerId, empty);
        return empty;
    }
    create(info) {
        const id = info.dimension.replace("minecraft:", "") + `/${info.pos.x},${info.pos.y},${info.pos.z}`;
        this.getPlayerCache(info.owner)[info.access == 0 ? "private" : "public"].add(id);
        globalCacheWaystones.set(id, info);
        if (info.access == 1)
            globalCacheWaystonesPublic.add(id);
    }
    remove(id) {
        const info = globalCacheWaystones.get(id);
        if (!info)
            return;
        info.claim.forEach(playerId => this.getPlayerCache(playerId).claim.delete(id));
        info.favorite.forEach(playerId => this.getPlayerCache(playerId).favorite[info.access == 0 ? "private" : "public"].delete(id));
        this.getPlayerCache(info.owner)[info.access == 0 ? "private" : "public"].delete(id);
        globalCacheWaystones.delete(id);
    }
    claim(playerId, id) {
        this.getPlayerCache(playerId).claim.add(id);
        globalCacheWaystones.get(id)?.claim.add(playerId);
    }
    updateColor(color, id) {
        const cache = globalCacheWaystones.get(id);
        if (cache)
            cache.color = color;
    }
    updateDiscount(discount, id) {
        const cache = globalCacheWaystones.get(id);
        if (cache)
            cache.xpDiscount = discount / 100;
    }
    updateExitOffset(dirIndex, id) {
        const dir = exitDirection[dirIndex];
        if (!dir)
            return;
        const cache = globalCacheWaystones.get(id);
        if (cache)
            cache.offset = dir;
    }
    updateFavorite(playerId, id, access, value) {
        if (value) {
            globalCacheWaystones.get(id)?.favorite.add(playerId);
            this.getPlayerCache(playerId).favorite[access].add(id);
        }
        else {
            globalCacheWaystones.get(id)?.favorite.delete(playerId);
            this.getPlayerCache(playerId).favorite[access].delete(id);
        }
    }
    getWaystone(id) { return globalCacheWaystones.get(id); }
    getPlayerWaystoneIds(playerId) {
        return this.getPlayerCache(playerId);
    }
    getPublicWaystones() {
        const waystones = [];
        for (const id of globalCacheWaystonesPublic) {
            const value = globalCacheWaystones.get(id);
            if (value)
                waystones.push(value);
        }
        return waystones;
    }
};

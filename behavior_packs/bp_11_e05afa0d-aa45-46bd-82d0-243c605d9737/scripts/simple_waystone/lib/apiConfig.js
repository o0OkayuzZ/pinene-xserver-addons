const configCache = new Map();
export const apiConfig = new class apiConfig {
    constructor() {
        this.defaultConfig = {
            organize: false,
            organizeDimension: 0,
            showDimension: 0
        };
    }
    getConfig(player) {
        const cache = configCache.get(player.id);
        if (cache)
            return cache;
        const dynamic = player.getDynamicProperty("config");
        if (!dynamic || typeof dynamic != "string")
            return this.defaultConfig;
        const config = JSON.parse(dynamic);
        if (!this.isConfig(config)) {
            player.setDynamicProperty(`config`, JSON.stringify(this.defaultConfig));
            return this.defaultConfig;
        }
        return config;
    }
    setConfig(player, config) {
        player.setDynamicProperty("config", JSON.stringify(config));
        configCache.set(player.id, config);
    }
    isConfig(obj) {
        return obj &&
            typeof obj === "object" &&
            typeof obj.organize === "boolean" &&
            typeof obj.organizeDimension === "number" &&
            typeof obj.showDimension === "number";
    }
};

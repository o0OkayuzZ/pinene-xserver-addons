export const apiCooldown = new class ApiCooldown {
    timeUp(player, id) {
        const date = Math.floor(new Date().getTime() / 1000);
        const cooldownEnd = player.getDynamicProperty(id) ?? new Date().getTime() / 1000 - 1;
        return {
            end: date >= cooldownEnd,
            time: cooldownEnd - date
        };
    }
    set(player, id, time) {
        player.setDynamicProperty(id, Math.floor(new Date().getTime() / 1000) + time - 1);
    }
};

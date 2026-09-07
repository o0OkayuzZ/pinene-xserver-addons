import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { apiScoreboard } from "../lib/math/scoreboard";
import { waystoneCache } from "../lib/cache/waystone";
import { waystonesList } from "../lib/waystone/list";
import { colorDimension } from "./listUI";
import { apiWarn } from "../lib/player/warn";
export function waystoneUIFavorite(player) {
    new ActionFormData()
        .title("ui.simple_waystone:favorite.title")
        .body("ui.simple_waystone:favorite.body")
        .button({ translate: "ui.simple_waystone:waystone.list.title.0", with: [""] })
        .button({ translate: "ui.simple_waystone:waystone.list.title.1", with: [""] })
        .show(player).then(({ canceled, selection }) => {
        if (canceled || selection == undefined || selection > 1)
            return;
        waystoneUIList(player, selection == 1);
    });
}
function waystoneUIList(player, publicList = false) {
    const access = publicList ? 1 : 0;
    const accessType = publicList ? "public" : "private";
    const waystones = publicList ? waystonesList.getPublicWaystones(player) : waystonesList.getPrivateWaystones(player);
    const buttons = waystones.map(value => {
        return {
            name: value.name,
            pos: value.pos,
            dimension: value.dimension,
            isFavorite: value.favorite.has(player.id)
        };
    });
    const form = new ModalFormData()
        .title({ translate: "ui.simple_waystone:waystone.list.title." + access, with: [""] })
        .label("ui.simple_waystone:favorite.list.body");
    buttons.forEach(waystone => form.toggle(`${colorDimension[waystone.dimension]}${waystone.name}§r`, { defaultValue: waystone.isFavorite }));
    form.submitButton("ui.simple_waystone:waystone.create.button")
        .show(player).then(({ canceled, formValues }) => {
        if (canceled || formValues == undefined)
            return apiWarn.notify(player, "warning.simple_waystone:waystone.cancel_settings", { type: "actionbar", sound: "simple_waystone.warn.break" });
        formValues.forEach((value, index) => {
            if (index == 0)
                return;
            const selected = buttons[index - 1];
            if (typeof value == "boolean" && selected && selected.isFavorite != value) {
                const id = `${selected.dimension.replace("minecraft:", "")}/${selected.pos.x},${selected.pos.y},${selected.pos.z}`;
                if (value) {
                    apiScoreboard.addScore(`simple_waystone/w/${id}`, `3/${player.id}`);
                    apiScoreboard.addScore(`simple_waystone/p/${player.id}`, `3/${access}/${id}`);
                }
                else {
                    apiScoreboard.removeParticipant(`simple_waystone/w/${id}`, `3/${player.id}`);
                    apiScoreboard.removeParticipant(`simple_waystone/p/${player.id}`, `3/${access}/${id}`);
                }
                waystoneCache.updateFavorite(player.id, id, accessType, value);
            }
        });
        apiWarn.notify(player, "warning.simple_waystone:waystone.save_settings", { type: "actionbar", sound: "simple_waystone.warn.levelup" });
    });
}

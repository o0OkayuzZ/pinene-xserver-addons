import { world, system } from "@minecraft/server";
import {hunts} from "./main.js"


system.runInterval(() => {
    if (!hunts) return;
    if (Math.random() < 0.66) return;
    for (const player of world.getDimension("dungeons:ancientdim_woodland_prison").getPlayers()) {
        player.playSound("ambient.weather.thunder", { volume: 0.1, pitch: 0.6 + Math.random() * 0.6 })
    }

}, 100)


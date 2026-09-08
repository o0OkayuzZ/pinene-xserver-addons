import { system } from "@minecraft/server";
import { IDS } from "./config.js";

system.beforeEvents.startup.subscribe(({ dimensionRegistry }) => {
  dimensionRegistry.registerCustomDimension(IDS.dimension);
});

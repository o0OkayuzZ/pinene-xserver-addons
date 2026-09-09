import { useExtension } from "../golden_extensions/runtime.js";
import { system } from "@minecraft/server";
import { consumeFood } from "./core.js";
import { showGuide } from "./guide.js";

// Keep errors in the content log. Eating never writes to chat/actionbar/title.
let loggedErrors = 0;
function reportError(error) {
  if (loggedErrors++ < 5) console.warn("[GoldenFoods] " + String(error));
}
system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {
  itemComponentRegistry.registerCustomComponent("pinene:golden_extension_use", { onUse: useExtension });
  itemComponentRegistry.registerCustomComponent("pinene:golden_food_consume", {
    onConsume(event) { consumeFood(event, undefined, reportError); }
  });
  itemComponentRegistry.registerCustomComponent("pinene:golden_food_guide", {
    onUse(event) {
      system.run(() => { void showGuide(event.source, reportError); });
    }
  });
});


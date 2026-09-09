import { EXTENSION_GUIDE } from "../golden_extensions/guide_data.js";
import { ActionFormData } from "@minecraft/server-ui";
import { FOODS } from "./data.js";
import { SCIENCE } from "./science_ja.js";
import { effectLines } from "./core.js";

const opened = new Set();
export async function showGuide(player, reportError = () => {}) {
  if (opened.has(player.id)) return;
  opened.add(player.id);
  try {
    const entries = Object.entries({ ...FOODS, ...EXTENSION_GUIDE }).filter(([id]) => id !== "a:astew");
    while (player.isValid) {
      const list = new ActionFormData().title("金食料図鑑")
        .body("調べたい食料を選んでください。\n金の小麦はクラフト素材です。");
      for (const [, food] of entries) list.button(food.name, food.icon);
      const result = await list.show(player);
      if (result.canceled || result.selection === undefined) break;
      const entry = entries[result.selection];
      if (!entry) break;
      const [, food] = entry;
      if (food.extensionBody) {
        const detail = await new ActionFormData().title(food.name).body(food.extensionBody).button("一覧へ戻る").show(player);
        if (detail.canceled) break;
        continue;
      }
      const science = SCIENCE.families[food.family];
      const title = food.tier === "enchanted" ? science.title_enchanted : science.title_gold;
      const lines = effectLines(food);
      const effects = food.food
        ? ["満腹度回復：" + food.food.nutrition, ...lines].join("\n") +
          (lines.length ? "" : "\n追加効果なし")
        : "クラフト用素材（食べられません）";
      const body = [title, "", science.body, "", ...(science.design ? ["能力の考察：", science.design, ""] : []), "ゲーム効果：", effects, ...(food.container_note ? [food.container_note] : []), "",
        science.caveat, "", SCIENCE.disclaimer].join("\n");
      const detail = await new ActionFormData().title(food.name).body(body).button("一覧へ戻る").show(player);
      if (detail.canceled) break;
    }
  } catch (error) { reportError(error); }
  finally { opened.delete(player.id); }
}


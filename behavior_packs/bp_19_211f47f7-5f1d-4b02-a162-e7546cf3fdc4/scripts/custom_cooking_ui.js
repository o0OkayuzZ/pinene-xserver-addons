/**
 * Persistent cooking UI. Stable @minecraft/server-ui 2.2.0 only.
 * The complete component tree is built before show(); callbacks update data,
 * never close/re-show the form. Host callbacks own all world/inventory access.
 */
export function createPersistentCookingUi({ ui, system, recipes, inspect, craft, log = () => {} }) {
  const sessions = new Map();
  const ranks = ["素材", "I", "II", "III", "IV", "V", "VI", "VII"];
  let sequence = 0;
  const readonly = { clientWritable: false };
  const writable = { clientWritable: true };
  const available = () => ["CustomForm", "ObservableString", "ObservableNumber", "ObservableBoolean"]
    .every((name) => typeof ui[name] === "function");
  function set(observable, value) {
    if (observable.getData() !== value) observable.setData(value);
  }
  function emit(session, event, extra = {}) {
    log({ event, session: session.id, opens: session.opens, updates: session.updates,
      selections: session.selections, crafts: session.crafts, ...extra });
  }
  function cleanup(session, reason) {
    if (session.closed) return;
    session.closed = true;
    if (session.timer !== undefined) system.clearRun(session.timer);
    for (const [observable, callback] of session.listeners) observable.unsubscribe(callback);
    session.listeners.length = 0;
    if (sessions.get(session.player.id) === session) sessions.delete(session.player.id);
    emit(session, "closed", { reason: String(reason ?? "closed") });
  }
  function stop(session, reason) {
    if (session.closed) return;
    try { if (session.form?.isShowing()) session.form.close(); }
    catch (error) { emit(session, "close_error", { error: String(error) }); }
    finally { cleanup(session, reason); }
  }
  function close(playerId, reason = "host_closed") {
    const session = sessions.get(playerId);
    if (session) stop(session, reason);
  }
  async function open(player, origin) {
    if (sessions.has(player.id)) return { opened: false, reason: "already_open" };
    if (!available()) return { opened: false, reason: "unsupported_api" };
    const session = { id: ++sequence, player, origin, form: undefined, timer: undefined,
      listeners: [], closed: false, queued: false, opens: 0, updates: 0, selections: 0, crafts: 0 };
    sessions.set(player.id, session);
    try {
    const byRank = ranks.map((_, rank) => recipes.filter((r) => r.rank === rank));
    let rank = 0;
    let mute = false;
    let notice = "";
    let failed = false;
    const picks = byRank.map(() => 0);
    const string = (value = "") => new ui.ObservableString(value, readonly);
    const boolean = (value) => new ui.ObservableBoolean(value, readonly);
    const title = string("まな板 · 料理");
    const selectedName = string();
    const ingredients = string();
    const status = string();
    const knifeStatus = string();
    const buttonText = string("クラフト");
    const disabled = boolean(true);
    const imageSource = string("textures/items/cheese.png");
    const imageVisible = boolean(false);
    const rankValue = new ui.ObservableNumber(0, writable);
    const choiceValues = byRank.map(() => new ui.ObservableNumber(0, writable));
    const choiceVisible = byRank.map((_, index) => boolean(index === 0));
    const selected = () => byRank[rank][picks[rank]];
    function bind(observable, callback) {
      session.listeners.push([observable, observable.subscribe(callback)]);
    }
    function restoreSelectors() {
      mute = true;
      try {
        set(rankValue, rank);
        choiceValues.forEach((value, index) => set(value, picks[index]));
      } finally { mute = false; }
    }
    function refresh() {
      if (session.closed) return false;
      const recipe = selected();
      const state = inspect(player, origin, recipe);
      if (!state.valid) {
        stop(session, state.reason || "invalid_context");
        return false;
      }
      choiceVisible.forEach((value, index) => set(value, index === rank));
      set(selectedName, recipe ? `${recipe.name} ×${recipe.resultCount}` : "このRankにはレシピがありません");
      set(ingredients, (state.ingredients ?? []).join("\n").slice(0, 4500));
      const mayCraft = !!recipe && state.canCraft && !session.queued && !failed;
      set(disabled, !mayCraft);
      set(buttonText, mayCraft ? `クラフト（${recipe.resultCount}個）` : "クラフトできません");
      // Only use explicitly registered, existing resource-pack images.
      const image = state.image;
      if (image) set(imageSource, image.path);
      set(imageVisible, !!image);
      const owned = recipe ? `完成品の所持数：${state.resultOwned ?? 0}` : "";
      set(status, [notice || state.reason || "", owned].filter(Boolean).join("\n").slice(0, 4500));
      set(knifeStatus, state.knifeText ?? "");
      session.updates++;
      return true;
    }
    function queue(action) {
      if (session.closed || session.queued) return;
      session.queued = true;
      set(disabled, true);
      system.run(() => {
        if (session.closed) return;
        try {
          if (!session.form.isShowing()) return;
          action();
        } catch (error) {
          // Disable crafting after an unexpected error; never auto-repeat it.
          failed = true;
          notice = "処理を停止しました。画面を閉じてログを確認してください。";
          emit(session, "action_error", { error: String(error) });
        } finally {
          session.queued = false;
          if (!session.closed) {
            try { refresh(); }
            catch (error) { emit(session, "refresh_error", { error: String(error) }); stop(session, "refresh_error"); }
          }
        }
      });
    }
      const form = new ui.CustomForm(player, title);
      session.form = form;
      form.dropdown("Rank", rankValue, ranks.map((label, value) => ({ label, value })));
      byRank.forEach((group, index) => {
        const items = group.length ? group.map((r, value) => ({ label: r.name, value })) : [{ label: "未登録", value: 0 }];
        form.dropdown("レシピ", choiceValues[index], items, { visible: choiceVisible[index], disabled: !group.length });
      });
      form.header(selectedName);
      // The pack UUID is explicit: no guessed icon paths or native inventory emulation.
      if (typeof form.image === "function") {
        form.image(imageSource, "c81a6798-b6b1-4716-a514-c49967ad0ee2", { width: 0.13, visible: imageVisible });
      }
      form.label(ingredients);
      form.button(buttonText, () => {
        const recipeAtClick = selected();
        if (!recipeAtClick || disabled.getData() || failed) return;
        queue(() => {
          if (selected()?.id !== recipeAtClick.id) return;
          const state = inspect(player, origin, recipeAtClick);
          if (!state.valid) { stop(session, state.reason); return; }
          if (!state.canCraft) { notice = state.reason || "材料が不足しています。"; return; }
          // Synchronous host callback revalidates current materials and knife.
          const result = craft(player, origin, recipeAtClick);
          if (result.ok) {
            session.crafts++;
            notice = `${recipeAtClick.name}を${recipeAtClick.resultCount}個作りました。`;
            emit(session, "crafted", { recipe: recipeAtClick.id });
          } else notice = result.reason || "作成できませんでした。";
        });
      }, { disabled });
      form.label(status);
      form.label(knifeStatus);
      form.closeButton();
      bind(rankValue, (value) => {
        if (mute || session.closed) return;
        if (!Number.isInteger(value) || value < 0 || value >= ranks.length || session.queued) { restoreSelectors(); return; }
        rank = value;
        session.selections++;
        notice = "";
        queue(() => {});
      });
      choiceValues.forEach((value, index) => bind(value, (pick) => {
        if (mute || session.closed) return;
        if (index !== rank || !Number.isInteger(pick) || pick < 0 || pick >= byRank[index].length || session.queued) {
          restoreSelectors(); return;
        }
        picks[index] = pick;
        session.selections++;
        notice = "";
        queue(() => {});
      }));
      if (!refresh()) return { opened: false, reason: "invalid_context" };
      session.opens++;
      refresh();
      emit(session, "show_requested");
      // SINGLE show call. Never call show from callbacks or poll refresh.
      const completion = form.show();
      session.timer = system.runInterval(() => {
        if (session.closed) return;
        try { if (form.isShowing()) refresh(); }
        catch (error) { emit(session, "poll_error", { error: String(error) }); stop(session, "poll_error"); }
      }, 10);
      const reason = await completion;
      cleanup(session, reason);
      return { opened: true, reason };
    } catch (error) {
      emit(session, "open_error", { error: String(error) });
      stop(session, "open_error");
      return { opened: false, reason: "open_error" };
    }
  }
  return { open, close, available, activeCount: () => sessions.size };
}

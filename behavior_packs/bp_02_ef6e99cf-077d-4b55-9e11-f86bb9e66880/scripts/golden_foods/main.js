import { useExtension } from "../golden_extensions/runtime.js";
import { system, world } from "@minecraft/server";
import { activateFoodCounters, counterState, incomingEffectDecision, COUNTER_KEY } from './counterEffects.js';
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
    onConsume(event) {
      if (consumeFood(event, undefined, reportError)) {
        try { activateFoodCounters(event.source, event.itemStack.typeId, world.getAbsoluteTime()); }
        catch (error) { reportError(error); }
      }
    }
  });
  itemComponentRegistry.registerCustomComponent("pinene:golden_food_guide", {
    onUse(event) {
      system.run(() => { void showGuide(event.source, reportError); });
    }
  });
});

// Incoming-event adapter: no player scan and no recursive remove/re-add loop.
const reservedProc=new Map();
world.beforeEvents.effectAdd.subscribe(event=>{
  if(event.entity.typeId!=='minecraft:player')return;
  try {
    const player=event.entity,now=world.getAbsoluteTime(),state=counterState(player);
    state.nextPoisonProc=Math.max(state.nextPoisonProc??0,reservedProc.get(player.id)??0);
    const decision=incomingEffectDecision(state,event.effectType.replace('minecraft:',''),event.duration,now);
    if(decision.cancel)event.cancel=true;else event.duration=decision.duration;
    if(decision.convert){
      const f=decision.convert,until=now+f.cooldown_s*20;reservedProc.set(player.id,until);
      system.run(()=>{try{const current=counterState(player);current.nextPoisonProc=until;player.setDynamicProperty(COUNTER_KEY,JSON.stringify(current));
        const existing=player.getEffect(f.proc_effect.effect),duration=f.proc_effect.duration_s*20,amplifier=f.proc_effect.amplifier_zero_based;
        if(!existing||(existing.amplifier<=amplifier&&existing.duration<duration))player.addEffect(f.proc_effect.effect,duration,{amplifier});
      }catch(error){reportError(error);}});
    }
  }catch(error){reportError(error);}
});
world.afterEvents.playerLeave.subscribe(e=>reservedProc.delete(e.playerId));


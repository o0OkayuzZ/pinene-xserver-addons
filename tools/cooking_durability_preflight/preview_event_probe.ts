/**
 * READ-ONLY probe for server 2.12.0-beta.1.26.60-preview.29 declarations.
 * NOT loaded into the current 1.26.52 test world. No installation side effects.
 * It records raw events to discover batch granularity and return-item behavior.
 * It intentionally never infers finalized operation counts or charges durability.
 */
import {world, system, type PlayerCraftRecipeAfterEvent} from '@minecraft/server';
const LIMIT=128;
type Observation={tick:number;playerId:string;boardType:string;dimension:string;
  location:{x:number;y:number;z:number};output?:{typeId:string;amount:number}};
export function startCraftEventProbe() {
  const records:Observation[]=[];
  let stopped=false,overflow=false;
  const signal=world.afterEvents.playerCraftRecipe;
  if(!signal || typeof signal.subscribe !== 'function')
    return {supported:false,stop(){},snapshot:():Observation[]=>[]};
  const callback=(event:PlayerCraftRecipeAfterEvent)=>{
    if(stopped) return;
    try {
      const b=event.block;
      if(!b || !b.typeId.startsWith('pinene_cooking:') || !b.typeId.endsWith('_cutting_board')) return;
      if(world.getAllPlayers().length!==1) return;
      if(records.length>=LIMIT) {
        if(!overflow)console.warn('[pinene_wear_probe] capture_limit_reached');
        overflow=true;return;
      }
      const row:Observation={tick:system.currentTick,playerId:event.player.id,
        boardType:b.typeId,dimension:b.dimension.id,location:{...b.location},
        output:event.itemStack?{typeId:event.itemStack.typeId,amount:event.itemStack.amount}:undefined};
      records.push(row);
      console.warn('[pinene_wear_probe] '+JSON.stringify(row));
    } catch(error) { console.warn('[pinene_wear_probe] observation_error: '+String(error)); }
  };
  signal.subscribe(callback);
  return {supported:true,
    stop(){if(!stopped){stopped=true;signal.unsubscribe(callback);}},
    snapshot:()=>records.map(row=>({...row,location:{...row.location},
      output:row.output?{...row.output}:undefined}))};
}

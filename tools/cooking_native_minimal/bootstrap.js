import {world,system,ItemStack,BlockPermutation,GameMode} from '@minecraft/server';
import {seedPlacedKnife,LIMITS} from './native_boards.js';
const KEY='pinene_native_minimal:setup_v1';
const ORIGIN={x:0.5,y:-60,z:-0.5};
const MATERIALS=[
 ['minecraft:bread',32],['pine:chocolate',16],['pine:butter',32],['minecraft:apple',16],
 ['minecraft:cooked_beef',16],['minecraft:honey_bottle',16],['minecraft:wheat',48],
 ['minecraft:wheat_seeds',32],['minecraft:glass_bottle',16],['minecraft:bone',32],['pine:whole_cheese',16],
 ['minecraft:bowl',32],['minecraft:carrot',32],['pine:milk_bottle',16]
];
const SUPPLIES=[
 ['minecraft:sugar',32],['minecraft:cocoa_beans',32],['minecraft:egg',16],['minecraft:beetroot',16],
 ['minecraft:sweet_berries',32],['minecraft:glow_berries',32],['minecraft:pumpkin',16],
 ['minecraft:dried_kelp',32],['minecraft:baked_potato',32],['minecraft:cooked_porkchop',16],
 ['minecraft:cooked_chicken',16],['minecraft:red_mushroom',16],['minecraft:brown_mushroom',16],
 ['minecraft:cooked_cod',16],['minecraft:cooked_salmon',16],['myname:pancake',16],
 ['minecraft:melon_seeds',16],['minecraft:beetroot_seeds',16],['minecraft:pumpkin_seeds',16],
 ['minecraft:coal',16],['minecraft:milk_bucket',1],['minecraft:milk_bucket',1]
];
const pending=new Set();
function welcome(player){
 player.sendMessage('§aバニラ料理試験場：中央はネザライト、左は銅、右はナイフなしのまな板です。');
 player.sendMessage('§7画面はバニラのまま。手を空けて開きます。スニーク＋操作でナイフ回収。追加材料は奥の樽、左端は炉、右端は普通の作業台です。');
 player.sendMessage('§e今回は34レシピとランク制限の試験。クラフト時のナイフ耐久消費はまだ未接続です。');
 player.onScreenDisplay.setTitle('料理システム試験場',{subtitle:'バニラ画面・レシピとナイフの連携',stayDuration:60,fadeInDuration:5,fadeOutDuration:15});
}
function log(event,extra={}){console.warn('[pinene_native_minimal] '+JSON.stringify({event,...extra}));}
function prepare(player,attempt=0){
 if(!player.isValid){pending.delete(player.id);return;}
 try{
  if(world.getAllPlayers().length!==1)throw new Error('single_player_only');
  const phase=world.getDynamicProperty(KEY);
  if(phase==='done'){welcome(player);pending.delete(player.id);return;}
  if(phase!==undefined)throw new Error('previous_setup_incomplete_no_regrant');
  if(player.dimension.id!=='minecraft:overworld')throw new Error('wrong_dimension');
  const p=player.location;if((p.x-ORIGIN.x)**2+(p.y-ORIGIN.y)**2+(p.z-ORIGIN.z)**2>256)throw new Error('unexpected_spawn');
  const inventory=player.getComponent('minecraft:inventory')?.container;
  if(!inventory || inventory.size!==36)throw new Error('inventory_unavailable');
  for(let i=0;i<36;i++)if(inventory.getItem(i))throw new Error('initial_inventory_not_empty');
  const dim=player.dimension,plan=[];
  for(let x=-7;x<=7;x++)for(let z=-4;z<=8;z++)plan.push({at:{x,y:-61,z},type:'minecraft:smooth_stone'});
  for(const x of [-3,0,3])plan.push({at:{x,y:-60,z:2},type:'pinene_cooking:oak_cutting_board'});
  plan.push({at:{x:0,y:-60,z:5},type:'minecraft:barrel'},
   {at:{x:-5,y:-60,z:2},type:'minecraft:furnace'},{at:{x:5,y:-60,z:2},type:'minecraft:crafting_table'});
  const prepared=plan.map(a=>({...a,block:dim.getBlock(a.at),permutation:BlockPermutation.resolve(a.type)}));
  if(prepared.some(a=>!a.block))throw new Error('chunks_not_ready');
  const knives=Object.keys(LIMITS).map(m=>new ItemStack(`pinene_cooking:${m}_knife`,1));
  const items=MATERIALS.map(([id,n])=>new ItemStack(String(id),Number(n)));
  const supplies=SUPPLIES.map(([id,n])=>new ItemStack(String(id),Number(n)));
  // Refuse duplicate setup after a crash. Never clear pre-existing inventories.
  world.setDynamicProperty(KEY,'started');
  for(const a of prepared)a.block.setPermutation(a.permutation);
  seedPlacedKnife(dim.getBlock({x:0,y:-60,z:2}),'netherite');
  seedPlacedKnife(dim.getBlock({x:-3,y:-60,z:2}),'copper');
  const barrel=dim.getBlock({x:0,y:-60,z:5}).getComponent('minecraft:inventory')?.container;
  if(!barrel || barrel.size<supplies.length)throw new Error('supply_barrel_unavailable');
  for(let i=0;i<barrel.size;i++)if(barrel.getItem(i))throw new Error('supply_barrel_not_empty');
  knives.forEach((s,i)=>inventory.setItem(i+1,s));
  items.forEach((s,i)=>inventory.setItem(i+9,s));
  supplies.forEach((s,i)=>barrel.setItem(i,s));
  player.selectedSlotIndex=0;player.setGameMode(GameMode.Survival);
  player.teleport(ORIGIN,{dimension:dim,rotation:{x:34,y:0},checkForBlocks:true});
  player.setSpawnPoint({dimension:dim,...ORIGIN});
  world.setDynamicProperty(KEY,'done');welcome(player);log('setup_complete');
  pending.delete(player.id);
 }catch(error){
  if((String(error).includes('chunks_not_ready')||String(error).includes('LocationInUnloadedChunk'))&&attempt<20 && world.getDynamicProperty(KEY)===undefined){
   system.runTimeout(()=>prepare(player,attempt+1),10);return;
  }
  log('setup_failed',{error:String(error)});pending.delete(player.id);
  try{player.sendMessage('§c試験場の準備を停止しました。自動再配布は行いません。ログを確認してください。');}catch{}
 }
}
function schedule(player){if(!pending.has(player.id)){pending.add(player.id);system.runTimeout(()=>prepare(player),20);}}
world.afterEvents.playerSpawn.subscribe(({player,initialSpawn})=>{if(initialSpawn)schedule(player);});
world.afterEvents.playerLeave.subscribe(({playerId})=>pending.delete(playerId));
system.run(()=>{for(const player of world.getAllPlayers())schedule(player);});

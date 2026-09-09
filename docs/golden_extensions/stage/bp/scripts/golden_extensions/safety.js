import {add,sub,mul,distance,finite} from './math.js';
// Deliberately conservative: unknown/custom/partial/hazardous floors are refused.
const FLOOR=/^minecraft:(?:stone|end_stone|end_stone_bricks|dirt|coarse_dirt|rooted_dirt|grass_block|podzol|mycelium|netherrack|nether_bricks|red_nether_bricks|obsidian|crying_obsidian|bedrock|cobblestone|mossy_cobblestone|stone_bricks|mossy_stone_bricks|cracked_stone_bricks|chiseled_stone_bricks|deepslate|cobbled_deepslate|polished_deepslate|deepslate_bricks|deepslate_tiles|granite|diorite|andesite|polished_granite|polished_diorite|polished_andesite|basalt|smooth_basalt|polished_basalt|blackstone|polished_blackstone|sandstone|red_sandstone|smooth_stone|bricks|clay|terracotta|iron_block|gold_block|diamond_block|emerald_block|netherite_block|quartz_block|purpur_block|prismarine|dark_prismarine|sea_lantern|glowstone|(?:[a-z_]+)_(?:planks|log|wood|concrete|terracotta|ore))$/;
export function blockAt(dim,p){try{return dim.getBlock(p);}catch{return undefined;}}
export function bodyClear(dim,p){
 if(!finite(p)||p.y<dim.heightRange.min||p.y+1.85>=dim.heightRange.max)return false;
 for(const x of [-0.31,0.31])for(const z of [-0.31,0.31])for(const y of [0.05,0.95,1.8]){
  if(blockAt(dim,add(p,{x,y,z}))?.isAir!==true)return false;
 }
 return true;
}
export function safeStanding(dim,p){
 if(!bodyClear(dim,p))return false;
 for(const x of [-0.3,0,0.3])for(const z of [-0.3,0,0.3]){
  const b=blockAt(dim,add(p,{x,y:-0.05,z}));
  if(!b||!FLOOR.test(b.typeId))return false;
 }
 return true;
}
// Traverse all grid intervals along each corner/height ray, including both sides
// of grid boundaries. No skipped cells on long coordinate warps.
export function pathClear(dim,from,to){
 if(!finite(from)||!finite(to))return false;
 const delta=sub(to,from),times=new Set([0,1]);
 for(const offset of [{x:-.31,y:.05,z:-.31},{x:.31,y:1.8,z:.31},{x:0,y:.95,z:0}]){
  for(const k of ['x','y','z']){
   if(Math.abs(delta[k])<1e-8)continue;
   const a=from[k]+offset[k],b=to[k]+offset[k];
   for(let edge=Math.ceil(Math.min(a,b));edge<=Math.floor(Math.max(a,b));edge++){
    const t=(edge-a)/delta[k];if(t>0&&t<1){times.add(Math.max(0,t-1e-7));times.add(Math.min(1,t+1e-7));}
   }
  }
 }
 for(const t of times)if(!bodyClear(dim,add(from,mul(delta,t))))return false;
 return true;
}
export function blinkPoint(dim,origin,view,maxDistance){
 let best,previous=origin;
 for(let d=.25;d<=maxDistance+.001;d+=.25){
  const p=add(origin,mul(view,d));
  if(!pathClear(dim,previous,p))break;
  previous=p;
  // A landing is placed on the block grid, only when still on the view ray
  // within a quarter block. No downward search through floors or over a void.
  const landing={...p,y:Math.round(p.y)};
  if(Math.abs(landing.y-p.y)<=.25&&distance(origin,landing)<=maxDistance&&safeStanding(dim,landing)&&pathClear(dim,p,landing))best=landing;
 }
 return best&&distance(best,origin)>=.75&&pathClear(dim,origin,best)?best:undefined;
}
export function coordinatePoint(dim,origin,target,maxDistance){
 if(!finite(target)||distance(origin,target)>maxDistance)return undefined;
 const candidates=[target];
 for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++)for(let dz=-2;dz<=2;dz++){
  candidates.push({x:Math.floor(target.x)+.5+dx,y:Math.round(target.y)+dy,z:Math.floor(target.z)+.5+dz});
 }
 candidates.sort((a,b)=>distance(a,target)-distance(b,target));
 for(const p of candidates)if(distance(origin,p)<=maxDistance&&distance(p,target)<=3&&safeStanding(dim,p)&&pathClear(dim,origin,p))return p;
 return undefined;
}

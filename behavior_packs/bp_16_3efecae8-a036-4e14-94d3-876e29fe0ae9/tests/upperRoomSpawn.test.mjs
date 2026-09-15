import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as mock from './minecraft-server-encounter-mock.js';
import {createSourcePartsPlan} from '../scripts/infinite_castle/sourcePartsPlanner.js';
import {serializeRoomMaterials} from '../scripts/infinite_castle/sourceRoomMaterials.js';
import * as api from '../scripts/infinite_castle/phase1Runtime.js';
test('first upper-tier combat encounter spawns despite failing optional lighting writes',()=>{
 const plan=createSourcePartsPlan(420320,{x:1120,y:80,z:992});plan.dimensionId=mock.dimension.id;
 mock.setup(plan);
 mock.world.setDynamicProperty('infinite_castle:source_parts_test_state_v2',JSON.stringify({status:'complete'}));
 mock.world.setDynamicProperty('infinite_castle:source_parts_detailed_plan_v1',JSON.stringify({v:2,d:plan.dimensionId,s:plan.seed,t:plan.style,o:plan.topologyId,a:Object.values(plan.tierBases.lower),m:serializeRoomMaterials(plan)}));
 api.activateRoomEncounterPlan(plan);
 const upper=api.phase1Snapshot().rooms.filter(r=>r.kind==='combat').sort((a,b)=>b.origin.y-a.origin.y)[0];
 assert.ok(upper.origin.y>80);
 const player={id:'upper-first-visit',dimension:mock.dimension,
  location:{x:upper.origin.x+21,y:upper.origin.y+1,z:upper.origin.z+21},
  getGameMode:()=> 'Survival',getComponent:()=>({currentValue:20,effectiveMax:20}),
  getEffect(){},addEffect(){},sendMessage(){},applyDamage(){},applyKnockback(){},
  onScreenDisplay:{setActionBar(){},setTitle(){}},
 };
 mock.setPlayers([player]);api.phase1Enter(player);
 const getBlock=mock.dimension.getBlock.bind(mock.dimension);let failures=0;
 mock.dimension.getBlock=point=>{
  const b=getBlock(point);const set=b.setType.bind(b);
  return new Proxy(b,{get(target,key){if(key==='setType') return type=>{
   if(type==='minecraft:light_block_15'){failures++;throw Error('simulated optional lighting failure');}set(type);
  };return Reflect.get(target,key);}});
 };
 const warn=console.warn;console.warn=()=>{};
 try {for(let i=0;i<30;i++){mock.advance();api.updateRoomEncounters();}}
 finally{console.warn=warn;mock.dimension.getBlock=getBlock;}
 const room=api.phase1Snapshot().rooms.find(r=>r.roomInstanceId===upper.roomInstanceId);
 assert.ok(failures>0,'failure condition was exercised');
 assert.equal(room.state,'Active');assert.ok(mock.metrics.spawns>0,'spawn work survives optional decoration errors');
 assert.equal(room.reward,'locked','unvisited combat reward has not been granted');
 const slots=room.slots.length;let removed=false;
 mock.emit('entitySpawn',{entity:{id:'foreign-creeper',typeId:'minecraft:creeper',
  isValid:true,dimension:mock.dimension,location:player.location,getComponent(){},
  matches:()=>true,remove(){removed=true;}}});
 assert.equal(removed,true);
 assert.equal(api.phase1Snapshot().rooms.find(r=>r.roomInstanceId===upper.roomInstanceId).slots.length,slots);
});

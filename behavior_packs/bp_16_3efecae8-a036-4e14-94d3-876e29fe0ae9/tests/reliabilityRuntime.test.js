import test from 'node:test';
import assert from 'node:assert/strict';
import * as mock from './minecraft-server-encounter-mock.js';
import { createSourcePartsPlan } from '../scripts/infinite_castle/sourcePartsPlanner.js';
import { serializeRoomMaterials } from '../scripts/infinite_castle/sourceRoomMaterials.js';
import { interiorBlocks } from '../scripts/infinite_castle/phase1Interiors.js';
import { MOB_BALANCE } from '../scripts/infinite_castle/phase1Config.js';
import { readyWatchdog } from '../scripts/infinite_castle/phase1Reliability.js';
const KEY='infinite_castle:phase1_v2',CORE='infinite_castle:source_parts_test_state_v2',PLAN='infinite_castle:source_parts_detailed_plan_v1';
let serial=0;
async function setup() {
    mock.resetSubscriptions();mock.setPlayers([]);mock.setUnloaded(false);
    mock.world.setDynamicProperty(KEY,undefined);
    const plan=createSourcePartsPlan(17,{x:1000+10000*++serial,y:80,z:1000});plan.dimensionId=mock.dimension.id;
    mock.setup(plan);mock.world.setDynamicProperty(CORE,JSON.stringify({status:'COMPLETE'}));
    mock.world.setDynamicProperty(PLAN,JSON.stringify({v:2,d:plan.dimensionId,s:plan.seed,t:plan.style,o:plan.topologyId,a:Object.values(plan.tierBases.lower),m:serializeRoomMaterials(plan)}));
    const api=await import(`../scripts/infinite_castle/phase1Runtime.js?reliability=${serial}`);
    api.activateRoomEncounterPlan(plan);
    const rooms=()=>api.phase1Snapshot().rooms;
    const guard=rooms().find(r=>r.encounterType==='guard');
    const player={id:'A',dimension:mock.dimension,location:{x:guard.origin.x+21,y:guard.origin.y+1,z:guard.origin.z+21},
        getGameMode:()=> 'Survival',getComponent:()=>({currentValue:20,effectiveMax:20}),getEffect(){},addEffect(){},applyDamage(){},applyKnockback(){},
        sendMessage(){},notices:[],onScreenDisplay:{setActionBar:m=>player.notices.push(m),setTitle(){}}};
    const tick=(n=1)=>{for(let i=0;i<n;i++){mock.advance();api.updateRoomEncounters();}};
    return {api,plan,rooms,guard,player,tick,room:id=>rooms().find(r=>r.roomInstanceId===id)};
}
test('real runtime preserves killed slots through dormant and process reload',async()=>{
    const h=await setup();mock.setPlayers([h.player]);h.api.phase1Enter(h.player);h.tick(30);
    const dead=h.room(h.guard.roomInstanceId).slots.filter(s=>!MOB_BALANCE[s.mob].keyHolder&&s.phase==='alive').slice(0,2);
    for(const slot of dead) mock.kill(mock.world.getEntity(slot.id));
    const inside={...h.player.location};h.player.location={x:-100000,y:80,z:-100000};h.tick(45);
    assert.equal(h.room(h.guard.roomInstanceId).state,'Dormant');
    assert.equal(h.room(h.guard.roomInstanceId).slots.filter(s=>s.phase==='dead').length,2);
    h.player.location=inside;h.tick(30);
    for(const slot of dead) assert.equal(h.room(h.guard.roomInstanceId).slots.find(s=>s.tag===slot.tag).phase,'dead');
    const saved=JSON.parse(mock.world.getDynamicProperty(KEY));
    assert.equal(saved.rooms.find(r=>r.roomInstanceId===h.guard.roomInstanceId).slots.filter(s=>s[3]===0).length,2);
    mock.resetSubscriptions();
    const reboot=await import(`../scripts/infinite_castle/phase1Runtime.js?reboot=${serial}`);
    reboot.updateRoomEncounters();
    const restored=reboot.phase1Snapshot().rooms.find(r=>r.roomInstanceId===h.guard.roomInstanceId);
    assert.equal(restored.slots.filter(s=>s.phase==='dead').length,2);
});
for(const deleted of [1,25]) test(`decorated exit repairs ${deleted} missing tiles only and pauses during reconstruction`,async()=>{
    const h=await setup(),exit=h.rooms().find(r=>r.kind==='exit');
    h.player.location={x:exit.origin.x+21,y:exit.origin.y+1,z:exit.origin.z+21};mock.setPlayers([h.player]);h.api.phase1Enter(h.player);h.tick(20);
    assert.equal(h.room(exit.roomInstanceId).decorated,true);
    const blocks=interiorBlocks(exit);for(const tile of blocks.slice(0,deleted))mock.dimension.getBlock(tile.position).setType('minecraft:air');
    mock.world.setDynamicProperty(CORE,JSON.stringify({status:'REBUILDING'}));h.tick(3);
    assert.equal(mock.dimension.getBlock(blocks[0].position).typeId,'minecraft:air');
    mock.world.setDynamicProperty(CORE,JSON.stringify({status:'COMPLETE'}));h.tick(2);
    for(const tile of blocks)assert.equal(mock.dimension.getBlock(tile.position).typeId,tile.typeId);
});
test('real placement events cancel adjacent chest/hopper and diagonal placements but allow distant blocks',async()=>{
    const h=await setup();mock.setPlayers([h.player]);h.api.phase1Enter(h.player);h.tick(25);
    const room=h.room(h.guard.roomInstanceId);assert.ok(room.chestOwned);assert.notEqual(room.reward,'stocked');
    for(const typeId of ['minecraft:chest','minecraft:hopper','minecraft:dropper','minecraft:dispenser','minecraft:rail']) {
        const p={x:room.chest.x+1,y:room.chest.y+1,z:room.chest.z+1};
        const event={dimension:mock.dimension,block:mock.dimension.getBlock(p),permutationToPlace:{type:{id:typeId}},cancel:false};
        mock.emit('place',event);assert.equal(event.cancel,true);
    }
    const event={dimension:mock.dimension,block:mock.dimension.getBlock({...room.chest,x:room.chest.x+2}),cancel:false};
    mock.emit('place',event);assert.equal(event.cancel,false);
});
test('planned reconstruction busy state does not show recovery UI or request recovery',async()=>{
    const h=await setup();mock.setPlayers([h.player]);h.api.phase1Enter(h.player);
    let requests=0;h.api.setPhase1Handlers({recover:()=>requests++,recoveryPending:()=>false,recoveryBusy:()=>true});
    h.api.beginEncounterReconstruction();h.tick(100);
    assert.deepEqual(h.player.notices,[]);assert.equal(requests,0);
});
test('ready=false shows action bar at 3 seconds and requests only owner recovery at 20 seconds',async()=>{
    const h=await setup();mock.setPlayers([h.player]);h.api.phase1Enter(h.player);
    let requests=0,busy=false;h.api.setPhase1Handlers({recover:()=>requests++,recoveryPending:()=>true,recoveryBusy:()=>busy});
    mock.world.setDynamicProperty(CORE,JSON.stringify({status:'RECOVERY_REQUIRED'}));
    h.tick(12);assert.equal(h.player.notices.includes('§e無限城を復旧中です…'),false);
    h.tick();assert.ok(h.player.notices.includes('§e無限城を復旧中です…'));
    busy=true;h.tick(80);assert.equal(requests,0);busy=false;h.tick();assert.equal(requests,1);
    h.tick(20);assert.equal(requests,1);
});
test('offline A plus exited B ends after 60 seconds; returning A is sent through the next-run handler',async()=>{
    const h=await setup(),original=Date.now;let now=0;Date.now=()=>now;
    try {
        const b={...h.player,id:'B'};mock.setPlayers([h.player,b]);h.api.phase1Enter(h.player);h.api.phase1Enter(b);h.tick(2);
        const runId=h.api.phase1Snapshot().runId;
        mock.setPlayers([b]);h.tick(2);h.api.phase1Exit(b);mock.setPlayers([]);h.tick(2);
        assert.equal(h.api.phase1Snapshot().participants.A,'active');
        now=59999;h.tick(2);assert.equal(h.api.phase1RunState(),'ACTIVE');
        now=60000;h.tick(2);assert.equal(h.api.phase1RunState(),'ENDED_PENDING_REBUILD');
        let rejoined=0;h.api.setPhase1Handlers({rejoin:p=>{assert.equal(p.id,'A');rejoined++;}});
        mock.setPlayers([h.player]);h.tick(2);assert.ok(rejoined>0);
        h.api.beginPhase1Run();h.api.activateRoomEncounterPlan(h.plan);h.api.phase1Enter(h.player);
        assert.notEqual(h.api.phase1Snapshot().runId,runId);
    } finally {Date.now=original;}
});
test('return inside grace resumes the same run and resets absence timer',async()=>{
    const h=await setup(),original=Date.now;let now=0;Date.now=()=>now;
    try {
        mock.setPlayers([h.player]);h.api.phase1Enter(h.player);h.tick(2);const runId=h.api.phase1Snapshot().runId;
        mock.setPlayers([]);h.tick(2);now=59000;mock.setPlayers([h.player]);h.tick(2);
        assert.equal(h.api.phase1Snapshot().runId,runId);assert.equal(h.api.phase1Snapshot().noOnlineSince,undefined);
        now=120000;h.tick(2);assert.equal(h.api.phase1RunState(),'ACTIVE');
    }finally{Date.now=original;}
});
test('forced spawn failures get one queue repair then room quarantine without endless retry',async()=>{
    const h=await setup(),spawn=mock.dimension.spawnEntity;let calls=0;
    mock.dimension.spawnEntity=()=>{calls++;throw Error('injected spawn failure');};
    try {
        mock.setPlayers([h.player]);h.api.phase1Enter(h.player);h.tick(320);
        const r=h.room(h.guard.roomInstanceId);assert.equal(r.spawnRepairAttempted,true);assert.equal(r.state,'Error');
        const before=calls;h.tick(100);assert.equal(calls,before);assert.equal(h.api.phase1RunState(),'ACTIVE');
        assert.ok(h.rooms().filter(r=>r.roomInstanceId!==h.guard.roomInstanceId).every(r=>r.state!=='Error'));
    }finally{mock.dimension.spawnEntity=spawn;}
});
test('ready watchdog resets its elapsed timer after readiness returns',()=>{
    const memory={};readyWatchdog(memory,{ready:false,now:0,players:1,busy:false});
    assert.equal(readyWatchdog(memory,{ready:false,now:400,players:1,busy:false}).request,true);
    readyWatchdog(memory,{ready:true,now:401,players:1,busy:false});
    assert.deepEqual(readyWatchdog(memory,{ready:false,now:402,players:1,busy:false}),{notice:false,request:false});
});

test('creative observer in an ended run never gets a false recovery notice, including after reload',async()=>{
    const h=await setup(),original=Date.now;let now=0;Date.now=()=>now;
    try {
        h.player.getGameMode=()=> 'Creative';mock.setPlayers([h.player]);
        let requests=0;h.api.setPhase1Handlers({recover:()=>requests++});h.tick(2);
        now=60000;h.tick(100);
        assert.equal(h.api.phase1RunState(),'ENDED_PENDING_REBUILD');
        assert.deepEqual(h.player.notices,[]);assert.equal(requests,0);
        const saved=mock.world.getDynamicProperty(KEY);
        mock.resetSubscriptions();
        const reboot=await import(`../scripts/infinite_castle/phase1Runtime.js?creativeReload=${serial}`);
        reboot.setPhase1Handlers({recover:()=>requests++});
        for(let i=0;i<100;i++){mock.advance();reboot.updateRoomEncounters();}
        assert.equal(reboot.phase1RunState(),'ENDED_PENDING_REBUILD');
        assert.deepEqual(h.player.notices,[]);assert.equal(requests,0);
        assert.equal(mock.world.getDynamicProperty(KEY),saved);
    }finally{Date.now=original;}
});

test('an ended run with an actual recovery journal still notifies and requests its owner',async()=>{
    const h=await setup(),original=Date.now;let now=0;Date.now=()=>now;
    try {
        h.player.getGameMode=()=> 'Creative';mock.setPlayers([h.player]);h.tick(2);
        now=60000;h.tick(2);assert.equal(h.api.phase1RunState(),'ENDED_PENDING_REBUILD');
        let requests=0;h.api.setPhase1Handlers({recover:()=>requests++,recoveryPending:()=>true});
        h.tick(82);assert.ok(h.player.notices.length>0);assert.equal(requests,1);
    }finally{Date.now=original;}
});

test('idle watchdog clears stale timers before the next active run',()=>{
    const memory={since:0,requestedAt:400};
    assert.deepEqual(readyWatchdog(memory,{ready:false,expected:false,now:1000,players:1,busy:false}),{notice:false,request:false});
    assert.deepEqual(memory,{});
    assert.deepEqual(readyWatchdog(memory,{ready:false,expected:true,now:1001,players:1,busy:false}),{notice:false,request:false});
});
test('full visual rebuild releases old encounter locks after snapshot and can restore on failure',async()=>{
    const h=await setup();mock.setPlayers([h.player]);h.api.phase1Enter(h.player);h.tick(30);
    assert.ok(h.api.encounterProtection().rooms.length>0);
    h.api.captureEncounterRollback();h.api.prepareVisualEncounterRebuild();
    assert.equal(h.api.encounterProtection().rooms.length,0);
    h.api.restoreEncounterRollback();h.api.activateRoomEncounterPlan(h.plan);
    assert.equal(h.room(h.guard.roomInstanceId).retired,false);
    assert.ok(h.room(h.guard.roomInstanceId).slots.length>0);
    h.api.finishEncounterRollback();
});

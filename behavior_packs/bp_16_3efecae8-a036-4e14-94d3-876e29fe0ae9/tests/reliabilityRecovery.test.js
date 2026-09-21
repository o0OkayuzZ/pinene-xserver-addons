import test from 'node:test';
import { clearCastleSection } from '../scripts/infinite_castle/castleClearLighting.js';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as lifecycle from '../scripts/infinite_castle/reconstructionLifecycle.js';
import * as stateCodec from '../scripts/infinite_castle/sourcePartsState.js';
import { sourcePlayerSafetyBounds } from '../scripts/infinite_castle/sourcePartsDynamicReconstruction.js';
import { createSourcePartsPlan as authoredPlan } from '../scripts/infinite_castle/sourcePartsPlanner.js';
import { serializeRoomMaterials, restoreRoomMaterials } from '../scripts/infinite_castle/sourceRoomMaterials.js';

const CORE='infinite_castle:source_parts_test_state_v2';
const LEGACY='infinite_castle:source_parts_test_state';
const PLAN='infinite_castle:source_parts_detailed_plan_v1';
const ROLLBACK='infinite_castle:reconstruction_rollback_v1';
const RUNTIME='runtime';
const source=readFileSync(new URL('../scripts/infinite_castle/sourcePartsReconstructionV2.js',import.meta.url),'utf8')
    .replace(/^import\s+[\s\S]*?from\s+"[^"]+";\r?\n/gm,'').replace(/^export /gm,'');

function plan(seed) {
    return {seed,style:'castle',topologyId:'castle_test',dimensionId:'infinite_castle:dungeon',
        tierBases:{lower:{x:0,y:80,z:0}},connections:[],placements:Array.from({length:5},(_,i)=>({
            placementId:`p${i}`,variantId:'test',category:'room',role:i===0?'entrance':'room',
            origin:{x:i*50+(i&&seed===2?10:0),y:80,z:0},size:{x:8,y:8,z:8},tier:'lower',
        }))};
}
const descriptor=p=>JSON.stringify({v:2,d:p.dimensionId,s:p.seed,t:p.style,o:p.topologyId,a:[0,80,0]});
function harness({unchanged=false,fault=null,players=1,properties=new Map(),physical=new Map()}={}) {
    const events=[],logs=[],dimensionRequests=[]; let tick=0,buildCount=0,failures=0;
    const old=plan(1), candidate=plan(2);
    const protectedIds=Array.from({length:Math.max(1,players)},(_,i)=>`p${i}`);
    for(const p of candidate.placements) if(protectedIds.includes(p.placementId)) p.origin={...old.placements.find(o=>o.placementId===p.placementId).origin};
    if (!properties.size) {
        properties.set(CORE,stateCodec.serializeSourcePartsState('COMPLETE',[old]));
        properties.set(PLAN,descriptor(old)); properties.set(RUNTIME,'old');
        for (const p of old.placements) physical.set(p.origin.x,'test');
    }
    const status=()=>JSON.parse(properties.get(CORE)).status;
    function fail(stage) {
        if (fault===stage && failures++===0) throw Error(stage);
        if (fault==='recoveryAgain' && ((stage==='place' && status()==='REBUILDING') || status()==='RECOVERING')) throw Error('recoveryAgain');
    }
    const dimension={id:old.dimensionId,heightRange:{min:-64,max:512},
        getPlayers:()=>Array.from({length:players},(_,i)=>({id:`u${i}`,location:{x:i*50+3,y:82,z:3},sendMessage(){}})),
        fillBlocks(volume){
            for (const x of physical.keys()) if (x>=volume.from.x && x<=volume.to.x) {
                assert.ok(!Array.from({length:players},(_,i)=>i*50).includes(x),'occupied structure must never be cleared');
                physical.delete(x);
            }
        }};
    const areas=new Map();
    const world={getDynamicProperty:k=>properties.get(k),setDynamicProperty(k,v){
        if (v===undefined) properties.delete(k); else properties.set(k,v);
        if(k===CORE) events.push(JSON.parse(v).status);
        if(k===PLAN) fail('descriptor');
    },getDimension:id=>{dimensionRequests.push(id);if(id&&id!==dimension.id)throw Error('foreign dimension requested: '+id);return dimension;},getAbsoluteTime:()=>tick,
        tickingAreaManager:{chunkCount:1,maxChunkCount:64,hasCapacity:()=>true,
            hasTickingArea:k=>areas.has(k),removeTickingArea:k=>areas.delete(k),getTickingArea:k=>areas.get(k),
            async createTickingArea(k){fail('ticking');areas.set(k,{isFullyLoaded:true});}},
        structureManager:{getPackStructureIds:()=>['infinite_castle:generated_variants/test'],
            place(id,d,origin){fail('place');physical.set(origin.x,'test');
                if(status()==='REBUILDING') {buildCount++; if(fault===`percent${buildCount*25}`) {fault=null;throw Error('wave fault');}}
            }}};
    const no=()=>{};
    const context=vm.createContext({ ...lifecycle,...stateCodec,clearCastleSection,console:{warn:m=>logs.push(m)},world,
        system:{waitTicks:async n=>{tick+=n;}},PHASE1:{protectionHops:0,reconstructionCandidateAttempts:1},
        BlockVolume:class {constructor(from,to){Object.assign(this,{from,to});}},StructureAnimationMode:{None:'None'},
        DEFAULT_STAIR_SMOOTHING_STYLE:'authored',SCENERY_CORE_CLEARANCE:3,
        containsPlacement:(p,point)=>['x','y','z'].every(a=>point[a]>=p.origin[a]&&point[a]<p.origin[a]+p.size[a]),
        createSourcePartsPlan:seed=>plan(seed),restoreRoomMaterials,serializeRoomMaterials,fitPlanToHeightRange:no,
        getSourcePartsDemoLayoutSnapshot:()=>null,restoreSourcePartsPlanFromRoomSnapshot:()=>null,
        pauseSourcePartsDemo:()=>events.push('pause'),deactivateSourcePartsDemo:()=>properties.delete(RUNTIME),
        activateSourcePartsDemo:p=>{fail('activateSource');events.push(`source:${p.seed}`);properties.set(RUNTIME,String(p.seed));},
        activateRoomEncounterPlan:p=>{fail('activateEncounters');events.push(`encounters:${p.seed}`);},captureEncounterRollback:no,
        restoreEncounterRollback:no,finishEncounterRollback:no,
        isSourcePartsSceneryInProgress:()=>false,encounterProtection:()=>({rooms:[]}),beginEncounterReconstruction:no,
        endEncounterReconstruction:no,assertEncounterRevision:no,assertEncounterProtection:no,prepareRoomEncounterRemoval:no,
        getSourcePartsSceneryGuard:()=>({known:true,bounds:[]}),getSourcePartsSceneryRelocationGuard:()=>({known:true,fixedBounds:[]}),
        classifySourcePlayerLocations:()=>({conflict:[],invalid:[],core:[],scenery:[],outside:[],anchorLocations:[],anchorMode:'core'}),
        createAnchoredSourcePartsReconstructionAsync:async()=>({plan:candidate,protectedOldPlacementIds:protectedIds,protectedNewPlacementIds:protectedIds,changedPlacements:unchanged?0:5-protectedIds.length}),
        validateSocketContracts:no,prepareEncounterRoles:no,materialVariantId:p=>p.variantId,
        prepareSourcePartsSceneryForDynamicCore:async()=>({ok:true}),createRebuildStartCue:()=>no,
        assertVisualTestSafety:no,sourcePlayerSafetyBounds,
        clipBoundsToHeight:b=>b,splitBoundsForFill:b=>[b],protectedIds,
    });
    vm.runInContext(source+`
        // Native block/area operations and owner state machine remain real;
        // authored geometry generation/verification is tested in its own suite.
        prepareFastDynamicPlanGeometry=async()=>({replacements:0});
        sealUnusedAuthoredSockets=async()=>({sockets:0});
        sealRemovedProtectedConnections=async()=>({placed:0,retained:0,blocked:0});
        sealOldFrontierBeforeClear=async()=>({placed:0,retained:0,blocked:0});
        createDynamicRebuildSchedule=()=>({mutableNewPlacementIds:['p1','p2','p3','p4'].filter(id=>!protectedIds.includes(id)),
            steps:[1,2,3,4].filter(i=>!protectedIds.includes('p'+i)).flatMap(i=>[{phase:'clear',placementId:'p'+i},{phase:'build',placementId:'p'+i}])});
        globalThis.api={reconstructSourcePartsAroundPlayers,recoverSourceParts,sourcePartsRecoveryRequired,inspectSourcePartsStorage,
            withLoadedBounds,waitForTickingAreaLoaded,saveReconstructionState};`,context);
    return {api:context.api,world,dimension,properties,physical,events,logs,status,areas,dimensionRequests,
        build:()=>context.api.reconstructSourcePartsAroundPlayers(dimension,2),
        recover:()=>context.api.recoverSourceParts(dimension)};
}

test('foreign legacy plan is diagnosed but never opened or cleared',async()=>{
    const h=harness(),foreign=plan(99);foreign.dimensionId='minecraft:overworld';
    h.properties.set(LEGACY,stateCodec.serializeSourcePartsState('COMPLETE',[foreign]));
    const diagnostics=h.api.inspectSourcePartsStorage();
    assert.ok(diagnostics.some(r=>r.key===LEGACY&&r.dimensionId==='minecraft:overworld'&&r.foreign===true));
    const result=await h.build();assert.equal(result.ok,true,JSON.stringify({result,logs:h.logs}));
    assert.equal(h.dimensionRequests.includes('minecraft:overworld'),false);
    assert.ok(h.logs.some(line=>line.includes('[ic-dimension-guard] ignored stored plan')&&line.includes('minecraft:overworld')));
    assert.equal(h.properties.has(LEGACY),true,'foreign metadata is preserved for diagnosis until explicitly quarantined');
});

test('normal partial rebuild commits COMPLETE and both runtimes',async()=>{
    const h=harness();const result=await h.build();assert.equal(result.ok,true,JSON.stringify(result));
    assert.equal(h.status(),'COMPLETE');assert.equal(JSON.parse(h.properties.get(PLAN)).s,2);
    assert.deepEqual(h.events.slice(-3),['COMPLETE','source:2','encounters:2']);assert.equal(h.properties.has(ROLLBACK),false);
});
for(const fault of ['percent25','percent50','place','ticking','descriptor','activateSource','activateEncounters']) test(`${fault} failure automatically restores old plan`,async()=>{
    const h=harness({fault});const result=await h.build();
    assert.equal(result.reason,'recovered',JSON.stringify({result,logs:h.logs}));assert.equal(h.status(),'COMPLETE');
    assert.equal(JSON.parse(h.properties.get(PLAN)).s,1);assert.equal(h.properties.get(RUNTIME),'1');
    for (const p of plan(1).placements) assert.equal(h.physical.get(p.origin.x),'test');
    assert.ok(h.events.includes('RECOVERY_REQUIRED'));assert.ok(h.events.includes('RECOVERING'));
    assert.deepEqual(h.events.slice(-3),['COMPLETE','source:1','encounters:1']);assert.equal(h.areas.size,0);
    if(fault==='ticking') {const log=h.logs.find(l=>l.startsWith('[ic-loaded-bounds-error]'));
        assert.ok(log);for(const key of ['stage','temporaryAreaName','bounds','chunkCount','maxChunkCount','reconstructionStatus','oldPlanSeed','newPlanSeed','playerCount']) assert.ok(log.includes(key));}
});
for(const status of ['PREPARING','REBUILDING','VERIFYING','COMMITTING','RECOVERING']) test(`${status} restart without entrance runtime prioritizes old descriptor`,async()=>{
    const h=harness();h.properties.set(CORE,stateCodec.serializeSourcePartsState(status,[plan(1),plan(2)]));
    h.properties.set(ROLLBACK,descriptor(plan(1)));h.properties.set(PLAN,descriptor(plan(2)));h.properties.delete(RUNTIME);
    const reboot=harness({properties:h.properties,physical:h.physical,players:0});
    assert.equal(reboot.api.sourcePartsRecoveryRequired(),true);
    const result=await reboot.build();assert.equal(result.ok,true,JSON.stringify({result,logs:reboot.logs}));
    assert.equal(reboot.status(),'COMPLETE');assert.equal(JSON.parse(h.properties.get(PLAN)).s,1);
});
test('failure during recovery remains recoverable on next invocation',async()=>{
    const h=harness({fault:'recoveryAgain'});await h.build();assert.equal(h.status(),'RECOVERY_REQUIRED');
    assert.ok(h.properties.has(ROLLBACK));
    const reboot=harness({properties:h.properties,physical:h.physical});
    const result=await reboot.recover();assert.equal(result.ok,true,JSON.stringify(result));assert.equal(reboot.status(),'COMPLETE');
});
for(const players of [2,3,4]) test(`${players} players retain occupied structure through failure and recovery`,async()=>{
    const h=harness({fault:'place',players});const result=await h.build();
    assert.equal(result.reason,'recovered',JSON.stringify(result));
    for(let i=0;i<players;i++)assert.equal(h.physical.get(i*50),'test');
});
test('loaded flag cannot turn native chunk currently loaded and ticking failure into success',async()=>{
    const h=harness();h.world.tickingAreaManager.createTickingArea=async name=>{
        h.areas.set(name,{isFullyLoaded:true});throw Error('chunk currently loaded and ticking');
    };
    await assert.rejects(h.api.withLoadedBounds(h.dimension,{from:{x:0,y:80,z:0},to:{x:2,y:82,z:2}},'test',()=>assert.fail('callback must not run')),/chunk currently/);
    assert.equal(h.logs.filter(l=>l.startsWith('[ic-loaded-bounds-error]')).length,1);
});

test('persisted state descriptors recover without detailed descriptor or entrance runtime',async()=>{
    const h=harness();const value=JSON.parse(stateCodec.serializeSourcePartsState('VERIFYING',[plan(1),plan(2)]));
    value.descriptors=[JSON.parse(descriptor(plan(1))),JSON.parse(descriptor(plan(2)))];
    h.properties.set(CORE,JSON.stringify(value));h.properties.delete(PLAN);h.properties.delete(RUNTIME);
    const result=await h.recover();assert.equal(result.ok,true,JSON.stringify(result));
    assert.equal(h.status(),'COMPLETE');assert.equal(JSON.parse(h.properties.get(PLAN)).s,1);
});
test('two authored plans with room roles fit the persistent reconstruction property budget',()=>{
    const h=harness();
    const plans=[17,29].map(seed=>{
        const p=authoredPlan(seed,{x:1000,y:80,z:1000});p.dimensionId=h.dimension.id;
        for(const room of p.placements.filter(p=>p.category==='room')) {
            room.encounterRole={kind:'combat',encounterType:'guard',interiorVariant:0};
        }
        return p;
    });
    h.api.saveReconstructionState('REBUILDING',plans);
    assert.ok(Buffer.byteLength(h.properties.get(CORE),'utf8')<32767);
    assert.equal(JSON.parse(h.properties.get(CORE)).descriptors.length,2);
});


test('unchanged live layout clears its unused rollback journal without rebuilding', async()=>{
    const h=harness({unchanged:true});
    const result=await h.build();
    assert.equal(result.reason,'unchanged_layout');
    assert.equal(h.status(),'COMPLETE');
    assert.equal(h.properties.has(ROLLBACK),false);
    assert.equal(h.api.sourcePartsRecoveryRequired(),false);
    assert.equal(JSON.parse(h.properties.get(PLAN)).s,1);
});

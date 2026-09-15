import { system, world, BlockPermutation } from "@minecraft/server";
import { getSourcePartsLightingPlan, isSourcePartsReconstructionInProgress } from "./sourcePartsReconstructionV2.js";
import { isSourcePartsSceneryInProgress } from "./sourcePartsScenery.js";
import { GENERATED_SOURCE_VARIANTS } from "./sourcePartsGeneratedCatalog.js";
import { LIGHTING_SOCKETS } from "./castleVanillaLightingCatalog.js";
import { fixtureJobs, overlapsWalkingSpace, tryPlaceFixture } from "./castleVanillaLightingPure.js";

const DIMENSION="infinite_castle:dungeon";
const CORE="infinite_castle:source_parts_test_state_v2";
const DETAIL="infinite_castle:source_parts_detailed_plan_v1";
const SCENERY="infinite_castle:source_parts_scenery_v1";
const variants=new Map(GENERATED_SOURCE_VARIANTS.map(v=>[v.id,v]));
let signature=null, jobs=[], cursor=0, nextSweep=0, lastWarning=-1200, placed=0;
let standing, hanging;

export function updateCastleVanillaLighting() {
    if (isSourcePartsReconstructionInProgress() || isSourcePartsSceneryInProgress()) return;
    let dimension;
    try { dimension=world.getDimension(DIMENSION); } catch { return; }
    const players=dimension.getPlayers();
    if (!players.length) return;
    const core=world.getDynamicProperty(CORE), detail=world.getDynamicProperty(DETAIL), scenery=world.getDynamicProperty(SCENERY);
    const current=[core,detail,scenery];
    if (!signature || current.some((value,i)=>value!==signature[i])) {
        jobs=[];cursor=0;
        // No stale positions during clear, migration, or an interrupted reconstruction.
        if (!core || String(JSON.parse(core).status).toUpperCase()!=="COMPLETE") {signature=null;return;}
        const plan=getSourcePartsLightingPlan(dimension);
        if (!plan) {signature=null;return;}
        let placements=[...plan.placements];
        if (scenery) {
            const state=JSON.parse(scenery);
            if (state.status==="complete" && state.plan?.dimensionId===DIMENSION)
                placements.push(...state.plan.placements);
        }
        jobs=fixtureJobs(placements,LIGHTING_SOCKETS)
            .filter(job=>!overlapsWalkingSpace(job.position,placements,variants));
        signature=current;nextSweep=0;
    }
    if (!jobs.length || system.currentTick<nextSweep) return;
    standing??=BlockPermutation.resolve("minecraft:light_block_8");
    hanging??=BlockPermutation.resolve("minecraft:light_block_6");
    let writes=0;
    for (let read=0;read<8 && writes<2 && cursor<jobs.length;read++) {
        const job=jobs[cursor++];
        if (!players.some(p=>Math.hypot(p.location.x-job.position.x,p.location.y-job.position.y,p.location.z-job.position.z)<160)) continue;
        try {
            if (tryPlaceFixture(dimension,job,players,job.hanging?hanging:standing)==="placed") {writes++;placed++;}
        } catch(error) {
            // Unloaded blocks are retried in the next sparse sweep without loading chunks.
            if (!/unloaded|out.of.world|out.of.bounds/i.test(String(error))) throw error;
        }
    }
    if (cursor>=jobs.length) {
        cursor=0;nextSweep=system.currentTick+200;
        if (placed) {console.warn(`[ic-lighting] dim invisible lights added=${placed} sockets=${jobs.length}`);placed=0;}
    }
}

system.runInterval(()=>{
    try {updateCastleVanillaLighting();}
    catch(error) {
        signature=null;
        if (system.currentTick-lastWarning>=1200) {
            lastWarning=system.currentTick;
            console.warn(`[ic-lighting] delayed: ${error}`);
        }
    }
},2);

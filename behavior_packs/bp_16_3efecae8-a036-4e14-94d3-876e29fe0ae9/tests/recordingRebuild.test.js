import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { beginVisualTest, endVisualTest, assertVisualTestSafety, isVisualTestObserver } from '../scripts/infinite_castle/sourcePartsVisualTestGuard.js';

test('recording accepts creative and spectator observers without changing game mode',()=>{
    const players=['Creative','Spectator'].map(mode=>({getGameMode:()=>mode}));
    const dimension={id:'infinite_castle:dungeon',getPlayers:()=>players};
    try {
        beginVisualTest(dimension,{allowCreative:true});
        assert.doesNotThrow(()=>assertVisualTestSafety(dimension));
        for(const p of players)assert.equal(isVisualTestObserver(p,dimension),true);
        assert.equal(isVisualTestObserver(players[0],{id:'minecraft:overworld'}),false);
    } finally {endVisualTest();}
});
test('recording stops when a survival/adventure player joins or an observer changes mode',()=>{
    let mode='Creative';const player={getGameMode:()=>mode};
    const dimension={id:'infinite_castle:dungeon',getPlayers:()=>[player]};
    for(const disallowed of ['Survival','Adventure']) {
        mode='Creative';beginVisualTest(dimension,{allowCreative:true});
        try {mode=disallowed;assert.throws(()=>assertVisualTestSafety(dimension));}
        finally {endVisualTest();}
    }
});
test('recording permission cannot leak into ordinary spectator-only full rebuilds',()=>{
    const dimension={id:'infinite_castle:dungeon',getPlayers:()=>[{getGameMode:()=> 'Creative'}]};
    beginVisualTest(dimension,{allowCreative:true});endVisualTest();
    assert.throws(()=>beginVisualTest(dimension));
    assert.doesNotThrow(()=>assertVisualTestSafety());
});

const source=readFileSync(new URL('../scripts/infinite_castle/infiniteCastleManager.js',import.meta.url),'utf8');
const start=source.indexOf('async function runVisualFullRebuild(');
const next=source.indexOf('if (event.id !== "infinite_castle:rebuild_source_parts")',start);
const snippet=source.slice(start,source.lastIndexOf('system.afterEvents.scriptEventReceive.subscribe',next));
function harness(mode='Creative',dimensionId='infinite_castle:dungeon') {
    const callbacks=[],calls=[],messages=[];
    const player={dimension:{id:dimensionId},getGameMode:()=>mode,sendMessage:m=>messages.push(m)};
    const context=vm.createContext({console,INFINITE_CASTLE_DIMENSION_ID:'infinite_castle:dungeon',
        dungeonResetInProgress:false,reconstructionInProgress:false,sourceDynamicReconstructionInProgress:false,sceneryClockInProgress:false,
        isSourcePartsReconstructionInProgress:()=>false,world:{setDynamicProperty(){}},SCENERY_NEXT_TICK_KEY:'scenery',
        setSourceDynamicNextTick(){},reconstructionNow:()=>0,drawReconstructionDelayTicks:()=>6000,
        system:{afterEvents:{scriptEventReceive:{subscribe:fn=>callbacks.push(fn)}}},
        async rebuildAllSourcePartsForVisualTest(p,options){calls.push({p,options});return {ok:true,plan:{placements:[1],seed:42},scenery:{placements:36}};},
    });
    vm.runInContext(snippet,context);
    return {context,player,calls,messages,async command(id){for(const fn of callbacks)fn({id,sourceEntity:player});await new Promise(resolve=>setImmediate(resolve));}};
}
test('rebuild_record command routes the creative player to the full core and scenery builder',async()=>{
    const h=harness();await h.command('infinite_castle:rebuild_record');
    assert.equal(h.calls.length,1);assert.equal(h.calls[0].p,h.player);assert.equal(h.calls[0].options.allowCreative,true);
    assert.equal(h.context.dungeonResetInProgress,false);assert.ok(h.messages.some(m=>m.includes('総入れ替え完了')));
});
test('recording command requires a creative player in the castle and serializes with other jobs',async()=>{
    for(const mode of ['Survival','Adventure','Spectator']) {
        const h=harness(mode);await h.command('infinite_castle:rebuild_record');assert.equal(h.calls.length,0);
    }
    const outside=harness('Creative','minecraft:overworld');await outside.command('infinite_castle:rebuild_record');assert.equal(outside.calls.length,0);
    const busy=harness();busy.context.sourceDynamicReconstructionInProgress=true;
    await busy.command('infinite_castle:rebuild_record');assert.equal(busy.calls.length,0);
});
test('existing rebuild_all command keeps spectator-only mode',async()=>{
    const h=harness('Spectator');await h.command('infinite_castle:rebuild_all');
    assert.equal(h.calls.length,1);assert.equal(h.calls[0].options.allowCreative,false);
});

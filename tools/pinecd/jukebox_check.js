// Diagnostic fixture for an isolated disposable world only. Not a pack script.
import { world, system } from '@minecraft/server';
const ids = Array.from({length:19}, (_, i) => 'pinecd:cd_' + String(i+1).padStart(2,'0'));
ids.push('minecraft:music_disc_cat');
const results = [];
system.run(() => {
  const d = world.getDimension('overworld');
  const pos = {x:0,y:100,z:0};
  d.runCommand('tickingarea add circle 0 100 0 1 pinecd_probe');
  system.runTimeout(() => {
    let index=0;
    function next() {
      if(index===ids.length) { console.warn('PINECD_JUKEBOX_CHECK '+JSON.stringify(results)); return; }
      const id=ids[index++];
      try {
        const block=d.getBlock(pos); block.setType('minecraft:jukebox');
        const record=block.getComponent('minecraft:record_player');
        record.setRecord(id,true);
        system.runTimeout(() => {
          try {
            const inserted=record.getRecord()?.typeId;
            const playing=record.isPlaying();
            record.ejectRecord();
            const stopped=!record.isPlaying();
            const empty=record.getRecord()===undefined;
            results.push({id,inserted,playing,stopped,empty});
            block.setType('minecraft:air');
          } catch(e) { results.push({id,error:String(e)}); }
          next();
        },2);
      } catch(e) {results.push({id,error:String(e)});next();}
    }
    next();
  },40);
});

import { ActionFormData } from '@minecraft/server-ui';
import { MUSHROOMS,BY_ID } from './registry.js';
import { counts,seen } from './progress.js';
import { appraise,owned,recoverDelivery } from './appraisal.js';
import { requireUsable,canUse } from './npc.js';
import { sessions } from './sessions.js';
import { entityById,tell,logError,tr } from './util.js';
function label(d,suffix){return tr(`myco.${d.id.toLowerCase()}.${suffix}`);}
function stars(rarity){return '★'.repeat(rarity)+'☆'.repeat(10-rarity);}
function effectsText(d){
 const names={regeneration:'再生',darkness:'暗闇',nausea:'吐き気',haste:'採掘速度上昇',hunger:'空腹',speed:'移動速度上昇',jump_boost:'跳躍力上昇',resistance:'耐性',slowness:'移動速度低下',strength:'攻撃力上昇',weakness:'弱体化',mining_fatigue:'採掘速度低下',absorption:'衝撃吸収',fatal_poison:'致死毒',poison:'毒',wither:'衰弱',night_vision:'暗視',slow_falling:'低速落下'};
 const list=(fs)=>fs.map(x=>`${names[x.effect]??x.effect} ${x.level} : ${x.seconds}秒`).join('\n');
 let out=list(d.effects);
 if(d.special?.kind==='delayed')out+=`\n${d.special.delaySeconds}秒後：\n${list(d.special.effects)}`;
 if(d.special?.kind==='damage_first')out=`体力 -${d.special.damageHp}HP\n`+out;
 if(d.special?.kind==='choice'){
  const total=d.special.choices.reduce((n,x)=>n+x.weight,0);
  out+='\n'+d.special.choices.map(x=>`抽選 ${Math.round(x.weight/total*100)}%：\n${list(x.effects)}`).join('\n');
 }
 if(d.special?.kind==='sense')out+=`\n生物マーカー：半径${d.special.radius} / 0・3・6秒`;
 if(d.special?.kind==='spore_burst')out+=`\n半径${d.special.radius}のMob：\n${list(d.special.targetEffects)}`;
 return out||'特殊効果なし';
}
async function detail(player,d){
 const body={rawtext:[{text:`${d.id} / ${d.nameJa}\n${d.scientificName}\n${stars(d.rarity)}\n\n`},
  {text:d.useMode==='specimen'?'ゲーム内：研究標本（使用不可）\n':d.useMode==='crush'?'ゲーム内：握り潰して使用（食料ではない）\n':`ゲーム内：満腹度 ${d.food.nutrition}\n`},
  {text:'\n【ゲーム効果】\n'+effectsText(d)+'\n\n【科学解説】\n'},label(d,'science'),
  {text:'\n\n【ゲーム内表現】\n'},label(d,'game'),{text:'\n\n【鑑定士のひとこと】\n「'},label(d,'joke'),{text:'」\n\n'},tr('myco.warning')]};
 await new ActionFormData().title(d.nameJa).body(body).button('戻る',d.texturePath).show(player);
}
export async function encyclopedia(player){
 while(true){
  const c=counts(player),form=new ActionFormData().title(tr('myco.title')).body({rawtext:[{text:`発見 ${c.total}/${MUSHROOMS.length}\n\n`},tr('myco.warning')]})
   .button(`赤色キノコ ${c.red}/${MUSHROOMS.filter(x=>x.group==='red').length}`,'textures/items/mycology/r11')
   .button(`茶色キノコ ${c.brown}/${MUSHROOMS.filter(x=>x.group==='brown').length}`,'textures/items/mycology/b01').button('戻る');
  const result=await form.show(player);if(result.canceled||result.selection===2)return;
  const group=result.selection===0?'red':'brown';let page=0;
  const defs=MUSHROOMS.filter(x=>x.group===group),pages=Math.ceil(defs.length/10);
  while(true){
   const entries=defs.slice(page*10,page*10+10),actions=[];
   const list=new ActionFormData().title(`${group==='red'?'赤色':'茶色'}キノコ ${page+1}/${pages}`);
   for(const d of entries){const known=seen(player,d);list.button(known?`${d.id} ${d.nameJa}\n${stars(d.rarity)}`:`${d.id} ？？？？？`,known?d.texturePath:'textures/ui/mycology/unknown');actions.push(known?d.id:'unknown');}
   if(page>0){list.button('前のページ');actions.push('prev');}
   if(page+1<pages){list.button('次のページ');actions.push('next');}
   list.button('図鑑トップ');actions.push('back');
   const r=await list.show(player);if(r.canceled)break;
   const a=actions[r.selection];if(a==='back')break;if(a==='prev'){page--;continue;}if(a==='next'){page++;continue;}
   if(a==='unknown')continue;const d=BY_ID.get(a);if(d&&seen(player,d))await detail(player,d);
  }
 }
}
async function batchLoop(player,npcId,group){
 while(true){
  const npc=entityById(npcId);requireUsable(player,npc,true);
  const b=appraise(player,group,()=>requireUsable(player,entityById(npcId),true));
  const summary=[`鑑定数：${b.count}（スロット ${b.sourceSlot+1}）`,`新規発見：${b.fresh.length}種`,''];
  for(const r of [...b.results].sort((a,b)=>BY_ID.get(b.id).rarity-BY_ID.get(a.id).rarity||a.id.localeCompare(b.id))){
   const d=BY_ID.get(r.id);summary.push(`${b.fresh.includes(r.id)?'NEW ':''}${r.id} ${d.nameJa} ×${r.amount} / ★${d.rarity}`);
  }
  if(b.dropped)summary.push(`\n入りきらない ${b.dropped}個を足元に置きました。`);
  const r=await new ActionFormData().title('鑑定結果').body(summary.join('\n'))
   .button('もう1スタック鑑定').button('図鑑').button('戻る').show(player);
  if(r.canceled||r.selection===2)return;
  if(r.selection===1){await encyclopedia(player);return;}
 }
}
export async function openAppraiser(player,npc){
 if(sessions.has(player.id)||!canUse(player,npc,false))return;
 sessions.set(player.id,{npcId:npc.id,openedAt:Date.now()});
 try{
  recoverDelivery(player);
  while(true){
   requireUsable(player,entityById(npc.id),true);
   const red=owned(player,'red'),brown=owned(player,'brown'),c=counts(player);
   const result=await new ActionFormData().title('キノコ鑑定士').body(`図鑑 ${c.total}/${MUSHROOMS.length}\n最初の該当スタックを全量鑑定します。\n別スロットのキノコは合算しません。\n鑑定料：なし`)
    .button(`赤色キノコを1スタック鑑定\n今回 ${red.first?.amount??0} / 合計 ${red.total}`,'textures/items/mycology/r11')
    .button(`茶色キノコを1スタック鑑定\n今回 ${brown.first?.amount??0} / 合計 ${brown.total}`,'textures/items/mycology/b01')
    .button('キノコ図鑑','textures/ui/mycology/unknown').button('閉じる').show(player);
   if(result.canceled||result.selection===3)return;
   if(result.selection===2){await encyclopedia(player);continue;}
   await batchLoop(player,npc.id,result.selection===0?'red':'brown');
  }
 }catch(error){logError('appraiser form',error);tell(player,'§e'+(error?.message??'画面を開けませんでした。'));}
 finally{sessions.delete(player.id);}
}

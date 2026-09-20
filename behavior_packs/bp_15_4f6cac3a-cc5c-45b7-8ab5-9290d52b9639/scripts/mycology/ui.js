import { ActionFormData } from '@minecraft/server-ui';
import { ALL_FUNGI,BY_ID } from './registry.js';
import { counts,seen } from './progress.js';
import { appraise,owned,recoverDelivery } from './appraisal.js';
import { requireUsable,canUse } from './npc.js';
import { sessions } from './sessions.js';
import { rarityColor,rarityTier,stars,coloredSpecies,rarityHeadline,progressBar } from './rarity_ui.js';
import { revealAppraisal,revealPreferences,cycleRevealMode,toggleRevealSound } from './reveal.js';
import { entityById,tell,logError,tr } from './util.js';

function label(d,suffix){return tr(`myco.${d.id.toLowerCase()}.${suffix}`);}

function effectsText(d){
  const names={
    regeneration:'再生',darkness:'暗闇',nausea:'吐き気',haste:'採掘速度上昇',
    hunger:'空腹',speed:'移動速度上昇',jump_boost:'跳躍力上昇',resistance:'耐性',
    slowness:'移動速度低下',strength:'攻撃力上昇',weakness:'弱体化',
    mining_fatigue:'採掘速度低下',absorption:'衝撃吸収',fatal_poison:'致死毒',
    poison:'毒',wither:'衰弱',night_vision:'暗視',slow_falling:'低速落下'
  };
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
  if(d.id.startsWith('NF-')){
    const fields=[
      ['一般名',d.common_name],['分類',d.classification],
      ['概要',d.real_world_summary],['歴史',d.history_note],
      ['医薬史',d.drug_history],['構造・化合物',d.structure_compound]
    ].filter(([,value])=>value);
    await new ActionFormData()
      .title(`${rarityColor(d.rarity)}${d.nameJa}§r`)
      .body(`${d.scientificName}\n${stars(d.rarity)}\n\n`+fields.map(([name,value])=>`【${name}】\n${value}`).join('\n\n'))
      .button('戻る',d.texturePath)
      .show(player);
    return;
  }
  const body={rawtext:[
    {text:`${coloredSpecies(d)}\n${d.scientificName}\n${stars(d.rarity)}\n${rarityColor(d.rarity)}${rarityTier(d.rarity)}§r\n\n`},
    {text:d.useMode==='specimen'
      ?'ゲーム内：研究標本（使用不可）\n'
      :d.useMode==='crush'
        ?'ゲーム内：握り潰して使用（食料ではない）\n'
        :`ゲーム内：満腹度 ${d.food.nutrition}\n`
    },
    {text:'\n【ゲーム効果】\n'+effectsText(d)+'\n\n【科学解説】\n'},
    label(d,'science'),
    {text:'\n\n【ゲーム内表現】\n'},
    label(d,'game'),
    {text:'\n\n【鑑定士のひとこと】\n「'},
    label(d,'joke'),
    {text:'」\n\n'},
    tr('myco.warning')
  ]};

  await new ActionFormData()
    .title(`${rarityColor(d.rarity)}${d.nameJa}§r`)
    .body(body)
    .button('戻る',d.texturePath)
    .show(player);
}

export async function encyclopedia(player){
  while(true){
    const c=counts(player);
    const form=new ActionFormData()
      .title(tr('myco.title'))
      .body({
        rawtext:[
          {text:
            `発見 §f${c.total}§7/${ALL_FUNGI.length}§r\n`+
            `${progressBar(c.total,ALL_FUNGI.length)}\n\n`
          },
          tr('myco.warning')
        ]
      })
    const categories=[
      ['red','§c赤色キノコ§r','textures/items/mycology/r11'],
      ['brown','§6茶色キノコ§r','textures/items/mycology/b01'],
      ['crimson','§4深紅ネザー菌§r','textures/items/mycology/nf/nf_001'],
      ['warped','§3歪んだネザー菌§r','textures/items/mycology/nf/nf_005']
    ];
    for(const [group,title,icon] of categories)
      form.button(`${title} ${c[group]}/${ALL_FUNGI.filter(x=>x.group===group).length}`,icon);
    form.button('戻る');

    const result=await form.show(player);
    if(result.canceled||result.selection===categories.length)return;

    const group=categories[result.selection][0];
    let page=0;
    const defs=ALL_FUNGI.filter(x=>x.group===group);
    const pages=Math.ceil(defs.length/10);

    while(true){
      const entries=defs.slice(page*10,page*10+10);
      const actions=[];
      const list=new ActionFormData()
        .title(`${categories.find(x=>x[0]===group)[1]} ${page+1}/${pages}`);

      for(const d of entries){
        const known=seen(player,d);
        list.button(
          known
            ? `${coloredSpecies(d)}\n${stars(d.rarity)}`
            : `§8${d.id} ？？？？？§r`,
          known?d.texturePath:'textures/ui/mycology/unknown'
        );
        actions.push(known?d.id:'unknown');
      }

      if(page>0){
        list.button('前のページ');
        actions.push('prev');
      }
      if(page+1<pages){
        list.button('次のページ');
        actions.push('next');
      }
      list.button('図鑑トップ');
      actions.push('back');

      const r=await list.show(player);
      if(r.canceled)break;

      const a=actions[r.selection];
      if(a==='back')break;
      if(a==='prev'){page--;continue;}
      if(a==='next'){page++;continue;}
      if(a==='unknown')continue;

      const d=BY_ID.get(a);
      if(d&&seen(player,d))await detail(player,d);
    }
  }
}

async function batchLoop(player,npcId,group){
  while(true){
    const npc=entityById(npcId);
    requireUsable(player,npc,true);

    /*
     * appraise() remains the single source of truth.
     * Do NOT insert awaits or animation between its validation/commit steps.
     * UI presentation starts only after the result is fully committed.
     */
    const b=appraise(
      player,
      group,
      ()=>requireUsable(player,entityById(npcId),true)
    );

    const sorted=[...b.results].sort(
      (a,b)=>BY_ID.get(b.id).rarity-BY_ID.get(a.id).rarity||a.id.localeCompare(b.id)
    );
    const top=BY_ID.get(sorted[0].id);
    const c=counts(player);
    const beforeTotal=Math.max(0,c.total-b.fresh.length);

    const summary=[];

    if(b.count===64){
      summary.push('§6§l🔥 MAX STACK / 64連 🔥§r');
      summary.push('');
    }

    summary.push(rarityHeadline(top));
    summary.push(`${rarityColor(top.rarity)}${top.nameJa}§r ×${sorted[0].amount}`);
    summary.push(stars(top.rarity));
    summary.push('');

    summary.push(`最高レア：${rarityColor(top.rarity)}★${top.rarity} ${rarityTier(top.rarity)}§r`);
    summary.push(`新規発見：${b.fresh.length?`§e§l${b.fresh.length}種§r`:'0種'}`);
    summary.push(`図鑑：${beforeTotal} → §a${c.total}§r / ${ALL_FUNGI.length}`);
    summary.push(progressBar(c.total,ALL_FUNGI.length));
    summary.push('');
    summary.push('§8──────── 鑑定内訳 ────────§r');

    for(const r of sorted){
      const d=BY_ID.get(r.id);
      const isFresh=b.fresh.includes(r.id);
      summary.push(
        `${isFresh?'§e§lNEW!§r ':''}`+
        `${coloredSpecies(d)} ×${r.amount}  ${stars(d.rarity)}`
      );
    }

    if(b.dropped){
      summary.push('');
      summary.push(`§e入りきらない ${b.dropped}個を足元に置きました。§r`);
    }

    const presentation=await revealAppraisal(player,b,sorted);
    if(presentation==='aborted')return 'aborted';

    const next=owned(player,group);
    const nextAmount=next.first?.amount??0;
    const form=new ActionFormData()
      .title(`${rarityColor(top.rarity)}${b.count}連 鑑定結果§r`)
      .body(summary.join('\n'));

    if(nextAmount>0){
      form.button(
        nextAmount===64
          ? '§6§l🔥 もう64連 / MAX STACK 🔥§r'
          : `もう${nextAmount}連鑑定`
      );
    }else{
      form.button('鑑定メニューへ戻る');
    }

    form.button('§aキノコ図鑑§r');
    form.button('戻る');

    const r=await form.show(player);
    if(r.canceled||r.selection===2)return;

    if(r.selection===1){
      await encyclopedia(player);
      return;
    }

    if(r.selection===0&&nextAmount===0)return;
  }
}

function appraisalButton(group,info){
  const amount=info.first?.amount??0;
  const total=info.total;
  const labels={red:'§c赤色キノコ',brown:'§6茶色キノコ',crimson:'§4深紅ネザー菌',warped:'§3歪んだネザー菌'};
  const label=labels[group];
  return amount===64
    ? `${label} §lMAX STACK§r\n64連鑑定 / 所持 ${total}`
    : `${label}を${amount}連鑑定§r\n今回 ${amount} / 合計 ${total}`;
}

export async function openAppraiser(player,npc){
  if(sessions.has(player.id)||!canUse(player,npc,false))return;
  const session={npcId:npc.id,openedAt:Date.now()};
  sessions.set(player.id,session);

  try{
    recoverDelivery(player);

    while(true){
      requireUsable(player,entityById(npc.id),true);

      const groups=[
        ['red','textures/items/mycology/r11'],
        ['brown','textures/items/mycology/b01'],
        ['crimson','textures/items/mycology/nf/nf_001'],
        ['warped','textures/items/mycology/nf/nf_005']
      ];
      const holdings=Object.fromEntries(groups.map(([group])=>[group,owned(player,group)]));
      const c=counts(player);

      const prefs=revealPreferences(player);
      const form=new ActionFormData()
        .title('§2§lキノコ鑑定士§r')
        .body(
          `図鑑 §a${c.total}§r/${ALL_FUNGI.length}\n`+
          `${progressBar(c.total,ALL_FUNGI.length)}\n\n`+
          '最初の該当スタックを全量鑑定します。\n'+
          '別スロットのキノコは合算しません。\n'+
          '鑑定料：§aなし§r'
        )
      for(const [group,icon] of groups)form.button(appraisalButton(group,holdings[group]),icon);
      form.button('§aキノコ図鑑§r','textures/ui/mycology/unknown')
        .button('閉じる')
        .button(`演出：${{full:'じっくり',quick:'短縮',off:'OFF'}[prefs.mode]}\n押して切替 / しゃがみでスキップ`)
        .button(`サウンド：${prefs.sound?'ON':'OFF'}\n鑑定した自分だけに再生`);
      const result=await form.show(player);

      if(result.canceled||result.selection===5)return;

      if(result.selection===6){cycleRevealMode(player);continue;}
      if(result.selection===7){toggleRevealSound(player);continue;}

      if(result.selection===4){
        await encyclopedia(player);
        continue;
      }

      const outcome=await batchLoop(
        player,
        npc.id,
        groups[result.selection][0]
      );
      if(outcome==='aborted')return;
    }
  }catch(error){
    logError('appraiser form',error);
    tell(player,'§e'+(error?.message??'画面を開けませんでした。')+'§r');
  }finally{
    if(sessions.get(player.id)===session)sessions.delete(player.id);
  }
}

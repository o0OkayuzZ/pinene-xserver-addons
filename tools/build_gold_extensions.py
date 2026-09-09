from pathlib import Path
import json,collections,hashlib,shutil
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parents[1];D=R/'docs/golden_extensions';S=D/'stage'
B=R/'behavior_packs/bp_02_ef6e99cf-077d-4b55-9e11-f86bb9e66880'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
shutil.copyfile(Path.home()/'.codex/attachments/0d590710-b545-47d2-bcb9-97cf15558ea6/pasted-text.txt',D/'REQUEST.md')
items=[('gegg','金の卵','golden_egg','minecraft:egg',False),('egegg','エンチャントされた金の卵','golden_egg','a:gegg',True),('gchorus_fruit','金のコーラスフルーツ','golden_chorus_fruit','minecraft:chorus_fruit',False),('egchorus_fruit','エンチャントされた金のコーラスフルーツ','golden_chorus_fruit','a:gchorus_fruit',True)]
for ident,name,tex,ingredient,enchanted in items:
 c={'minecraft:display_name':{'value':name},'minecraft:icon':'pinene_golden_foods_'+tex,'minecraft:max_stack_size':16 if 'egg' in ident else 64,'pinene:golden_extension_use':{}}
 if enchanted:c['minecraft:glint']=True
 write(S/'bp/items'/f'{ident}.json',{'format_version':'1.21.90','minecraft:item':{'description':{'identifier':'a:'+ident,'menu_category':{'category':'items'}},'components':c}})
 write(S/'bp/recipes'/f'golden_extension_{ident}.json',{'format_version':'1.20.10','minecraft:recipe_shaped':{'description':{'identifier':'pinene:golden_extension_'+ident},'tags':['crafting_table'],'pattern':['GGG','GIG','GGG'],'key':{'G':{'item':'minecraft:gold_block' if enchanted else 'minecraft:gold_ingot'},'I':{'item':ingredient}},'result':{'item':'a:'+ident,'count':1},'unlock':[{'item':ingredient}]}})
for enhanced in [False,True]:
 ident='pinene:'+('enchanted_' if enhanced else '')+'golden_egg_projectile'
 entity={'format_version':'1.21.0','minecraft:entity':{'description':{'identifier':ident,'is_spawnable':False,'is_summonable':True,'is_experimental':False},'component_groups':{'pinene:expire':{'minecraft:instant_despawn':{}}},'components':{
  'minecraft:collision_box':{'width':.25,'height':.25},'minecraft:physics':{'has_collision':True,'has_gravity':not enhanced},
  'minecraft:projectile':{'power':1.5,'gravity':0 if enhanced else .03,'inertia':1 if enhanced else .99,'liquid_inertia':1 if enhanced else .8,'shoot_target':False,'reflect_on_hurt':False,'should_bounce':'no','on_hit':{'impact_damage':{'damage':0,'knockback':False,'destroy_on_hit':False,'power_multiplier':0}}},
  'minecraft:timer':{'time':20,'looping':False,'time_down_event':{'event':'pinene:expire','target':'self'}}},'events':{'pinene:expire':{'add':{'component_groups':['pinene:expire']}}}}}
 write(S/'bp/entities'/(ident.split(':')[1]+'.json'),entity)
 client={'format_version':'1.10.0','minecraft:client_entity':{'description':{'identifier':ident,'materials':{'default':'egg'},'textures':{'default':'textures/pinene_golden_foods/golden_egg'},'geometry':{'default':'geometry.item_sprite'},'render_controllers':['controller.render.item_sprite'],'animations':{'flying':'animation.actor.billboard'},'scripts':{'animate':['flying']}}}}
 write(S/'rp/entity'/(ident.split(':')[1]+'.entity.json'),client)
# Use only the existing softened vanilla gold mapping; do not rebuild old assets.
prov=read(R/'docs/golden_foods/texture_provenance.json')
src=Path(prov['reference_sources']['apple']['path']).parent
apple=Image.open(src/'apple.png').convert('RGBA');gold=Image.open(src/'apple_golden.png').convert('RGBA')
counts=collections.Counter(g[:3] for a,g in zip(apple.get_flattened_data(),gold.get_flattened_data()) if a[3] and g[3] and a[0]>a[1]*1.2 and a[0]>a[2]*1.2)
luma=lambda c:.2126*c[0]+.7152*c[1]+.0722*c[2]
palette=sorted(counts,key=luma);total=sum(counts.values())
def target(q):
 q=.12+.78*q;cum=0;previous=None
 for c in palette:
  center=(cum+counts[c]/2)/total
  if q<=center:
   if previous is None:return c
   old,oldcenter=previous;t=(q-oldcenter)/(center-oldcenter)
   return tuple(round(a+(b-a)*t) for a,b in zip(old,c))
  previous=(c,center);cum+=counts[c]
 return palette[-1]
preview=Image.new('RGBA',(420,180),(44,44,44,255));draw=ImageDraw.Draw(preview);textures={}
for row,(base,name) in enumerate([('egg','golden_egg'),('chorus_fruit','golden_chorus_fruit')]):
 original=Image.open(src/(base+'.png')).convert('RGBA');hist=collections.Counter(c[:3] for c in original.get_flattened_data() if c[3]);n=sum(hist.values());mapping={};cum=0
 for rgb in sorted(hist,key=luma):mapping[rgb]=target((cum+hist[rgb]/2)/n);cum+=hist[rgb]
 result=original.copy();result.putdata([(*mapping[c[:3]],c[3]) if c[3] else c for c in original.get_flattened_data()])
 assert original.size==result.size==(16,16) and original.getchannel('A').tobytes()==result.getchannel('A').tobytes()
 path=S/'rp/textures/pinene_golden_foods'/(name+'.png');path.parent.mkdir(parents=True,exist_ok=True);result.save(path)
 textures[name]={'source':str(src/(base+'.png')),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'size':[16,16],'alpha_preserved':True,'method':'existing softened vanilla gold palette, luminance-weighted quantile 0.12..0.90; interpolate reference tones to retain original shading levels'}
 for col,img in enumerate([original,result]):preview.alpha_composite(img.resize((64,64),Image.Resampling.NEAREST),(col*85,row*85+5))
 draw.text((180,row*85+25),name,fill='white')
preview.save(D/'texture_preview.png');write(D/'texture_validation.json',textures)
guide={}
for ident,name,tex,ingredient,enchanted in items:
 egg='egg' in ident
 body=('卵タンパク質は必須アミノ酸を含みます。ロイシンなどはmTORC1を介する筋タンパク質合成の調節に関与します。卵のコリンはリン脂質やアセチルコリンの材料になります。\n\nこれを遠隔で届ける「アミノ酸パルス」として表現しました。投げて即座に回復・筋力が増すことはゲーム上の誇張です。' if egg else 'コーラスは架空植物です。実在する生理作用は設定しません。\n現在位置 p=(x,y,z)、視線方向の単位ベクトル v、距離 d とすると、目標位置は p\'=p+dv。Raycastとプレイヤーの体積を使う衝突判定で、壁を越えない安全地点を選びます。\n相対座標 ~ は入力画面を開いた時の現在座標、~100 はそこから+100を意味します。')
 effects=(('再生能力 II：20秒\n攻撃力上昇 II：90秒\n満腹度・隠し満腹度：大回復（満腹 IIの上位設定）\n追尾補助：32ブロック・照準20度・最大6度/tick' if enchanted else '再生能力 II：8秒\n攻撃力上昇 I：60秒\n満腹度・隠し満腹度：小回復')+'\nプレイヤー直撃のみ。敵も強化されます。\nダメージ0・孵化なし・食べられません。' if egg else ('通常使用：最大64ブロック（エンド96）\nスニーク使用：視線・照準・座標・アンカー確認\n座標指定：通常256／エンド1024ブロック\nエンドの安全地点から成功時：ヴォイド・アンカー60秒、奈落落下時に1回帰還。' if enchanted else '通常使用：視線方向へ最大24ブロック。')+'\n同じディメンション内のみ。壁・低い天井・危険な足場・未読込領域を避けます。\n安全地点がなければ不発・非消費。成功時に1個消費。')
 guide['a:'+ident]={'name':name,'icon':'textures/pinene_golden_foods/'+tex,'extensionBody':('アミノ酸パルス' if egg else 'ベクトル・ブリンク')+'\n\n'+body+'\n\nゲーム効果：\n'+effects}
gp=S/'bp/scripts/golden_extensions/guide_data.js';gp.write_text('export const EXTENSION_GUIDE = '+json.dumps(guide,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
main=(B/'scripts/golden_foods/main.js').read_text(encoding='utf-8')
if 'golden_extensions/runtime.js' not in main:main='import { useExtension } from "../golden_extensions/runtime.js";\n'+main
needle='system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {'
main=main.replace(needle,needle+'\n  itemComponentRegistry.registerCustomComponent("pinene:golden_extension_use", { onUse: useExtension });')
p=S/'bp/scripts/golden_foods/main.js';p.parent.mkdir(parents=True,exist_ok=True);p.write_text(main,encoding='utf-8')
ui=(B/'scripts/golden_foods/guide.js').read_text(encoding='utf-8')
ui='import { EXTENSION_GUIDE } from "../golden_extensions/guide_data.js";\n'+ui
ui=ui.replace('Object.entries(FOODS).filter','Object.entries({ ...FOODS, ...EXTENSION_GUIDE }).filter')
ui=ui.replace('      const science = SCIENCE.families[food.family];','      if (food.extensionBody) {\n        const detail = await new ActionFormData().title(food.name).body(food.extensionBody).button("一覧へ戻る").show(player);\n        if (detail.canceled) break;\n        continue;\n      }\n      const science = SCIENCE.families[food.family];')
(S/'bp/scripts/golden_foods/guide.js').write_text(ui,encoding='utf-8')
write(D/'settings.json',{'items':['a:'+i[0] for i in items],'projectiles':['pinene:golden_egg_projectile','pinene:enchanted_golden_egg_projectile'],'homing':{'range':32,'cone_degrees':20,'max_turn_degrees_per_tick':6,'speed':1.5,'lifetime_ticks':400},'blink':{'gold':24,'enchanted':64,'enchanted_end':96},'coordinates':{'overworld':256,'nether':256,'end':1024},'anchor_seconds':60,'egg_refill':{'method':'native saturation effect, one tick, food and saturation capped by engine','gold_amplifier':1,'enchanted_amplifier':5}})
print('STAGED four items/recipes, two projectiles, two vanilla-derived textures, extension runtime and four guide entries')

import json
from pathlib import Path
R=Path(__file__).resolve().parents[1]
B=R/'behavior_packs/bp_02_ef6e99cf-077d-4b55-9e11-f86bb9e66880'
S=R/'docs/golden_foods/legacy_food_stage'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,d):
 p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def jsread(n):return json.loads((B/'scripts/golden_foods'/n).read_text(encoding='utf-8').split('=',1)[1].strip().rstrip(';'))
foods=jsread('data.js');science=jsread('science_ja.js')
effect=lambda i,a,s:dict(id=i,amplifier=a,seconds=s)
definitions=[
 ('astew','リンゴシチュー','apple_stew','normal',4,0.6,[], 'astew'),
 ('gstew','金のリンゴシチュー','apple_stew','golden',8,1.0,[effect('regeneration',1,15)],'gstew'),
 ('estew','エンチャントされた金のリンゴシチュー','apple_stew','enchanted',16,1.0,[effect('regeneration',1,30),effect('absorption',1,120)],'gstew'),
 ('gmbucket','金のミルク','milk','golden',4,0.6,[effect('regeneration',0,10),effect('absorption',0,120)],'gmbucket'),
 ('egmbucket','エンチャントされた金のミルク','milk','enchanted',8,1.0,[effect('regeneration',1,20),effect('absorption',1,180)],'gmbucket')]
for ident,name,family,tier,nut,sat,effects,tex in definitions:
 milk=family=='milk';container='minecraft:bucket' if milk else 'minecraft:bowl'
 food=dict(nutrition=nut,saturation_modifier=sat,can_always_eat=tier!='normal',use_duration_s=1.6)
 foods['a:'+ident]=dict(name=name,family=family,tier=tier,food=food,effects=effects,features=[],icon='textures/pinene_golden_foods/'+tex,container_note='飲み終わるとバケツが戻ります。通常の牛乳の状態異常解除はありません。' if milk else '食べ終わるとボウルが戻ります。')
 c={'minecraft:display_name':{'value':name},'minecraft:icon':'pinene_golden_foods_'+tex,'minecraft:max_stack_size':1,'minecraft:food':dict(nutrition=nut,saturation_modifier=sat,can_always_eat=tier!='normal',using_converts_to=container),'minecraft:use_modifiers':dict(use_duration=1.6,movement_modifier=0.35),'minecraft:use_animation':'drink' if milk else 'eat','pinene:golden_food_consume':{}}
 if tier=='enchanted':c['minecraft:glint']=True
 write(S/'bp/items'/f'{ident}.json',{'format_version':'1.21.90','minecraft:item':{'description':{'identifier':'a:'+ident,'menu_category':{'category':'items'}},'components':c}})
science['families']['milk']={
 'title_gold':'乳たんぱく質と修復','title_enchanted':'修復と栄養の備え',
 'body':'牛乳の主なたんぱく質はカゼインとホエイです。消化で生じるアミノ酸は、体のたんぱく質を合成・維持する材料になります。乳たんぱく質の摂取と運動後の筋たんぱく質合成の関係も研究されています。',
 'design':'修復の材料を補給する働きを再生能力に、栄養を備えるイメージを衝撃吸収に対応させました。金版は小さな回復と備え、エンチャント版はその強化です。',
 'caveat':'飲んですぐ傷が治ったり、衝撃を防いだりするわけではありません。効果の強さ・秒数はゲーム用の調整値です。',
 'sources':['https://ncbi.nlm.nih.gov/mesh/68008894','https://pubmed.ncbi.nlm.nih.gov/26354539/']}
science['families']['apple_stew']={
 'title_gold':'糖質による回復支援','title_enchanted':'回復とエネルギーの備え',
 'body':'リンゴの糖類は代謝され、ATPを作るためのエネルギー源になります。果肉の細胞壁にはペクチンなどの食物繊維も含まれます。糖類と食物繊維は役割が異なり、ペクチンそのものが傷を治すという意味ではありません。',
 'design':'糖質のエネルギー補給を題材に、金版は再生能力に集中させました。エンチャント版は回復時間と衝撃吸収を追加し、移動・採掘を補助する金のパンと役割を分けています。通常のリンゴシチューは満腹度回復のみです。',
 'caveat':'再生能力や追加の体力はゲーム上の表現です。煮ることや金を加えることで、現実の治癒能力が高まるという意味ではありません。',
 'sources':['https://newsinhealth.nih.gov/2023/08/breaking-down-food','https://www.ars.usda.gov/ARSUserFiles/60701000/Pickle%20Pubs/p274.pdf']}
for n,var,data in [('data.js','FOODS',foods),('science_ja.js','SCIENCE',science)]:
 p=S/'bp/scripts/golden_foods'/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_text('export const '+var+' = '+json.dumps(data,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
guide=(B/'scripts/golden_foods/guide.js').read_text(encoding='utf-8')
guide=guide.replace('science.body, "", "ゲーム効果：", effects, "",','science.body, "", ...(science.design ? ["能力の考察：", science.design, ""] : []), "ゲーム効果：", effects, ...(food.container_note ? [food.container_note] : []), "",')
(S/'bp/scripts/golden_foods/guide.js').write_text(guide,encoding='utf-8')
# Independent namespaced atlas keys prevent old language/atlas fallback problems.
oldrp=R/'resource_packs/rp_02_3d6a685e-83f1-4a8a-b6a6-27d8d9a3db7a'
for tex in ['astew','gstew','gmbucket']:
 p=S/'rp/textures/pinene_golden_foods'/f'{tex}.png';p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((oldrp/'textures'/f'{tex}.png').read_bytes())
# The standalone world has no cow pack: provide the same normal -> gold -> enchanted progression.
for base,out,metal in [('a:astew','a:gstew','minecraft:gold_ingot'),('a:gstew','a:estew','minecraft:gold_block'),('minecraft:milk_bucket','a:gmbucket','minecraft:gold_ingot'),('a:gmbucket','a:egmbucket','minecraft:gold_block')]:
 n='golden_foods_legacy_'+out.split(':')[1]
 write(S/'bp/recipes'/f'{n}.json',{'format_version':'1.20.10','minecraft:recipe_shaped':{'description':{'identifier':'pinene:'+n},'tags':['crafting_table'],'pattern':['GGG','GFG','GGG'],'key':{'G':{'item':metal},'F':{'item':base}},'result':{'item':out,'count':1},'unlock':[{'item':base}]}})
write(S/'bp/recipes/golden_foods_legacy_astew.json',{'format_version':'1.20.10','minecraft:recipe_shapeless':{'description':{'identifier':'pinene:golden_foods_legacy_astew'},'tags':['crafting_table'],'ingredients':[{'item':'minecraft:apple'},{'item':'minecraft:bowl'}],'result':{'item':'a:astew','count':1},'unlock':[{'item':'minecraft:apple'}]}})
write(S/'review.json',{'items':[{'id':'a:'+i,'name':n,'effects':e} for i,n,f,t,nu,sa,e,te in definitions],'science':{k:science['families'][k] for k in ['milk','apple_stew']}})
print('STAGED: 5 Japanese items, 5 recipes, 19 guide entries, 2 science families, 3 existing textures')

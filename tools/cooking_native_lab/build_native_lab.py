"""Build an isolated native-crafting proof; never patch existing cooking packs."""
from __future__ import annotations
import argparse, hashlib, json, pathlib, shutil, struct, tempfile, unittest, uuid, zipfile

VERSION = [0, 1, 0]
NS = 'pinene_ui_lab'
TAG = 'pinene_ui_lab_workbench'
BP_UUID = 'e4cda620-778d-407e-a28c-fba2bd818102'
RP_UUID = '0f33ebf9-c36d-42e1-9c48-51938a5e9ac3'
SOURCE_RP_UUID = 'c81a6798-b6b1-4716-a514-c49967ad0ee2'
IDS = ['wheat', 'seed', 'bottle', 'whole_cheese', 'noodles', 'cheese', 'oil']
NAMES = ['小麦', '種', '空瓶', 'ホールチーズ', '麺', 'チーズ', '調理油']
RUNTIME = r'''import { world, system, GameMode } from "@minecraft/server";
// Read-only diagnostics: native Minecraft owns ALL transfers and crafting.
const NS = "pinene_ui_lab:";
const IDS = ["wheat", "seed", "bottle", "whole_cheese", "noodles", "cheese", "oil"];
const baselines = new Map();
function emit(player, event, data) {
  console.warn("[pinene_native_lab] " + JSON.stringify({ event, player: player.id, ...data }));
}
function weights(c) {
  return { wheat: c.wheat + 3 * c.noodles, dairy: 4 * c.whole_cheese + c.cheese,
    seed: c.seed + 8 * c.oil, bottle: c.bottle + c.oil };
}
function snapshot(player, origin) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) throw new Error("inventory_unavailable");
  const counts = Object.fromEntries(IDS.map(id => [id, 0]));
  const other = {};
  const add = (stack) => {
    if (!stack) return;
    const key = stack.typeId.startsWith(NS) ? stack.typeId.slice(NS.length) : "";
    if (Object.prototype.hasOwnProperty.call(counts, key)) counts[key] += stack.amount;
    else other[stack.typeId] = (other[stack.typeId] ?? 0) + stack.amount;
  };
  for (let i = 0; i < inv.size; i++) add(inv.getItem(i));
  // Include nearby dropped remainders after closing a full crafting inventory.
  let drops = 0;
  for (const e of player.dimension.getEntities({ type: "minecraft:item", location: origin, maxDistance: 8 })) {
    const stack = e.getComponent("minecraft:item")?.itemStack;
    if (stack) { add(stack); drops++; }
  }
  return { counts, weights: weights(counts), other, drops };
}
function same(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every(k => (a[k] ?? 0) === (b[k] ?? 0));
}
system.afterEvents.scriptEventReceive.subscribe(event => {
  if (!event.id.startsWith(NS)) return;
  const player = /** @type {import("@minecraft/server").Player | undefined} */ (event.sourceEntity);
  if (!player || player.typeId !== "minecraft:player") return;
  const command = event.id.slice(NS.length);
  if (!["baseline", "check", "reset"].includes(command)) return;
  system.run(() => {
    try {
      if (!player.isValid) return;
      if (command === "reset") { baselines.delete(player.id); player.sendMessage("試験記録を解除しました。所持品は変更していません。"); return; }
      if (world.getAllPlayers().length !== 1 || player.getGameMode() !== GameMode.Survival) {
        player.sendMessage("判定保留：単独の試験ワールド・サバイバルで実行してください。"); return;
      }
      if (command === "baseline") {
        const origin = { ...player.location };
        const data = snapshot(player, origin);
        baselines.set(player.id, { dimension: player.dimension.id, origin, data });
        emit(player, "baseline", data);
        player.sendMessage("試験の初期個数を記録しました。試験台で作成後、画面を閉じて check を実行してください。");
        return;
      }
      const base = baselines.get(player.id);
      if (!base) { player.sendMessage("先に /scriptevent pinene_ui_lab:baseline run を実行してください。"); return; }
      const p = player.location, o = base.origin;
      if (player.dimension.id !== base.dimension || (p.x-o.x)**2+(p.y-o.y)**2+(p.z-o.z)**2 > 16) {
        player.sendMessage("判定保留：記録地点の4ブロック以内に戻ってください。"); return;
      }
      const data = snapshot(player, base.origin);
      const materialsOK = same(base.data.weights, data.weights);
      const otherCountsOK = same(base.data.other, data.other);
      emit(player, "sampled_balance", { materialsOK, otherCountsOK, before: base.data, after: data });
      player.sendMessage((materialsOK && otherCountsOK ? "§a個数整合OK" : "§c個数に差あり：ログを確認") +
        "§r（所持品＋記録地点8ブロック内の落下品のみ。全動作の合格判定ではありません）");
    } catch (error) { emit(player, "diagnostic_error", { error: String(error) }); }
  });
});
world.afterEvents.playerLeave.subscribe(({ playerId }) => baselines.delete(playerId));
system.run(() => console.warn("[pinene_native_lab] read-only diagnostics ready; no GUI or inventory writes"));
'''
README = '''# Pinene Native Cooking Lab v1 / 専用料理台・基礎検証

これは完成版の料理UIではありません。成功したCustomForm版を残し、
ゲーム標準の作業台で「画面を閉じない選択・連続クラフト」と本物の所持品表示を検証します。

## 独立性
- 新規UUIDのBP/RPのみ。既存の料理パック、main、Xserver、ワールド登録を変更しません。
- ui/*.json の上書きなし。通常の作業台・チェストを作り替えません。
- 全材料・出力は pinene_ui_lab: 名前空間の試験専用アイテムです。実際の料理には使えません。
- 本体の minecraft:crafting_table が材料消費と出力移動を処理します。
- 診断スクリプトは読み取り専用。アイテムをGUIボタンに見立てる処理、回収・補充処理はありません。
- ナイフ耐久、Rank制限、8タブ、独自の配置は未実装。既存料理にこのまま置き換えてはいけません。

## 最初の実機確認
1. 新しい空の試験ワールドを作り、Pinene Native Cooking Lab BP/RPだけを有効化します。
   チートON。実験トグルは不要です。いつもの開発ワールドや本番には追加しないでください。
2. クリエイティブで安全な地面に試験台を置きます。
   /give @s pinene_ui_lab:workbench
   空きのある所持品で /function pinene_ui_lab/kit を実行します。
   キットは初回だけ。追加投入後は初期個数を記録し直します。
3. /gamemode survival としてから /scriptevent pinene_ui_lab:baseline run を実行。
   試験台を空手で開き、左のレシピ選択と連続クラフトを確認します。
   画面を閉じ、/scriptevent pinene_ui_lab:check run を実行します。

## レシピ（全て試験専用）
- 試験小麦3個を縦一列 → 試験麺1個
- 試験ホールチーズ1個 → 試験チーズ4個
- 試験種8個で試験空瓶を囲む → 試験調理油1個

## 合格条件・未検証項目
- 見た目: レシピブック、3x3、完成品、実際の27+9所持品枠が表示される。
- 操作: レシピを何度も選ぶ、連続作成、Shift操作をしても画面が閉じない。
- 消費: 上記比率を守る。途中閉鎖で未消費材料が戻る。満杯時に消失/増殖しない。
- 標準作業台には試験レシピが出ない。試験台には通常レシピが混ざらない。
- 異なるプレイヤーで同じ試験台を開いたときにクラフト枠が干渉しない。
- 再接続、切断、死亡、カーソルにアイテムを持った状態、モバイル/パッドは追加検証。

個数検査は単独サバイバルで、画面を閉じてカーソルから品物を戻して実施。
記録地点8ブロック内の落下品を数えます。ホッパーや動物、他プレイヤーのない場所で。
範囲外に落ちた品物・未返却カーソル・別容器・追加キットは判定を不確かにします。
個数整合OKはその一回の観測範囲の検査であり、メタデータ保持や全状況の安全性を証明しません。

## 元に戻す
このパックを使うのは使い捨て試験ワールドだけです。確認後そのワールドで無効化します。
既存の料理画面・CustomForm版は無変更なので、そのまま使えます。

## 根拠と次の判断
Microsoft Learn minecraft:crafting_table (stable):
https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_crafting_table?view=minecraft-bedrock-stable
Microsoft Learn BlockInventoryComponent:
https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/blockinventorycomponent?view=minecraft-bedrock-stable
Mojang bedrock-samples 46ba6ea985fb5a92d79a9419198f10dda14c199d:
resource_pack/ui/data_driven_container_screen.json
metadata/json_schemas/server/block/1.26.20/container.json

container.json とコンテナ画面の存在だけでは、自由なボタン操作や安全な取り出し拒否の公開APIは確認できません。
そのため今回の実装は、確認できた専用作業台コンポーネントを使います。
この試験に合格しても、Rank/ナイフの連携とプレビュー配置の再現は別の合格条件です。
'''

def encode(obj):
    return (json.dumps(obj, ensure_ascii=False, indent=2) + '\n').encode('utf-8')

def manifest(kind):
    bp = kind == 'BP'
    modules = [{'type': 'data' if bp else 'resources', 'uuid': str(uuid.uuid5(uuid.UUID(BP_UUID if bp else RP_UUID), 'module')), 'version': VERSION}]
    if bp:
        modules.append({'type':'script','language':'javascript','uuid':'9cdc16e0-bb48-43a6-b9a1-a7d886fd7a84','entry':'scripts/main.js','version':VERSION})
    d = {'format_version':2,'header':{'name':f'Pinene Native Cooking Lab {kind}','description':'Isolated native crafting proof. Not the production cooking UI.','uuid':BP_UUID if bp else RP_UUID,'version':VERSION,'min_engine_version':[1,21,90]},'modules':modules}
    if bp: d['dependencies'] = [{'uuid':RP_UUID,'version':VERSION},{'module_name':'@minecraft/server','version':'2.7.0'}]
    return d

def recipes():
    def wrap(name, body):
        body.update(description={'identifier':NS+':'+name}, tags=[TAG])
        return {'format_version':'1.20.10', 'minecraft:recipe_'+('shapeless' if 'ingredients' in body else 'shaped'):body}
    return {
      'noodles':wrap('noodles',{'pattern':['W','W','W'],'key':{'W':{'item':NS+':wheat'}},'result':{'item':NS+':noodles','count':1},'unlock':[{'item':NS+':wheat'}]}),
      'cheese':wrap('cheese',{'ingredients':[{'item':NS+':whole_cheese'}],'result':{'item':NS+':cheese','count':4},'unlock':[{'item':NS+':whole_cheese'}]}),
      'oil':wrap('oil',{'pattern':['SSS','SBS','SSS'],'key':{'S':{'item':NS+':seed'},'B':{'item':NS+':bottle'}},'result':{'item':NS+':oil','count':1},'unlock':[{'item':NS+':seed'}]})}

def definitions():
    f = {f'{k}/manifest.json':encode(manifest(k)) for k in ['BP','RP']}
    comp = {'minecraft:display_name':'tile.pinene_ui_lab:workbench.name','minecraft:geometry':'minecraft:geometry.full_block','minecraft:material_instances':{'*':{'texture':'pinene_ui_lab_side','render_method':'opaque'},'up':{'texture':'pinene_ui_lab_top','render_method':'opaque'},'north':{'texture':'pinene_ui_lab_front','render_method':'opaque'}},'minecraft:crafting_table':{'crafting_tags':[TAG],'table_name':'tile.pinene_ui_lab:workbench.name'},'minecraft:destructible_by_mining':{'seconds_to_destroy':1},'minecraft:destructible_by_explosion':False}
    f['BP/blocks/workbench.json'] = encode({'format_version':'1.21.90','minecraft:block':{'description':{'identifier':NS+':workbench','menu_category':{'category':'construction'}},'components':comp}})
    texture_map = {k:'textures/items/'+v for k,v in {'wheat':'wheat','seed':'seeds_wheat','bottle':'potion_bottle_empty'}.items()}
    texture_map.update({k:'textures/pinene_ui_lab/'+k for k in ['whole_cheese','noodles','cheese','oil']})
    for k in IDS:
        f['BP/items/'+k+'.json'] = encode({'format_version':'1.21.0','minecraft:item':{'description':{'identifier':NS+':'+k,'menu_category':{'category':'items'}},'components':{'minecraft:display_name':{'value':'item.'+NS+':'+k+'.name'},'minecraft:icon':NS+'_'+k,'minecraft:max_stack_size':64}}})
    f['RP/textures/item_texture.json'] = encode({'resource_pack_name':'pinene_ui_lab','texture_name':'atlas.items','texture_data':{NS+'_'+k:{'textures':v} for k,v in texture_map.items()}})
    f['RP/textures/terrain_texture.json'] = encode({'resource_pack_name':'pinene_ui_lab','texture_name':'atlas.terrain','padding':8,'num_mip_levels':4,'texture_data':{NS+'_'+k:{'textures':'textures/blocks/crafting_table_'+k} for k in ['side','top','front']}})
    f['RP/blocks.json'] = encode({'format_version':'1.1.0',NS+':workbench':{'sound':'wood'}})
    ja = ['tile.pinene_ui_lab:workbench.name=料理UI試験台（独立検証）']+[f'item.{NS}:{k}.name=［試験］{n}' for k,n in zip(IDS,NAMES)]
    en = ['tile.pinene_ui_lab:workbench.name=Native Cooking Lab (TEST)']+[f'item.{NS}:{k}.name=[TEST] {k.replace("_"," ")}' for k in IDS]
    for locale,lines in [('ja_JP',ja),('en_US',en)]: f['RP/texts/'+locale+'.lang']= ('\n'.join(lines)+'\n').encode('utf-8')
    f['RP/texts/languages.json'] = encode(['en_US','ja_JP'])
    f['BP/scripts/main.js'] = RUNTIME.encode('utf-8')
    f['BP/functions/pinene_ui_lab/kit.mcfunction'] = ('# Once, in an empty disposable test world. Never clears or replaces inventory.\n'+'\n'.join(f'give @s {NS}:{k} {n}' for k,n in [('wheat',48),('seed',32),('bottle',4),('whole_cheese',4)])+'\n').encode('utf-8')
    for k,v in recipes().items(): f['BP/recipes/'+k+'.json']=encode(v)
    return f

def png(data):
    if data[:8] != b'\x89PNG\r\n\x1a\n' or len(data) < 33: raise ValueError('Not a PNG')
    size=struct.unpack('>II',data[16:24])
    if size != (64,64): raise ValueError('Expected adopted 64x64 material texture; got '+str(size))
    return data

def build(source, output):
    if output.exists(): raise FileExistsError('Refusing to replace an existing build: '+str(output))
    f=definitions()
    for k in ['whole_cheese','noodles','cheese','oil']:
        f['RP/textures/pinene_ui_lab/'+k+'.png']=png((source/('cooking_oil.png' if k=='oil' else k+'.png')).read_bytes())
    output.mkdir(parents=True)
    for rel,data in f.items():
        dest=output/rel; dest.parent.mkdir(parents=True,exist_ok=True); dest.write_bytes(data)
    (output/'README_ja.md').write_text(README,encoding='utf-8')
    checks={p:hashlib.sha256(b).hexdigest() for p,b in f.items()}
    (output/'sha256.json').write_bytes(encode(checks))
    for k in ['BP','RP']:
        with zipfile.ZipFile(output/(k+'.mcpack'),'w',zipfile.ZIP_DEFLATED) as z:
            for rel,data in f.items():
                if rel.startswith(k+'/'): z.writestr(rel[len(k)+1:],data)
    with zipfile.ZipFile(output/'Pinene_Native_Cooking_Lab_v1.mcaddon','w',zipfile.ZIP_DEFLATED) as z:
        for k in ['BP','RP']: z.write(output/(k+'.mcpack'),k+'.mcpack')
    return checks

def locate_source(mojang):
    found=[]
    for p in (mojang/'development_resource_packs').glob('*/manifest.json'):
        try:
            if json.loads(p.read_text(encoding='utf-8-sig'))['header']['uuid']==SOURCE_RP_UUID: found.append(p.parent/'textures/items')
        except (ValueError,KeyError,OSError): continue
    if len(found)!=1: raise ValueError('Expected exactly one source Food RP UUID; got '+str(found))
    return found[0]

def install(output, mojang):
    changes={}
    for kind in ['BP','RP']:
        root=mojang/('development_behavior_packs' if kind=='BP' else 'development_resource_packs')
        dest=root/('Pinene_Native_Cooking_Lab_'+kind)
        if dest.exists(): raise FileExistsError('Refusing overwrite: '+str(dest))
        for p in root.glob('*/manifest.json'):
            try: uid=json.loads(p.read_text(encoding='utf-8-sig'))['header']['uuid']
            except (ValueError,KeyError,OSError): continue
            if uid==manifest(kind)['header']['uuid']: raise ValueError('Duplicate lab UUID: '+str(p))
        changes[kind]=dest
    created=[]
    try:
        for kind,dest in changes.items():
            dest.mkdir(parents=True, exist_ok=False)
            created.append(dest); shutil.copytree(output/kind,dest,dirs_exist_ok=True)
        for rel,expected in json.loads((output/'sha256.json').read_text()).items():
            kind,part=rel.split('/',1)
            if hashlib.sha256((changes[kind]/part).read_bytes()).hexdigest()!=expected: raise ValueError('Installed hash mismatch: '+rel)
    except Exception:
        for p in created:
            if p.exists(): shutil.rmtree(p)
        raise
    return {k:str(v) for k,v in changes.items()}

def main():
    a=argparse.ArgumentParser(description=__doc__)
    a.add_argument('--source-items',type=pathlib.Path); a.add_argument('--out',type=pathlib.Path)
    a.add_argument('--mojang',type=pathlib.Path); a.add_argument('--install',action='store_true')
    args=a.parse_args()
    if not args.out: a.error('--out is required')
    source=args.source_items or (locate_source(args.mojang) if args.mojang else None)
    if source is None: a.error('--source-items or --mojang required')
    if args.install and not args.mojang: a.error('--install needs --mojang')
    checks=build(source,args.out)
    result={'files':len(checks),'out':str(args.out),'engine_verified':False}
    if args.install: result['installed']=install(args.out,args.mojang)
    print(json.dumps(result,ensure_ascii=True))
if __name__=='__main__': main()

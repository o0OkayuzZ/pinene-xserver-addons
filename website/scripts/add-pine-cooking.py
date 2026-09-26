"""Add Pine Food + Cooking Tools to the public website registry. One-shot authoring helper."""
import json, re, shutil
from pathlib import Path

web = Path(__file__).resolve().parents[1]
repo = web.parent
bp_food = repo / "behavior_packs/bp_18_7e540260-69ce-4a82-951d-bc793e151cd5"
bp_tools = repo / "behavior_packs/bp_19_211f47f7-5f1d-4b02-a162-e7546cf3fdc4"
rp_food = repo / "resource_packs/rp_21_c81a6798-b6b1-4716-a514-c49967ad0ee2"
rp_tools = repo / "resource_packs/rp_22_392fe57f-87d4-4146-a8ba-5c548001ab45"
source_commit = "28cdffa4e569b313afe9491d0d3cd6a7fc416809"

def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))

def rel(path):
    return path.relative_to(repo).as_posix()

def evidence(paths):
    return {"commit": source_commit, "paths": [rel(p) for p in paths]}
def load_lang(path):
    out = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            out[key] = value
    return out

food_lang = load_lang(rp_food / "texts/ja_JP.lang")
tool_lang = load_lang(rp_tools / "texts/ja_JP.lang")

data_text = (bp_tools / "scripts/cooking_data.js").read_text(encoding="utf-8")
match = re.search(r"export const COOKING_RECIPES = (.*?);\s*export const", data_text, re.S)
assert match, "COOKING_RECIPES not found"
cooking = json.loads(match.group(1))
by_id = {x["id"]: x for x in cooking}

rank_label = {0: "素材", 1: "Rank I", 2: "Rank II", 3: "Rank III",
              4: "Rank IV", 5: "Rank V", 6: "Rank VI", 7: "Rank VII"}
field_path = web / "src/data/field-guide.json"
content_path = web / "src/data/content-registry.json"
pack_path = web / "src/data/pack-registry.json"
records = read(field_path)
contents = read(content_path)
packs = read(pack_path)

new_records = []
record_ids = {x["id"] for x in records}

def add_record(entry):
    assert entry["id"] not in record_ids, entry["id"]
    record_ids.add(entry["id"])
    new_records.append(entry)

def image_for(src, slug):
    dst = web / f"public/images/items/{slug}.png"
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dst)
    return {"src": f"/images/items/{slug}.png",
            "alt": "ゲーム内で使用するアイテムテクスチャ", "kind": "pack-texture"}

content_id = "pine-cooking"
assert not any(x["id"] == content_id for x in contents["contents"])
hero_src = rp_food / "textures/items/honey_bread.png"
hero_dst = web / "public/images/pine-cooking.png"
shutil.copyfile(hero_src, hero_dst)

contents["contents"].append({
    "id": content_id,
    "name": "Pine Cooking",
    "visibility": "public",
    "implementation": "implemented",
    "deployment": "repo-only",
    "category": ["craft", "systems"],
    "packBindings": [
        {"uuid": "7e540260-69ce-4a82-951d-bc793e151cd5", "roles": ["item-definition", "recipe"]},
        {"uuid": "211f47f7-5f1d-4b02-a162-e7546cf3fdc4", "roles": ["behavior", "item-definition", "runtime-script", "recipe"]},
        {"uuid": "c81a6798-b6b1-4716-a514-c49967ad0ee2", "roles": ["texture"]},
        {"uuid": "392fe57f-87d4-4146-a8ba-5c548001ab45", "roles": ["texture", "model", "shared-asset"]},
    ],
    "related": ["pancakes", "golden-foods"],
    "verification": [
        {"kind": "code", "result": "confirmed", "commit": source_commit},
        {"kind": "gameplay", "result": "unknown"},
        {"kind": "appearance", "result": "confirmed"},
    ],
    "summary": "まな板と調理ナイフで、Rank別の料理を作る専用クラフトシステム。",
    "description": "Pine Foodの30種類の料理・素材と、13種類のまな板、5種類の調理ナイフをまとめた料理システムです。料理は通常の作業台では作れず、まな板専用UIから選んでクラフトします。",
    "image": {"src": "/images/pine-cooking.png", "alt": "Pine Cookingのはちみつパン実テクスチャ", "kind": "placeholder"},
    "highlights": [
        "素材 / Rank I〜VIIで料理を分類",
        "料理はまな板専用UIからのみクラフト",
        "銅・鉄・金・ダイヤ・ネザライトで作成可能Rankが変化",
    ],
    "guide": "まな板に調理ナイフを置いて操作し、Rankを選択します。料理アイコンを選ぶと材料・完成品・説明が表示され、材料が揃っていればクラフトできます。",
    "children": [],
    "evidence": evidence([bp_food/"manifest.json", bp_tools/"manifest.json", rp_food/"manifest.json", rp_tools/"manifest.json"]),
})
for kind, path in [
    ("behavior", bp_food), ("behavior", bp_tools),
    ("resource", rp_food), ("resource", rp_tools),
]:
    manifest = read(path / "manifest.json")["header"]
    assert not any(x["uuid"] == manifest["uuid"] for x in packs["packs"])
    packs["packs"].append({
        "uuid": manifest["uuid"],
        "name": manifest["name"],
        "kind": kind,
        "version": ".".join(map(str, manifest["version"])),
        "registered": True,
        "visibility": "public",
    })

minecraft_names = {
    "minecraft:bread": "パン", "minecraft:honey_bottle": "ハチミツ入りの瓶",
    "minecraft:apple": "リンゴ", "minecraft:pumpkin": "カボチャ",
    "minecraft:carrot": "ニンジン", "minecraft:beetroot": "ビートルート",
    "minecraft:bowl": "ボウル", "minecraft:egg": "卵",
    "minecraft:cooked_beef": "ステーキ", "minecraft:cooked_chicken": "焼き鳥",
    "minecraft:cooked_porkchop": "焼き豚", "minecraft:baked_potato": "ベイクドポテト",
    "minecraft:red_mushroom": "赤キノコ", "minecraft:brown_mushroom": "茶キノコ",
    "minecraft:dried_kelp": "乾燥昆布", "minecraft:cooked_salmon": "焼き鮭",
    "minecraft:cooked_cod": "焼き鱈", "minecraft:sugar": "砂糖",
    "minecraft:wheat": "小麦", "minecraft:milk_bucket": "ミルク入りバケツ",
    "minecraft:glass_bottle": "ガラス瓶", "minecraft:cocoa_beans": "カカオ豆",
    "myname:pancake": "パンケーキ",
}
for item_id, rec in by_id.items():
    minecraft_names[item_id] = rec["name"]

def ingredient_name(item_id):
    return minecraft_names.get(item_id, item_id.split(":")[-1])

def item_entry(rec):
    stem = rec["id"].split(":", 1)[1]
    slug = "pine-food-" + stem.replace("_", "-")
    item_path = bp_food / f"items/{stem}.json"
    recipe_path = bp_food / f"recipes/{stem}.json"
    texture_path = rp_food / f"textures/items/{stem}.png"
    item_doc = read(item_path)["minecraft:item"]
    comps = item_doc.get("components", {})
    details = [f"分類：{rank_label[rec['rank']]}。"]
    if rec.get("nutrition") is not None:
        details += [
            f"満腹度の設定：{rec['nutrition']}。",
            f"飽和度係数の設定：{rec['saturation']}。",
        ]
    else:
        details.append("食料ではなく料理素材として定義されています。")
    details.append("料理説明はまな板UI上に表示され、アイテムLoreには追加されません。")
    image = image_for(texture_path, slug)
    add_record({
        "id": slug, "name": rec["name"], "kind": "item", "contentId": content_id,
        "summary": f"{rank_label[rec['rank']]}のPine Cookingアイテム。",
        "description": rec["description"],
        "usage": "食料は手に持って食べます。素材は上位料理の材料として使います。" if rec.get("nutrition") is not None else "まな板料理の材料として使います。",
        "obtaining": f"まな板で{rank_label[rec['rank']]}を選び、必要材料を揃えてクラフトします。",
        "details": details,
        "image": image,
        "recipe": None,
        "visibility": "public",
        "evidence": evidence([item_path, recipe_path, texture_path, bp_tools/"scripts/cooking_data.js"]),
    })

    recipe_doc = read(recipe_path)
    recipe_key = next(k for k in recipe_doc if k.startswith("minecraft:recipe_"))
    recipe_def = recipe_doc[recipe_key]
    grouped = {}
    for ingredient in recipe_def.get("ingredients", []):
        iid = ingredient["item"]
        grouped[iid] = grouped.get(iid, 0) + 1
    ingredients = [{"name": ingredient_name(iid), "count": count}
                   for iid, count in grouped.items()]
    recipe_slug = "craft-" + slug
    add_record({
        "id": recipe_slug, "name": rec["name"] + "のまな板レシピ",
        "kind": "recipe", "contentId": content_id,
        "summary": f"{rank_label[rec['rank']]}の{rec['name']}を、まな板で作るレシピ。",
        "description": "通常の作業台では表示・作成されない、Pine Cookingのまな板専用レシピです。",
        "usage": "対応Rankの調理ナイフをまな板に置き、専用UIから料理を選んでクラフトします。",
        "obtaining": "材料はプレイヤーのインベントリから消費されます。",
        "details": [
            f"必要Rank：{rank_label[rec['rank']]}。",
            "レシピタグは pinene_cutting_board のみです。",
            "ハチミツ瓶やミルクバケツは対応する空容器を返却する処理があります。",
        ],
        "image": image,
        "recipe": {
            "shaped": False,
            "grid": [],
            "ingredients": ingredients,
            "resultId": slug,
            "count": rec.get("resultCount", 1),
        },
        "visibility": "public",
        "evidence": evidence([recipe_path, bp_tools/"scripts/main.js", bp_tools/"scripts/cooking_data.js"]),
    })
for rec in cooking:
    item_entry(rec)

knife_info = {
    "copper": ("銅のナイフ", 2, 96),
    "iron": ("鉄のナイフ", 3, 128),
    "gold": ("金のナイフ", 4, 64),
    "diamond": ("ダイヤモンドのナイフ", 6, 512),
    "netherite": ("ネザライトのナイフ", 7, 640),
}
for material, (name, rank, durability) in knife_info.items():
    slug = f"cooking-knife-{material}"
    item_path = bp_tools / f"items/{material}_knife.json"
    texture_path = rp_tools / f"textures/items/{material}_knife.png"
    image = image_for(texture_path, slug)
    add_record({
        "id": slug, "name": name, "kind": "item", "contentId": content_id,
        "summary": f"まな板でRank {['','I','II','III','IV','V','VI','VII'][rank]}まで調理できるナイフ。",
        "description": f"{name}はPine Cooking専用の調理ナイフです。まな板に置くと料理UIを開けます。",
        "usage": "手に持ってまな板を操作すると設置されます。設置後にまな板を通常操作すると料理UIを開きます。",
        "obtaining": "各素材の調理ナイフ用レシピから作成します。",
        "details": [
            f"作成可能上限：Rank {['','I','II','III','IV','V','VI','VII'][rank]}。",
            f"耐久値：{durability}。",
            "スニーク＋操作でまな板から回収できます。",
        ],
        "image": image, "recipe": None, "visibility": "public",
        "evidence": evidence([item_path, texture_path, bp_tools/"scripts/main.js"]),
    })

board_names = [
    "オーク", "トウヒ", "シラカバ", "ジャングル", "アカシア", "ダークオーク",
    "マングローブ", "サクラ", "竹", "深紅", "歪んだ", "ペールオーク", "ポプラ",
]
add_record({
    "id": "pine-cooking-cutting-boards", "name": "まな板（13種類）",
    "kind": "feature", "contentId": content_id,
    "summary": "13種類の木材系バリエーションを持つ料理専用ブロック。",
    "description": "調理ナイフを置いてPine Cookingの専用UIを開くためのまな板です。機能は共通で、木材ごとに見た目が変わります。",
    "usage": "設置したまな板へ調理ナイフを置き、通常操作で料理UIを開きます。",
    "obtaining": "各木材に対応するまな板レシピから作成します。",
    "details": [
        "種類：" + " / ".join(board_names),
        "ナイフを置いた状態は専用3Dモデルで表示されます。",
        "料理30種は通常作業台ではなく、このまな板UIから作成します。",
    ],
    "image": None, "recipe": None, "visibility": "public",
    "evidence": evidence([
        bp_tools/"blocks/oak_cutting_board.json",
        bp_tools/"scripts/main.js",
        rp_tools/"models/blocks/cutting_board.geo.json",
        rp_tools/"ui/server_form.json",
    ]),
})

add_record({
    "id": "pine-cooking-rank-system", "name": "料理Rankとナイフ制限",
    "kind": "feature", "contentId": content_id,
    "summary": "料理をRankで分類し、ナイフ素材ごとに作成可能な上限を設定。",
    "description": "料理UIは素材とRank I〜VIIに分かれています。現在の料理はRank II〜VIを中心に配置され、使用中のナイフで作れないRankはロック表示されます。",
    "usage": "左側のRankタブを選び、中央の料理アイコンから作りたい料理を選択します。",
    "obtaining": "ナイフ素材を上位へ更新すると、より高いRankの料理を作れるようになります。",
    "details": [
        "銅：Rank IIまで / 鉄：Rank IIIまで / 金：Rank IVまで。",
        "ダイヤモンド：Rank VIまで / ネザライト：Rank VIIまで。",
        "Rank IとVIIは将来拡張用の空き区分です。",
    ],
    "image": None, "recipe": None, "visibility": "public",
    "evidence": evidence([bp_tools/"scripts/main.js", bp_tools/"scripts/cooking_data.js", rp_tools/"ui/server_form.json"]),
})

field_path.write_text(json.dumps(records + new_records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
content_path.write_text(json.dumps(contents, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
pack_path.write_text(json.dumps(packs, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Added {len(new_records)} field-guide entries; total {len(records) + len(new_records)}.")

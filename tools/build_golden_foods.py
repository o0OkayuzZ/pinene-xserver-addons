"""Build the scoped golden-foods definitions from the user's v0.1.1 design.
Run with Pillow; inputs and vanilla install are explicit, not downloaded art.
"""
import argparse, collections, hashlib, json, shutil, uuid, zipfile, subprocess
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
BP = ROOT / "behavior_packs/bp_02_ef6e99cf-077d-4b55-9e11-f86bb9e66880"
RP = ROOT / "resource_packs/rp_05_608f921e-6be8-4a27-85d6-27945fa3a1ef"
DUP = ROOT / "behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639"
DOC = ROOT / "docs/golden_foods"
def read(p): return json.loads(p.read_text(encoding="utf-8-sig"))
def write(p, obj):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
def js(p, name, obj):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text("export const " + name + " = " + json.dumps(obj, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8", newline="\n")
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def normalize_id(s):
    s = s if ":" in s else "minecraft:" + s
    return "minecraft:enchanted_golden_apple" if s.lower() == "minecraft:appleenchanted" else s
def recipe_signature(r):
    kind = next((k for k in r if k.startswith("minecraft:recipe_")), None)
    if kind != "minecraft:recipe_shaped": return None
    v = r[kind]; result = v.get("result", {})
    if not isinstance(result, dict): return None
    rows = v.get("pattern", [])
    rows = [row.strip() for row in rows if row.strip()]
    if any("item" not in entry for entry in v.get("key", {}).values()): return None
    grid = [[normalize_id(v["key"][c]["item"]) if c != " " else "" for c in row] for row in rows]
    return (tuple(tuple(row) for row in grid), normalize_id(result.get("item", "")), result.get("count", 1))
def build(args):
    if (DOC / "versions.json").exists():
        raise SystemExit("Already built. Run validate_golden_foods.py; rebuild in a fresh baseline worktree to avoid overwriting reviewed edits.")
    DOC.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(args.bundle) as z:
        for name in ["CODEX_PROMPT.txt", "Pinene_Golden_Foods_Spec_v0.1.1.md", "balance_seed.json", "README.md", "SPEC_VALIDATION.json"]:
            p = DOC / "input" / name; p.parent.mkdir(parents=True, exist_ok=True); p.write_bytes(z.read(name))
    seed = read(DOC / "input/balance_seed.json")
    # Audit before modifying definitions. Some unrelated legacy files are JSONC.
    audit = {"head": args.head, "engine_package": args.engine, "recipe_duplicates_removed": [], "existing_apple_recipes": [], "unparsed_recipes": [], "id_locations": {}, "supplies": []}
    recipes = []
    ids = {x["item_id"] for x in seed["items"]}
    tracked = set(subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode("utf-8").split("\0"))
    for p in (ROOT / "behavior_packs").rglob("*.json"):
        if p.relative_to(ROOT).as_posix() not in tracked: continue
        if "items" in p.parts:
            try:
                item = read(p).get("minecraft:item", {})
                if item.get("description", {}).get("identifier") in ids:
                    audit["id_locations"].setdefault(item["description"]["identifier"], []).append(str(p.relative_to(ROOT)))
            except (ValueError, KeyError): pass
        if "recipes" in p.parts:
            try:
                r = read(p); recipes.append((p,r))
                if "enchanted_golden_apple" in json.dumps(r).lower() or "appleenchanted" in json.dumps(r).lower():
                    audit["existing_apple_recipes"].append(str(p.relative_to(ROOT)))
            except ValueError: audit["unparsed_recipes"].append(str(p.relative_to(ROOT)))
        if any(t in p.parts for t in ("entities", "trading", "loot_tables")):
            text = p.read_text(encoding="utf-8-sig", errors="replace")
            hits = [i for i in ids if i in text]
            if hits: audit["supplies"].append({"path":str(p.relative_to(ROOT)), "ids":hits})
    # No equivalent new ID exists in this HEAD; fail rather than shadow another pack.
    for item in seed["items"]:
        if item["id_status"] == "new_proposed_id":
            assert not audit["id_locations"].get(item["item_id"]), item["item_id"]
    for item_id in ("a:gwheat", "a:egwheat", "a:gbread", "a:egbread"):
        assert len(audit["id_locations"].get(item_id, [])) == 1, (item_id, audit["id_locations"].get(item_id))
    atlas = read(RP / "textures/item_texture.json")
    runtime = {}
    for item in seed["items"]:
        if item["item_id"].startswith("minecraft:"): continue
        key = "pinene_golden_foods_" + item["texture_group"]
        comp = {"minecraft:display_name":{"value":item["name_ja"]}, "minecraft:icon":key, "minecraft:max_stack_size":64}
        if item["glint"]: comp["minecraft:glint"] = True
        food = item.get("food")
        if food:
            comp["minecraft:food"] = {k:food[k] for k in ("nutrition","saturation_modifier","can_always_eat")}
            comp["minecraft:use_modifiers"] = {"use_duration":food["use_duration_s"], "movement_modifier":0.35}
            comp["minecraft:use_animation"] = "eat"
            comp["pinene:golden_food_consume"] = {}
        filename = item["item_id"].split(":")[1] + ".json"
        write(BP / "items" / filename, {"format_version":"1.21.90","minecraft:item":{"description":{"identifier":item["item_id"],"menu_category":{"category":"items"}},"components":comp}})
        atlas["texture_data"][key] = {"textures":"textures/pinene_golden_foods/" + item["texture_group"]}
        runtime[item["item_id"]] = {"name":item["name_ja"], "family":item["family"], "tier":item["tier"], "food":food,
            "effects":[{"id":e["effect"],"amplifier":e["amplifier_zero_based"],"seconds":e["duration_s"]} for e in item["effects"]],
            "features":item["features"], "icon":"textures/pinene_golden_foods/" + item["texture_group"]}
    js(BP / "scripts/golden_foods/data.js", "FOODS", runtime)
    js(BP / "scripts/golden_foods/science_ja.js", "SCIENCE", {"families":seed["science_ui"],"disclaimer":seed["science_disclaimer"]})
    # Registered guide is separate from eating; no food callback ever opens UI.
    write(BP / "items/golden_food_guide.json", {"format_version":"1.21.90","minecraft:item":{"description":{"identifier":"pinene:golden_food_guide","menu_category":{"category":"items"}},"components":{
        "minecraft:display_name":{"value":"金食料図鑑"},"minecraft:icon":"pinene_golden_foods_guide","minecraft:max_stack_size":1,
        "pinene:golden_food_guide":{}}}})
    atlas["texture_data"]["pinene_golden_foods_guide"]={"textures":"textures/pinene_golden_foods/guide"}
    write(RP / "textures/item_texture.json", atlas)
    write(BP / "recipes/golden_food_guide.json", {"format_version":"1.20.10","minecraft:recipe_shapeless":{"description":{"identifier":"pinene:golden_food_guide"},"tags":["crafting_table"],"ingredients":[{"item":"minecraft:book"},{"item":"minecraft:gold_nugget"}],"result":{"item":"pinene:golden_food_guide","count":1},"unlock":[{"item":"minecraft:book"}]}})
    legacy_files={"golden_wheat":"gwheat","enchanted_wheat":"egwheat","golden_bread":"gbread","enchanted_bread_from_enchanted_wheat":"egbread"}
    for recipe in seed["recipes"]:
        name = legacy_files.get(recipe["key"], "golden_foods_" + recipe["key"])
        rid = "a:" + name if recipe["key"] in legacy_files else "pinene:" + name
        v = {"description":{"identifier":rid}, "tags":recipe["station_tags"]}
        if recipe["type"] == "furnace":
            v.update(input=recipe["inputs"]["input"]["item_id"],output=recipe["output"]["item_id"])
            doc={"format_version":"1.12","minecraft:recipe_furnace":v}
        else:
            v.update(pattern=recipe["pattern"], key={k:{"item":value["item_id"]} for k,value in recipe["inputs"].items()},
                result={"item":recipe["output"]["item_id"],"count":recipe["output"]["count"]},
                unlock=[{"item":next(iter(recipe["inputs"].values()))["item_id"]}])
            doc={"format_version":"1.20.10","minecraft:recipe_shaped":v}
        if recipe["key"] == "enchanted_apple_rule":
            identical=[str(p.relative_to(ROOT)) for p,r in recipes if recipe_signature(r)==recipe_signature(doc)]
            if identical:
                audit["reused_apple_recipe"]=identical
                continue
            # The local development copy already has this exact recipe. Reuse its ID/content.
            local = Path(args.local_apple)
            if local.exists() and recipe_signature(read(local))==recipe_signature(doc):
                doc=read(local)
                audit["apple_import_source"]=str(local)
        write(BP / "recipes" / (name + ".json"),doc)
    for name in ("gwheat","egwheat"):
        p=DUP / "recipes" / (name+".json")
        if p.exists():
            audit["recipe_duplicates_removed"].append({"path":str(p.relative_to(ROOT)),"before":read(p)})
            p.unlink()
    # Source assets: highest versioned overlay available in the installed vanilla pack.
    vanilla = Path(args.vanilla)
    overlays=sorted((p for p in vanilla.glob("vanilla_*") if p.name[8:].replace(".","").isdigit()),
        key=lambda p:tuple(map(int,p.name[8:].split("."))), reverse=True)
    def source(name):
        return next(p/"textures/items"/(name+".png") for p in overlays+[vanilla/"vanilla"] if (p/"textures/items"/(name+".png")).is_file())
    apple=Image.open(source("apple")).convert("RGBA")
    gold=Image.open(source("apple_golden")).convert("RGBA")
    assert apple.size==gold.size==(16,16)
    # Match red edible apple pixels to golden apple at the same coordinates.
    paired=collections.defaultdict(list)
    for a,g in zip(apple.getdata(), gold.getdata()):
        if a[3] and g[3] and a[0]>a[1]*1.2 and a[0]>a[2]*1.2:
            paired[a[:3]].append(g[:3])
    luma=lambda c: .2126*c[0]+.7152*c[1]+.0722*c[2]
    gold_palette=sorted(set(collections.Counter(v).most_common(1)[0][0] for v in paired.values()),key=luma)
    assert len(gold_palette)>=4
    mappings={"golden_potato":"potato","baked_golden_potato":"potato_baked","golden_beetroot":"beetroot",
      "golden_pumpkin_pie":"pumpkin_pie","golden_poisonous_potato":"potato_poisonous","golden_wheat":"wheat","golden_bread":"bread",
      "golden_carrot":"carrot_golden","glistering_melon":"melon_speckled"}
    # Derive any differing melon group spelling from supplied data.
    melon_group=next(x["texture_group"] for x in seed["items"] if x["key"]=="enchanted_glistering_melon_slice")
    mappings[melon_group]=mappings.pop("glistering_melon")
    tex=RP/"textures/pinene_golden_foods";tex.mkdir(parents=True,exist_ok=True)
    provenance={"engine_package":args.engine,"reference_sources":{n:{"path":str(source(n)),"sha256":digest(source(n))} for n in ("apple","apple_golden")},"palette":gold_palette,"assets":{}}
    preview=Image.new("RGBA",(4*112, len(mappings)*52),(36,36,36,255)); draw=ImageDraw.Draw(preview)
    for row,(group,base) in enumerate(mappings.items()):
        p=source(base);original=Image.open(p).convert("RGBA");assert original.size==(16,16)
        result=original.copy()
        native=base in ("carrot_golden","melon_speckled")
        if not native:
            colors=sorted({c[:3] for c in original.getdata() if c[3] and not(c[1]>c[0]*1.15 and c[1]>c[2]*1.1)},key=luma)
            color_map={color:gold_palette[round(i*(len(gold_palette)-1)/max(1,len(colors)-1))] for i,color in enumerate(colors)}
            result.putdata([(*color_map.get(c[:3],c[:3]),c[3]) for c in original.getdata()])
        assert result.getchannel("A").tobytes()==original.getchannel("A").tobytes()
        result.save(tex/(group+".png"))
        provenance["assets"][group]={"path":str(p),"sha256":digest(p),"source_size":list(original.size),"output_sha256":digest(tex/(group+".png")),"mode":"native" if native else "apple-paired palette by luminance rank; original green regions retained"}
        for col,img in enumerate((original,result,result)):
            preview.alpha_composite(img.resize((48,48),Image.Resampling.NEAREST),(col*112,row*52))
        draw.text((3*112,row*52+12),base,fill="white")
    shutil.copyfile(source("book_normal"),tex/"guide.png")
    provenance["assets"]["guide"]={"path":str(source("book_normal")),"sha256":digest(source("book_normal"))}
    preview.save(DOC/"texture_comparison.png")
    write(DOC/"texture_provenance.json",provenance)
    write(DOC/"audit.json",audit)
    # Scope version increments to changed packs; registrations/dependencies follow UUIDs.
    versions={}
    for pack in (BP,RP,DUP):
        m=read(pack/"manifest.json");v=m["header"]["version"];v=[v[0],v[1],v[2]+1];m["header"]["version"]=v
        for module in m["modules"]:module["version"]=v
        if pack==BP:
            m["header"]["min_engine_version"]=[1,21,90]
            m["modules"].append({"type":"script","language":"javascript","entry":"scripts/golden_foods/main.js","uuid":str(uuid.uuid5(uuid.NAMESPACE_URL,"pinene-golden-foods-script-v011")),"version":v})
            m["dependencies"]=[{"module_name":"@minecraft/server","version":"2.0.0"},{"module_name":"@minecraft/server-ui","version":"2.0.0"}]
        versions[m["header"]["uuid"]]=v
        write(pack/"manifest.json",m)
    # Add an explicit dependency to the resource pack providing the unique atlas keys.
    m=read(BP/"manifest.json");rm=read(RP/"manifest.json")
    m["dependencies"].append({"uuid":rm["header"]["uuid"],"version":rm["header"]["version"]});write(BP/"manifest.json",m)
    for p in list(ROOT.glob("behavior_packs/*/manifest.json"))+list(ROOT.glob("resource_packs/*/manifest.json")):
        m=read(p);changed=False
        for dep in m.get("dependencies",[]):
            if dep.get("uuid") in versions and dep["version"]!=versions[dep["uuid"]]:
                dep["version"]=versions[dep["uuid"]];changed=True
        if changed:write(p,m)
    for p in list(ROOT.glob("world_*_packs.json"))+list((ROOT/"worlds").rglob("world_*_packs.json")):
        entries=read(p);changed=False
        for entry in entries:
            if entry["pack_id"] in versions:
                entry["version"]=versions[entry["pack_id"]];changed=True
        if changed:write(p,entries)
    write(DOC/"versions.json",versions)
    print(json.dumps({"items":len(runtime),"recipes":len(seed["recipes"]),"palette":gold_palette,"audit":str(DOC/"audit.json")},ensure_ascii=False))
if __name__=="__main__":
    p=argparse.ArgumentParser()
    for name in ("bundle","vanilla","engine","head","local-apple"):p.add_argument("--"+name,required=True)
    build(p.parse_args())

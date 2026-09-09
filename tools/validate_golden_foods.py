"""Static acceptance checks, not a Minecraft runtime certification."""
import collections, json, subprocess, sys
sys.dont_write_bytecode = True
from pathlib import Path
from PIL import Image
sys.path.insert(0,str(Path(__file__).parent))
from build_golden_foods import ROOT, BP, RP, DOC, read, recipe_signature, normalize_id

checks=[]
def check(name, condition):
    if not condition: raise AssertionError(name)
    checks.append(name)
def unique_json(path):
    def pairs(items):
        d={}
        for k,v in items:
            if k in d:raise ValueError("Duplicate key "+k)
            d[k]=v
        return d
    return json.loads(path.read_text(encoding="utf-8-sig"),object_pairs_hook=pairs)
seed=read(DOC/"input/balance_seed.json")
custom=[i for i in seed["items"] if not i["item_id"].startswith("minecraft:")]
all_items=collections.defaultdict(list)
recipes=[]
for pack in (ROOT/"behavior_packs").iterdir():
    for p in (pack/"items").rglob("*.json"):
        try:
            v=read(p).get("minecraft:item",{}); id=v.get("description",{}).get("identifier")
            if id:all_items[id].append(p)
        except ValueError:pass # Unchanged third-party legacy JSONC is outside this patch.
    for p in (pack/"recipes").rglob("*.json"):
        recipes.append((p,unique_json(p)))
atlas=unique_json(RP/"textures/item_texture.json")["texture_data"]
for item in custom:
    id=item["item_id"];check("Single owner "+id,len(all_items[id])==1)
    p=all_items[id][0];doc=unique_json(p);v=doc["minecraft:item"];c=v["components"]
    check("Modern schema "+id,doc["format_version"]=="1.21.90" and "category" not in v["description"])
    check("Glint "+id,c.get("minecraft:glint",False)==item["glint"])
    if item["food"]:
        check("Food values "+id,all(c["minecraft:food"][k]==item["food"][k] for k in ("nutrition","saturation_modifier","can_always_eat")))
        check("Single consume adapter "+id,"pinene:golden_food_consume" in c and "effects" not in c["minecraft:food"] and "minecraft:use_duration" not in c and "minecraft:custom_components" not in c)
        check("1.6 second duration "+id,c["minecraft:use_modifiers"]["use_duration"]==1.6)
    else:check("Inedible "+id,"minecraft:food" not in c)
    path=RP/(atlas[c["minecraft:icon"]]["textures"]+".png")
    image=Image.open(path).convert("RGBA")
    check("Native size "+id,image.size==(16,16))
    same_group=[j for j in custom if j["texture_group"]==item["texture_group"]]
    check("Shared exact texture "+id,all(read(all_items[j["item_id"]][0])["minecraft:item"]["components"]["minecraft:icon"]==c["minecraft:icon"] for j in same_group))
for asset,info in read(DOC/"texture_provenance.json")["assets"].items():
    result=Image.open(RP/"textures/pinene_golden_foods"/(asset+".png")).convert("RGBA")
    original=Image.open(info["path"]).convert("RGBA")
    check("Exact alpha/silhouette "+asset,result.getchannel("A").tobytes()==original.getchannel("A").tobytes() and result.size==original.size)
    if info.get("mode")=="native":check("Native pixels "+asset,result.tobytes()==original.tobytes())
for recipe in seed["recipes"]:
    result=recipe["output"]["item_id"]
    if recipe["type"]=="furnace":
        matches=[p for p,r in recipes if (v:=r.get("minecraft:recipe_furnace")) and v.get("input")==recipe["inputs"]["input"]["item_id"] and v.get("output")==result]
    else:
        wanted={"minecraft:recipe_shaped":{"pattern":recipe["pattern"],"key":{k:{"item":v["item_id"]} for k,v in recipe["inputs"].items()},"result":{"item":result,"count":1}}}
        matches=[p for p,r in recipes if recipe_signature(r)==recipe_signature(wanted)]
    check("One canonical recipe "+recipe["key"],len(matches)==1)
# Reject forbidden bypasses by examining every recipe producing target potato items.
for p,r in recipes:
    v=r.get("minecraft:recipe_shaped")
    if v and isinstance(v.get("result"),dict):
        result=v["result"]["item"]
        if result=="pinene:golden_potato":
            check("No baked-to-gold bypass",v["key"]["C"]["item"]=="minecraft:potato")
        if result=="pinene:enchanted_baked_golden_potato":
            check("Only cooked gold can enchant",v["key"]["C"]["item"]=="pinene:baked_golden_potato")
    v=r.get("minecraft:recipe_furnace")
    if v and v.get("output")=="pinene:baked_golden_potato":
        check("No poison cooking",v["input"]=="pinene:golden_potato")
        check("No blast furnace",set(v["tags"])=={"furnace","smoker","campfire","soul_campfire"})
check("No raw enchanted gold potato",not all_items["pinene:enchanted_golden_potato"])
check("Vanilla items are not redefined",not any(p.parent==BP/"items" for id in ["minecraft:golden_apple","minecraft:golden_carrot","minecraft:glistering_melon_slice"] for p in all_items[id]))
manifest_by_id={}
for p in list(ROOT.glob("behavior_packs/*/manifest.json"))+list(ROOT.glob("resource_packs/*/manifest.json")):
    m=unique_json(p);manifest_by_id[m["header"]["uuid"]]=m
for file in list(ROOT.glob("world_*_packs.json"))+list((ROOT/"worlds").rglob("world_*_packs.json")):
    for ref in unique_json(file):
        check("Pack registration "+str(file.relative_to(ROOT))+" "+ref["pack_id"],ref["version"]==manifest_by_id[ref["pack_id"]]["header"]["version"])
for uuid in read(DOC/"versions.json"):
    m=manifest_by_id[uuid]
    check("Module versions "+uuid,all(x["version"]==m["header"]["version"] for x in m["modules"]))
    for dep in m.get("dependencies",[]):
        if "uuid" in dep:check("Dependency "+uuid,dep["version"]==manifest_by_id[dep["uuid"]]["header"]["version"])
# The integrated release also contains Mycology and pancakes. Check gold files
# against the reviewed source inventory instead of rejecting all other work.
import hashlib
release=read(ROOT/"docs/deployments/2026-09-10-release-files.json")["files"]
for rel,digest in release.items():
    p=ROOT/rel
    check("Reviewed release file "+rel,(not p.exists()) if digest is None else p.is_file() and hashlib.sha256(p.read_bytes()).hexdigest()==digest)
r={"status":"PASS","checks":len(checks),"details":checks,"in_game_tests":"NOT RUN"}
(DOC/"static_validation.json").write_text(json.dumps(r,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print(json.dumps({"status":"PASS","checks":len(checks),"in_game_tests":"NOT RUN"}))

import json, subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]
def read(p):return json.loads(p.read_text(encoding="utf-8-sig"))
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+"\n",encoding="utf-8",newline="\n")
version_path=root/"docs/golden_foods/versions.json"
versions=read(version_path)
# Close version updates over real UUID dependencies, without changing equipment code.
paths=list(root.glob("behavior_packs/*/manifest.json"))+list(root.glob("resource_packs/*/manifest.json"))
pending=True
while pending:
    pending=False
    for p in paths:
        m=read(p)
        if m["header"]["uuid"] not in versions and any(d.get("uuid") in versions for d in m.get("dependencies",[])):
            v=list(m["header"]["version"]);v[2]+=1
            m["header"]["version"]=v
            for mod in m["modules"]:mod["version"]=v
            versions[m["header"]["uuid"]]=v
            write(p,m);pending=True
for p in paths:
    m=read(p);changed=False
    for d in m.get("dependencies",[]):
        if d.get("uuid") in versions and d["version"]!=versions[d["uuid"]]:
            d["version"]=versions[d["uuid"]];changed=True
    if changed:write(p,m)
for p in list(root.glob("world_*_packs.json"))+list((root/"worlds").rglob("world_*_packs.json")):
    m=read(p);changed=False
    for d in m:
        if d["pack_id"] in versions and d["version"]!=versions[d["pack_id"]]:
            d["version"]=versions[d["pack_id"]];changed=True
    if changed:write(p,m)
write(version_path,versions)
names=set(subprocess.check_output(["git","diff","--name-only","-z"],cwd=root).decode().split("\0"))
names.update(subprocess.check_output(["git","ls-files","--others","--exclude-standard","-z"],cwd=root).decode().split("\0"))
for name in names:
    p=root/name
    if p.is_file() and p.suffix in (".json",".js",".mjs",".py",".md",".txt") and "/input/" not in name:
        data=p.read_bytes();p.write_bytes(data.replace(b"\r\n",b"\n"))
print("Versions and LF normalized",versions)


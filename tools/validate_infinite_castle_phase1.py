"""Validate the Phase 1 delta against the explicitly requested integration commit."""
import argparse
import copy
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = "42fc747426db0cf6e65eca77d73ae16fdf257188"
CASTLE = "behavior_packs/bp_16_3efecae8-a036-4e14-94d3-876e29fe0ae9"
DUNGEONS = "behavior_packs/bp_08_2c5e0de8-0360-49ac-bfe5-339a2a0e62f2"
TAG_FILTER = {"test": "has_tag", "subject": "self", "operator": "!=", "value": "ic_room_enemy_v1"}

def git(*args):
    return subprocess.check_output(["git", "-c", "core.quotepath=false", *args], cwd=ROOT)

def load(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--node", default="node")
    args = parser.parse_args()
    errors = []
    def check(value, message):
        if not value:
            errors.append(message)
    subprocess.run(["git", "merge-base", "--is-ancestor", BASE, "HEAD"], cwd=ROOT, check=True)
    changed = git("diff", "--name-only", BASE).decode().splitlines()
    added = git("ls-files", "--others", "--exclude-standard").decode().splitlines()
    paths = sorted(set(changed + added))
    json_count = js_count = isolated = 0
    manifests = {}
    for path in ROOT.glob("*_packs/*/manifest.json"):
        data = load(path)
        manifests[data["header"]["uuid"]] = data
    for name in paths:
        path = ROOT / name
        if not path.is_file():
            continue
        if path.suffix == ".json":
            try:
                load(path)
                json_count += 1
            except ValueError as error:
                errors.append(f"{name}: {error}")
        if path.suffix in (".js", ".mjs"):
            result = subprocess.run([args.node, "--check", str(path)], capture_output=True, text=True, encoding="utf-8")
            check(result.returncode == 0, f"{name}: {result.stderr}")
            js_count += 1
            for relative in re.findall(r"""from\s+['"](\.[^'"]+)['"]""", path.read_text(encoding="utf-8")):
                check((path.parent / relative).is_file(), f"Unresolved local import: {name}: {relative}")
        if name.endswith("/manifest.json"):
            now = load(path)
            before = json.loads(git("show", BASE + ":" + name))
            check(now["header"]["uuid"] == before["header"]["uuid"], f"UUID changed: {name}")
            check([m["uuid"] for m in now["modules"]] == [m["uuid"] for m in before["modules"]], f"Module UUID changed: {name}")
            check(now["header"]["version"] > before["header"]["version"], f"Version not increased: {name}")
            for dep in now.get("dependencies", []):
                if dep.get("uuid") in manifests:
                    check(dep["version"] == manifests[dep["uuid"]]["header"]["version"], f"Dependency version mismatch: {name}")
        if name.startswith(DUNGEONS + "/entities/"):
            now = load(path)
            before = json.loads(git("show", BASE + ":" + name))
            normal = copy.deepcopy(now)
            entity = normal["minecraft:entity"]
            entity["component_groups"] = {k: v for k, v in entity["component_groups"].items() if not k.startswith("infinite_castle:")}
            events = {}
            for key, value in entity["events"].items():
                if key.startswith("infinite_castle:"):
                    continue
                if key.startswith("dungeons:") and value != before["minecraft:entity"]["events"].get(key):
                    check(len(value.get("sequence", [])) == 1, f"Missing scoped native event: {name}: {key}")
                    value = copy.deepcopy(value["sequence"][0])
                    check(value.pop("filters", None) == TAG_FILTER, f"Incorrect instance filter: {name}: {key}")
                events[key] = value
            entity["events"] = events
            check(normal == before, f"Normal Dungeons entity changed: {name}")
            isolated += 1
    check(isolated == 14, "Expected nine Dungeons mobs, three Vanilla mobs and two scoped projectile definitions")
    for registration in [ROOT / "world_behavior_packs.json", ROOT / "world_resource_packs.json", *ROOT.glob("worlds/*/world_*_packs.json")]:
        name = registration.relative_to(ROOT).as_posix()
        before = json.loads(git("show", BASE + ":" + name))
        now = load(registration)
        check([r["pack_id"] for r in now] == [r["pack_id"] for r in before], f"Registration UUID/order changed: {name}")
        for row in now:
            if row["pack_id"] in manifests:
                check(row["version"] == manifests[row["pack_id"]]["header"]["version"], f"Registration version mismatch: {name}: {row['pack_id']}")
    config = ROOT / CASTLE / "scripts/infinite_castle/phase1Config.js"
    balance = json.loads(subprocess.check_output([args.node, "--input-type=module", "-e", f"import {{MOB_BALANCE}} from {json.dumps(config.as_uri())}; process.stdout.write(JSON.stringify(MOB_BALANCE));"], text=True, encoding="utf-8"))
    definitions = {load(p)["minecraft:entity"]["description"]["identifier"]: load(p)["minecraft:entity"] for p in (ROOT / DUNGEONS / "entities").rglob("*.json")}
    for type_id, event, damage in [("minecraft:arrow", "infinite_castle:skeleton_arrow", 8), ("dungeons:necromancer_shot", "infinite_castle:necromancer_shot", 4)]:
        entity = definitions[type_id]
        check(event in entity["events"], f"Missing scoped projectile event: {event}")
        projectile = entity["component_groups"].get(event, {}).get("minecraft:projectile", {})
        check(projectile.get("on_hit", {}).get("impact_damage", {}).get("damage") == damage, f"Wrong raw projectile damage: {event}")
    for mob, spec in balance.items():
        check(spec["typeId"] in definitions, f"Missing mob: {spec['typeId']}")
        entity = definitions[spec["typeId"]]
        for count in range(1, 5) if spec.get("keyHolder") else [1]:
            event = f"infinite_castle:{mob}_{count}"
            group = entity["component_groups"].get(event, {})
            check(event in entity["events"], f"Missing managed spawn event: {event}")
            check(abs(group.get("minecraft:health", {}).get("max", 0) - spec["hp"] * (1 + .15 * (count - 1))) < .00001, f"Wrong managed HP: {event}")
            check(group.get("minecraft:attack", {}).get("damage") == spec["damage"], f"Wrong managed damage: {event}")
            target = group.get("minecraft:behavior.nearest_attackable_target", {})
            check(target.get("entity_types") and target.get("within_radius", 0) >= 40, f"Missing room-wide managed target acquisition: {event}")
            for component, value in entity.get("components", {}).items():
                if component.startswith(("minecraft:navigation.", "minecraft:movement.", "minecraft:jump.")) or component == "minecraft:physics":
                    check(group.get(component) == value, f"Managed locomotion not retained: {event}: {component}")
            if mob == "overseer":
                check(group.get("minecraft:movement", {}).get("value", 0) > 0, f"Managed Endersent has no movement speed: {event}")
            if mob in ("wraith", "wraith_lord", "nightmare", "rot", "plague"):
                check(group.get("minecraft:behavior.move_towards_target", {}).get("speed_multiplier", 0) > 0, f"Script caster lacks pursuit: {event}")
    forbidden = ["lower_moon", "upper_moon", "muzan"]
    check(not any(token in json.dumps(balance) for token in forbidden), "Phase 2 entity enabled")
    debug = list((ROOT / CASTLE / "functions/infinite_castle/debug").glob("*.mcfunction"))
    check(len(debug) == 17, "Expected 17 debug functions")
    report = {"status": "FAIL" if errors else "PASS", "baseCommit": BASE,
              "changedFiles": changed, "newFiles": added, "strictChangedJSON": json_count,
              "javascriptSyntaxChecks": js_count, "outsideCastleEntityIsolation": isolated,
              "managedMobDefinitions": len(balance), "debugFunctions": len(debug), "errors": errors,
              "engineTested": False,
              "limits": ["JSON syntax and semantic isolation do not replace Bedrock Content Log/schema checks.", "Socket block invariance and animation/performance require an actual game world."]}
    target = ROOT / "docs/infinite_castle/validation.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k not in ("changedFiles", "newFiles")}, ensure_ascii=False, indent=2))
    return bool(errors)

if __name__ == "__main__":
    sys.exit(main())

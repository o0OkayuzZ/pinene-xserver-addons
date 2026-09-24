"""Build a disposable Bedrock client world from a read-only level.dat template.

Requires nbtlib. Never copies or edits the source world's database.
Example: python prepare_appraiser_world.py --template-world PATH --output NEW_PATH
"""
from pathlib import Path
import argparse
import io
import json
import shutil
import struct
import uuid
import nbtlib

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--template-world', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
dest = args.output.resolve()
if dest.exists():
    raise SystemExit('Refusing to overwrite an existing world: ' + str(dest))
raw = (args.template_world / 'level.dat').read_bytes()
nbt = nbtlib.File.parse(io.BytesIO(raw[8:]), byteorder='little')
title = 'APPRAISER Lifecycle TEST 20260923'
nbt['LevelName'] = nbtlib.String(title)
for k, v in {'GameType': 1, 'Difficulty': 0, 'Generator': 2, 'SpawnX': 0, 'SpawnY': -60, 'SpawnZ': 0}.items():
    nbt[k] = nbtlib.Int(v)
for k, v in {'commandsEnabled': 1, 'cheatsEnabled': 1, 'hasBeenLoadedInCreative': 1,
             'doMobSpawning': 0, 'keepinventory': 1, 'MultiplayerGame': 0, 'MultiplayerGameIntent': 0}.items():
    nbt[k] = nbtlib.Byte(v)
nbt['FlatWorldLayers'] = nbtlib.String(json.dumps({'biome_id': 1, 'block_layers': [
    {'block_name': 'minecraft:bedrock', 'count': 1},
    {'block_name': 'minecraft:dirt', 'count': 2},
    {'block_name': 'minecraft:grass_block', 'count': 1}],
    'encoding_version': 6, 'structure_options': None, 'world_version': 'version.post_1_18'}))
buffer = io.BytesIO()
nbt.write(buffer, byteorder='little')
data = buffer.getvalue()
dest.mkdir(parents=True)
(dest / 'level.dat').write_bytes(struct.pack('<II', 10, len(data)) + data)
(dest / 'levelname.txt').write_text(title, encoding='utf-8')
author = Path(__file__).resolve().parents[1]
for side, folder in [('BP', 'behavior_packs'), ('RP', 'resource_packs')]:
    pack = dest / folder / 'appraiser_lifecycle_test'
    shutil.copytree(author / 'pack' / side, pack)
    manifest = json.loads((pack / 'manifest.json').read_text(encoding='utf-8-sig'))
    manifest['header']['name'] = title + ' ' + side
    manifest['header']['uuid'] = str(uuid.uuid4())
    for module in manifest['modules']:
        module['uuid'] = str(uuid.uuid4())
    manifest['dependencies'] = [d for d in manifest.get('dependencies', []) if 'module_name' in d]
    (pack / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    (dest / ('world_' + folder + '.json')).write_text(json.dumps([
        {'pack_id': manifest['header']['uuid'], 'version': manifest['header']['version']}]), encoding='utf-8')
    if side == 'BP':
        # Expose the actual private spawn routine, without changing its body or balance.
        with (pack / 'scripts/mycology/npc.js').open('a', encoding='utf-8') as f:
            f.write('\n// TEST WORLD ONLY: unchanged private spawn implementation.\nexport {attempt as engineAttempt};\n')
        with (pack / 'scripts/main.js').open('a', encoding='utf-8') as f:
            f.write('\nimport "./appraiser-engine.js";\n')
        shutil.copyfile(author / 'tests/appraiser-engine.js', pack / 'scripts/appraiser-engine.js')
print(dest)

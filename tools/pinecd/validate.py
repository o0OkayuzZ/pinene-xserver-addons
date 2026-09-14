"""Read-only native record and migration regression checks; optional ffprobe."""
import argparse
import collections
import hashlib
import json
import re
import subprocess
from pathlib import Path
from build import ROOT, BP, RP, load, outputs

BASE = '56b2ab24'
REMUXED = (RP / 'sounds/records/pinecd_track_09.ogg').relative_to(ROOT).as_posix()


def old(path):
    return subprocess.check_output(['git', 'show', BASE + ':' + path.relative_to(ROOT).as_posix()], cwd=ROOT)


def jsonc(path):
    # Preserve string literals while stripping comments and trailing commas.
    text = path.read_text(encoding='utf-8-sig')
    text = re.sub(r'"(?:\\.|[^"\\])*"|//[^\n]*|/\*[\s\S]*?\*/',
                  lambda m: m[0] if m[0].startswith('"') else ' ', text)
    text = re.sub(r'("(?:\\.|[^"\\])*")|,\s*(?=[}\]])',
                  lambda m: m[1] or '', text)
    def unique(pairs):
        result = {}
        for k, v in pairs:
            assert k not in result, f'Duplicate JSON key: {path}: {k}'
            result[k] = v
        return result
    return json.loads(text, object_pairs_hook=unique)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--probe-audio', action='store_true')
    args = parser.parse_args()
    for p, d in outputs().items():
        assert load(p) == d, f'Generated data drift: {p}'
    tracks = load(Path(__file__).with_name('tracks.json'))['tracks']
    ids = {t['id'] for t in tracks}
    events = {t['sound_event'] for t in tracks}
    owners = collections.defaultdict(list)
    for p in (ROOT / 'behavior_packs').glob('*/items/**/*.json'):
        d = jsonc(p).get('minecraft:item', {})
        ident = d.get('description', {}).get('identifier')
        if ident in ids:
            owners[ident].append(p)
    assert set(owners) == ids and all(len(v) == 1 for v in owners.values())
    for i in range(1, 20):
        p = owners[f'pinecd:cd_{i:02d}'][0]
        before = json.loads(old(p)); after = load(p)
        before['format_version'] = 'beta'
        before['minecraft:item']['description']['menu_category']['group'] = 'minecraft:itemGroup.name.record'
        before['minecraft:item']['components']['minecraft:record']['sound_event'] = f'pinecd.record.{i:02d}'
        assert before == after, f'Existing item changed: {p}'
    sound_owners = collections.defaultdict(list)
    for p in (ROOT / 'resource_packs').glob('*/**/*sounds*.json'):
        jsonc(p)
    for p in (ROOT / 'resource_packs').glob('*/**/sound_definitions.json'):
        for key, value in jsonc(p).get('sound_definitions', {}).items():
            if key in events:
                sound_owners[key].append(p)
            assert not (key.startswith('record.') and 'pinecd' in json.dumps(value)), p
    assert set(sound_owners) == events and all(v == [RP / 'sounds/sound_definitions.json'] for v in sound_owners.values())
    for p in (ROOT / 'resource_packs').glob('*/sounds.json'):
        d = jsonc(p)
        assert 'pinecd' not in json.dumps(d), f'Legacy root sound definition: {p}'
    # Every preexisting recipe, loot table, script, OGG and icon stays byte-identical.
    files = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', BASE], cwd=ROOT).decode().splitlines()
    changed_files = set(subprocess.check_output(
        ['git', 'diff', '--name-only', BASE], cwd=ROOT).decode().splitlines())
    preserved = 0
    for rel in files:
        if not rel.startswith(('behavior_packs/', 'resource_packs/')):
            continue
        if any(part in rel.split('/') for part in ['recipes', 'loot_tables', 'scripts']) or rel.endswith(('.ogg', '.png')):
            assert rel not in changed_files or rel == REMUXED, f'Preservation failed: {rel}'
            preserved += 1
    for t in tracks[:19]:
        for key, suffix in [('sound', '.ogg'), ('texture', '.png')]:
            p = RP / (t[key] + suffix)
            if p.relative_to(ROOT).as_posix() != REMUXED:
                assert hashlib.sha256(p.read_bytes()).digest() == hashlib.sha256(old(p)).digest(), p
    compat = next((ROOT / 'resource_packs').glob('rp_02*'))
    before = json.loads(old(compat / 'sounds.json'))
    after = load(compat / 'sounds.json')
    for key in ['sound_definitions', 'records']:
        del before[key]
    assert before == after, 'Unrelated entity sounds changed'
    for p in (RP / 'texts').glob('*.lang'):
        assert not re.search(r'^(?:item\.)?record[._](?!pinecd)[^=]*=', p.read_text(encoding='utf-8'), re.M)
    manifests = [*ROOT.glob('behavior_packs/*/manifest.json'), *ROOT.glob('resource_packs/*/manifest.json')]
    versions = {load(p)['header']['uuid']: load(p)['header']['version'] for p in manifests}
    for p in manifests:
        d = load(p)
        for dep in d.get('dependencies', []):
            if 'uuid' in dep:
                assert dep['uuid'] in versions and dep['version'] == versions[dep['uuid']], p
    existing_registration_issues = []
    old_versions = {json.loads(old(p))['header']['uuid']: json.loads(old(p))['header']['version'] for p in manifests}
    for kind in ['behavior', 'resource']:
        root_refs = ROOT / f'world_{kind}_packs.json'
        assert load(root_refs) == load(ROOT / 'worlds/Bedrock level' / root_refs.name)
        for p in [root_refs, ROOT / 'worlds/Bedrock level' / root_refs.name]:
            refs = load(p)
            assert [e['pack_id'] for e in refs] == [e['pack_id'] for e in json.loads(old(p))]
            before_refs = {e['pack_id']: e for e in json.loads(old(p))}
            for e in refs:
                ident = e['pack_id']
                if e['version'] != versions.get(ident):
                    assert e == before_refs[ident] and versions.get(ident) == old_versions.get(ident), p
                    if p == root_refs:
                        existing_registration_issues.append({'pack_id': ident, 'registered': e['version'],
                                                             'manifest': versions.get(ident)})
    bp = load(BP / 'manifest.json'); rp = load(RP / 'manifest.json')
    assert {'uuid': rp['header']['uuid'], 'version': rp['header']['version']} in bp['dependencies']
    assert all(m['type'] != 'script' for m in bp['modules'])
    assert bp['header']['min_engine_version'] == rp['header']['min_engine_version'] == [1, 26, 30]
    audio = []
    if args.probe_audio:
        for t in tracks:
            p = RP / (t['sound'] + '.ogg')
            d = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries',
                'format=duration:stream=codec_name,channels,sample_rate', '-of', 'json', str(p)]))
            assert len(d['streams']) == 1 and d['streams'][0]['codec_name'] == 'vorbis', p
            seconds = float(d['format']['duration'])
            audio.append({'id': t['id'], 'audio_seconds': seconds, 'record_seconds': t['duration'],
                          'delta_seconds': round(t['duration'] - seconds, 3)})
        pcm = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(ROOT / REMUXED),
                                       '-map', '0:a:0', '-f', 's16le', '-'])
        assert hashlib.sha256(pcm).hexdigest() == '257aa1075deb17340ecdd0bfe25d48840e7d6a5621a918bb3c48b84810f50bf8'
    print(json.dumps({'status': 'static_passed', 'tracks': len(tracks), 'preserved_files': preserved,
                      'manifests': len(manifests), 'preexisting_registration_issues': existing_registration_issues,
                      'audio': audio, 'in_game': 'NOT RUN'}, indent=2))


if __name__ == '__main__':
    main()

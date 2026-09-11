"""Validate the merged Mycology runtime and preservation of the integration base."""
from pathlib import Path
import hashlib,json,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
AUTHOR=ROOT/'tools/mycology'
BP=ROOT/'behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639'
RP=ROOT/'resource_packs/rp_02_3d6a685e-83f1-4a8a-b6a6-27d8d9a3db7a'
def load(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def git(*args):return subprocess.check_output(['git','-c',f'safe.directory={ROOT.as_posix()}',*args],cwd=ROOT)
provenance=load(ROOT/'docs/mycology/provenance.json')
base=provenance['baseCommit']
release=load(ROOT/'docs/deployments/2026-09-10-release-files.json')['files']
for rel,digest in release.items():
    p=ROOT/rel
    assert (not p.exists()) if digest is None else p.is_file() and hashlib.sha256(p.read_bytes()).hexdigest()==digest,rel
subprocess.run([sys.executable,'-X','utf8','tools/validate.py'],cwd=AUTHOR,check=True)
def old(p):return git('show',base+':'+p.relative_to(ROOT).as_posix())
for rel in provenance['runtimeAdded']:
    p=ROOT/rel; target=BP if p.is_relative_to(BP) else RP
    source=AUTHOR/'pack'/('BP' if target==BP else 'RP')/p.relative_to(target)
    assert p.read_bytes()==source.read_bytes(),f'Tested source differs: {rel}'
assert (BP/'scripts/main.js').read_bytes()==b'import "./mycology/index.js";\n'+old(BP/'scripts/main.js')
atlas=load(RP/'textures/item_texture.json')['texture_data']
prior=json.loads(old(RP/'textures/item_texture.json'))['texture_data']
assert all(atlas[k]==v for k,v in prior.items()),'Existing texture changed'
for k,v in load(AUTHOR/'pack/RP/textures/item_texture.json')['texture_data'].items():assert atlas[k]==v
texture_manifest=load(AUTHOR/'docs/texture_v1.4/asset_manifest.json')
assert {e['id'].lower()+'.png':e['texture_sha256'] for e in texture_manifest}==provenance['textureSHA256']
for e in texture_manifest:
    item=load(BP/f"items/mycology/{e['id'].lower()}.json")['minecraft:item']
    assert item['description']['identifier']==e['item_id']
    assert atlas[e['texture_key']]['textures']==e['texture_path']
for name,expected in provenance['textureSHA256'].items():
    assert hashlib.sha256((RP/'textures/items/mycology'/name).read_bytes()).hexdigest()==expected,name
    assert (AUTHOR/'reference/final_32x32'/name).read_bytes()==(RP/'textures/items/mycology'/name).read_bytes(),f'Rebuild source is stale: {name}'
for locale in ['en_US','ja_JP']:
    def entries(text):return dict(l.split('=',1) for l in text.splitlines() if '=' in l and not l.startswith('#'))
    p=RP/f'texts/{locale}.lang'; actual=entries(p.read_text(encoding='utf-8-sig'))
    assert all(actual[k]==v for k,v in entries(old(p).decode('utf-8-sig')).items())
    assert all(actual[k]==v for k,v in entries((AUTHOR/f'pack/RP/texts/{locale}.lang').read_text(encoding='utf-8')).items())
manifests=list(ROOT.glob('behavior_packs/*/manifest.json'))+list(ROOT.glob('resource_packs/*/manifest.json'))
versions={load(p)['header']['uuid']:load(p)['header']['version'] for p in manifests}
for p in manifests:
    m=load(p); before=json.loads(old(p))
    assert m['header']['uuid']==before['header']['uuid']
    expected_modules=[x['uuid'] for x in before['modules']]
    if p.parent.name=='bp_02_ef6e99cf-077d-4b55-9e11-f86bb9e66880':expected_modules.append('31fa7e01-72cd-5a44-ab19-d52fbdc56d0e')
    assert [x['uuid'] for x in m['modules']]==expected_modules
    for dep in m.get('dependencies',[]):
        if dep.get('uuid') in versions:assert dep['version']==versions[dep['uuid']],p
for p in [ROOT/'world_behavior_packs.json',ROOT/'world_resource_packs.json',*ROOT.glob('worlds/*/world_*_packs.json')]:
    refs=load(p); before=json.loads(old(p))
    assert [r['pack_id'] for r in refs]==[r['pack_id'] for r in before],p
    for ref in refs:
        if ref['pack_id'] in versions:assert ref['version']==versions[ref['pack_id']],p
# Inspect all changes to tracked runtime files, not only the known merge targets.
allowed={f'{p.relative_to(ROOT).as_posix()}' for p in [BP/'manifest.json',BP/'scripts/main.js',RP/'manifest.json',RP/'textures/item_texture.json',RP/'texts/en_US.lang',RP/'texts/ja_JP.lang',RP/'texts/languages.json']}
allowed.add('resource_packs/rp_07_4ab7ea5c-8d31-44e6-b3d6-42cc32ad2f10/manifest.json')
allowed.add('behavior_packs/bp_09_7c8ac348-47ad-4f71-8503-dc40a6f813f1/manifest.json')
allowed.update(provenance['runtimeAdded'])
allowed.update(release)
# This later, explicitly approved consolidation has its own exact-diff checks.
# Keep the original integration preservation check for every other runtime path.
from test_blue_apple_consolidation import APPROVED_RUNTIME_PATHS
subprocess.run([sys.executable,'-X','utf8','tools/test_blue_apple_consolidation.py'],cwd=ROOT,check=True)
allowed.update(APPROVED_RUNTIME_PATHS)
for rel in git('diff','--name-only',base).decode('utf-8').splitlines():
    if rel.startswith(('behavior_packs/','resource_packs/')):assert rel in allowed,f'Unexpected existing runtime change: {rel}'
summary={'status':'integrated_static_passed','baseCommit':base,'runtimeFilesAdded':len(provenance['runtimeAdded']),'BPBytes':sum(p.stat().st_size for p in BP.rglob('*') if p.is_file()),'RPBytes':sum(p.stat().st_size for p in RP.rglob('*') if p.is_file()),'versions':provenance['versions'],'engineResults':'See INTEGRATION_REPORT.md; static validation does not certify engine acceptance.'}
(ROOT/'docs/mycology/integrated-validation.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
print(json.dumps(summary,indent=2))

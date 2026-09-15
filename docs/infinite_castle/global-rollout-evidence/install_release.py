from pathlib import Path
import base64, datetime, hashlib, json, os, re, shutil, subprocess, sys, tarfile, time

plan_path=Path(sys.argv[1]);plan=json.loads(plan_path.read_text(encoding='utf-8'))
root=Path(plan['root']).resolve();backup=Path(plan['backup']);rows=plan['files']
def read(p):return p.read_bytes() if p.is_file() else None
def sha(b):return hashlib.sha256(b).hexdigest() if b is not None else None
def parse(b):
    s=b.decode('utf-8-sig');s=re.sub(r'("(?:\\.|[^"\\])*"\s*)|//[^\n]*|/\*[\s\S]*?\*/',lambda m:m[1] or '',s)
    return json.loads(re.sub(r',\s*([}\]])',r'\1',s))
def path(rel):
    p=(root/rel).resolve();assert p.is_relative_to(root) and p!=root,rel
    assert rel.endswith(('world_behavior_packs.json','world_resource_packs.json')) or rel.split('/')[0] in ['behavior_packs','resource_packs','development_behavior_packs','development_resource_packs'],rel
    return p
def proposed(p):
    rel=p.relative_to(root).as_posix()
    return base64.b64decode(rows[rel]['data']) if rel in rows and rows[rel]['data'] is not None else None if rel in rows else read(p)
for rel,row in rows.items():
    p=path(rel);assert sha(read(p))==row['before'],('concurrent change',rel)
    b=base64.b64decode(row['data']) if row['data'] is not None else None
    assert sha(b)==row['after']
    if b and p.suffix=='.json':parse(b)
    if b and p.suffix=='.js':
        for ref in re.findall(r'from\s+[\'"](\.[^\'"]+)[\'"]',b.decode('utf-8-sig')):
            dep=(p.parent/ref).resolve();assert dep.is_relative_to(root) and proposed(dep) is not None,('missing import',rel,ref)
if plan['label']!='shared':
    manifests={}
    for kind in ['behavior_packs','resource_packs']:
        for p in (root/kind).glob('*/manifest.json'):
            try:d=parse(proposed(p))
            except:continue
            manifests[d['header']['uuid']]=d
    prefix='worlds/Bedrock level/' if plan['server'] else ''
    active=set()
    for kind in ['behavior_packs','resource_packs']:
        for row in parse(proposed(root/(prefix+'world_'+kind+'.json'))):
            active.add(row['pack_id'])
            if row['pack_id'] in manifests:assert row['version']==manifests[row['pack_id']]['header']['version'],('registration',row)
    for u,d in manifests.items():
        if u not in active:continue
        for dep in d.get('dependencies',[]):
            if dep.get('uuid') in manifests:assert dep['version']==manifests[dep['uuid']]['header']['version'],('dependency',d['header']['name'],dep)
if '--validate-only' in sys.argv:
    print(json.dumps({'label':plan['label'],'preflight':True,'files':len(rows)}));sys.exit()
if not rows:
    result={'label':plan['label'],'success':True,'files':0,'note':'Uses shared packs or has no affected embedded pack'}
    plan_path.with_name(plan['label']+'-result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result));sys.exit()
assert not backup.exists();was_active=False;stopped=False;written=[]
if plan['server']:
    assert str(root)=='/opt/minecraft/server'
    was_active=subprocess.run(['systemctl','is-active','--quiet','minecraft-server.service']).returncode==0
    if was_active:
        log=root/'latest.log';offset=log.stat().st_size
        subprocess.run(['runuser','-u','minecraft','--','screen','-S','minecraft','-p','0','-X','stuff','list\r'],check=True)
        count=None
        for _ in range(20):
            time.sleep(.5);m=re.search(r'There are (\d+)/\d+ players online',log.read_bytes()[offset:].decode(errors='replace'))
            if m:count=int(m[1]);break
        assert count==0,('Online players; server unchanged',count)
        subprocess.run(['systemctl','stop','minecraft-server.service'],check=True,timeout=60);stopped=True
    assert subprocess.run(['pgrep','-x','bedrock_server'],stdout=subprocess.DEVNULL).returncode!=0
try:
    backup.mkdir(parents=True);shutil.copy2(plan_path,backup/'plan.json')
    if plan['server']:
        print('Backing up stopped world',flush=True)
        world=Path(plan['world']);subprocess.run(['tar','-czf',str(backup/'world-before.tar.gz'),'-C',str(world.parent),world.name],check=True)
    for rel,row in rows.items():
        p=path(rel);b=read(p);assert sha(b)==row['before'],('concurrent change after preflight',rel)
        if b is not None:
            q=backup/'files'/rel;q.parent.mkdir(parents=True,exist_ok=True);q.write_bytes(b)
    for rel,row in rows.items():
        p=path(rel);written.append(rel)
        if row['data'] is None:
            if p.is_file():p.unlink()
        else:
            p.parent.mkdir(parents=True,exist_ok=True);tmp=p.with_name(p.name+'.release-tmp')
            tmp.write_bytes(base64.b64decode(row['data']));os.replace(tmp,p)
            if plan['server']:shutil.chown(p,user='minecraft',group='minecraft')
    for rel,row in rows.items():assert sha(read(path(rel)))==row['after'],rel
except BaseException:
    for rel in reversed(written):
        p=path(rel);saved=backup/'files'/rel
        if saved.exists():shutil.copy2(saved,p)
        elif p.is_file():p.unlink()
        if plan['server'] and p.is_file():shutil.chown(p,user='minecraft',group='minecraft')
    raise
finally:
    if plan['server'] and was_active:
        offset=(root/'latest.log').stat().st_size;started=time.time()
        subprocess.run(['systemctl','start','minecraft-server.service'],check=True,timeout=60)
result={'label':plan['label'],'success':True,'files':len(rows),'backup':str(backup),'hashesVerified':True,'clientGameplayTest':'not_run'}
if plan['server'] and was_active:
    text=''
    for _ in range(50):
        time.sleep(1);raw=(root/'latest.log').read_bytes();text=raw[offset if len(raw)>=offset else 0:].decode(errors='replace')
        if 'Server started.' in text:break
    time.sleep(8);raw=(root/'latest.log').read_bytes();text=raw[offset if len(raw)>=offset else 0:].decode(errors='replace')
    content=[{'file':p.name,'text':p.read_text(errors='replace')} for folder in [root,root/'logs'] for p in folder.glob('ContentLog*.txt') if p.stat().st_mtime>=started]
    result.update(service=subprocess.check_output(['systemctl','is-active','minecraft-server.service'],text=True).strip(),startupConfirmed='Server started.' in text,
        errors=[l for t in [text]+[c['text'] for c in content] for l in t.splitlines() if re.search(r'\b(error|exception)\b',l,re.I)])
    plan_path.with_name('server-startup.log').write_text(text,encoding='utf-8')
    plan_path.with_name('server-content.json').write_text(json.dumps(content,ensure_ascii=False),encoding='utf-8')
    assert result['service']=='active' and result['startupConfirmed'],result
result['finishedUtc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
plan_path.with_name(plan['label']+'-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
(backup/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=True),flush=True)

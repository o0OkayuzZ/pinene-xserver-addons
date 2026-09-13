"""Apply a reviewed file/hash plan to an offline local world or Bedrock server.

Usage: python apply_addon_release.py /absolute/path/to/stage/manifest.json
The payload contains only addon files. World databases are backed up and verified,
never copied from Git. Target paths and concurrent edits are checked before writes.
"""
from pathlib import Path
import datetime,hashlib,json,os,shutil,subprocess,sys,tarfile,time,re

manifest_path=Path(sys.argv[1]).resolve();stage=manifest_path.parent
plan=json.loads(manifest_path.read_text(encoding='utf-8'))
root=Path(plan['root']).resolve();world=Path(plan['world']).resolve();backup=Path(plan['backup']).resolve()
assert root.is_dir() and world.is_dir() and not backup.exists()
assert backup!=root and backup!=world and world not in backup.parents
server=plan['server'];was_active=False;stopped=False;originals={};applied=False
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def target(rel):
 p=(root/rel).resolve();assert root in p.parents,rel
 assert rel in plan['references'] or any(rel.startswith(prefix+'/') for prefix in plan['prefixes']),rel
 return p
def saves():
 return {p.relative_to(world).as_posix():sha(p) for p in world.rglob('*') if p.is_file() and p.relative_to(world).parts[0] not in ('behavior_packs','resource_packs','world_behavior_packs.json','world_resource_packs.json')}
for rel in plan['updates']:
 assert sha(stage/'files'/rel)==plan['desired'][rel]['sha'],rel
for rel,expected in plan['before'].items():
 p=target(rel);assert (sha(p) if p.is_file() else None)==expected,('Concurrent edit',rel)
for rel,data in plan['references'].items():
 p=target(rel);actual=json.loads(p.read_text(encoding='utf-8-sig')) if p.is_file() else None
 assert actual==plan['referencesBefore'].get(rel),('Concurrent registration edit',rel)
# Every proposed active pack and UUID dependency must agree before restart.
manifests={}
for kind in ['behavior_packs','resource_packs']:
 for record in plan['references']['world_'+kind+'.json']:
  uuid=record['pack_id'];candidates=list((root/kind).glob('*/manifest.json'))
  for file in candidates:
   name=file.relative_to(root).as_posix();source=stage/'files'/name if name in plan['updates'] else file
   m=json.loads(source.read_text(encoding='utf-8-sig'))
   if m.get('header',{}).get('uuid')==uuid:
    assert m['header']['version']==record['version'],('Manifest registration version',name)
    manifests[uuid]=m;break
  assert uuid in manifests,('Missing active pack',uuid)
for m in manifests.values():
 for dep in m.get('dependencies',[]):
  if 'uuid' in dep:assert dep['uuid'] in manifests and dep['version']==manifests[dep['uuid']]['header']['version'],('Dependency mismatch',m['header']['name'],dep)
if server:
 assert str(root)=='/opt/minecraft/server'
 was_active=subprocess.run(['systemctl','is-active','--quiet','minecraft-server.service']).returncode==0
 if was_active:
  log=root/'latest.log';offset=log.stat().st_size
  subprocess.run(['runuser','-u','minecraft','--','screen','-S','minecraft','-p','0','-X','stuff','list\r'],check=True)
  count=None
  for _ in range(20):
   time.sleep(.5);text=log.read_bytes()[offset:].decode(errors='replace');match=re.search(r'There are (\d+)/\d+ players online',text)
   if match:count=int(match[1]);break
  assert count==0,('Not stopping: online player count',count)
  subprocess.run(['systemctl','stop','minecraft-server.service'],check=True);stopped=True
 assert subprocess.run(['pgrep','-x','bedrock_server'],stdout=subprocess.DEVNULL).returncode==1
else:
 assert 'Minecraft.Windows.exe' not in subprocess.check_output(['tasklist','/FO','CSV','/NH'],text=True,errors='replace')
try:
 backup.mkdir(parents=True);before_saves=saves()
 print('Creating complete world backup: '+str(backup),flush=True)
 if server:subprocess.run(['tar','-czf',str(backup/'world-before.tar.gz'),'-C',str(world.parent),world.name],check=True)
 else:
  with tarfile.open(backup/'world-before.tar.gz','w:gz') as archive:archive.add(world,arcname=world.name)
 changes=plan['updates']+list(plan['references'])
 for rel in changes:
  p=target(rel);originals[rel]=p.is_file()
  if p.is_file():q=backup/'files'/rel;q.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,q)
 (backup/'manifest.json').write_bytes(manifest_path.read_bytes())
 (backup/'original-existence.json').write_text(json.dumps(originals),encoding='utf-8')
 for rel in changes:
  p=target(rel);p.parent.mkdir(parents=True,exist_ok=True);tmp=p.with_name(p.name+'.release-tmp')
  if rel in plan['references']:tmp.write_bytes((json.dumps(plan['references'][rel],ensure_ascii=False,indent=2)+'\n').encode())
  else:shutil.copy2(stage/'files'/rel,tmp)
  os.replace(tmp,p)
  if server:shutil.chown(p,user='minecraft',group='minecraft')
 for rel,want in plan['desired'].items():assert hashlib.sha256(target(rel).read_bytes().replace(b'\r\n',b'\n')).hexdigest()==want['normalized'],('Deployed mismatch',rel)
 assert saves()==before_saves,'Save data changed during addon deployment'
 applied=True
 result={'sourceCommit':plan['sourceCommit'],'target':plan['label'],'changedPackFiles':len(plan['updates']),'verifiedPackFiles':len(plan['desired']),'saveFilesUnchanged':len(before_saves),'backup':str(backup),'success':True,'clientGameplayTest':'not_run'}
except BaseException:
 for rel,existed in originals.items():
  p=target(rel)
  if existed:shutil.copy2(backup/'files'/rel,p)
  elif p.is_file():p.unlink()
  if server and p.is_file():shutil.chown(p,user='minecraft',group='minecraft')
 raise
finally:
 if server and (stopped or applied):
  started=time.time();subprocess.run(['systemctl','start','minecraft-server.service'],check=True)
if server:
 latest=''
 for _ in range(50):
  time.sleep(1);latest=(root/'latest.log').read_text(errors='replace')
  if 'Server started.' in latest:break
 service=subprocess.check_output(['systemctl','is-active','minecraft-server.service'],text=True).strip()
 content=[{'name':p.name,'text':p.read_text(errors='replace')} for folder in [root,root/'logs'] for p in folder.glob('ContentLog*.txt') if p.is_file() and p.stat().st_mtime>=started]
 errors=[l for text in [latest]+[c['text'] for c in content] for l in text.splitlines() if re.search(r'\b(error|exception)\b',l,re.I)]
 result.update(service=service,startupConfirmed='Server started.' in latest,errors=errors,contentLogFiles=len(content))
 (stage/'startup.log').write_text(latest,encoding='utf-8');(stage/'content.json').write_text(json.dumps(content,ensure_ascii=False),encoding='utf-8')
 assert service=='active' and result['startupConfirmed'],'Startup failed; complete backup retained'
result['finishedUtc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
for file in [stage/'result.json',backup/'result.json']:file.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=True),flush=True)
if server and result['errors']:raise SystemExit('Startup errors require review')

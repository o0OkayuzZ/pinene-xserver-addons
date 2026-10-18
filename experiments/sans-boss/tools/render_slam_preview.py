"""Staged gravity slam choreography; actual landing uses Bedrock physics."""
from pathlib import Path
import json,math,wave,subprocess
import numpy as np
from PIL import Image,ImageDraw
from scipy.signal import resample_poly
import render_attack_preview as r
from render_preview import quads,font,rotation
OUT=Path(__file__).resolve().parents[1]/'dist';ROOT=OUT.parent
T=json.loads((OUT/'slam_attack_timeline.json').read_text())
az,el=np.deg2rad([25,28]);r.CAM=np.array([math.sin(az)*math.cos(el),math.sin(el),-math.cos(az)*math.cos(el)])
right=np.cross(r.CAM,[0,1,0]);right/=np.linalg.norm(right);up=np.cross(right,r.CAM)
r.BASIS=np.stack([right,up,r.CAM],axis=1);r.ZOOM=57;r.VIEW=np.array([-.3,.5,0.])
model=quads('bone');heart=quads('soul');png=OUT/'slam_frames';png.mkdir(exist_ok=True)
def clip(vertices):
 poly=list(vertices);result=[]
 for a,b in zip(poly,poly[1:]+poly[:1]):
  ia=a[1]>=0;ib=b[1]>=0
  if ia:result.append(a)
  if ia!=ib:result.append(a+(b-a)*(-a[1]/(b[1]-a[1])))
 return [np.array([result[0],result[i],result[i+1],result[i+1]]) for i in range(1,len(result)-1)]
for i,s in enumerate(T):
 age=s['age'];feet=np.array(list(s['feet'].values()));canvas=r.background()
 gesture=1 if 0<=age<22 else 2 if 22<=age<29 else 0
 surfaces=[(v/16+[-3,0,1],uv,g,None) for v,uv,g in quads('sans',casting=0<=age<34,slam=gesture)]
 for v,uv,g,c in r.mannequin(feet[0],26<=age<30):surfaces.append((v+[0,feet[1],feet[2]],uv,g,c))
 if s['soul']:
  for v,uv,g in heart:surfaces.append((v/16+feet+[0,.98,-.37],uv,True,None))
 if 26<=age<34:
  radius=.35+(age-26)*.22
  for a in np.linspace(0,2*math.pi,18,endpoint=False):surfaces+=r.box([feet[0]+math.cos(a)*radius-.035,.025,math.sin(a)*radius-.035],[.07,.035,.07],[83,193,237])
 for b in s['bones']:
  pose=b['pose'];base=np.array(list(b['base'].values()));axis=np.array(list(b['direction'].values()))
  if pose['warning']:surfaces+=r.box(base+[-.3,.015,-.0125],[.6,.025,.025],[2,2,5])
  if pose['presence']<=0:continue
  mat=rotation([0,b['azimuth'],b['tilt']])
  for v,uv,g in model:
   world=(v/16*[1,b['length']/1.5,1])@mat.T+base+axis*pose['slide']
   surfaces.extend((face,uv,g,None) for face in clip(world))
 rgba,_,_=r.render_surfaces(surfaces);layer=Image.fromarray(rgba,'RGBA');canvas.paste(layer,(0,0),layer)
 d=ImageDraw.Draw(canvas);d.rectangle([0,0,r.WIDTH,106],fill='#142131')
 d.text((28,18),'SANS  /  BLUE SOUL GRAVITY SLAM',font=font(25,True),fill='#eff6fa')
 d.text((29,58),'BLUE SOUL  >  LIFT  >  SLAM  >  ALTERNATING BONES',font=font(13,True),fill='#b0cbdc')
 d.text((29,83),'REFERENCE SFX  /  STAGED OFFLINE CHOREOGRAPHY',font=font(11),fill='#829eb1')
 d.rectangle([0,575,r.WIDTH,r.HEIGHT],fill='#111c29')
 label='READY' if age<0 else 'BLUE SOUL / HAND UP' if age<10 else 'GRAVITY LIFT' if age<22 else 'HAND DOWN / SLAM' if age<26 else 'IMPACT' if age<34 else 'FOLLOW-UP: 4 BONES / SECOND'
 d.text((28,592),label,font=font(20,True),fill='#a1e5d5')
 d.text((29,627),'Original-pitch cue / One impact hit / Left-right bone follow-up',font=font(13),fill='#9daebe')
 d.text((29,651),'Flight shown here is staged; Minecraft physics and terrain determine the actual landing.',font=font(11),fill='#829eb1')
 canvas.save(png/f'{i:04}.png')
 if age==18:canvas.save(OUT/'Slam_Preview_Check.png')
 if i%40==0:print('Slam frames',i,'/',len(T),flush=True)
rate=48000;mix=np.zeros(round(len(T)/20*rate))
for age,name in [(0,'gravity_cue'),(22,'gravity_cue'),(26,'slam_impact')]:
 raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(ROOT/'RP/sounds/pinene_sans'/(name+'.ogg')),'-f','f32le','-ac','1','-ar',str(rate),'-'])
 a=np.frombuffer(raw,dtype='<f4').astype(float)*.65;start=round((age+10)/20*rate);n=min(len(a),len(mix)-start);mix[start:start+n]+=a[:n]
mix*=min(1,.92/max(1e-9,abs(mix).max()))
with wave.open(str(OUT/'slam_preview_audio.wav'),'wb') as f:
 f.setparams((1,2,rate,len(mix),'NONE','not compressed'));f.writeframes((mix*32767).astype('<i2').tobytes())
print('Slam audio peak',float(abs(mix).max()),flush=True)

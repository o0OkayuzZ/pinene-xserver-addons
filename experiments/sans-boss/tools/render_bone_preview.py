"""Continuous angled ground-spike preview using shared runtime poses."""
from pathlib import Path
import json, math
import numpy as np
from PIL import Image, ImageDraw
import render_attack_preview as r
from render_preview import quads, font, rotation
OUT=Path(__file__).resolve().parents[1]/'dist'
timeline=json.loads((OUT/'bone_attack_timeline.json').read_text())
az,el=np.deg2rad([38,28])
r.CAM=np.array([math.sin(az)*math.cos(el),math.sin(el),-math.cos(az)*math.cos(el)])
right=np.cross(r.CAM,[0,1,0]);right/=np.linalg.norm(right)
up=np.cross(right,r.CAM)
r.BASIS=np.stack([right,up,r.CAM],axis=1);r.ZOOM=64
r.VIEW=np.array([0.,.35,0.])
model=quads('bone')
def above_ground(vertices):
 poly=list(vertices);clipped=[]
 for a,b in zip(poly,poly[1:]+poly[:1]):
  ia=a[1]>=0;ib=b[1]>=0
  if ia:clipped.append(a)
  if ia!=ib:clipped.append(a+(b-a)*(-a[1]/(b[1]-a[1])))
 return [np.array([clipped[0],clipped[i],clipped[i+1],clipped[i+1]]) for i in range(1,len(clipped)-1)]
frames=[];png=OUT/'bone_spike_frames';png.mkdir(exist_ok=True)
for index,s in enumerate(timeline):
 canvas=r.background();surfaces=r.mannequin(s['feet']['x'],s['hit'],s['feet']['z'])
 for b in s['bones']:
  pose=b['pose'];base=np.array(list(b['base'].values()));axis=np.array(list(b['direction'].values()))
  if pose['warning']:
   # A small, thin cross fixes each upcoming insertion point.
   surfaces+=r.box(base+[-.3,.015,-.0125],[.6,.025,.025],[2,2,5])
   surfaces+=r.box(base+[-.0125,.015,-.3],[.025,.025,.6],[2,2,5])
  if pose['presence']<=0:continue
  mat=rotation([0,b['azimuth'],b['tilt']])
  for verts,uv,glow in model:
   world=(verts/16*np.array([1,b['length']/1.5,1]))@mat.T+base+axis*pose['slide']
   surfaces.extend((face,uv,glow,None) for face in above_ground(world))
 rgba,_,_=r.render_surfaces(surfaces);layer=Image.fromarray(rgba,'RGBA');canvas.paste(layer,(0,0),layer)
 draw=ImageDraw.Draw(canvas);draw.rectangle([0,0,r.WIDTH,106],fill='#142131')
 draw.text((28,18),'SANS  /  CONTINUOUS BONE SPIKES',font=font(25,True),fill='#f0f6fa')
 draw.text((29,58),'LEFT  >  RIGHT  >  LEFT  /  VARIED ANGLES',font=font(13,True),fill='#b0cbdc')
 draw.text((29,83),'EXPORTED ASSETS + SHARED COMBAT RULES  /  OFFLINE PREVIEW',font=font(11),fill='#829eb1')
 draw.rectangle([0,575,r.WIDTH,r.HEIGHT],fill='#111c29')
 draw.text((28,592),'4 BONES / SECOND',font=font(20,True),fill='#eff5ed')
 draw.text((490,592),f"{s['spawned']:02d} / 16   |   2-28 DEGREE LEAN",font=font(16,True),fill='#a1e5d5')
 draw.text((29,625),'0.5s warning / 0.2s thrust / 0.5s hold / 0.4s retreat',font=font(13),fill='#9daebe')
 draw.text((29,650),'Alternating lean / Random variation within each side / New bones follow the target.',font=font(12),fill='#829eb1')
 canvas.save(png/f'{index:04}.png');frames.append(canvas)
 if s['tick']==42:canvas.save(OUT/'Bone_Spikes_Alternating.png')
 if index%40==0:print('Spike frames',index,'/',len(timeline),flush=True)
palette=Image.new('RGB',(r.WIDTH*3,r.HEIGHT))
for n,i in enumerate([20,50,80]):palette.paste(frames[i],(n*r.WIDTH,0))
palette=palette.quantize(colors=160,method=Image.Quantize.MEDIANCUT)
indexed=[f.quantize(palette=palette,dither=Image.Dither.NONE) for f in frames]
path=OUT/'Sans_Bone_Spikes_Alternating_v072.gif'
indexed[0].save(path,save_all=True,append_images=indexed[1:],duration=50,loop=0,optimize=True,disposal=1)
print(path,flush=True)

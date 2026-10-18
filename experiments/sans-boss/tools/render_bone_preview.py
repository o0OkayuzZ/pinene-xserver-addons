"""Offline bone animation preview from exported assets and shared JS snapshots."""
from pathlib import Path
import json,math
import numpy as np
from PIL import Image,ImageDraw
import render_attack_preview as r
from render_preview import quads,font

OUT=Path(__file__).resolve().parents[1]/'dist'
timeline=json.loads((OUT/'bone_attack_timeline.json').read_text())
az,el=np.deg2rad([38,28])
r.CAM=np.array([math.sin(az)*math.cos(el),math.sin(el),-math.cos(az)*math.cos(el)])
right=np.cross(r.CAM,[0,1,0]);right/=np.linalg.norm(right)
up=np.cross(right,r.CAM)
r.BASIS=np.stack([right,up,r.CAM],axis=1);r.ZOOM=42
model=quads('bone')

def above_ground(vertices):
    # Clip the mesh at the real floor; buried bones must remain hidden.
    poly=list(vertices);clipped=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        inside_a=a[1]>=0;inside_b=b[1]>=0
        if inside_a:clipped.append(a)
        if inside_a!=inside_b:
            clipped.append(a+(b-a)*(-a[1]/(b[1]-a[1])))
    return [np.array([clipped[0],clipped[i],clipped[i+1],clipped[i+1]]) for i in range(1,len(clipped)-1)]

frames=[]
for index,s in enumerate(timeline):
    age=s['age'];feet=np.array(list(s['feet'].values()))
    r.VIEW=np.array([0.,0.,1.-7*max(0,min(1,(age-60)/23))])
    canvas=r.background();draw=ImageDraw.Draw(canvas)
    surfaces=[(verts+[0,feet[1],0],uv,glow,colour) for verts,uv,glow,colour in r.mannequin(feet[0],s['hit'],feet[2])]
    if s['visible']:
        for b in s['bones']:
            for verts,uv,glow in model:
                world=verts/16*np.array([1,b['height']/1.5,1])+[b['x'],b['offsetY'],b['z']]
                surfaces.extend((face,uv,glow,None) for face in above_ground(world))
            if s['pose']['warning']:
                surfaces+=r.box([b['x']-.018,.018,b['z']-.36],[.035,.035,.72],[2,2,5])
    rgba,_,_=r.render_surfaces(surfaces)
    layer=Image.fromarray(rgba,'RGBA');canvas.paste(layer,(0,0),layer)
    draw=ImageDraw.Draw(canvas)
    draw.rectangle([0,0,r.WIDTH,106],fill='#142131')
    draw.text((28,18),'SANS  /  BONE WALL ANIMATION',font=font(25,True),fill='#f0f6fa')
    draw.text((29,58),'GROUND MARKS  >  RISE  >  SPRING + ADVANCE  >  SINK',font=font(13,True),fill='#b0cbdc')
    draw.text((29,83),'EXPORTED ASSETS + SHARED COMBAT RULES  /  OFFLINE PREVIEW',font=font(11),fill='#829eb1')
    draw.rectangle([0,575,r.WIDTH,r.HEIGHT],fill='#111c29')
    variant='01 / LOW WALL - JUMP' if s['type']=='low' else '02 / TALL WALL - GAP'
    phase='READY' if age<0 else 'GROUND WARNING' if age<12 else 'RISE / NO DAMAGE' if age<18 else 'SPRING + ADVANCE' if age<28 else 'JUMP OVER' if s['type']=='low' and 38<=age<=56 else 'DODGE THROUGH GAP' if s['type']=='tall' and age<55 else 'SINK / NO DAMAGE' if age>=83 else 'WALL SWEEP'
    draw.text((28,592),variant,font=font(18,True),fill='#eff5ed')
    draw.text((450,592),phase,font=font(17,True),fill='#a1e5d5')
    draw.text((29,625),'0.9s warning  |  rise during final 0.3s  |  active motion: 20 ticks/s',font=font(12),fill='#9daebe')
    draw.text((29,650),'Jumpable low bones / Two-slot opening in tall walls / Cosmetic retreat has no damage',font=font(11),fill='#829eb1')
    frames.append(canvas)
    if s['type']=='tall' and age in [8,15,20,46,86]:canvas.save(OUT/f'bone-check-{age}.png')
    if index%40==0:print('Bone frames',index,'/',len(timeline),flush=True)
palette=Image.new('RGB',(r.WIDTH*3,r.HEIGHT))
for n,i in enumerate([23,54,154]):palette.paste(frames[i],(n*r.WIDTH,0))
palette=palette.quantize(colors=160,method=Image.Quantize.MEDIANCUT)
indexed=[f.quantize(palette=palette,dither=Image.Dither.NONE) for f in frames]
path=OUT/'Pinene_Sans_Bone_Attack_Preview.gif'
indexed[0].save(path,save_all=True,append_images=indexed[1:],duration=50,loop=0,optimize=True,disposal=1)
print(path,flush=True)

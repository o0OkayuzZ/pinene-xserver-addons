"""Combined staged choreography, using exported models and shared attack snapshots.

This is an offline animation, not a capture or Bedrock physics validation.
"""
from pathlib import Path
import json, math, subprocess, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import render_attack_preview as r
from render_preview import quads, rotation, font

ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'dist'
FPS=20
for name in ['bone','slam','attack']:
    subprocess.run(['node',str(ROOT/'tools'/f'build_{name}_timeline.mjs')],check=True)
load=lambda n:json.loads((OUT/f'{n}_attack_timeline.json').read_text())
bones,slams,blasts=load('bone'),load('slam'),load('blaster')
timeline=[]
for t in range(24):timeline.append(('warp',{'tick':t,'feet':{'x':0,'y':0,'z':0}}))
timeline += [('bones',s) for s in bones]
# A short travel beat makes the target's next position continuous.
for t in range(16):
    a=t/15; end=bones[-1]['feet']
    timeline.append(('step',{'tick':t,'feet':{'x':end['x']*(1-a)+1.2*a,'y':0,'z':end['z']*(1-a)}}))
timeline += [('slam',s) for s in slams]
for t in range(16):
    a=t/15;end=slams[-1]['feet']
    timeline.append(('surround',{'tick':t,'feet':{'x':end['x']*(1-a),'y':0,'z':0}}))
timeline += [('blaster',s) for s in blasts]
timeline += [('end',{'tick':t,'feet':blasts[-1]['feet']}) for t in range(16)]

az,el=np.deg2rad([20,29]);r.CAM=np.array([math.sin(az)*math.cos(el),math.sin(el),-math.cos(az)*math.cos(el)])
right=np.cross(r.CAM,[0,1,0]);right/=np.linalg.norm(right)
r.BASIS=np.stack([right,np.cross(right,r.CAM),r.CAM],axis=1)
r.VIEW=np.array([.1,.5,0.])
bone_model=quads('bone'); heart=quads('soul')
frames=OUT/'battle_v097_frames';frames.mkdir(exist_ok=True)

def clip(vertices):
    poly=list(vertices);result=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        ia=a[1]>=0;ib=b[1]>=0
        if ia:result.append(a)
        if ia!=ib:result.append(a+(b-a)*(-a[1]/(b[1]-a[1])))
    return [np.array([result[0],result[i],result[i+1],result[i+1]]) for i in range(1,len(result)-1)]

events=[];checkpoints={40:'BONE STREAM',210:'GRAVITY SLAM',385:'ENCIRCLEMENT'}
for i,(stage,s) in enumerate(timeline):
    t=s.get('age',s.get('tick',0));feet=np.array([s['feet'][k] for k in ['x','y','z']])
    # Open up smoothly as the heads begin to surround the target.
    zoom=58 if stage not in ['surround','blaster','end'] else 58-23*min(1,(t+1)/16) if stage=='surround' else 35
    r.ZOOM=zoom;canvas=r.background();surfaces=[]
    gesture=(1 if 0<=t<22 else 2 if 22<=t<29 else 0) if stage=='slam' else 1 if stage=='bones' and 0<=t<80 else 0
    casting=gesture>0 or stage=='blaster' and 0<=t<65
    boss=np.array([-3.4,0,1.2])
    if stage=='warp':boss=np.array([-1.6,0,1.2]) if t<9 else np.array([-3.4,0,1.2])
    target=feet-boss; yaw=math.degrees(math.atan2(-target[0],-target[2]))
    turn=rotation([0,yaw,0])
    visible=not(stage=='warp' and 9<=t<12)
    if visible:
        surfaces += [(v/16@turn.T+boss,uv,g,None) for v,uv,g in quads('sans',casting=casting,slam=gesture)]
    if stage=='warp' and 7<=t<17:
        for j in range(16):
            a=j*2.4;radius=.15+abs(t-11)*.085
            p=boss+[math.cos(a)*radius,(j%5)*.28,math.sin(a)*radius]
            surfaces += r.box(p,[.045,.045,.045],[175,224,245])
    for v,uv,g,c in r.mannequin(feet[0],s.get('hit',False) or stage=='slam' and 26<=t<30):
        surfaces.append((v+[0,feet[1],feet[2]],uv,g,c))
    if stage=='slam' and s.get('soul'):
        surfaces += [(v/16+feet+[0,.98,-.37],uv,True,None) for v,uv,g in heart]
    if stage=='slam' and 26<=t<34:
        radius=.35+(t-26)*.22
        for a in np.linspace(0,2*math.pi,18,endpoint=False):
            surfaces += r.box(feet+[math.cos(a)*radius-.035,.025,math.sin(a)*radius-.035],[.07,.035,.07],[83,193,237])
    for b in s.get('bones',[]):
        pose=b['pose'];base=np.array([b['base'][k] for k in ['x','y','z']]);axis=np.array([b['direction'][k] for k in ['x','y','z']])
        if pose['warning']:surfaces += r.box(base+[-.3,.015,-.0125],[.6,.025,.025],[2,2,5])
        if pose['presence']<=0:continue
        mat=rotation([0,b['azimuth'],b['tilt']])
        for v,uv,g in bone_model:
            world=(v/16*[1,b['length']/1.5,1])@mat.T+base+axis*pose['slide']
            surfaces.extend((f,uv,g,None) for f in clip(world))
    for b in s.get('blasters',[]):
        r.ORIGIN=np.array([b['origin'][k] for k in ['x','y','z']]);aim=np.array([b['direction'][k] for k in ['x','y','z']])
        if b['visible']:surfaces+=r.head(aim,b['firing'],b['age'],b['recoil'],b['arrival'],b['departure'])
        if b['rayVisible']:surfaces+=r.ray(aim,r.LENGTH,b['width'],b['firing'])
        if b['age']==0:events.append((i,'blaster_charge'))
        if b['age']==24:events.append((i,'blaster_fire'))
    if stage=='slam' and t==18:events.append((i,'gravity_cue'))
    if stage=='slam' and t==26:events.append((i,'slam_impact'))
    rgba,_,emission=r.render_surfaces(surfaces);layer=Image.fromarray(rgba,'RGBA');canvas.paste(layer,(0,0),layer)
    blur=np.asarray(Image.fromarray(emission).filter(ImageFilter.GaussianBlur(7))).astype(float)
    canvas=Image.fromarray(np.clip(np.asarray(canvas).astype(float)+blur*.4,0,255).astype(np.uint8))
    d=ImageDraw.Draw(canvas);d.rectangle([0,0,1000,105],fill='#142131')
    d.text((28,18),'SANS  /  COMBAT SEQUENCE',font=font(25,True),fill='#eff6fa')
    d.text((29,58),'WARP  >  BONE STREAM  >  GRAVITY SLAM  >  ENCIRCLEMENT',font=font(13,True),fill='#b0cbdc')
    d.text((29,82),'CURRENT EXPORTED MODEL / APPROVED SFX / OFFLINE CHOREOGRAPHY',font=font(11),fill='#829eb1')
    d.rectangle([0,575,1000,680],fill='#111c29')
    label={'warp':'WARP','bones':'ALTERNATING BONES / 4 PER SECOND','step':'REPOSITION','slam':'BLUE SOUL / GRAVITY SLAM','surround':'SURROUND','blaster':'STAGGERED BLASTERS / KARMA','end':'SEQUENCE COMPLETE'}[stage]
    d.text((28,592),label,font=font(19,True),fill='#a1e5d5')
    d.text((29,627),'Thin warnings / Ground-clipped bones / Beam collapse / Reverse entrance exit',font=font(12),fill='#a0b9c9')
    d.text((29,651),'Staged preview: flight, gestures and transitions shown here need in-game verification.',font=font(11),fill='#829eb1')
    d.rectangle([28,670,972,674],fill='#34475b');d.rectangle([28,670,28+944*(i+1)/len(timeline),674],fill='#62c5da')
    canvas.save(frames/f'{i:04}.png')
    if i in checkpoints:canvas.save(OUT/f'Battle_Check_{i}.png')
    if i%40==0:print('Battle frames',i,'/',len(timeline),flush=True)

rate=48000;mix=np.zeros(round(len(timeline)/FPS*rate));cache={}
for frame,name in events:
    if name not in cache:
        raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(ROOT/'RP/sounds/pinene_sans'/(name+'.ogg')),'-f','f32le','-ac','1','-ar',str(rate),'-'])
        cache[name]=np.frombuffer(raw,dtype='<f4').astype(float)
    a=cache[name]*(.32 if name.startswith('blaster') else .65);start=round(frame/FPS*rate);n=min(len(a),len(mix)-start);mix[start:start+n]+=a[:n]
mix*=min(1,.92/max(1e-9,abs(mix).max()))
audio=OUT/'battle_v097_audio.wav'
with wave.open(str(audio),'wb') as f:
    f.setparams((1,2,rate,len(mix),'NONE','not compressed'));f.writeframes((mix*32767).astype('<i2').tobytes())
video=OUT/'Sans_Combat_Sequence_v097.mp4'
subprocess.run(['ffmpeg','-y','-v','error','-framerate',str(FPS),'-i',str(frames/'%04d.png'),'-i',str(audio),'-c:v','libx264','-crf','19','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart','-shortest',str(video)],check=True)
subprocess.run(['ffmpeg','-v','error','-i',str(video),'-f','null','-'],check=True)
print('BATTLE_COMPLETE',video,'seconds',len(timeline)/FPS,'sound events',len(events),flush=True)

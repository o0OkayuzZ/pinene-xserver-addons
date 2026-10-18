"""Offline attack preview using exported v0.5 geometry and current timings.

No Minecraft capture or engine verification is implied. A neutral mannequin
and explanatory HUD illustrate contact damage and the aim-lock window.
"""
from pathlib import Path
import sys, json, re, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

PROJECT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(PROJECT/'tools'))
from render_preview import quads, rotation, font

OUT=PROJECT/'dist'
WIDTH,HEIGHT=1000,680
FPS=20
config=(PROJECT/'BP/scripts/combat.js').read_text()
def setting(name):
    return float(re.search(r'\b'+re.escape(name)+r':\s*([\d.]+)',config).group(1))
CHARGE=int(setting('blasterWarningTicks'))
FIRE=int(setting('blasterFireTicks'))
LENGTH=setting('beamLength')
DAMAGE=setting('blasterDamagePerTick')
assert CHARGE==24 and FIRE==16

az,el=np.deg2rad([25,36])
CAM=np.array([math.sin(az)*math.cos(el),math.sin(el),-math.cos(az)*math.cos(el)])
RIGHT=np.cross(CAM,[0,1,0]);RIGHT/=np.linalg.norm(RIGHT)
UP=np.cross(RIGHT,CAM);UP/=np.linalg.norm(UP)
BASIS=np.stack([RIGHT,UP,CAM],axis=1)
ORIGIN=np.array([0.,2.5,10.])
VIEW=np.array([0.,0.,0.])
ZOOM=37

def project(vertices):
    projected=(np.asarray(vertices)-VIEW)@BASIS
    return np.column_stack([projected[:,0]*ZOOM+505,395-projected[:,1]*ZOOM,projected[:,2]])

RAY_ATLAS=np.asarray(Image.open(PROJECT/'RP/textures/entity/ray_preview.png').convert('RGBA'))
ATLAS=np.asarray(Image.open(PROJECT/'RP/textures/entity/sans_atlas.png').convert('RGBA'))
LIGHT=np.array([-.45,.85,-.55]);LIGHT/=np.linalg.norm(LIGHT)

def render_surfaces(surfaces):
    pixels=np.zeros((HEIGHT,WIDTH,4),np.uint8)
    depth=np.full((HEIGHT,WIDTH),-np.inf)
    emission=np.zeros((HEIGHT,WIDTH,3),np.uint8)
    def triangle(vertices,tex,normal,glow,colour,texture):
        screen=project(vertices)
        lo=np.maximum(np.floor(screen[:,:2].min(axis=0)).astype(int),0)
        hi=np.minimum(np.ceil(screen[:,:2].max(axis=0)).astype(int),[WIDTH-1,HEIGHT-1])
        if np.any(hi<lo):return
        xs,ys=np.meshgrid(np.arange(lo[0],hi[0]+1)+.5,np.arange(lo[1],hi[1]+1)+.5)
        a,b,c=screen
        denominator=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
        if abs(denominator)<1e-8:return
        u=((b[1]-c[1])*(xs-c[0])+(c[0]-b[0])*(ys-c[1]))/denominator
        v=((c[1]-a[1])*(xs-c[0])+(a[0]-c[0])*(ys-c[1]))/denominator
        w=1-u-v
        z=u*a[2]+v*b[2]+w*c[2]
        region=(slice(lo[1],hi[1]+1),slice(lo[0],hi[0]+1))
        active=(u>=-1e-5)&(v>=-1e-5)&(w>=-1e-5)&(z>depth[region]+1e-7)
        if not active.any():return
        if colour is None:
            uv=u[...,None]*tex[0]+v[...,None]*tex[1]+w[...,None]*tex[2]
            tx=np.clip(np.floor(uv[:,:,0]).astype(int),0,texture.shape[1]-1)
            ty=np.clip(np.floor(uv[:,:,1]).astype(int),0,texture.shape[0]-1)
            rgba=texture[ty,tx].astype(float)
        else:
            rgba=np.empty((*xs.shape,4));rgba[:]=[*colour,255]
        active&=rgba[:,:,3]>0
        shade=1 if glow else .57+.43*max(0,float(normal@LIGHT))
        rgba[:,:,:3]*=shade
        pixels[region][active]=np.clip(rgba[active],0,255).astype(np.uint8)
        depth[region][active]=z[active]
        emission[region][active]=rgba[active,:3].astype(np.uint8) if glow else 0
    for verts,uv,glow,colour in surfaces:
        normal=np.cross(verts[1]-verts[0],verts[2]-verts[0])
        magnitude=np.linalg.norm(normal)
        if magnitude<1e-12:continue
        normal/=magnitude
        if normal@CAM<=0:continue
        if uv:
            x,y=uv['uv'];w,h=uv['uv_size']
            tex=np.array([[x,y+h-.001],[x,y],[x+w-.001,y],[x+w-.001,y+h-.001]])
        else:tex=np.zeros((4,2))
        triangle(verts[[0,1,2]],tex[[0,1,2]],normal,glow,colour,RAY_ATLAS if uv and uv.get('ray') else ATLAS)
        triangle(verts[[0,2,3]],tex[[0,2,3]],normal,glow,colour,RAY_ATLAS if uv and uv.get('ray') else ATLAS)
    return pixels,depth,emission

def box(origin,size,colour):
    x,y,z=origin;a,b,c=np.asarray(origin)+size
    faces=[[(x,y,z),(x,b,z),(a,b,z),(a,y,z)],[(a,y,c),(a,b,c),(x,b,c),(x,y,c)],
           [(x,y,c),(x,b,c),(x,b,z),(x,y,z)],[(a,y,z),(a,b,z),(a,b,c),(a,y,c)],
           [(x,b,z),(x,b,c),(a,b,c),(a,b,z)],[(x,y,c),(x,y,z),(a,y,z),(a,y,c)]]
    return [(np.array(face),None,False,colour) for face in faces]

def mannequin(x,hit,z=0):
    output=[]
    def part(origin,size,colour):
        output.extend(box(np.array(origin)+[x,0,z],size,colour))
    cloth=[226,82,91] if hit else [69,135,172]
    part([-.25,1.35,-.25],[.5,.45,.5],[210,214,214])
    part([-.25,.65,-.17],[.5,.7,.34],cloth)
    for side in [-1,1]:
        part([side*.32-.09,.65,-.13],[.18,.67,.26],cloth)
        part([side*.14-.11,0,-.14],[.22,.65,.28],[68,77,91])
    return output

def head(direction,fire,age,recoil,arrival,departure):
    # A rotation mapping the model's local -Z forward axis to the runtime ray.
    back=-direction;right=np.cross([0,1,0],back);right/=np.linalg.norm(right)
    up=np.cross(back,right);matrix=np.stack([right,up,back],axis=1)
    return [(verts/16@matrix.T+ORIGIN,uv,glow,None) for verts,uv,glow in quads('blaster',firing=fire,age=age,recoil=recoil,arrival=arrival,departure=departure)]

def background():
    array=np.empty((HEIGHT,WIDTH,3),np.uint8)
    for y in range(HEIGHT):array[y,:,:]=[int(72-22*y/HEIGHT),int(91-25*y/HEIGHT),int(112-29*y/HEIGHT)]
    image=Image.fromarray(array);draw=ImageDraw.Draw(image)
    for x in range(-10,14):
        p=project([[x,0,-15],[x,0,15]])
        draw.line([tuple(p[0,:2]),tuple(p[1,:2])],fill='#52677a',width=1)
    for z in range(-15,16):
        p=project([[-10,0,z],[13,0,z]])
        draw.line([tuple(p[0,:2]),tuple(p[1,:2])],fill='#52677a',width=1)
    return image

def ray(direction,length,width,firing):
    back=-direction;right=np.cross([0,1,0],back);right/=np.linalg.norm(right)
    up=np.cross(back,right);matrix=np.stack([right,up,back],axis=1)
    source=box([-width/2,-width/2,-length],[width,width,length],[2,2,5])
    uv=[(0,0),(0,0),(16,0),(16,0),(8,0),(8,0)]
    output=[]
    for index,(verts,_,_,_) in enumerate(source):
        output.append((verts@matrix.T+ORIGIN,
            {'uv':uv[index],'uv_size':[8,8],'ray':True} if firing else None,
            firing,None if firing else [2,2,5]))
    return output

def main():
    global ORIGIN
    BASE=background()
    frames=[]
    timeline=json.loads((OUT/'blaster_attack_timeline.json').read_text())
    for index,snapshot in enumerate(timeline):
        local=snapshot['tick'];present=snapshot['visible'];firing=snapshot['firing']
        x=snapshot['feet']['x'];hp=snapshot['health'];debt=snapshot['debt']
        surfaces=mannequin(x,snapshot['hit'],snapshot['feet']['z'])
        for blaster in snapshot['blasters']:
            ORIGIN=np.array(list(blaster['origin'].values()))
            aim=np.array(list(blaster['direction'].values()))
            if blaster['visible']:
                surfaces+=head(aim,blaster['firing'],blaster['age'],blaster['recoil'],blaster['arrival'],blaster['departure'])
            if blaster['rayVisible']:
                surfaces+=ray(aim,LENGTH,blaster['width'],blaster['firing'])
        rgba,depth,emissive=render_surfaces(surfaces)
        canvas=BASE.copy();draw=ImageDraw.Draw(canvas)
        px,py,_=project([[x,0,snapshot['feet']['z']]])[0]
        draw.ellipse([px-13,py-4,px+13,py+4],fill='#34495a')
        layer=Image.fromarray(rgba,'RGBA');canvas.paste(layer,(0,0),layer)
        pixels=np.asarray(canvas).copy()
        blur=np.asarray(Image.fromarray(emissive).filter(ImageFilter.GaussianBlur(9))).astype(float)
        canvas=Image.fromarray(np.clip(pixels.astype(float)+blur*.45,0,255).astype(np.uint8))
        draw=ImageDraw.Draw(canvas)
        if snapshot['pulse']>0:
            center=project([[x,.9,snapshot['feet']['z']]])[0]
            for dx,dy in [(-12,-8),(8,3),(-2,15)]:
                draw.rectangle([center[0]+dx,center[1]+dy,center[0]+dx+4,center[1]+dy+4],fill='#cc65f2')
        draw.rectangle([0,0,WIDTH,105],fill='#142131')
        draw.text((28,19),'GASTER BLASTER  /  ENCIRCLEMENT',font=font(24,True),fill='#f0f6fa')
        draw.text((29,58),'POP  >  SURROUND  >  STAGGERED BLASTS  >  KARMA',font=font(14,True),fill='#b0cbdc')
        draw.text((29,83),'CURRENT ASSETS + COMBAT RULES  /  OFFLINE PREVIEW',font=font(11),fill='#829eb1')
        draw.rectangle([0,575,WIDTH,HEIGHT],fill='#111c29')
        count=sum(b['visible'] for b in snapshot['blasters'])
        stage=('READY' if local<0 else 'POP / ENCIRCLE' if local<24 else 'STAGGERED BLASTS' if firing
               else 'RETREAT / KARMA' if present else 'LINGERING KARMA' if debt>0 else 'KARMA CLEARED')
        draw.text((28,118),f'{count} / 6 BLASTERS   |   0.2s SPAWN RHYTHM',font=font(14,True),fill='#d8e8f2')
        draw.text((400,591),stage,font=font(17,True),fill='#dc8dff' if debt>0 and not firing else '#c3edff')
        draw.text((28,592),f'HP  {hp:04.2f} / 20   KR  {debt:04.2f}',font=font(15,True),fill='#eaf1f5')
        draw.rectangle([29,622,326,636],fill='#2b394a')
        solid=max(0,hp-debt)
        draw.rectangle([29,622,29+297*hp/20,636],fill='#be5ce5')
        draw.rectangle([29,622,29+297*solid/20,636],fill='#e36b78' if snapshot['hit'] else '#6fc8b5')
        draw.text((29,650),'GREEN: HEALTH   PURPLE: PENDING KARMA',font=font(10),fill='#9daebe')
        for lo,hi,colour in [(0,24,'#6a7782'),(24,60,'#69d7ed'),(60,80,'#9753ad')]:
            draw.rectangle([400+lo*6.5,626,400+hi*6.5,635],fill=colour)
        marker=400+min(80,max(0,local))*6.5
        draw.rectangle([marker-1,621,marker+1,640],fill='#ffffff')
        draw.text((400,650),'6 directions  |  individual aim lock  |  KR continues after dodging',font=font(10),fill='#829eb1')
        frames.append(canvas)
        if local in (3,20,30,44,60):canvas.save(OUT/f'lifecycle-{local}.png')
        if index%30==0:print('Rendered',index,'/',len(timeline),flush=True)
    assert timeline[-1]['debt']==0 and timeline[-1]['health']>0
    palette=Image.new('RGB',(WIDTH*3,HEIGHT))
    for index,frame in enumerate([frames[25],frames[36],frames[66]]):palette.paste(frame,(WIDTH*index,0))
    palette=palette.quantize(colors=192,method=Image.Quantize.MEDIANCUT)
    indexed=[frame.quantize(palette=palette,dither=Image.Dither.NONE) for frame in frames]
    path=OUT/'Pinene_Gaster_Blaster_Hover_Karma_Preview.gif'
    indexed[0].save(path,save_all=True,append_images=indexed[1:],duration=50,loop=0,optimize=True,disposal=1)
    frames[25].save(OUT/'karma-preview-warning-check.png')
    frames[36].save(OUT/'karma-preview-fire-check.png')
    frames[66].save(OUT/'karma-preview-tail-check.png')
    print(path,flush=True)

if __name__=='__main__':main()

"""Render the exported Bedrock cubes/UVs with a CPU depth buffer.

This is an honest offline model view, not an imagegen concept. Bone/cube
rotations and the casting/firing pose use the same pivots as the resource pack.
Requires NumPy and Pillow; those are preview-only dependencies.
"""
from pathlib import Path
import json
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
RP = ROOT/'RP'

def load(path): return json.loads(path.read_text(encoding='utf-8'))

def rotation(angles):
    x,y,z=np.deg2rad(angles)
    rx=np.array([[1,0,0],[0,math.cos(x),-math.sin(x)],[0,math.sin(x),math.cos(x)]])
    ry=np.array([[math.cos(y),0,math.sin(y)],[0,1,0],[-math.sin(y),0,math.cos(y)]])
    rz=np.array([[math.cos(z),-math.sin(z),0],[math.sin(z),math.cos(z),0],[0,0,1]])
    return rz@ry@rx

def transform(pivot, angles=(0,0,0)):
    matrix=np.eye(4); matrix[:3,:3]=rotation(angles)
    point=np.array(pivot); matrix[:3,3]=point-matrix[:3,:3]@point
    return matrix

def quads(name, casting=False, firing=False, age=0, recoil=0):
    geo=load(RP/f'models/entity/{name}.geo.json')['minecraft:geometry'][0]
    matrices={}; output=[]
    for bone in geo['bones']:
        key=bone['name']
        if key=='magic_eye' and not casting or key=='pupil' and casting or key=='core' and not firing:
            continue
        angles=bone.get('rotation',[0,0,0])
        if name=='blaster' and key=='jaw': angles=[-46 if firing else -4,0,0]
        if name=='blaster' and key=='skull': angles=[10 if firing else 0,0,0]
        if name=='blaster' and key=='root':angles=[0,0,math.sin(math.radians(age/20*80))*1.5]
        local=transform(bone.get('pivot',[0,0,0]),angles)
        if name=='blaster' and key in ['jaw','skull']:
            local[:3,3]+=np.array([0,math.sin(math.radians(age/20*140))*.55,recoil*2.8])
        matrices[key]=matrices.get(bone.get('parent'),np.eye(4))@local
        for cube in bone.get('cubes',[]):
            x,y,z=cube['origin']; sx,sy,sz=cube['size']; a,b,c=x+sx,y+sy,z+sz
            faces={
                'north':[(x,y,z),(x,b,z),(a,b,z),(a,y,z)],
                'south':[(a,y,c),(a,b,c),(x,b,c),(x,y,c)],
                'west':[(x,y,c),(x,b,c),(x,b,z),(x,y,z)],
                'east':[(a,y,z),(a,b,z),(a,b,c),(a,y,c)],
                'up':[(x,b,z),(x,b,c),(a,b,c),(a,b,z)],
                'down':[(x,y,c),(x,y,z),(a,y,z),(a,y,c)],
            }
            pivot=cube.get('pivot',[x+sx/2,y+sy/2,z+sz/2])
            matrix=matrices[key]@transform(pivot,cube.get('rotation',[0,0,0]))
            for face,vertices in faces.items():
                verts=np.array([(*v,1) for v in vertices])@matrix.T
                output.append((verts[:,:3],cube['uv'][face],key in ['magic_eye','eyes','core']))
    return output

def render(name, width=720,height=850, casting=False,firing=False, azimuth=25,elevation=10):
    surfaces=quads(name,casting,firing)
    az,el=np.deg2rad([azimuth,elevation])
    toward=np.array([math.sin(az)*math.cos(el),math.sin(el),-math.cos(az)*math.cos(el)])
    right=np.cross(toward,[0,1,0]);right/=np.linalg.norm(right)
    up=np.cross(right,toward);up/=np.linalg.norm(up)
    basis=np.stack([right,up,toward],axis=1)
    points=np.concatenate([verts for verts,uv,glow in surfaces])@basis
    extent=np.ptp(points[:,:2],axis=0); center=(points[:,:2].max(axis=0)+points[:,:2].min(axis=0))/2
    zoom=min((width-120)/extent[0],(height-140)/extent[1])
    atlas=np.asarray(Image.open(RP/'textures/entity/sans_atlas.png').convert('RGBA'))
    pixels=np.zeros((height,width,4),dtype=np.float64)
    depth=np.full((height,width),-np.inf)
    glowmask=np.zeros((height,width,3),dtype=np.float64)
    light=np.array([-0.45,0.85,-0.55]);light/=np.linalg.norm(light)

    def triangle(vertices,tex,normal,glow):
        projected=vertices@basis
        screen=np.column_stack([(projected[:,0]-center[0])*zoom+width/2,
                                height/2-(projected[:,1]-center[1])*zoom,projected[:,2]])
        lo=np.maximum(np.floor(screen[:,:2].min(axis=0)).astype(int),0)
        hi=np.minimum(np.ceil(screen[:,:2].max(axis=0)).astype(int),[width-1,height-1])
        if np.any(hi<lo):return
        xs,ys=np.meshgrid(np.arange(lo[0],hi[0]+1)+0.5,np.arange(lo[1],hi[1]+1)+0.5)
        a,b,c=screen
        denom=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
        if abs(denom)<1e-7:return
        u=((b[1]-c[1])*(xs-c[0])+(c[0]-b[0])*(ys-c[1]))/denom
        v=((c[1]-a[1])*(xs-c[0])+(a[0]-c[0])*(ys-c[1]))/denom
        w=1-u-v
        z=u*a[2]+v*b[2]+w*c[2]
        region=(slice(lo[1],hi[1]+1),slice(lo[0],hi[0]+1))
        active=(u>=-0.0001)&(v>=-0.0001)&(w>=-0.0001)&(z>depth[region]+1e-6)
        if not active.any():return
        uv=u[...,None]*tex[0]+v[...,None]*tex[1]+w[...,None]*tex[2]
        tx=np.clip(np.floor(uv[...,0]).astype(int),0,atlas.shape[1]-1)
        ty=np.clip(np.floor(uv[...,1]).astype(int),0,atlas.shape[0]-1)
        rgba=atlas[ty,tx].astype(float)
        active&=rgba[:,:,3]>0
        shade=1 if glow else 0.55+0.45*max(0,float(np.dot(normal,light)))
        rgba[:,:,:3]*=shade
        depth[region][active]=z[active]
        pixels[region][active]=rgba[active]
        glowmask[region][active]=rgba[active,:3]/255 if glow else 0

    for verts,uv,glow in surfaces:
        normal=np.cross(verts[1]-verts[0],verts[2]-verts[0]);normal/=np.linalg.norm(normal)
        if np.dot(normal,toward)<=0:continue
        x,y=uv['uv'];w,h=uv['uv_size']
        tex=np.array([[x,y+h-0.001],[x,y],[x+w-0.001,y],[x+w-0.001,y+h-0.001]])
        triangle(verts[[0,1,2]],tex[[0,1,2]],normal,glow)
        triangle(verts[[0,2,3]],tex[[0,2,3]],normal,glow)
    image=Image.fromarray(np.clip(pixels,0,255).astype(np.uint8),'RGBA')
    glow=Image.fromarray(np.clip(glowmask*255,0,255).astype(np.uint8),'RGB')
    return image,glow

def font(size,bold=False):
    paths=['/usr/share/fonts/truetype/dejavu/DejaVuSans'+('-Bold' if bold else '')+'.ttf',
           'C:/Windows/Fonts/arial'+('bd' if bold else '')+'.ttf']
    for path in paths:
        if Path(path).is_file():return ImageFont.truetype(path,size)
    return ImageFont.load_default()

def main():
    width,height=1600,1000
    gradient=np.zeros((height,width,3),dtype=np.uint8)
    for y in range(height):
        t=y/(height-1);gradient[y,:,:]=[int(23-12*t),int(38-18*t),int(54-24*t)]
    canvas=Image.fromarray(gradient,'RGB')
    draw=ImageDraw.Draw(canvas)
    draw.text((66,42),'SANS  /  MODEL PREVIEW 02',font=font(29,True),fill='#eaf3f7')
    draw.text((68,88),'EXPORTED BEDROCK GEOMETRY  ·  OFFLINE RENDER',font=font(15),fill='#7c9aaf')
    draw.line([(800,158),(800,894)],fill='#2b4052',width=2)
    for name,cast,fire,az,position in [('sans',True,False,15,(32,133)),('blaster',False,True,36,(827,158))]:
        image,glow=render(name,740,720,cast,fire,az,9)
        if name=='sans':
            shadow=Image.new('RGBA',canvas.size,(0,0,0,0));sd=ImageDraw.Draw(shadow)
            sd.ellipse([180,805,605,859],fill=(0,0,0,170));canvas.paste(shadow.filter(ImageFilter.GaussianBlur(15)),(0,0),shadow.filter(ImageFilter.GaussianBlur(15)))
        canvas.paste(image,position,image)
        # A subtle bloom of the actual visible emissive pixels, never a fake
        # painted light source. Model surfaces and UVs stay unchanged.
        bloom=glow.filter(ImageFilter.GaussianBlur(12))
        arr=np.asarray(canvas).astype(float); b=np.asarray(bloom).astype(float)*0.4
        x,y=position;arr[y:y+image.height,x:x+image.width]+=b
        canvas=Image.fromarray(np.clip(arr,0,255).astype(np.uint8),'RGB')
    draw=ImageDraw.Draw(canvas)
    draw.text((84,899),'SANS',font=font(30,True),fill='#f2f5f8')
    draw.text((84,943),'Sculpted skull · recessed eyes · layered hoodie',font=font(17),fill='#a0b8c9')
    draw.text((861,899),'GASTER BLASTER',font=font(30,True),fill='#f2f5f8')
    draw.text((861,943),'Long skull · articulated jaw · emissive core',font=font(17),fill='#a0b8c9')
    target=ROOT/'dist/Sans_Model_Preview_v0.2.0.png'
    canvas.save(target)
    print(target)

if __name__=='__main__':main()

"""Hand-authored 32px sprites and matching cuboid armor; never crops the reference."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
RP = ROOT / 'resource_packs/rp_07_4ab7ea5c-8d31-44e6-b3d6-42cc32ad2f10'
OUT = ROOT / 'docs/zombie_gear_final'
OUT.mkdir(parents=True, exist_ok=True)
PARTS = ['helmet','chestplate','leggings','boots']
GREEN = ['#40482c','#526039','#687644','#809054','#a5b777']
RED = ['#3d2520','#5a3027','#794135','#975442','#b47456']
BONE = ['#78674d','#9c8967','#c0b18b','#dfd2ac','#f3e8c8']
OUTLINE = ['#192016','#211f15','#291b15','#2c1814','#2d1714']

def noise(x,y,seed=0): return ((x*37+y*53+seed*71) ^ (x*y*11+seed*29)) % 101
def skin(x,y,c,part='helmet',front=True):
    n=noise(x//2,y//2,3)
    tone=min(4,max(0,noise(x//2,y//2,7)//23 + (1 if x<12 else 0) - (1 if x>23 else 0)))
    rust = n < [0,24,48,80,100][c]
    bone = c>=3 and noise(x//2,y//2,13)<[0,0,0,23,43][c]
    if front and c>=3:
        if part=='chestplate': bone = (12<=y<=24 and (y-12)%5<2 and 9<=x<=22) or (15<=x<=16 and 10<=y<=25)
        elif part=='helmet': bone = (y in range(13,16) and 8<=x<=24) or (c==4 and 15<=x<=17 and y<15)
        elif part=='leggings': bone |= (x in [9,10,21,22] and y>11 and y%7<5)
        elif part=='boots': bone |= (x in [8,9,22,23] and y>9) or (y in [24,25])
    return (BONE if bone else RED if rust else GREEN)[tone]

def mask(part):
    m=Image.new('1',(32,32));d=ImageDraw.Draw(m)
    if part=='helmet':
        d.polygon([(8,4),(23,4),(23,6),(26,6),(26,27),(21,27),(21,18),(11,18),(11,27),(5,27),(5,7),(8,7)],fill=1)
    elif part=='chestplate':
        d.polygon([(3,5),(10,5),(10,8),(13,8),(13,10),(18,10),(18,8),(21,8),(21,5),(28,5),(30,7),(30,15),(25,15),(25,27),(22,29),(9,29),(6,27),(6,15),(1,15),(1,7)],fill=1)
    elif part=='leggings':
        d.rectangle((5,4,26,28),fill=1); d.rectangle((13,14,18,28),fill=0)
    else:
        d.polygon([(6,4),(12,4),(12,21),(10,21),(10,27),(3,28),(1,26),(1,23),(6,20)],fill=1)
        d.polygon([(19,4),(25,4),(25,20),(30,23),(30,26),(28,28),(21,27),(21,21),(19,21)],fill=1)
    return m

def icon(part,c):
    m=mask(part); im=Image.new('RGBA',(32,32))
    for y in range(32):
        for x in range(32):
            if not m.getpixel((x,y)): continue
            edge=any(not (0<=xx<32 and 0<=yy<32) or not m.getpixel((xx,yy)) for xx,yy in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)])
            im.putpixel((x,y),tuple(int(v[i:i+2],16) for i in (1,3,5))+(255,) if (v:=OUTLINE[c] if edge else skin(x,y,c,part)) else (0,0,0,0))
    d=ImageDraw.Draw(im)
    if part=='chestplate':
        # Player-left is viewer-right. This is the only eye in the entire sprite set.
        d.polygon([(24,6),(27,6),(29,8),(29,11),(27,13),(24,13),(22,11),(22,8)],fill='#3b2818')
        d.polygon([(24,7),(27,7),(28,8),(28,11),(27,12),(24,12),(23,11),(23,8)],fill='#e8b544')
        d.rectangle((24,8,27,11),fill='#fff0be');d.rectangle((25,8,26,11),fill='#a82d1f')
        d.rectangle((25,9,26,10),fill='#301713');d.point((25,8),fill='#fff5d4')
    return im

class Atlas:
    def __init__(self,c,part):
        self.image=Image.new('RGBA',(128,128));self.x=2;self.y=2;self.row=0;self.c=c;self.part=part
    def face(self,w,h,front=False,eye=False):
        w=max(1,round(w*2));h=max(1,round(h*2))
        if self.x+w+2>128:self.x=2;self.y+=self.row+2;self.row=0
        if self.y+h+2>128:raise ValueError('atlas overflow')
        x,y=self.x,self.y;self.x+=w+2;self.row=max(self.row,h)
        d=ImageDraw.Draw(self.image)
        for v in range(h):
            for u in range(w):
                sx=int(5+u/w*22);sy=int(4+v/h*25)
                color=skin(sx,sy,self.c,self.part,front)
                if eye:
                    dist=max(abs((u+.5)/w-.5),abs((v+.5)/h-.5))
                    color='#e8b544' if dist>.35 else '#fff0be' if dist>.22 else '#ae3121' if dist>.11 else '#271512'
                d.point((x+u,y+v),fill=color)
        # 1px opaque gutters isolate every UV island (nearest sampling and glint).
        for u in range(w):
            d.point((x+u,y-1),fill=self.image.getpixel((x+u,y)));d.point((x+u,y+h),fill=self.image.getpixel((x+u,y+h-1)))
        for v in range(h):
            d.point((x-1,y+v),fill=self.image.getpixel((x,y+v)));d.point((x+w,y+v),fill=self.image.getpixel((x+w-1,y+v)))
        return {'uv':[x,y],'uv_size':[w,h]}
    def cube(self,origin,size,eye=False):
        w,h,z=size
        uv={f:self.face(*dims,front=f=='north',eye=eye and f=='north') for f,dims in
            [('north',(w,h)),('south',(w,h)),('east',(z,h)),('west',(z,h)),('up',(w,z)),('down',(w,z))]}
        return {'origin':origin,'size':size,'uv':uv}

def geometry(part,c):
    atlas=Atlas(c,part);bones=[]
    def bone(name,pivot,boxes,parent=None,eye=False):
        b={'name':name,'pivot':pivot,'cubes':[atlas.cube(o,s,eye) for o,s in boxes]}
        if parent:b['parent']=parent
        bones.append(b)
    if part=='helmet':
        bone('head',[0,24,0],[([-4.3,31.7,-4.3],[8.6,.6,8.6]),([-4.3,24,-4.3],[.7,7.7,8.6]),
            ([3.6,24,-4.3],[.7,7.7,8.6]),([-3.6,24,3.6],[7.2,7.7,.7]),([-3.6,28.6,-4.3],[7.2,3.1,.7])])
    elif part=='chestplate':
        bone('body',[0,24,0],[([-4.22,12,-2.22],[8.44,11.8,4.44])])
        bone('leftArm',[5,22,0],[([3.9,18,-2.3],[4.4,6.3,4.6])])
        bone('rightArm',[-5,22,0],[([-8.3,18,-2.3],[4.4,6.3,4.6])])
        bone('zg_final_shoulder_eye',[5,22,0],[([4.75,20.6,-2.95],[2.5,2.5,.65])],parent='leftArm',eye=True)
    elif part=='leggings':
        bone('body',[0,24,0],[([-4.2,11.5,-2.2],[8.4,1.5,4.4])])
        bone('leftLeg',[1.9,12,0],[([-.1,4.2,-2.2],[4.3,7.8,4.4])])
        bone('rightLeg',[-1.9,12,0],[([-4.2,4.2,-2.2],[4.3,7.8,4.4])])
    else:
        bone('leftLeg',[1.9,12,0],[([-.15,.1,-2.3],[4.35,4.5,4.6]),([-.15,.1,-3.1],[4.35,1.8,.8])])
        bone('rightLeg',[-1.9,12,0],[([-4.2,.1,-2.3],[4.35,4.5,4.6]),([-4.2,.1,-3.1],[4.35,1.8,.8])])
    suffix=f'_c{c}' if c else ''
    geo={'format_version':'1.12.0','minecraft:geometry':[{'description':{
        'identifier':f'geometry.zombiegear.v4hd_{part}{suffix}','texture_width':128,'texture_height':128,
        'visible_bounds_width':3,'visible_bounds_height':3,'visible_bounds_offset':[0,1,0]},'bones':bones}]}
    return geo,atlas.image

atlas_data=json.loads((RP/'textures/item_texture.json').read_text(encoding='utf-8-sig'))['texture_data']
sheet=Image.new('RGB',(5*160,4*172+36),'#222b2c');sd=ImageDraw.Draw(sheet)
for c in range(5):
    sd.text((c*160+65,10),f'C{c}',fill='white')
    for row,part in enumerate(PARTS):
        suffix=f'_c{c}' if c else '';key=f'zombie_{part}{suffix}'
        im=icon(part,c)
        dest=RP/(atlas_data[key]['textures']+'.png');im.save(dest)
        # Existing PBR companions must match the new silhouettes and dimensions.
        companion=dest.with_name(dest.stem+'_mer.png')
        if companion.exists():Image.new('RGB',(32,32),(0,0,255)).save(companion)
        geo,texture=geometry(part,c)
        (RP/f'models/entity/zombiegear_v4hd/{part}{suffix}.geo.json').write_text(json.dumps(geo,indent=2)+'\n',encoding='utf-8')
        texture.save(RP/f'textures/models/armor/zombiegear_v4hd/{part}{suffix}.png')
        large=im.resize((128,128),Image.Resampling.NEAREST);sheet.paste(large,(c*160+16,row*172+34),large)
        sd.text((c*160+40,row*172+164),part,fill='#c3cebb')
sheet.save(OUT/'icons-preview.png')
manifest={'source':'ACCEPTED_ZOMBIE_GEAR_REFERENCE.png','method':'Hand-authored native 32px pixel masks; no sheet cropping or AI resampling',
          'icon_size':[32,32],'mode':'RGBA','eye':{'part':'chestplate','all_stages':True,'icon_center':[25.5,9.5],'bone':'leftArm'},
          'worn_texture_size':[128,128],'stages':['olive skin','rust mottles','spreading rot','exposed ribs/bone','red/bone dominant']}
(OUT/'asset-build.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print('Built 20 exact 32x32 RGBA icons and 20 compact, textured armor geometries')

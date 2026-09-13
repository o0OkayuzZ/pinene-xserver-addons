"""Orthographic front/side/back contact sheet from the actual geometry/UV/PNG files."""
from pathlib import Path
import json, math
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[2]
RP=ROOT/'resource_packs/rp_07_4ab7ea5c-8d31-44e6-b3d6-42cc32ad2f10'
sheet=Image.new('RGB',(1200,700),'#222b2c');draw=ImageDraw.Draw(sheet)
parts=['helmet','chestplate','leggings','boots']
def render(part,c,yaw):
    suffix=f'_c{c}' if c else ''
    geo=json.loads((RP/f'models/entity/zombiegear_v4hd/{part}{suffix}.geo.json').read_text())['minecraft:geometry'][0]
    texture=Image.open(RP/f'textures/models/armor/zombiegear_v4hd/{part}{suffix}.png')
    cubes=[cube for bone in geo['bones'] for cube in bone.get('cubes',[])]
    lo=min(cube['origin'][1] for cube in cubes);hi=max(cube['origin'][1]+cube['size'][1] for cube in cubes)
    angle=math.radians(yaw);co,si=math.cos(angle),math.sin(angle)
    def project(p):
        x,y,z=p; xx=co*x-si*z; zz=si*x+co*z
        return (40+xx*4,69-(y-(lo+hi)/2)*4+zz*.65),zz
    tiles=[]
    for cube in cubes:
        x,y,z=cube['origin'];w,h,d=cube['size']
        faces={
         'north':((x,y+h,z),(w,0,0),(0,-h,0),(0,0,-1)),
         'south':((x+w,y+h,z+d),(-w,0,0),(0,-h,0),(0,0,1)),
         'west':((x,y+h,z+d),(0,0,-d),(0,-h,0),(-1,0,0)),
         'east':((x+w,y+h,z),(0,0,d),(0,-h,0),(1,0,0)),
         'up':((x,y+h,z+d),(w,0,0),(0,0,-d),(0,1,0)),
         'down':((x,y,z),(w,0,0),(0,0,d),(0,-1,0))}
        for face,(o,u,v,n) in faces.items():
            if n[0]*(-si)+n[2]*(-co)+n[1]*.17<=0:continue
            uv=cube['uv'][face];a,b=uv['uv'];tw,th=uv['uv_size']
            for j in range(th):
                for i in range(tw):
                    color=texture.getpixel((a+i,b+j))
                    if not color[3]:continue
                    corners=[tuple(o[k]+u[k]*ii/tw+v[k]*jj/th for k in range(3)) for ii,jj in [(i,j),(i+1,j),(i+1,j+1),(i,j+1)]]
                    pts=[project(p) for p in corners]
                    shade={'north':1,'south':.9,'west':.77,'east':.77,'up':1.1,'down':.6}[face]
                    tiles.append((sum(p[1] for p in pts)/4,[p[0] for p in pts],tuple(min(255,round(ch*shade)) for ch in color[:3])))
    im=Image.new('RGB',(80,145),'#222b2c');d=ImageDraw.Draw(im)
    for _,pts,color in sorted(tiles,key=lambda t:-t[0]):d.polygon(pts,fill=color)
    return im
for c in range(5):
    draw.text((c*240+108,10),f'C{c}',fill='white')
    for row,part in enumerate(parts):
        for view,angle in enumerate([0,90,180]):
            sheet.paste(render(part,c,angle),(c*240+view*80,row*164+34))
            draw.text((c*240+view*80+18,row*164+179),['front','left','back'][view],fill='#b9c6b0')
sheet.save(ROOT/'docs/zombie_gear_final/worn-models-preview.png')
print('Rendered actual geometry/UVs: 20 variants x front/left/back')

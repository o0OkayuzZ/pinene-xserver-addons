"""Authored Bedrock cube art, v2: sculpted skulls, clothing and casting eyes.

The preview renderer reads the resulting geometry and texture atlas directly.
One model uses a small number of bones; rounded volumes are merged voxel rows.
"""
import math
from PIL import Image, ImageDraw

ATLAS_SIZE = (256, 128)
PALETTE = [
    '#f1efe5', '#2696d2', '#141922', '#353e4a',
    '#fffcf2', '#18deff', '#c7cbd0', '#176495',
    '#317fa6', '#b6c7d1', '#ede6ed', '#dea7bf',
    '#eceadf', '#454954', '#00070f', '#7ef2ff',
]

def cube(origin, size, tile=0, rotation=None, pivot=None, faces=None):
    uv = {face: {'uv': [tile * 16, 0], 'uv_size': [16, 16]}
          for face in ['north', 'south', 'east', 'west', 'up', 'down']}
    if faces:
        for face, index in faces.items():
            uv[face] = {'uv': [index * 16, 0], 'uv_size': [16, 16]}
    value = {'origin': origin, 'size': size, 'uv': uv}
    if rotation: value['rotation'] = rotation
    if pivot: value['pivot'] = pivot
    return value

def bone(name, cubes=(), parent=None, pivot=None, rotation=None):
    value = {'name': name, 'pivot': pivot or [0, 0, 0], 'cubes': list(cubes)}
    if parent: value['parent'] = parent
    if rotation: value['rotation'] = rotation
    return value

def ellipsoid(center, radii, tile=0, step=0.75, omit=None):
    """Merge filled x-runs at each y/z row instead of exporting one cube/voxel."""
    cx, cy, cz = center
    rx, ry, rz = radii
    bounds = [(math.floor((c-r)/step), math.ceil((c+r)/step))
              for c, r in zip(center, radii)]
    output = []
    for iy in range(*bounds[1]):
        for iz in range(*bounds[2]):
            run = None
            for ix in range(bounds[0][0], bounds[0][1] + 1):
                x, y, z = (ix+0.5)*step, (iy+0.5)*step, (iz+0.5)*step
                inside = (ix < bounds[0][1] and
                          ((x-cx)/rx)**2 + ((y-cy)/ry)**2 + ((z-cz)/rz)**2 <= 1 and
                          not (omit and omit(x, y, z)))
                if inside and run is None: run = ix
                if not inside and run is not None:
                    output.append(cube([run*step, iy*step, iz*step], [(ix-run)*step, step, step], tile))
                    run = None
    return output

def sans():
    # Broad box silhouette; facial/clothing detail lives in 64px face maps.
    def mapped(origin,size,region,tile=0):
        c=cube(origin,size,tile)
        x,y,w,h=region;c['uv']['north']={'uv':[x,y],'uv_size':[w,h]}
        return c
    head=[mapped([-8,12.5,-5],[16,10,10],(0,32,64,64))]
    jacket=[mapped([-7,4.5,-4.5],[14,9,9],(64,32,64,64),1)]
    output=[bone('root'),bone('body',jacket,'root',[0,9,0]),
        bone('hood',[cube([-7.3,11.8,-3.8],[14.6,1.5,8.5],7)],'body',[0,12,0]),
        bone('head',head,'body',[0,12.5,0]),
        bone('pupil',[cube([3.25,17.9,-5.04],[.55,.65,.04],4)],'head',[3.5,18.2,-5]),
        bone('magic_eye',[cube([2.95,17.65,-5.06],[1.15,1.15,.04],5),
                          cube([3.36,17.85,-5.1],[.32,.64,.04],15)],'head',[3.5,18.2,-5])]
    for side,label in [(-1,'left'),(1,'right')]:
        x=-10.4 if side<0 else 6.4
        arm=[mapped([x,5,-4.4],[4,7.5,8.4],(128,32,32,64),1),
             cube([x+.2,4.8,-4.65],[3.6,1.25,2.6],7)]
        output.append(bone(label+'_arm',arm,'body',[side*7.4,12.2,0]))
        leg=[mapped([side*3.55-3.45,2.6,-4.1],[6.9,3.3,8.2],(160,32,32,32),2),
             cube([side*3.55-2.3,1.5,-2],[4.6,1.3,4],0)]
        output.append(bone(label+'_leg',leg,'root',[side*3.55,5.2,0]))
        foot=[mapped([side*3.6-3.1,0,-5.3],[6.2,1.9,9],(192,32,32,32),10),
              cube([side*3.6-3.15,0,-5.35],[6.3,.35,9.1],11)]
        output.append(bone(label+'_foot',foot,'root',[side*3.6,1.5,0]))
    return output


def paint_sans_details(atlas):
    # Keep existing 16px colour tiles unchanged for blasters/bones.
    face=Image.new('RGBA',(64,64),'#efeee5');d=ImageDraw.Draw(face)
    d.rectangle([0,0,63,3],fill='#faf8ee');d.rectangle([0,4,3,59],fill='#d5d7d2')
    d.rectangle([60,4,63,59],fill='#cbd0cc');d.rectangle([4,60,59,63],fill='#d7dbd4')
    for x in [7,36]:
        d.polygon([(x+2,18),(x+18,18),(x+20,21),(x+20,32),(x+17,35),(x+1,34),(x,31),(x,21)],fill='#090d12')
        d.line([(x+1,17),(x+18,16)],fill='#c4c9c4',width=1)
    d.rectangle([16,25,18,28],fill='#fffdf3')
    d.polygon([(29,35),(34,35),(36,40),(28,40)],fill='#10141a')
    d.polygon([(7,41),(13,44),(49,44),(57,41),(56,53),(51,59),(13,59),(8,53)],fill='#11151b')
    d.polygon([(10,45),(19,48),(45,48),(54,45),(52,53),(47,56),(17,56),(12,52)],fill='#fffdf1')
    for x in [16,22,28,34,40,46,51]:d.line([(x,46 if x<19 or x>48 else 48),(x,55)],fill='#6b7473',width=1)
    d.line([(12,51),(18,53),(47,53),(52,50)],fill='#c3c7bc',width=1)
    d.line([(6,38),(7,42)],fill='#a9b1ad');d.line([(58,38),(57,42)],fill='#a9b1ad')
    atlas.paste(face,(0,32))
    shirt=Image.new('RGBA',(64,64),'#1686c2');d=ImageDraw.Draw(shirt)
    d.rectangle([0,0,63,4],fill='#59b3d9');d.rectangle([0,55,63,63],fill='#176b9b')
    d.polygon([(20,3),(44,3),(47,63),(17,63)],fill='#f2f0e4')
    d.rectangle([20,4,43,8],fill='#d4dcd8')
    for x in [16,46]:d.line([(x,6),(x+(-2 if x<32 else 2),62)],fill='#0d598a',width=2)
    for x in [23,39]:
        d.rectangle([x,4,x+1,22],fill='#c4d1d0');d.rectangle([x,22,x+2,25],fill='#9cacab')
    d.line([(2,43),(13,39)],fill='#0d6596',width=3);d.line([(51,39),(61,43)],fill='#0d6596',width=3)
    d.line([(3,46),(13,42)],fill='#3e9ecc',width=1);d.line([(51,42),(60,46)],fill='#3e9ecc',width=1)
    atlas.paste(shirt,(64,32))
    sleeve=Image.new('RGBA',(32,64),'#1787c4');d=ImageDraw.Draw(sleeve)
    d.rectangle([0,0,31,4],fill='#36a4d5');d.rectangle([0,5,3,63],fill='#1375ad')
    d.rectangle([1,53,30,63],fill='#125e8e')
    for y in [21,37]:d.line([(6,y),(23,y+3)],fill='#2c98ca',width=2)
    for x in range(3,30,4):d.line([(x,55),(x,62)],fill='#398bb1')
    atlas.paste(sleeve,(128,32))
    shorts=Image.new('RGBA',(32,32),'#151b27');d=ImageDraw.Draw(shorts)
    d.rectangle([0,0,31,2],fill='#263145');d.rectangle([27,2,29,31],fill='#e3e6de')
    d.rectangle([2,29,26,31],fill='#0b111c');atlas.paste(shorts,(160,32))
    shoe=Image.new('RGBA',(32,32),'#e5d4df');d=ImageDraw.Draw(shoe)
    d.rectangle([0,24,31,31],fill='#ba8cac');d.rectangle([2,3,29,6],fill='#f5e8ee')
    d.rectangle([4,7,27,9],fill='#d2b6cb');atlas.paste(shoe,(192,32))


def blaster():
    # Posterior cranium, cheek ridges and a narrow elongated muzzle. The two
    # swept rear horns and angular sockets keep the dragon/skull silhouette.
    skull = ellipsoid([0,3.3,8.0],[5.3,4.0,6.4],0,step=1)
    skull += ellipsoid([0,1.5,1.8],[3.8,2.4,4.5],0,step=0.75,
                       omit=lambda x,y,z: abs(x)>1.4 and y>1.5 and z<3)
    for side in [-1,1]:
        skull += [cube([side*4.1-0.85,1.1,1.5],[1.7,3.8,6.2],0,
                       [0,side*11,0],[side*4,3,7]),
                  cube([side*3.4-0.85,6.2,10],[1.7,3.4,3],0,
                       [-26,0,side*10],[side*3.4,6.2,10]),
                  cube([side*3.4-0.6,8.2,12],[1.2,2.6,2],0,
                       [-35,0,side*10],[side*3.4,8.2,12]),
                  cube([side*2.15-1.45,3.0,-0.7],[2.9,1.8,0.45],14,
                       [0,0,side*19],[side*2.15,3.9,-0.7]),
                  cube([side*2.15-1.6,4.6,-0.9],[3.2,0.65,1.2],0,
                       [0,0,side*19],[side*2.15,4.6,-0.7])]
    skull += [cube([-0.55,1.9,-2.45],[1.1,1.3,0.2],14),
              cube([-2.6,-0.35,-1.9],[5.2,1.65,3.4],14)]
    # Distinct upper teeth: short incisors and long outer fangs.
    for x in [-2.9,-1.65,-0.6,0.6,1.65,2.9]:
        length = 1.8 if abs(x)>2 else 0.8
        skull.append(cube([x-0.38,-length,-1.75],[0.76,length+0.45,1.2],4))
    jaw = ellipsoid([0,-1.9,4.3],[3.5,0.95,5.8],0,step=0.75)
    jaw += [cube([-3.0,-2.4,-1.35],[6,1.3,1.3],0),
            cube([-2.3,-1.7,-0.9],[4.6,0.25,4.8],14)]
    for x in [-2.45,-1.2,0,1.2,2.45]:
        jaw.append(cube([x-0.32,-1.6,-1.25],[0.64,1.15,0.8],4))
    eyes=[]
    for side in [-1,1]:
        eyes += [cube([side*2.15-0.4,3.15,-1.1],[0.8,1.1,0.11],5,
                      [0,0,side*19],[side*2.15,3.9,-0.7]),
                 cube([side*2.15-0.16,3.38,-1.23],[0.32,0.62,0.1],15)]
    core = [cube([-1.15,-0.35,-1.9],[2.3,1.5,0.16],5),
            cube([-0.7,-0.1,-2.02],[1.4,0.95,0.1],15)]
    return [bone('root',pivot=[0,1,7]),bone('skull',skull,'root',[0,1,7]),
            bone('jaw',jaw,'root',[0,-1.3,8]),
            bone('eyes',eyes,'skull'),bone('core',core,'root',[0,0,0])]

def attack_bone():
    # Double lobes at each end, a narrow shaft and a subtle marrow-coloured seam.
    shapes = [cube([-1.15,2,-1.15],[2.3,20,2.3],0)]
    for y in [0,21.5]:
        shapes += [cube([-2.6,y+0.4,-1.05],[5.2,1.5,2.1],0),
                   cube([-2.15,y,-0.85],[1.85,2.5,1.7],0),
                   cube([0.3,y,-0.85],[1.85,2.5,1.7],0)]
    for shape in shapes:
        for axis in [0, 2]:
            shape['origin'][axis] *= 1.35
            shape['size'][axis] *= 1.35
    return [bone('root',shapes)]

def soul():
    rows=['0110110','1111111','1111111','0111110','0011100','0001000']
    return [bone('root',[cube([(x-3.5)*.8,(5-y)*.8,-.4],[.8,.8,.8],1)
        for y,row in enumerate(rows) for x,pixel in enumerate(row) if pixel=='1'])]

def write_models(save, RP):
    atlas=Image.new('RGBA',ATLAS_SIZE,(0,0,0,0))
    d=ImageDraw.Draw(atlas)
    for index,colour in enumerate(PALETTE):
        d.rectangle([index*16,0,index*16+15,15],fill=colour)
        # Sparse one-pixel weave: texture remains legible, without noisy edges.
        if index in [1,2,7,8,10]:
            rgb=tuple(int(colour[i:i+2],16) for i in [1,3,5])
            for y in range(16):
                for x in range(16):
                    shift=3 if (x*17+y*31)%13==0 else (-3 if (x*11+y*7)%17==0 else 0)
                    if shift:d.point((index*16+x,y),fill=tuple(max(0,min(255,c+shift)) for c in rgb)+(255,))
    paint_sans_details(atlas)
    (RP/'textures/entity').mkdir(parents=True,exist_ok=True)
    atlas.save(RP/'textures/entity/sans_atlas.png')
    # Classic emissive entity shaders use TGA alpha for light, while the PBR
    # renderer uses the separate MER texture. Give the render atlas a unique
    # basename so Bedrock never chooses a PNG with the wrong alpha semantics.
    render_atlas=atlas.copy()
    ad=ImageDraw.Draw(render_atlas)
    for index in [5,15]:
        colour=tuple(int(PALETTE[index][i:i+2],16) for i in [1,3,5])
        ad.rectangle([index*16,0,index*16+15,15],fill=colour+(32,))
    render_atlas.save(RP/'textures/entity/sans_atlas_render.tga')
    mer=Image.new('RGB',ATLAS_SIZE,(0,0,240))
    md=ImageDraw.Draw(mer)
    for index in [5,15]:md.rectangle([index*16,0,index*16+15,15],fill=(0,230,70))
    mer.save(RP/'textures/entity/sans_atlas_mer.png')
    save(RP/'textures/entity/sans_atlas.texture_set.json',{
        'format_version':'1.16.100','minecraft:texture_set':{
            'color':'sans_atlas','metalness_emissive_roughness':'sans_atlas_mer'}})
    save(RP/'textures/entity/sans_atlas_render.texture_set.json',{
        'format_version':'1.16.100','minecraft:texture_set':{
            'color':'sans_atlas_render','metalness_emissive_roughness':'sans_atlas_mer'}})
    for name,shapes,height,width,offset in [
        ('sans',sans(),3,3,[0,1,0]),
        ('soul',soul(),1,1,[0,.15,0]),('bone',attack_bone(),8,9,[0,0,0]),
        ('blaster',blaster(),3,4,[0,0.2,0.4]),
    ]:
        save(RP/f'models/entity/{name}.geo.json',{'format_version':'1.12.0','minecraft:geometry':[{
            'description':{'identifier':'geometry.pinene_sans.'+name,
                'texture_width':ATLAS_SIZE[0],'texture_height':ATLAS_SIZE[1],
                'visible_bounds_width':width,'visible_bounds_height':height,'visible_bounds_offset':offset},
            'bones':shapes}]})
    # The eye material is emissive even in the classic renderer; body keeps its
    # ordinary directional lighting. Vibrant Visuals also uses the MER texture.
    save(RP/'render_controllers/sans.render_controllers.json',{
        'format_version':'1.8.0','render_controllers':{'controller.render.pinene_sans':{
            'geometry':'Geometry.default','materials':[{'*':'Material.default'},
                {'magic_eye':'Material.glow'},{'eyes':'Material.glow'},{'core':'Material.glow'}],
            'textures':['Texture.default']}}})
    presence = "(query.property('pinene_sans:arrival') * (1 - query.property('pinene_sans:departure')))"
    arrival = '('+presence+' * '+presence+' * (3 - 2 * '+presence+'))'
    save(RP/'animations/sans.animation.json',{
        'format_version':'1.8.0','animations':{
            'animation.pinene_sans.idle':{'loop':True,'animation_length':2,'bones':{
                'body':{'position':[0,'math.sin(query.life_time * 120) * 0.11',0],
                        'rotation':["query.property('pinene_sans:tired') * -5",0,0]},
                'left_arm':{'rotation':["query.property('pinene_sans:slam') == 1 ? -100 : (query.property('pinene_sans:slam') == 2 ? 40 : 0)",0,"query.property('pinene_sans:slam') == 1 ? -25 : 0"]},
                'head':{'rotation':[0,'math.sin(query.life_time * 45) * 2',
                                   'math.sin(query.life_time * 60) * 1.2']},
                'magic_eye':{'scale':"query.property('pinene_sans:casting') ? 1.0 : 0.0"},
                'pupil':{'scale':"query.property('pinene_sans:casting') ? 0.0 : 1.0"}}},
            'animation.pinene_sans.bone':{'loop':True,'bones':{
                'root':{'scale':[1,"query.property('pinene_sans:height')",1],
                    'rotation':[0,"query.property('pinene_sans:azimuth')","query.property('pinene_sans:tilt')"]}}},
            'animation.pinene_sans.blaster':{'loop':True,'bones':{
                'root':{'rotation':[
                    '-22 * (1 - ('+arrival+'))',0,
                    'math.sin(query.life_time * 80) * 1.5 - 18 * (1 - ('+arrival+'))'],
                    'position':[0,'-8 * (1 - ('+arrival+'))',
                        '14 * (1 - ('+arrival+'))'],
                    'scale':'(0.03 + 0.97 * ('+arrival+') + 0.40 * math.sin(('+arrival+') * 180))'},
                'jaw':{'rotation':["query.property('pinene_sans:firing') ? -46 : (query.property('pinene_sans:departure') > 0 ? -4 - 42 * math.max(0, 1 - query.property('pinene_sans:departure') * 3) : -4)",0,0],
                    'position':[0,'math.sin(query.life_time * 140) * 0.55',"query.property('pinene_sans:recoil') * 2.8"]},
                'skull':{'rotation':["query.property('pinene_sans:firing') ? 10 : (query.property('pinene_sans:departure') > 0 ? 10 * math.max(0, 1 - query.property('pinene_sans:departure') * 3) : 0)",0,0],
                    'position':[0,'math.sin(query.life_time * 140) * 0.55',"query.property('pinene_sans:recoil') * 2.8"]},
                'core':{'scale':"query.property('pinene_sans:firing') ? 1.0 : 0.0"}}},
        }})

    icon=Image.new('RGB',(128,128),'#111e2a');draw=ImageDraw.Draw(icon)
    draw.rounded_rectangle([17,58,111,142],radius=20,fill=PALETTE[1])
    draw.ellipse([20,7,108,84],fill=PALETTE[0])
    draw.rounded_rectangle([33,31,56,49],radius=7,fill=PALETTE[14])
    draw.rounded_rectangle([73,31,96,49],radius=7,fill=PALETTE[14])
    draw.rectangle([42,38,47,43],fill=PALETTE[4]);draw.rectangle([82,36,88,44],fill=PALETTE[5])
    draw.rounded_rectangle([34,55,94,70],radius=5,fill=PALETTE[14])
    for x in range(37,92,8):draw.rectangle([x,57,x+5,66],fill=PALETTE[4])
    return icon

def write_ray(save, RP):
    """One cube, zero particle budgets: black telegraph becomes emissive beam."""
    black=Image.new('RGBA',(32,16),(2,2,5,255))
    black.save(RP/'textures/entity/ray_black.png')
    white=(235,252,255,32);cyan=(35,200,255,32)
    glow=Image.new('RGBA',(32,16),cyan);draw=ImageDraw.Draw(glow)
    draw.rectangle([1,1,6,6],fill=white)       # beam end cross-section
    draw.rectangle([9,0,14,7],fill=white)     # top/bottom: width runs along U
    draw.rectangle([16,1,23,6],fill=white)    # side faces: height runs along V
    glow.save(RP/'textures/entity/ray_glow.tga')
    # Opaque authoring copy for deterministic offline previews only.
    preview=glow.copy();preview.putalpha(255);preview.save(RP/'textures/entity/ray_preview.png')
    save(RP/'textures/entity/ray_glow.texture_set.json',{
        'format_version':'1.16.100','minecraft:texture_set':{
            'color':'ray_glow','metalness_emissive_roughness':[0,255,80]}})
    ray=cube([-8,-8,-16],[16,16,16])
    ray['uv']={face:{'uv':uv,'uv_size':[8,8]} for face,uv in {
        'north':[0,0],'south':[0,0],'up':[8,0],'down':[8,0],
        'east':[16,0],'west':[16,0]}.items()}
    save(RP/'models/entity/ray.geo.json',{'format_version':'1.12.0','minecraft:geometry':[{
        'description':{'identifier':'geometry.pinene_sans.ray','texture_width':32,'texture_height':16,
            'visible_bounds_width':60,'visible_bounds_height':60,'visible_bounds_offset':[0,0,-14]},
        'bones':[bone('root',[ray])]}]})
    save(RP/'entity/ray.entity.json',{'format_version':'1.10.0','minecraft:client_entity':{'description':{
        'identifier':'pinene_sans:ray','materials':{'default':'entity_alphatest','glow':'entity_emissive_alpha'},
        'textures':{'warning':'textures/entity/ray_black','beam':'textures/entity/ray_glow'},
        'geometry':{'default':'geometry.pinene_sans.ray'},
        'animations':{'ray':'animation.pinene_sans.ray'},'scripts':{'animate':['ray']},
        'render_controllers':['controller.render.pinene_sans.ray']}}})
    save(RP/'render_controllers/ray.render_controllers.json',{'format_version':'1.8.0','render_controllers':{
        'controller.render.pinene_sans.ray':{'geometry':'Geometry.default',
            'materials':[{'*':"query.property('pinene_sans:firing') ? Material.glow : Material.default"}],
            'textures':["query.property('pinene_sans:firing') ? Texture.beam : Texture.warning"]}}})
    save(RP/'animations/ray.animation.json',{'format_version':'1.8.0','animations':{
        'animation.pinene_sans.ray':{'loop':True,'bones':{'root':{'scale':[
            "query.property('pinene_sans:width')","query.property('pinene_sans:width')",
            "query.property('pinene_sans:length')"]}}}}})

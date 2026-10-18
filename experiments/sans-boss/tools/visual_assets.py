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
    def sockets(x, y, z):
        eye = ((abs(x)-2.25)/1.6)**2 + ((y-20.25)/1.13)**2 < 1
        grin_y = 17.4 + 0.065*x*x
        mouth = abs(x) < 4.15 and abs(y-grin_y) < 0.82
        nose = abs(x) < 0.55 and 18.8 < y < 19.55
        return z < -1.5 and (eye or mouth or nose)

    head = ellipsoid([0, 20.0, 0], [5.5, 4.25, 3.5], omit=sockets)
    # Recessed eye sockets. Black is visible behind a real cutout, not painted
    # on the outer skull. Large cheeks frame the wide grin.
    head += ellipsoid([-2.25, 20.25, -1.5], [1.8, 1.25, 0.4], 14, step=0.5)
    head += ellipsoid([2.25, 20.25, -1.5], [1.8, 1.25, 0.4], 14, step=0.5)
    head += [cube([-0.6, 18.75, -2.25], [1.2, 0.8, 0.4], 14),
             cube([-4.3, 17.0, -1.75], [8.6, 2.0, 0.35], 14)]
    # Ten individually placed teeth follow a curved smile. A thin dark gap
    # between upper and lower rows preserves the familiar grin at small scale.
    for i in range(10):
        x = -3.85 + i*0.78
        y = 17.05 + 0.058*x*x
        height = 0.95 if abs(x) < 2.7 else 0.72
        head.append(cube([x, y, -2.7], [0.64, height, 0.45], 4))
        head.append(cube([x+0.04, y-0.55, -2.62], [0.57, 0.47, 0.36], 0))
    # Small bright pupils at the back of the eye wells.
    head += [cube([-2.5, 20.05, -2.02], [0.38, 0.48, 0.08], 4)]

    hoodie = ellipsoid([0, 11.9, 0.0], [4.55, 4.45, 2.8], 1, step=0.75)
    # Open zipper/front panels expose a pale shirt. Blue lapels are layered
    # above it and tapered with rotation, making a hoodie rather than a box.
    hoodie += [cube([-2.3, 8.7, -3.02], [4.6, 6.5, 0.25], 4),
               cube([-4.15, 8.65, -3.4], [1.45, 6.7, 0.4], 1,
                    [0, 0, -6], [-3.6, 15, -3.2]),
               cube([2.7, 8.65, -3.4], [1.45, 6.7, 0.4], 1,
                    [0, 0, 6], [3.6, 15, -3.2]),
               cube([-4.1, 8.25, -2.9], [8.2, 0.7, 5.8], 7),
               cube([-4.35, 10.0, -3.52], [2.25, 0.55, 0.28], 7,
                    [0, 0, -18], [-3, 10.5, -3.5]),
               cube([2.1, 10.0, -3.52], [2.25, 0.55, 0.28], 7,
                    [0, 0, 18], [3, 10.5, -3.5])]
    # Puff of hood behind the neck, with a rounded padded white rim.
    hood = ellipsoid([0, 15.0, 1.15], [4.9, 2.5, 3.25], 7,
                     omit=lambda x,y,z: z < -0.8 and y > 14.8)
    for i in range(9):
        angle = math.pi*(i/8)
        x = math.cos(angle)*4.2
        z = -2.6 + math.sin(angle)*1.0
        hood.append(cube([x-0.48, 14.9+math.sin(angle)*0.5, z-0.45], [0.96,1.25,0.9], 6))
    hoodie += [cube([-1.9,14.1,-3.3],[0.25,1.7,0.2],6),
               cube([1.6,14.1,-3.3],[0.25,1.7,0.2],6)]

    output = [bone('root'), bone('body', hoodie, 'root', [0,12,0]),
              bone('hood', hood, 'body', [0,15,0]),
              bone('head', head, 'body', [0,16,0]),
              bone('pupil', [cube([2.1,20.05,-2.02],[0.38,0.48,0.08],4)], 'head', [2.25,20.25,-2]),
              bone('magic_eye', [cube([1.8,19.88,-2.08],[0.95,0.87,0.09],5),
                                 cube([2.13,20.05,-2.2],[0.33,0.48,0.08],15)], 'head', [2.25,20.25,-2])]
    # Bent sleeves disappear into the front pocket openings. No loose arms
    # hanging beside a generic Minecraft humanoid.
    for side, label in [(-1,'left'),(1,'right')]:
        sleeve = ellipsoid([side*4.7,12.4,0],[1.65,3.0,2.15],1,step=0.75)
        sleeve += [cube([side*3.45-1.15,9.6,-3.25],[2.3,2.4,2.0],1,
                        [0,0,side*22],[side*4.8,11.4,-1]),
                   cube([side*3.0-0.8,9.55,-3.45],[1.6,0.65,1.5],7)]
        output.append(bone(label+'_arm', sleeve, 'body', [side*4,15,0]))
        shorts = [cube([side*1.95-1.85,4.65,-2.55],[3.7,3.8,5.1],2),
                  cube([side*3.4-0.2,4.8,-2.67],[0.4,3.4,0.16],6),
                  cube([side*1.95-1.6,2.65,-1.45],[3.2,2,2.9],0)]
        output.append(bone(label+'_leg',shorts,'root',[side*2,8,0],rotation=[0,0,-side*3]))
        slipper = ellipsoid([side*2.15,1.25,-0.65],[2.4,1.25,3.25],10,step=0.5)
        slipper += [cube([side*2.15-2.2,0,-3.2],[4.4,0.4,5.9],11),
                    cube([side*2.15-1.4,2.2,-0.5],[2.8,0.6,1.2],6)]
        output.append(bone(label+'_foot',slipper,'root',[side*2,2,0]))
    # Compact, broad Sans silhouette. Transform every pivot with its cubes so
    # the face and the new gravity-slam arm animation remain aligned.
    def yshape(y):
        return y*.85 if y <= 16 else 13.6+(y-16)*1.08
    for part in output:
        name = part['name']
        face = name in ['head','pupil','magic_eye']
        sx = 1.22 if face else 1.30 if name in ['body','hood'] else 1.25
        sz = 1.10 if face else 1.18 if name in ['body','hood','left_arm','right_arm'] else 1.08
        def point(v): return [v[0]*sx,yshape(v[1]),v[2]*sz]
        part['pivot'] = point(part['pivot'])
        for shape in part['cubes']:
            origin=shape['origin'];size=shape['size']
            end=[origin[i]+size[i] for i in range(3)]
            a,b=point(origin),point(end)
            shape['origin']=a;shape['size']=[b[i]-a[i] for i in range(3)]
            if 'pivot' in shape:shape['pivot']=point(shape['pivot'])
    return output

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

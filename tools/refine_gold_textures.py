import json,collections,hashlib,datetime,copy
from pathlib import Path
from PIL import Image, ImageDraw
R=Path(__file__).resolve().parents[1]
D=R/'docs/golden_foods'
T=Path('resource_packs/rp_05_608f921e-6be8-4a27-85d6-27945fa3a1ef/textures/pinene_golden_foods')
p=json.loads((D/'texture_provenance.json').read_text(encoding='utf-8'))
stage=D/'refined_textures';stage.mkdir(exist_ok=True)
luma=lambda c: .2126*c[0]+.7152*c[1]+.0722*c[2]
gold=Image.open(p['reference_sources']['apple_golden']['path']).convert('RGBA')
apple=Image.open(p['reference_sources']['apple']['path']).convert('RGBA')
counts=collections.Counter(g[:3] for a,g in zip(apple.get_flattened_data(),gold.get_flattened_data()) if a[3] and g[3] and a[0]>a[1]*1.2 and a[0]>a[2]*1.2)
palette=sorted(counts,key=luma);total=sum(counts.values())
def target(q):
 # Compress the tonal range within the actual vanilla palette: lift deep
 # red-brown shadows and reserve the near-white highlights for vanilla items.
 q=0.12+0.78*q
 c=0
 for rgb in palette:
  c+=counts[rgb]/total
  if q<=c:return rgb
 return palette[-1]
preview=Image.new('RGBA',(640,850),(40,40,40,255));draw=ImageDraw.Draw(preview)
draw.text((4,4),'Original          Previous          Revised',fill='white')
report={'method':'Softened vanilla gold histogram transfer, quantile range 0.12 to 0.90; lifted shadows and restrained highlights; exact vanilla palette and original pixel layout','palette_histogram':{str(k):v for k,v in counts.items()},'assets':{}}
for row,(name,v) in enumerate(p['assets'].items()):
 original=Image.open(v['path']).convert('RGBA');old=Image.open(R/T/(name+'.png')).convert('RGBA');out=original.copy()
 native=v.get('mode')=='native'
 def preserve(c):
  if name=='guide':return max(c[:3])-min(c[:3])<35
  return c[1]>c[0]*1.15 and c[1]>c[2]*1.1
 eligible=collections.Counter(c[:3] for c in original.get_flattened_data() if c[3] and not preserve(c))
 mapping={};cumulative=0;n=sum(eligible.values())
 for rgb in sorted(eligible,key=luma):
  mapping[rgb]=target((cumulative+eligible[rgb]/2)/n);cumulative+=eligible[rgb]
 if not native:out.putdata([(*mapping.get(c[:3],c[:3]),c[3]) if c[3] and not preserve(c) else c for c in original.get_flattened_data()])
 assert out.size==original.size==(16,16)
 assert out.getchannel('A').tobytes()==original.getchannel('A').tobytes()
 for a,b in zip(original.get_flattened_data(),out.get_flattened_data()):
  if not native and a[3] and not preserve(a):assert b[:3] in palette
 if native:assert out.tobytes()==original.tobytes()
 out.save(stage/(name+'.png'))
 report['assets'][name]={'native_preserved':native,'alpha_preserved':True,'output_sha256':hashlib.sha256((stage/(name+'.png')).read_bytes()).hexdigest(),'mapping':{str(k):v for k,v in mapping.items()}}
 for col,img in enumerate([original,old,out]):preview.alpha_composite(img.resize((64,64),Image.Resampling.NEAREST),(col*100,row*80+35))
 draw.text((310,row*80+55),name,fill='white')
preview.save(D/'refined_texture_comparison.png')
(D/'refined_texture_validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('PASS: 10 assets, exact alpha and dimensions; gold palette membership; native textures unchanged')

"""Compile existing cooking data into native-only recipes. No source files are edited."""
from __future__ import annotations
import copy,json,re
from collections import Counter
LIMITS={'copper':2,'iron':3,'gold':4,'diamond':6,'netherite':7}
TAG_PREFIX='pinene_native_rank_'
CONTAINER_RETURNS={'minecraft:milk_bucket':'minecraft:bucket','minecraft:honey_bottle':'minecraft:glass_bottle'}
SEEDS=['minecraft:wheat_seeds','minecraft:pumpkin_seeds','minecraft:melon_seeds','minecraft:beetroot_seeds']
def parse_data(text):
    match=re.fullmatch(r'\s*export const COOKING_RECIPES\s*=\s*(\[[\s\S]*\]);\s*export const CATEGORY_ORDER\s*=\s*\[[0-9,\s]*\];\s*',text)
    if not match:raise ValueError('Unexpected cooking-data format; review instead of executing source code')
    data=json.loads(match[1]); ids=[r['id'] for r in data]
    if len(ids)!=len(set(ids)):raise ValueError('Duplicate cooking IDs')
    for r in data:
        if type(r['rank']) is not int or not 0<=r['rank']<=7:raise ValueError('Invalid rank')
        if type(r['resultCount']) is not int or not 1<=r['resultCount']<=64:raise ValueError('Invalid result count')
        if not r['ingredients']:raise ValueError('Missing ingredients')
        for p in r['ingredients']:
            if type(p['count']) is not int or p['count']<=0:raise ValueError('Invalid ingredient count')
            if ('id' in p)==('ids' in p):raise ValueError('Ambiguous ingredient')
    return data

def table(material):
    tags=[TAG_PREFIX+str(i) for i in range(LIMITS[material]+1)] if material in LIMITS else ['pinene_native_locked']
    # Use the native crafting header; no HUD overlay or UI JSON override.
    roman=('', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII')
    title='料理  Rank '+roman[LIMITS[material]] if material in LIMITS else '料理'
    return {'crafting_tags':tags,'table_name':title}

def compile_board(src):
    data=copy.deepcopy(src);block=data['minecraft:block']
    if block['description']['states']['pinene_cooking:knife']!=['empty',*LIMITS]:raise ValueError('Unexpected knife states')
    block['components']['minecraft:crafting_table']=table('empty')
    block['components']['minecraft:destructible_by_explosion']=False
    block['components']['minecraft:movable']={'movement_type':'immovable'}
    for material in LIMITS:
        test=f"q.block_state('pinene_cooking:knife') == '{material}'"
        found=[p for p in block['permutations'] if p['condition']==test]
        if len(found)!=1:raise ValueError('Missing material permutation '+material)
        found[0]['components']['minecraft:crafting_table']=table(material)
    return data

def signature(parts):
    total=Counter()
    for part in parts:
        if part is not None:total[part.get('id') or tuple(part['ids'])]+=part.get('count',1)
    return total

def _compile_recipe(r):
    """Return (filename,json) entries. Keep recipe counts and layouts exact.
    Oil's four homogeneous patterns are preserved. Mixed seed combinations are
    deliberately not claimed until a supported native tag is confirmed.
    """
    base=r['id'].split(':',1)[1]
    ids_parts=[p for p in r['ingredients'] if 'ids' in p]
    if ids_parts:
        if r['id']!='pine:cooking_oil' or ids_parts[0]['ids']!=SEEDS or len(ids_parts)!=1:raise ValueError('Unsupported choice ingredient')
        variants=SEEDS
    else:variants=[None]
    out=[]
    for variant in variants:
        suffix='_'+variant.split(':')[1] if variant else ''
        body={'description':{'identifier':'pinene_native:'+base+suffix},'tags':[TAG_PREFIX+str(r['rank'])]}
        def item(p):
            if 'ids' in p:return variant
            return p['id']
        if 'layout' in r:
            slots=r['layout']
            if len(slots)!=9 or signature(slots)!=signature(r['ingredients']):raise ValueError('Layout does not conserve ingredients '+r['id'])
            chars={};key={};pattern=[]
            for row in range(3):
                line=''
                for p in slots[row*3:row*3+3]:
                    if p is None:line+=' ';continue
                    if p.get('count',1)!=1:raise ValueError('Native grid slot count must be one')
                    name=item(p)
                    if name not in chars:
                        c=chr(65+len(chars));chars[name]=c;key[c]={'item':name}
                    line+=chars[name]
                pattern.append(line)
            body.update(pattern=pattern,key=key);kind='shaped'
        else:
            ingredients=[{'item':item(p)} for p in r['ingredients'] for _ in range(p['count'])]
            if len(ingredients)>9:raise ValueError('Too many native ingredient slots')
            body['ingredients']=ingredients;kind='shapeless'
        primary={'item':r['id'],'count':r['resultCount']}
        returned=Counter()
        for part in r['ingredients']:
            if part.get('id') in CONTAINER_RETURNS:
                returned[CONTAINER_RETURNS[part['id']]]+=part['count']
        if returned and kind=='shapeless':
            # Bedrock rejects mixed output types in shapeless result lists.
            # A compact shaped recipe retains counts and native container return.
            cells=body.pop('ingredients');width=min(3,len(cells));chars={};key={};letters=[]
            for cell in cells:
                name=cell['item']
                if name not in chars:
                    char=chr(65+len(chars));chars[name]=char;key[char]={'item':name}
                letters.append(chars[name])
            body['pattern']=[''.join(letters[i:i+width]).ljust(width) for i in range(0,len(letters),width)]
            body['key']=key;kind='shaped'
        body['result']=([primary]+[{'item':item,'count':count} for item,count in sorted(returned.items())]) if returned else primary
        body['unlock']=[{'item':item(r['ingredients'][0])}]
        out.append((base+suffix+'.json',{'format_version':'1.20.10','minecraft:recipe_'+kind:body}))
    return out

def compile_recipe(r):
    out=_compile_recipe(r)
    if r['id']!='pine:cooking_oil':return out
    # The former form accepted any mix of the four seeds. Enumerate unordered
    # mixtures rather than using a broad vanilla tag that may allow other seeds.
    from itertools import combinations_with_replacement
    for mixture in combinations_with_replacement(SEEDS,8):
        counts=Counter(mixture)
        if len(counts)==1:continue  # Existing four shaped patterns already cover these.
        suffix='_'.join(str(counts[s]) for s in SEEDS)
        body={'description':{'identifier':'pinene_native:cooking_oil_mix_'+suffix},
            'tags':[TAG_PREFIX+str(r['rank'])],
            'ingredients':[{'item':i} for i in mixture]+[{'item':'minecraft:glass_bottle'}],
            'result':{'item':r['id'],'count':r['resultCount']},
            'unlock':[{'item':mixture[0]}]}
        out.append(('cooking_oil_mix_'+suffix+'.json',{'format_version':'1.20.10','minecraft:recipe_shapeless':body}))
    return out

def native_counts(recipe):
    kind=next(k for k in recipe if k.startswith('minecraft:recipe_'));b=recipe[kind]
    if kind.endswith('shaped') and not kind.endswith('shapeless'):
        return Counter(b['key'][ch]['item'] for row in b['pattern'] for ch in row if ch!=' ')
    return Counter(p['item'] for p in b['ingredients'])

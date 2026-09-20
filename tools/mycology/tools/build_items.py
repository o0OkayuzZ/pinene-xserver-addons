"""Copy approved 32x32 icons verbatim; never fall back to legacy artwork."""
from pathlib import Path
import hashlib
import json
import shutil
import struct
import zlib

ROOT = Path(__file__).resolve().parents[1]


def nf_slug(number):
    if not isinstance(number, int) or isinstance(number, bool) or number < 1:
        raise ValueError('NF number must be a positive integer')
    return f'nf_{number:03d}'


def png_info(path):
    data = path.read_bytes()
    assert data[:8] == b'\x89PNG\r\n\x1a\n' and data[12:16] == b'IHDR', path
    width, height, bit_depth, color_type = struct.unpack('>IIBB', data[16:26])
    return width, height, bit_depth, color_type


def png_has_transparency(path):
    data=path.read_bytes();width,height,bit_depth,color_type=png_info(path)
    assert bit_depth==8 and color_type==6
    chunks=[];offset=8
    while offset<len(data):
        length=struct.unpack('>I',data[offset:offset+4])[0]
        kind=data[offset+4:offset+8]
        if kind==b'IDAT':chunks.append(data[offset+8:offset+8+length])
        offset+=12+length
    raw=zlib.decompress(b''.join(chunks));stride=width*4;prior=bytearray(stride);pos=0
    for _ in range(height):
        mode=raw[pos];pos+=1;row=bytearray(raw[pos:pos+stride]);pos+=stride
        for x in range(stride):
            left=row[x-4] if x>=4 else 0;up=prior[x];upper_left=prior[x-4] if x>=4 else 0
            if mode==1:row[x]=(row[x]+left)&255
            elif mode==2:row[x]=(row[x]+up)&255
            elif mode==3:row[x]=(row[x]+((left+up)//2))&255
            elif mode==4:
                p=left+up-upper_left;pa=abs(p-left);pb=abs(p-up);pc=abs(p-upper_left)
                row[x]=(row[x]+(left if pa<=pb and pa<=pc else up if pb<=pc else upper_left))&255
            elif mode!=0:raise AssertionError(f'Unsupported PNG filter {mode}')
        if any(row[x]<255 for x in range(3,stride,4)):return True
        prior=row
    return False


def sync_icons(root=ROOT):
    manifest = json.loads((root / 'docs/texture_v1.4/asset_manifest.json').read_text(encoding='utf8'))
    registry = json.loads((root / 'data/mushrooms.json').read_text(encoding='utf8'))['mushrooms']
    expected = {entry['id'].lower() + '.png' for entry in registry}
    source = root / 'reference/final_32x32'
    assert len(manifest) == len(expected) == 35
    assert {entry['id'].lower() + '.png' for entry in manifest} == expected
    assert {p.name for p in source.glob('*.png')} == expected, 'Missing or unexpected canonical icons'
    # Validate every source before changing any output.
    for entry in manifest:
        path = source / (entry['id'].lower() + '.png')
        assert hashlib.sha256(path.read_bytes()).hexdigest() == entry['texture_sha256'], path
        width,height,bit_depth,color_type=png_info(path)
        assert (width,height,bit_depth,color_type)==(32,32,8,6) and png_has_transparency(path), path
    target = root / 'pack/RP/textures/items/mycology'
    target.mkdir(parents=True, exist_ok=True)
    for name in sorted(expected):
        shutil.copyfile(source / name, target / name)
    print('Copied 35 canonical v1.4 icons without re-encoding')


def sync_nether_icons(root=ROOT):
    """Copy the authoritative NF sprites byte-for-byte and refresh their hash manifest."""
    source = root / 'reference/nether_fungi'
    target = root / 'pack/RP/textures/items/mycology/nf'
    target.mkdir(parents=True, exist_ok=True)
    entries = json.loads((root / 'data/nether_fungi_master_v1.0.json').read_text(encoding='utf8'))['entries']
    expected = {nf_slug(entry['number'])+'.png' for entry in entries}
    assert len(expected) == len(entries), 'Duplicate NF numbers'
    assert {path.name for path in source.glob('*.png')} == expected
    manifest = []
    for name in sorted(expected):
        path = source / name
        width,height,bit_depth,color_type=png_info(path)
        assert (width,height,bit_depth,color_type)==(32,32,8,6) and png_has_transparency(path), path
        data = path.read_bytes()
        shutil.copyfile(path, target / name)
        assert (target / name).read_bytes() == data
        manifest.append({
            'id': 'NF-' + name[3:-4],
            'file': name,
            'sha256': hashlib.sha256(data).hexdigest(),
            'width': 32,
            'height': 32,
            'mode': 'RGBA',
            'hasTransparency': True,
        })
    (root / 'data/nether_fungi_assets.json').write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print(f'Copied {len(expected)} authoritative NF icons without re-encoding')


if __name__ == '__main__':
    sync_icons()
    sync_nether_icons()

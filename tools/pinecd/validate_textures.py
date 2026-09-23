"""PineCD texture cap guard; independent of historical release hashes."""
import json
import struct
from build import RP

def validate_textures(rp=RP):
    """Check every PineCD PNG, including files not yet present in the catalog."""
    paths = sorted((rp / 'textures/items').glob('pinecd_cd_*.png'))
    assert paths, 'No PineCD PNG textures found'
    for path in paths:
        with path.open('rb') as stream:
            header = stream.read(33)
        assert (len(header) == 33 and header[:8] == b'\x89PNG\r\n\x1a\n'
                and header[8:16] == b'\x00\x00\x00\x0dIHDR'), f'Invalid PNG header: {path}'
        width, height = struct.unpack('>II', header[16:24])
        assert 0 < width <= 512 and 0 < height <= 512, (
            f'PineCD texture exceeds 512px or has invalid dimensions: {path}: {width}x{height}')
    return len(paths)


if __name__ == '__main__':
    print(json.dumps({'textures': validate_textures(), 'oversized_textures': 0}))

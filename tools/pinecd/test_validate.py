"""Exercise the texture limit without third-party imaging dependencies."""
import struct
import tempfile
import unittest
import zlib
from pathlib import Path
from validate import validate_textures


def png(width, height):
    def chunk(kind, data):
        return (struct.pack('>I', len(data)) + kind + data
                + struct.pack('>I', zlib.crc32(kind + data)))
    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress((b'\x00' + b'\x00' * width * 4) * height))
            + chunk(b'IEND', b''))


class TextureTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.rp = Path(temp.name)
        self.items = self.rp / 'textures/items'
        self.items.mkdir(parents=True)

    def test_small_and_boundary_dimensions_pass(self):
        for index, size in enumerate([(256, 256), (512, 512), (512, 256)]):
            (self.items / f'pinecd_cd_{index:02d}.png').write_bytes(png(*size))
        self.assertEqual(validate_textures(self.rp), 3)

    def test_either_oversized_dimension_fails_for_uncatalogued_file(self):
        path = self.items / 'pinecd_cd_99.png'
        for size in [(513, 256), (256, 513), (1024, 1024)]:
            with self.subTest(size=size):
                path.write_bytes(png(*size))
                with self.assertRaisesRegex(AssertionError, 'pinecd_cd_99.png'):
                    validate_textures(self.rp)

    def test_invalid_header_fails(self):
        (self.items / 'pinecd_cd_01.png').write_bytes(b'not a png')
        with self.assertRaisesRegex(AssertionError, 'Invalid PNG'):
            validate_textures(self.rp)

    def test_missing_textures_fail(self):
        with self.assertRaisesRegex(AssertionError, 'No PineCD'):
            validate_textures(self.rp)


if __name__ == '__main__':
    unittest.main()

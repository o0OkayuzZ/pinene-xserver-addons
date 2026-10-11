import unittest

from PIL import Image
from alpha_edges import edge_preserving_resize


class AlphaEdgeTests(unittest.TestCase):
    def test_thin_covered_fragment_survives(self):
        image = Image.new("RGBA", (4, 4), (0, 0, 0, 0))
        image.putpixel((0, 0), (210, 100, 30, 255))
        self.assertEqual(edge_preserving_resize(image, (1, 1)).getpixel((0, 0)), (210, 100, 30, 255))

    def test_transparent_rgb_does_not_bleed(self):
        image = Image.new("RGBA", (2, 2), (255, 255, 255, 0))
        image.putpixel((1, 1), (20, 40, 60, 255))
        self.assertEqual(edge_preserving_resize(image, (1, 1)).getpixel((0, 0)), (20, 40, 60, 255))

    def test_empty_blocks_stay_empty(self):
        image = Image.new("RGBA", (4, 2), (70, 80, 90, 0))
        image.putpixel((0, 0), (15, 25, 35, 255))
        result = edge_preserving_resize(image, (2, 1))
        self.assertEqual(result.getpixel((1, 0)), (0, 0, 0, 0))

    def test_opaque_colors_use_area_average(self):
        image = Image.new("RGBA", (2, 2), (20, 40, 60, 255))
        image.putpixel((0, 0), (60, 80, 100, 255))
        self.assertEqual(edge_preserving_resize(image, (1, 1)).getpixel((0, 0)), (30, 50, 70, 255))

    def test_same_size_preserves_every_pixel(self):
        image = Image.new("RGBA", (2, 2), (7, 19, 21, 130))
        self.assertEqual(edge_preserving_resize(image, image.size).tobytes(), image.tobytes())

    def test_noninteger_scaling_fails_closed(self):
        with self.assertRaises(ValueError):
            edge_preserving_resize(Image.new("RGBA", (4, 4)), (3, 3))


if __name__ == "__main__":
    unittest.main()

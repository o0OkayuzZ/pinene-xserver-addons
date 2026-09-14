"""Exercise catalog failures before any generated files can be written."""
import copy
import unittest
from unittest.mock import patch
import build


class CatalogTests(unittest.TestCase):
    def setUp(self):
        self.catalog = build.load(build.Path(__file__).with_name('tracks.json'))
        self.real_load = build.load

    def render(self):
        def reader(p):
            return self.catalog if p.name == 'tracks.json' else self.real_load(p)
        with patch.object(build, 'load', reader):
            return build.outputs()

    def test_current_catalog(self):
        self.assertEqual(len(self.render()), len(self.catalog['tracks']) + 2)
        for p, d in self.render().items():
            if p.parent == build.BP / 'items':
                self.assertEqual(d['format_version'], 'beta')
                self.assertEqual(d['minecraft:item']['description']['menu_category']['group'],
                                 'minecraft:itemGroup.name.record')

    def test_duplicate_id(self):
        self.catalog['tracks'].append(copy.deepcopy(self.catalog['tracks'][0]))
        with self.assertRaises(AssertionError):
            self.render()

    def test_duplicate_event(self):
        self.catalog['tracks'][1]['sound_event'] = self.catalog['tracks'][0]['sound_event']
        with self.assertRaises(AssertionError):
            self.render()

    def test_missing_audio(self):
        self.catalog['tracks'][0]['sound'] = 'sounds/records/nonexistent'
        with self.assertRaises(AssertionError):
            self.render()

    def test_escape_item_path(self):
        self.catalog['tracks'][0]['item_file'] = '../manifest.json'
        with self.assertRaises(AssertionError):
            self.render()

    def test_optional_recipe(self):
        self.catalog['tracks'][0]['recipe'] = {'format_version': '1.20.10',
            'minecraft:recipe_shapeless': {'description': {'identifier': 'pinecd:cd_01'},
                'tags': ['crafting_table'], 'ingredients': [{'item': 'minecraft:diamond'}],
                'result': {'item': 'pinecd:cd_01', 'count': 1}}}
        self.assertIn(build.BP / 'recipes/cd_01.json', self.render())


if __name__ == '__main__':
    unittest.main()

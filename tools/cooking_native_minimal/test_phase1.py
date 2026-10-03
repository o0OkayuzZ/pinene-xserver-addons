import json,pathlib,unittest
from compiler import *
HERE=pathlib.Path(__file__).parent
DATA=HERE.parents[1]/'behavior_packs/bp_19_211f47f7-5f1d-4b02-a162-e7546cf3fdc4/scripts/cooking_data.js'
class Phase1Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.data=parse_data(DATA.read_text(encoding='utf-8-sig'))
    def test_five_returning_recipes_use_shaped(self):
        found=[]
        for r in self.data:
            expected=[{'item':CONTAINER_RETURNS[p['id']],'count':p['count']} for p in r['ingredients'] if p.get('id') in CONTAINER_RETURNS]
            for name,doc in compile_recipe(r):
                body=doc[next(k for k in doc if k.startswith('minecraft:'))]
                if expected:
                    self.assertIn('minecraft:recipe_shaped',doc)
                    self.assertEqual(body['result'][1:],expected);found.append(r['id'])
                else:self.assertIsInstance(body['result'],dict)
        self.assertEqual(set(found),{'pine:milk_bottle','pine:butter','pine:honey_bread','pine:honey_chicken','pine:honey_pork_sandwich'})
    def test_furnace_is_not_given_a_return(self):
        p=DATA.parents[2]/'bp_18_7e540260-69ce-4a82-951d-bc793e151cd5/recipes/whole_cheese_furnace.json'
        doc=json.loads(p.read_text(encoding='utf-8'));self.assertEqual(doc['minecraft:recipe_furnace']['output'],'pine:whole_cheese')
    def test_returning_inputs_still_match_exact_counts(self):
        for r in self.data:
            if any(p.get('id') in CONTAINER_RETURNS for p in r['ingredients']):
                for _,doc in compile_recipe(r):self.assertEqual(native_counts(doc),signature(r['ingredients']))
    def test_no_new_recipe_or_private_tag_leak(self):
        self.assertEqual(sum(len(compile_recipe(r)) for r in self.data),37)
        for r in self.data:
            for _,d in compile_recipe(r):self.assertEqual(d[next(k for k in d if k.startswith('minecraft:'))]['tags'],[TAG_PREFIX+str(r['rank'])])

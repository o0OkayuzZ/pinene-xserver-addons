import copy,json,unittest
from collections import Counter
from build_catalog100 import *
from compiler import CONTAINER_RETURNS

class Catalog100Tests(unittest.TestCase):
    def setUp(self):self.catalog=load_catalog()
    def test_catalog_counts_and_dependencies(self):
        self.assertEqual(len(validate_catalog(self.catalog)),107)
    def test_free_dish_must_not_depend_on_expansion(self):
        self.catalog['dishes'][0]['ingredients'][0]['id']='pine:beef_stew'
        with self.assertRaises(AssertionError):validate_catalog(self.catalog)
    def test_more_than_100_or_material_counting_is_rejected(self):
        self.catalog['dishes'].append(self.catalog['materials'][0])
        with self.assertRaises(AssertionError):validate_catalog(self.catalog)
    def test_strong_or_overlong_effect_is_rejected(self):
        for key,value in [('amplifier',1),('seconds',999)]:
            c=copy.deepcopy(self.catalog);c['dishes'][0]['effects'][0][key]=value
            with self.assertRaises(AssertionError):validate_catalog(c)
    def test_duplicate_native_recipes_are_rejected(self):
        self.catalog['dishes'][1]['ingredients']=copy.deepcopy(self.catalog['dishes'][0]['ingredients'])
        with self.assertRaises(AssertionError):validate_catalog(self.catalog)
    def test_all_100_items_register_consumption_callback(self):
        files=generated_files(self.catalog)
        for row in self.catalog['dishes']:
            p=FOOD/'items'/(row['id'].split(':')[1]+'.json')
            comp=json.loads(files[p])['minecraft:item']['components']
            self.assertIn('pine:meal_effects',comp)
            self.assertEqual(comp['minecraft:food']['nutrition'],row['nutrition'])
            self.assertFalse(comp['minecraft:food']['can_always_eat'])
            self.assertEqual(comp['minecraft:food'].get('using_converts_to'),row['container_return'])
    def test_all_input_vessels_are_conserved_and_output_dish_remains_exact(self):
        for row in self.catalog['materials']+self.catalog['dishes']:
            expected=Counter()
            for part in row['ingredients']:
                if part.get('id') in CONTAINER_RETURNS:expected[CONTAINER_RETURNS[part['id']]]+=part['count']
            for _,recipe in compile_recipe(row):
                body=recipe[next(k for k in recipe if k.startswith('minecraft:recipe_'))]
                results=body['result'] if isinstance(body['result'],list) else [body['result']]
                self.assertEqual(results[0],{'item':row['id'],'count':row['resultCount']})
                self.assertEqual(Counter({x['item']:x['count'] for x in results[1:]}),expected)
    def test_new_recipe_count_is_100_dishes_plus_7_materials_plus_164_seed_variants(self):
        files=generated_files(self.catalog)
        self.assertEqual(sum('/recipes/native/' in p.as_posix() for p in files),271)
    def test_no_server_only_pancake_dependency(self):
        files=generated_files(self.catalog)
        self.assertNotIn('myname:pancake',files[TOOLS/'scripts/cooking_data.js'])
        self.assertNotIn('myname:pancake',files[TOOLS/'scripts/cooking_runtime.js'])
    def test_approved_27_names_are_retained(self):
        wave=json.loads((ROOT/'docs/cooking_ui/approved-wave2-20261015.json').read_text())
        names={r['name'] for r in self.catalog['dishes']}
        self.assertTrue({r['name_ja'] for r in wave['dishes']}<=names)

if __name__=='__main__':unittest.main(verbosity=2)

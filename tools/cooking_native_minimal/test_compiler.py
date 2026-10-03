from __future__ import annotations
import copy,json,pathlib,tempfile,unittest
from collections import Counter
from compiler import *
R=pathlib.Path(__file__).resolve().parents[2]
DATA=R/'behavior_packs/bp_19_211f47f7-5f1d-4b02-a162-e7546cf3fdc4/scripts/cooking_data.js'
class CompilerTests(unittest.TestCase):
    def basic(self):return {'id':'pine:test','name':'Test','rank':2,'resultCount':1,'ingredients':[{'id':'minecraft:bread','count':1}]}
    def test_01_no_knife_has_no_recipe_tag(self):self.assertEqual(table('empty')['crafting_tags'],['pinene_native_locked'])
    def test_02_rank_limits(self):self.assertEqual(LIMITS,dict(copper=2,iron=3,gold=4,diamond=6,netherite=7))
    def test_03_each_knife_excludes_above_limit(self):
        for m,max_rank in LIMITS.items():
            for rank in range(8):self.assertEqual(TAG_PREFIX+str(rank) in table(m)['crafting_tags'],rank<=max_rank)
    def test_04_private_tags(self):
        for m in LIMITS:self.assertTrue(all(t.startswith(TAG_PREFIX) for t in table(m)['crafting_tags']))
    def test_05_keep_result(self):
        r=self.basic();r['resultCount']=4;b=compile_recipe(r)[0][1]['minecraft:recipe_shapeless'];self.assertEqual(b['result'],{'item':'pine:test','count':4})
    def test_06_expand_ingredient_counts(self):
        r=self.basic();r['ingredients'][0]['count']=3;d=compile_recipe(r)[0][1];self.assertEqual(native_counts(d),{'minecraft:bread':3})
    def test_07_limit_nine_slots(self):
        r=self.basic();r['ingredients'][0]['count']=10
        with self.assertRaises(ValueError):compile_recipe(r)
    def test_08_reject_mismatched_layout(self):
        r=self.basic();r['layout']=[None]*9
        with self.assertRaises(ValueError):compile_recipe(r)
    def test_09_shape(self):
        r=self.basic();r['ingredients'][0]['count']=3;r['layout']=[None,{'id':'minecraft:bread'},None]*3
        d=compile_recipe(r)[0][1]['minecraft:recipe_shaped'];self.assertEqual(d['pattern'],[' A ',' A ',' A '])
    def test_10_input_is_not_mutated(self):
        r=self.basic();before=copy.deepcopy(r);compile_recipe(r);self.assertEqual(r,before)
    def test_11_reject_unknown_choice(self):
        r=self.basic();r['ingredients']=[{'ids':['x','y'],'count':1}]
        with self.assertRaises(ValueError):compile_recipe(r)
    def test_12_four_oil_variants(self):
        r=self.basic();r['id']='pine:cooking_oil';r['ingredients']=[{'ids':SEEDS,'count':8},{'id':'minecraft:glass_bottle','count':1}]
        parts=[{'ids':SEEDS} for _ in range(9)];parts[4]={'id':'minecraft:glass_bottle'};r['layout']=parts
        outputs=compile_recipe(r);self.assertEqual(len(outputs),4)
        for (name,d),seed in zip(outputs,SEEDS):self.assertEqual(native_counts(d),{seed:8,'minecraft:glass_bottle':1})
    def test_13_parser_no_eval(self):
        with self.assertRaises(ValueError):parse_data('export const COOKING_RECIPES = process.exit();')
    def test_14_duplicate_ids_rejected(self):
        with self.assertRaises(ValueError):parse_data('export const COOKING_RECIPES = '+json.dumps([self.basic()]*2)+'; export const CATEGORY_ORDER = [0];')
    def test_15_bad_rank(self):
        r=self.basic();r['rank']=9
        with self.assertRaises(ValueError):parse_data('export const COOKING_RECIPES = '+json.dumps([r])+';export const CATEGORY_ORDER = [0];')
    def test_16_bad_count(self):
        r=self.basic();r['ingredients'][0]['count']=0
        with self.assertRaises(ValueError):parse_data('export const COOKING_RECIPES = '+json.dumps([r])+';export const CATEGORY_ORDER = [0];')
    @unittest.skipUnless(DATA.exists(),'source data not mounted here')
    def test_17_real_recipes(self):
        data=parse_data(DATA.read_text(encoding='utf-8-sig'));self.assertEqual(len(data),34);self.assertEqual(sum(r['rank']==0 for r in data),7)
        count=0
        for r in data:
            for name,d in compile_recipe(r):
                count+=1;b=d[next(k for k in d if k.startswith('minecraft:recipe_'))]
                self.assertEqual(b['result'][0] if isinstance(b['result'],list) else b['result'],{'item':r['id'],'count':r['resultCount']})
                if r['id']!='pine:cooking_oil':self.assertEqual(native_counts(d),signature(r['ingredients']))
        self.assertEqual(count,37)
    @unittest.skipUnless(DATA.exists(),'source data not mounted here')
    def test_18_all_boards_keep_models(self):
        files=list((DATA.parent.parent/'blocks').glob('*_cutting_board.json'));self.assertEqual(len(files),13)
        for p in files:
            src=json.loads(p.read_text(encoding='utf-8'));d=compile_board(src)
            self.assertEqual(d['minecraft:block']['components']['minecraft:geometry'],src['minecraft:block']['components']['minecraft:geometry'])
            for m in LIMITS:
                perm=next(a for a in d['minecraft:block']['permutations'] if a['condition']==f"q.block_state('pinene_cooking:knife') == '{m}'")
                self.assertEqual(perm['components']['minecraft:crafting_table'],table(m))
    def test_19_no_forms_or_delta_wear(self):
        s=(pathlib.Path(__file__).parent/'native_boards.js').read_text(encoding='utf-8');self.assertNotIn('.show(',s);self.assertNotIn('playerInventoryItemChange',s)
    def test_20_no_script_recipe_consumption(self):
        s=(pathlib.Path(__file__).parent/'native_boards.js').read_text(encoding='utf-8');self.assertNotIn('COOKING_RECIPES',s);self.assertNotIn('damage =',s)
if __name__=='__main__':unittest.main(verbosity=2)

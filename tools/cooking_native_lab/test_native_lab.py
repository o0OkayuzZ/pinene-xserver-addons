"""Offline structural checks. Passing does not certify the Minecraft engine."""
import hashlib, importlib.util, json, os, pathlib, tempfile, unittest, zipfile
from unittest import mock
from PIL import Image
import build_native_lab as b

SOURCE=pathlib.Path(os.environ.get('PINENE_LAB_SOURCE_ITEMS','/mnt/data/cooking_material_textures'))
class LabTests(unittest.TestCase):
    def setUp(self): self.files=b.definitions(); self.recipes=b.recipes()
    def test_01_unique_manifest_ids(self):
        ids=[b.BP_UUID,b.RP_UUID]+[m['uuid'] for k in ['BP','RP'] for m in b.manifest(k)['modules']]
        self.assertEqual(len(ids),len(set(ids))); self.assertNotIn(b.SOURCE_RP_UUID,ids)
    def test_02_no_cooking_dependency(self):
        self.assertEqual([x.get('uuid') for x in b.manifest('BP')['dependencies'] if 'uuid' in x],[b.RP_UUID])
    def test_03_no_ui_overrides(self): self.assertFalse(any('/ui/' in p for p in self.files))
    def test_04_no_vanilla_definitions(self):
        for p,data in self.files.items():
            if p.startswith(('BP/items/','BP/blocks/')):
                obj=json.loads(data); item=obj.get('minecraft:item') or obj['minecraft:block']
                self.assertTrue(item['description']['identifier'].startswith(b.NS+':'))
    def test_05_no_shared_recipe_tags(self):
        for r in self.recipes.values():
            recipe=next(v for k,v in r.items() if k.startswith('minecraft:recipe_'))
            self.assertEqual(recipe['tags'],[b.TAG])
    def test_06_native_crafting_table(self):
        x=json.loads(self.files['BP/blocks/workbench.json'])['minecraft:block']['components']
        self.assertEqual(x['minecraft:crafting_table']['crafting_tags'],[b.TAG]); self.assertNotIn('minecraft:container',x)
    def test_07_no_reopen_forms(self):
        for token in ['ActionFormData','CustomForm','form.show','scheduleBoardUi']: self.assertNotIn(token,b.RUNTIME)
    def test_08_readonly_script(self):
        for token in ['.setItem(','.addItem(','.setType(','.setPermutation(','.spawnItem(','.runCommand(','.kill(','.clearAll(','.triggerEvent(']:
            self.assertNotIn(token,b.RUNTIME)
    def test_09_no_gameplay_recipe_outputs(self):
        for r in self.recipes.values():
            recipe=next(v for k,v in r.items() if k.startswith('minecraft:recipe_'))
            self.assertTrue(recipe['result']['item'].startswith(b.NS+':'))
    def test_10_no_gameplay_recipe_inputs(self):
        for r in self.recipes.values():
            x=next(v for k,v in r.items() if k.startswith('minecraft:recipe_'))
            for i in x.get('ingredients',list(x.get('key',{}).values())): self.assertTrue(i['item'].startswith(b.NS+':'))
    def test_11_noodle_layout(self):
        r=self.recipes['noodles']['minecraft:recipe_shaped']; self.assertEqual(r['pattern'],['W','W','W']); self.assertEqual(r['result']['count'],1)
    def test_12_cheese_ratio(self):
        r=self.recipes['cheese']['minecraft:recipe_shapeless']; self.assertEqual(r['ingredients'],[{'item':b.NS+':whole_cheese'}]); self.assertEqual(r['result']['count'],4)
    def test_13_oil_layout(self):
        r=self.recipes['oil']['minecraft:recipe_shaped']; self.assertEqual(r['pattern'],['SSS','SBS','SSS']); self.assertEqual(r['result']['count'],1)
    def test_14_unique_recipe_ids(self):
        ids=[next(v for k,v in r.items() if k.startswith('minecraft:recipe_'))['description']['identifier'] for r in self.recipes.values()]
        self.assertEqual(len(ids),len(set(ids)))
    def test_15_kit_no_replace(self):
        lines=self.files['BP/functions/pinene_ui_lab/kit.mcfunction'].decode().splitlines()
        self.assertEqual(len([l for l in lines if l.startswith('give @s pinene_ui_lab:')]),4)
        self.assertTrue(all(l.startswith('#') or l.startswith('give @s pinene_ui_lab:') for l in lines))
    def test_16_three_recipes_only(self): self.assertEqual(len(self.recipes),3)
    def test_17_no_ticking_gameplay(self): self.assertNotIn('runInterval',b.RUNTIME)
    def test_18_single_player_survival_guard(self):
        self.assertIn('world.getAllPlayers().length !== 1',b.RUNTIME); self.assertIn('GameMode.Survival',b.RUNTIME)
    def test_19_check_declares_sampling_limits(self):
        self.assertIn('maxDistance: 8',b.RUNTIME); self.assertIn('全動作の合格判定ではありません',b.RUNTIME)
    def test_20_native_output_conservation_arithmetic(self):
        # Recipe arithmetic only, not a simulation of native inventory transactions.
        counts=dict(wheat=180,noodles=0,whole_cheese=40,cheese=0,seed=240,bottle=30,oil=0)
        def weights(c): return (c['wheat']+3*c['noodles'],4*c['whole_cheese']+c['cheese'],c['seed']+8*c['oil'],c['bottle']+c['oil'])
        base=weights(counts)
        for _ in range(60): counts['wheat']-=3; counts['noodles']+=1; self.assertEqual(base,weights(counts))
        for _ in range(40): counts['whole_cheese']-=1; counts['cheese']+=4; self.assertEqual(base,weights(counts))
        for _ in range(30): counts['seed']-=8; counts['bottle']-=1; counts['oil']+=1; self.assertEqual(base,weights(counts))
    def test_21_build_archive_and_images(self):
        with tempfile.TemporaryDirectory() as t:
            out=pathlib.Path(t)/'out'; hashes=b.build(SOURCE,out)
            self.assertEqual(len(hashes),25)
            for rel,h in hashes.items():
                self.assertEqual(hashlib.sha256((out/rel).read_bytes()).hexdigest(),h)
                if rel.endswith('.png'):
                    with Image.open(out/rel) as im: im.verify()
            with zipfile.ZipFile(out/'Pinene_Native_Cooking_Lab_v1.mcaddon') as z: self.assertEqual(set(z.namelist()),{'BP.mcpack','RP.mcpack'})
            for k in ['BP','RP']:
                with zipfile.ZipFile(out/(k+'.mcpack')) as z: self.assertIn('manifest.json',z.namelist()); self.assertIsNone(z.testzip())
    def test_22_build_refuses_overwrite(self):
        with tempfile.TemporaryDirectory() as t:
            with self.assertRaises(FileExistsError): b.build(SOURCE,pathlib.Path(t))
    def test_23_install_creation_only_and_hashes(self):
        with tempfile.TemporaryDirectory() as t:
            root=pathlib.Path(t); out=root/'out'; b.build(SOURCE,out)
            (root/'mc/development_behavior_packs/Existing').mkdir(parents=True)
            sentinel=root/'mc/development_behavior_packs/Existing/keep.txt'; sentinel.write_text('KEEP')
            b.install(out,root/'mc'); self.assertEqual(sentinel.read_text(),'KEEP')
            with self.assertRaises(FileExistsError): b.install(out,root/'mc')
            self.assertEqual(sentinel.read_text(),'KEEP')
    def test_24_install_refuses_duplicate_uuid(self):
        with tempfile.TemporaryDirectory() as t:
            root=pathlib.Path(t); out=root/'out'; b.build(SOURCE,out)
            p=root/'mc/development_resource_packs/Elsewhere'; p.mkdir(parents=True)
            (p/'manifest.json').write_bytes(b.encode(b.manifest('RP')))
            with self.assertRaises(ValueError): b.install(out,root/'mc')
            self.assertFalse((root/'mc/development_behavior_packs/Pinene_Native_Cooking_Lab_BP').exists())
    def test_25_install_failure_rolls_back_only_new_dirs(self):
        with tempfile.TemporaryDirectory() as t:
            root=pathlib.Path(t); out=root/'out'; b.build(SOURCE,out)
            original=b.shutil.copytree
            calls=[]
            def fail_second(src,dst,*args,**kwargs):
                if str(src)==str(out/'RP'): raise OSError('injected')
                return original(src,dst,*args,**kwargs)
            with mock.patch.object(b.shutil,'copytree',side_effect=fail_second):
                with self.assertRaises(OSError): b.install(out,root/'mc')
            self.assertFalse((root/'mc/development_behavior_packs/Pinene_Native_Cooking_Lab_BP').exists())
            self.assertFalse((root/'mc/development_resource_packs/Pinene_Native_Cooking_Lab_RP').exists())
    def test_26_malformed_png_rejected(self):
        with self.assertRaises(ValueError): b.png(b'not png')
    def test_27_localization_complete(self):
        for lang in ['ja_JP','en_US']:
            s=self.files['RP/texts/'+lang+'.lang'].decode()
            for key in b.IDS: self.assertIn('item.'+b.NS+':'+key+'.name=',s)
    def test_28_json_utf8(self):
        for p,content in self.files.items():
            if p.endswith('.json'): self.assertIsInstance(json.loads(content), (dict,list))

if __name__=='__main__': unittest.main(verbosity=2)

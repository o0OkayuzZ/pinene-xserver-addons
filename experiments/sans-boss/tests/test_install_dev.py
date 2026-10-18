import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

path=Path(__file__).resolve().parents[1]/'tools/install_dev.py'
spec=importlib.util.spec_from_file_location('install_dev',path)
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        root=Path(self.tmp.name);self.source=root/'source';self.base=root/'shared';self.world=root/'world'
        self.world.mkdir();(self.world/'levelname.txt').write_text('\u958b\u767a\u7528\u30ef\u30fc\u30eb\u30c9',encoding='utf-8')
        self.original=[{'pack_id':'external','version':[1,2,3],'subpack':'keep'},
                       {'pack_id':'another','version':[4,5,6]}]
        for kind,short in [('behavior','BP'),('resource','RP')]:
            pack=self.source/short;pack.mkdir(parents=True)
            (pack/'manifest.json').write_text(json.dumps({'header':{'uuid':short,'version':[0,3,0]}}))
            (self.world/f'world_{kind}_packs.json').write_text(json.dumps(self.original))

    def install(self):return module.install(self.source,self.base,self.world,check_closed=lambda:None)

    def test_preserves_plain_arrays_subpacks_and_order_and_is_idempotent(self):
        self.install();self.install()
        for kind,short in [('behavior','BP'),('resource','RP')]:
            refs=module.load(self.world/f'world_{kind}_packs.json')
            self.assertEqual(refs,[{'pack_id':short,'version':[0,3,0]}]+self.original)
            self.assertTrue(all('pack_id' in row for row in refs))

    def test_rejects_wrapped_arrays_without_mutating_either_file(self):
        bad=self.world/'world_resource_packs.json'
        bad.write_text(json.dumps([{'value':self.original,'Count':2}]))
        before={p.name:p.read_bytes() for p in self.world.glob('*.json')}
        with self.assertRaises(ValueError):self.install()
        self.assertEqual(before,{p.name:p.read_bytes() for p in self.world.glob('*.json')})

    def test_game_open_guard_makes_no_changes(self):
        def blocked():raise RuntimeError('game open')
        with self.assertRaises(RuntimeError):module.install(self.source,self.base,self.world,blocked)
        self.assertFalse(self.base.exists())

if __name__=='__main__':unittest.main()

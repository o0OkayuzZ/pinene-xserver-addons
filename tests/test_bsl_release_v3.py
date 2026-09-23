import copy,json,pathlib,sys,unittest
from fractions import Fraction
ROOT=pathlib.Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT/'tools'))
from build_bsl_release_v3 import replacement,pack,load,outputs
from validate_bsl_release_v3 import bound,guaranteed,odds,validate
class ReleaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.tables=outputs(); cls.bp=pack()
    def test_all_contracts(self): self.assertEqual(validate()['normalTables'],33)
    def test_bastion_template_is_dedicated(self):
        data=copy.deepcopy(self.tables['loot_tables/chests/bastion_treasure.json'])
        self.assertTrue(guaranteed(data,'minecraft:netherite_upgrade_smithing_template'))
        data['pools'][0]['entries'].append({'type':'item','name':'minecraft:diamond_spear','weight':650})
        self.assertFalse(guaranteed(data,'minecraft:netherite_upgrade_smithing_template'))
    def test_heart_is_dedicated(self):
        self.assertTrue(guaranteed(self.tables['loot_tables/chests/buriedtreasure.json'],'minecraft:heart_of_the_sea'))
    def test_specials_all_exactly_27(self):
        for name in ['bastion_treasure','buriedtreasure','ancient_city_ice_box']:
            with self.subTest(name=name): self.assertEqual(bound(self.tables['loot_tables/chests/'+name+'.json'],self.bp,{}),(27,27))
    def test_extra_stack_detected(self):
        data=copy.deepcopy(self.tables['loot_tables/chests/buriedtreasure.json']); data['pools'][10]['rolls']+=1
        self.assertEqual(bound(data,self.bp,{}),(28,28))
    def test_conditional_guarantee_is_not_guaranteed(self):
        data=copy.deepcopy(self.tables['loot_tables/chests/buriedtreasure.json']); data['pools'][0]['conditions']=[{'condition':'random_chance','chance':.99}]
        self.assertFalse(guaranteed(data,'minecraft:heart_of_the_sea'))
    def test_replacement_preserves_exact_chance(self):
        old={'rolls':1,'entries':[{'type':'item','name':'resetapple:blue_apple'}],'conditions':[{'condition':'random_chance','chance':.012}]}
        new=replacement(old,'loot_tables/fallback.json')
        key=next(iter(odds(old))); self.assertEqual(odds(new)[key],Fraction(3,250))
        self.assertFalse(new.get('conditions')); self.assertFalse(any(e['type']=='empty' for e in new['entries']))
    def test_empty_replaced_without_changing_progression_odds(self):
        old={'rolls':1,'entries':[{'type':'item','name':'true_dn:deathnerite_ingot','weight':18},{'type':'item','name':'true_dn:darkness_upgrade_smithing_template','weight':10},{'type':'empty','weight':72}]}
        new=replacement(old,'loot_tables/fallback.json')
        for k,v in odds(old).items(): self.assertEqual(odds(new)[k],v)
    def test_unknown_condition_rejected(self):
        with self.assertRaises(AssertionError): replacement({'rolls':1,'entries':[{'type':'item','name':'minecraft:diamond'}],'conditions':[{'condition':'random_unknown','chance':.2}]},'fallback')
    def test_oversized_count_rejected(self):
        data={'pools':[{'rolls':1,'entries':[{'type':'item','name':'minecraft:snowball','functions':[{'function':'set_count','count':17}]}]}]}
        with self.assertRaises(AssertionError): bound(data,self.bp,{'minecraft:snowball':16})
    def test_native_floors_are_not_guessed(self):
        self.assertFalse(validate()['nativeItemLimitsUsed'])
if __name__=='__main__': unittest.main()

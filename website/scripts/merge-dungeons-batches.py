"""Merge reviewed staged batches into the Web guide; never edit game sources."""
import json
from pathlib import Path

web = Path(__file__).resolve().parents[1]
def read(path):
    return json.loads(path.read_text(encoding='utf-8'))
records = read(web/'src/data/field-guide.json')
groups = read(web/'src/data/dungeons-guide.json')
ids = {entry['id'] for entry in records}
groupmap = {group['id']: group for group in groups}
added = []
excluded = []
excluded_recipes = []
for name in ['weapons', 'artifacts', 'misc']:
    batch = read(web/f'artifacts/batch-{name}.json')
    for entry in batch['entries']:
        assert entry['id'] not in ids, entry['id']
        assert entry['contentId'] == 'minecraft-dungeons'
        assert entry['evidence']['commit'] == batch['sourceCommit']
        records.append(entry)
        ids.add(entry['id'])
        added.append(entry['id'])
    for group in batch.get('newGroups', []):
        assert group['id'] not in groupmap, group['id']
        groups.append(group)
        groupmap[group['id']] = group
    for group, members in batch.get('groupEntries', {}).items():
        assert group in groupmap, group
        groupmap[group]['entries'].extend(members)
    excluded.extend(batch.get('excluded', []))
    excluded_recipes.extend(batch.get('excludedRecipes', []))

group_ids = [identifier for group in groups for identifier in group['entries']]
assert len(group_ids) == len(set(group_ids)), 'Duplicate group membership'
assert set(group_ids) == {entry['id'] for entry in records if entry['contentId'] == 'minecraft-dungeons' and entry['visibility'] == 'public'}
for entry in records:
    if entry['kind'] == 'recipe':
        assert entry['recipe']['resultId'] in ids, entry['id']

# Keep item descriptions connected to newly published crafting instructions.
byid = {entry['id']: entry for entry in records}
for identifier in added:
    entry = byid[identifier]
    if entry['kind'] != 'recipe':
        continue
    item = byid[entry['recipe']['resultId']]
    if '関連レシピ' not in item['obtaining']:
        item['obtaining'] += ' 材料・配置は関連レシピから確認できます。'

crafting = byid['dungeons-artifact-crafting']
groupmap['artifacts']['intro'] = '移動、守り、攻撃、回復、仲間の召喚。通常版38種類の使い道と製作配置を紹介。'
crafting['description'] = 'ダイヤモンドの粉と、作りたい道具ごとの材料を使います。通常版38種類の製作レシピを、材料・配置・完成数とともに掲載しています。'
crafting['evidence']['commit'] = '3b66fddebe8006ea5f3656d509bf833d7594a09f'
crafting['evidence']['paths'] = list(dict.fromkeys(crafting['evidence']['paths']+[path for entry in records if entry['kind']=='recipe' and entry['contentId']=='minecraft-dungeons' for path in entry['evidence']['paths'] if '/recipes/artefacts/' in path]))
registry_path = web/'src/data/content-registry.json'
registry = read(registry_path)
content = next(content for content in registry['contents'] if content['id']=='minecraft-dungeons')
content['highlights'] = [
    '近接武器・弓・クロスボウを、画像と基礎設定、修理材料で比較。',
    '通常・ユニーク防具196部位に加え、期間限定の12部位も区別して掲載。',
    '通常版38種・レア版38種・限定1種のアーティファクトと、確認できた使用条件。',
    '鍵、ルーン、絵画、建築ブロックなどの収集品と使い道。',
    '英雄の書による収集と、14種類のボスチェスト報酬設定。',
    '素材から作るレシピと元の装備が必要な設計図を区別。材料名でも検索できます。'
]
registry_path.write_text(json.dumps(registry,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

for path, value in [(web/'src/data/field-guide.json', records), (web/'src/data/dungeons-guide.json', groups)]:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
(web/'artifacts/dungeons-bulk-audit.json').write_text(json.dumps(dict(addedIds=added, excluded=excluded, excludedRecipes=excluded_recipes), ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(f'Added {len(added)} entries; total {len(records)}.')

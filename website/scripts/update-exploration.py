"""One-time Web data update from pinned Git objects; never edits game packs."""
from pathlib import Path
import json, subprocess
from functools import lru_cache

web = Path(__file__).resolve().parents[1]
revision = 'a744ac8a2a32e3837abe8d3150802ec818f68a80'
myco = 'behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/'
castle = 'behavior_packs/bp_16_3efecae8-a036-4e14-94d3-876e29fe0ae9/'
ms = myco + 'scripts/mycology/'
cs = castle + 'scripts/infinite_castle/'
def git(*args): return subprocess.check_output(['git', *args], cwd=web.parent)
@lru_cache(None)
def source(path): return git('show', revision + ':' + path).decode('utf-8-sig')
def read(name): return json.loads((web / 'src/data' / name).read_text(encoding='utf-8-sig'))
def write(name, value): (web / 'src/data' / name).write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

records = read('field-guide.json')
contents = read('content-registry.json')
packs = read('pack-registry.json')
byid = {e['id']: e for e in records}
assert 'castle-guard-room' not in byid, 'Batch already applied'
tree = set(git('ls-tree', '-r', '--name-only', revision).decode().splitlines())
reviewed = []
# Species, effects, recipes and textures are unchanged. Changed UI was reviewed
# against its new result, discovery, preference and animation behavior.
for entry in records:
    if entry['contentId'] != 'mycology': continue
    for path in entry['evidence']['paths']:
        assert path in tree, path
        changed = git('diff', '--name-only', entry['evidence']['commit'], revision, '--', path)
        if changed:
            assert path == ms+'ui.js', 'Unreviewed Mycology evidence: '+path
            reviewed.append(path)
    entry['evidence']['commit'] = revision

assert "const MODES=['full','quick','off']" in source(ms+'reveal.js')
assert 'await revealAppraisal(player,b,sorted)' in source(ms+'ui.js')
assert 'dynamicReconstructionIntervalMinutes: 15' in source(cs+'phase1Config.js')
assert 'exitCrouchTicks: 30' in source(cs+'phase1Config.js')
assert 'intervalTicks: 40' in source(cs+'sourceHealingGarden.js')
assert 'healthPerPulse: 2' in source(cs+'sourceHealingGarden.js')
assert 'SCENERY_INTERVAL_TICKS = 150 * 20' in source(cs+'infiniteCastleManager.js')

added = []
def feature(id, owner, name, summary, description, usage, details, paths):
    assert id not in byid
    assert all(p in tree for p in paths)
    entry = dict(id=id, name=name, kind='feature', contentId=owner, summary=summary,
        description=description, usage=usage,
        obtaining=('無限城内の探索で扱う機能です。入口の場所や参加条件は公開案内を準備中です。' if owner=='infinite-castle' else 'Mycologyの鑑定士メニューで利用する機能です。鑑定士の所在は公開案内を準備中です。'),
        details=details, image=None, recipe=None, visibility='public', evidence=dict(commit=revision, paths=paths))
    records.append(entry); byid[id]=entry; added.append(id)

feature('mushroom-reveal', 'mycology', '鑑定結果の開封演出', 'キノコを順に紹介し、最後に最高レアを発表。',
    '鑑定したキノコの一部を順番に紹介してから、今回の最高レアを発表する演出です。種類ごとに音色とメロディが設定されています。すべての結果は最後の鑑定内訳で確認できます。',
    '演出中にしゃがむと結果画面へスキップする設定です。',
    ['64個の通常演出は20 TPS時に15〜25秒、短縮では約3.3〜5.5秒です。サーバーが重い場合は長くなることがあります。', 'アイテムの受け渡しと発見記録は演出の前に処理されます。演出を飛ばしても再抽選する仕組みではありません。', '最高レア以外に紹介するのは最大4種類。実際の結果より高いレア度を予告しない構成です。', '最新演出の音量・見え方・端末での操作は実機未確認です。'],
    [ms+'ui.js', ms+'reveal.js', ms+'reveal_sounds.js', ms+'appraisal.js'])
feature('mushroom-reveal-settings', 'mycology', '演出の長さとサウンド設定', 'じっくり・短縮・OFFを、自分のペースで選ぶ。',
    '鑑定士メニューには演出の長さとサウンドを別々に切り替えるボタンがあります。設定はプレイヤーごとに保存されます。',
    '「演出」を押すと、じっくり → 短縮 → OFFの順に切り替わります。「サウンド」でON/OFFを変更します。',
    ['初期設定は「じっくり」、サウンドONです。', '鑑定音は鑑定した本人に再生する処理です。', 'OFFでは演出と演出音を省き、結果の一覧を表示します。演出を残して音だけ止める場合はサウンドをOFFにします。', 'ゲーム側の音量設定や他のアドオンとの表示の重なりは、実機で確認が必要です。'],
    [ms+'ui.js', ms+'reveal.js'])
feature('mushroom-result-summary', 'mycology', '鑑定結果と次のスタック', '最高レア・NEW・発見数の変化をまとめて確認。',
    '結果画面には今回の最高レア、新規発見の種類数、鑑定前後の図鑑の発見数が表示されます。内訳はレア度の高い種類から並び、新しく見つけたものにはNEWが付きます。',
    '結果画面からキノコ図鑑を開くか、同じ色の次のスタックを鑑定するボタンへ進みます。',
    ['64個の鑑定ではMAX STACKと表示します。', '次に鑑定する数は、演出後に持ち物を確認した最初の該当スタックの個数です。別スロットを合算しません。', '次のスタックがない場合は鑑定メニューへ戻るボタンになります。', '持ち物に入りきらなかった分がある場合は、足元へ置いた数を結果に表示します。'],
    [ms+'ui.js', ms+'appraisal.js', ms+'progress.js'])
byid['mushroom-appraisal']['details'] = ['鑑定料なしと表示する構成です。', '色ごとに今回の鑑定数と合計所持数を表示します。最初の該当スタックの全量を消費します。', '結果の開封演出・短縮・スキップ・消音の案内も掲載しています。']
byid['mushroom-discoveries']['details'] = ['赤色15種類・茶色20種類、合計35種類の発見数と進捗バーを表示します。', 'ゲーム内の一覧は10種類ずつ。未発見の名前と画像を伏せ、発見済みの種類だけ詳細を開けます。', 'Webのキノコ一覧はゲーム内の個人の発見状況とは連動していません。']

room_specs = [
    ('guard', '衛兵部屋', '城郭隊長', 6, 4, '衛兵と弓の敵が組み合わされた戦闘部屋。'),
    ('curse', '呪術部屋', '大呪術師', 5, 5, '呪術師や妨害役が加わる戦闘部屋。'),
    ('wraith', '怨霊部屋', '怨霊主', 5, 5, '怨霊を中心とした構成の戦闘部屋。'),
    ('heavy', '重装部屋', '黒鉄守将', 4, 4, '重装の衛兵を中心に迎え撃つ戦闘部屋。'),
    ('mixed', '混成部屋', '無限城の監守', 6, 5, '衛兵・呪術師・怨霊が混ざる戦闘部屋。'),
    ('elite', 'Elite部屋', '深紅の鍵守', 4, 4, '強化された衛兵と深紅の鍵守に挑む部屋。'),
]
for key, name, holder, first, second, summary in room_specs:
    feature('castle-'+key+'-room', 'infinite-castle', name, summary,
        f'無限城の2段階の戦闘に対応した部屋です。第2波には、宝箱の封印解除につながる鍵持ち「{holder}」が含まれます。',
        '部屋で戦闘を進め、鍵持ちの敵と宝箱の封印に注目してください。第2波が始まっても、第1波の残敵は消えません。',
        [f'基本編成は第1波{first}体・第2波{second}体。参加人数による追加や召喚分は別です。', f'鍵持ちの表示名：{holder}。', '敵の同時数制限や読み込み状況で、投入を待つ敵がいる場合があります。', 'コードで確認した編成です。すべての部屋の戦闘バランスを実機検証したものではありません。'],
        [cs+'phase1Config.js', cs+'phase1State.js', cs+'phase1Runtime.js'])
feature('castle-waves', 'infinite-castle', '2段階の戦闘と人数調整', '残敵数と経過時間で、第2波へ進む。',
    '第1波の通常編成・人数追加の残りが2体以下になるか、開始から900tickが経過すると第2波へ進む設定です。20 TPSなら約45秒です。召喚された敵はこの残数判定に含めません。',
    '残敵がいても増援が来るため、周囲の敵を確認しながら進めてください。',
    ['各Wave開始時の部屋内人数に応じ、基本編成へ最大3体を追加します。', '鍵持ちの体力倍率は1人で1倍、2人で1.15倍、3人で1.30倍、4人以上で1.45倍の設定です。', '同時出現の上限設定は召喚・分身を含め45体。基本敵と鍵持ちの投入を優先します。'],
    [cs+'phase1State.js', cs+'phase1Config.js', cs+'phase1Runtime.js'])
feature('castle-key-rewards', 'infinite-castle', '鍵持ちと宝箱の封印', '鍵の演出をたどって、宝箱の解放へ。',
    '鍵持ちを倒すと、鍵が宝箱へ向かう演出を経て封印を解き、報酬を投入する処理です。通常の鍵は金色、深紅の鍵守では深紅の演出を使います。',
    '封印中の宝箱は開けません。解除後に「報酬を準備しています」と出る場合は投入処理を待ちます。',
    ['報酬は宝箱の27枠に対して抽選する設定です。1枠を基本報酬から選び、ほかの26枠は空欄も含めて抽選します。', 'すべての枠が埋まることや、特定のアイテムが必ず出ることを示すものではありません。', '受け取り済みの宝箱を再起動で補充し直さない処理があります。', '鍵持ちを倒したあとも残敵は続行します。'],
    [cs+'phase1Runtime.js', cs+'phase1Combat.js', cs+'phase1Rewards.js', cs+'phase1Config.js'])
feature('castle-healing-garden', 'infinite-castle', '癒やしの庭', '探索の合間に、庭の中で体力を回復。',
    '庭の内側にいるサバイバル・アドベンチャーのプレイヤーを対象に、40tickごとに2HPを回復する設定です。20 TPSでは約2秒ごとにハート1個分となります。',
    '庭の内側に留まって回復します。最大体力を超える回復や、死亡した状態からの復活は行いません。',
    ['体力を直接回復する仕組みで、退出後に再生効果を持ち越しません。', '出入りを繰り返しても回復間隔を早めない処理です。', '可変部屋枠の抽選では5%の設定です。城全体で必ず見つかる確率ではありません。'],
    [cs+'sourceHealingGarden.js', cs+'phase1Runtime.js', cs+'phase1State.js', cs+'phase1Config.js'])
feature('castle-treasure-vault', 'infinite-castle', '宝物庫', '探索中に出会う、報酬用の特別な部屋。',
    '通常の戦闘部屋とは別の特別な部屋です。専用の報酬テーブルを使い、鍵持ちの撃破を条件とせずに宝箱の報酬を準備する構成です。',
    '宝箱の準備が終わってから中身を確認してください。特定の装備の入手先としては断定していません。',
    ['可変部屋枠の抽選では3%の設定です。毎回の城に1室あるという意味ではありません。', '内装には2種類のバリエーションが定義されています。', '宝箱の枠ごとの抽選と受け取り記録は、戦闘部屋と共通の仕組みを使います。'],
    [cs+'phase1State.js', cs+'phase1Config.js', cs+'phase1Runtime.js', cs+'phase1Rewards.js', cs+'phase1Interiors.js'])
feature('castle-return-circle', 'infinite-castle', '出口の帰還陣', '出口を見つけたら、中心でしゃがんで帰還。',
    '出口の部屋へ入ると、その出口を再構成で動かさない状態にします。中心の帰還陣で30tickしゃがみ続けると、保存された個人の帰還地点へ戻る処理です。20 TPSなら約1.5秒が目安です。',
    '「しゃがむと帰還」の表示が出る位置でしゃがみ続けます。しゃがみを解除したり、範囲から外れたりすると待機を取り消します。',
    ['入口の位置・参加手順は公開案内を準備中です。', '全参加者が正常に帰還した場合に、次の探索用の城を作り直す流れになります。', '死亡やログアウトだけでは、正常帰還と同じ扱いで探索を終了しません。'],
    [cs+'phase1Runtime.js', cs+'phase1Config.js', cs+'phase1State.js', cs+'entranceTransition.js'])
feature('castle-reconstruction', 'infinite-castle', '城の再構成と琴の音', '遠くの飾りと、城本体の変化を聞き分ける。',
    '城本体は15分、背景の飾りは変更完了から150秒を基準に更新する設定です。背景更新には遠くに響く琴、城本体の入れ替えには近くで明瞭に鳴る琴を使います。',
    '変化の音を探索の手がかりにしてください。プレイヤーのいる区画や戦闘中の部屋、発見済みの出口などを保護し、安全な候補を探して再構成します。',
    ['昼夜を固定していても進む、サーバーの経過tickを使う時計です。ワールドを閉じている実時間は加算しません。', '琴は変更が実際に始まるときに鳴らす設定です。保護や読み込み、計画の状態により、予定時刻より遅れる場合があります。', '近くの部屋を保護するため、必ずすべての部屋が移動するわけではありません。', '新しい音の距離感・端末ごとの聞こえ方は実機未確認です。'],
    [cs+'phase1Config.js', cs+'infiniteCastleManager.js', 'docs/infinite_castle/distant-koto-20260912.md', 'docs/infinite_castle/reconstruction-clock-20260912.md'])

for c in contents['contents']:
    if c['id'] not in ['mycology', 'infinite-castle']: continue
    c['evidence']['commit'] = revision
    paths = sorted({p for e in records if e['contentId']==c['id'] for p in e['evidence']['paths']})
    c['evidence']['paths'] = list(dict.fromkeys(c['evidence']['paths'] + paths))
    c['deployment'] = 'deployed-recorded'
    for v in c['verification']:
        if v['kind'] in ['code','registration','server-start']: v.update(result='confirmed',commit=revision)
    if c['id']=='mycology':
        c['description']='赤色・茶色のキノコを鑑定して、35種類の発見を自分の図鑑に集めるコンテンツです。鑑定結果では最高レアや新規発見、図鑑の進み具合を確認できます。結果を開封する演出には種類ごとの音色があり、じっくり・短縮・OFFを選べます。以下の一覧から、鑑定の使い方と各キノコのゲーム内設定を調べられます。'
        c['highlights']=['赤色15種類・茶色20種類を掲載。ゲーム内の図鑑では自分の未発見の名前を伏せて表示します。', '最初の該当スタックを全量鑑定。別スロットの分は合算せず、鑑定料なしと表示する構成です。', '鑑定の最高レア・NEW・発見数の変化を確認し、次のスタックへ進めます。', '鑑定演出は長さとサウンドを設定でき、しゃがみでスキップできます。最新演出の聴感・表示は実機未確認です。']
        c['evidence']['paths'].append('docs/deployments/2026-09-12-mycology-reveal.md')
    else:
        c['description']='廊下や階段、広間をたどり、戦闘部屋や特別な部屋を探す独立した探索ダンジョンです。衛兵・呪術・怨霊・重装・混成・Eliteの6種類の戦闘は2段階で進み、鍵持ちの撃破が宝箱の封印解除につながります。癒やしの庭で休み、帰還陣を探しながら、変化する城を探索する構成です。ここでは最新版のコードで確認できた仕組みを紹介します。'
        c['highlights']=['6種類の戦闘部屋。それぞれの第2波に異なる鍵持ちが登場する設定です。', '鍵の飛翔と宝箱の封印解除。報酬は枠ごとに抽選し、空欄も含まれます。', '癒やしの庭・宝物庫・帰還陣など、戦闘以外の探索要素も掲載。', '再構成はプレイヤーや戦闘中の部屋を保護しながら進行。背景と城本体で琴の聞こえ方を分けています。']
        c['guide']='入口の場所と参加条件は案内を準備中です。城内では部屋ごとの戦闘と鍵持ちに注目し、出口を見つけたら帰還陣の中心でしゃがむ流れが実装されています。各説明はコードを照合したもので、全戦闘・報酬・帰還・最新の音を実機で受け入れ確認したものではありません。PvP Islandとは別コンテンツです。'
        c['evidence']['paths'].append('docs/infinite_castle/distant-koto-20260912.md')

registrations={kind:json.loads(source('world_'+kind+'_packs.json')) for kind in ['behavior','resource']}
for pack in packs['packs']:
    headers=[json.loads(source(p))['header'] for p in tree if p.startswith(pack['kind']+'_packs/') and p.endswith('/manifest.json') and p.count('/')==2]
    header=next(h for h in headers if h['uuid']==pack['uuid'])
    pack['version']='.'.join(map(str,header['version']))
    pack['registered']=any(r['pack_id']==pack['uuid'] and r['version']==header['version'] for r in registrations[pack['kind']])
packs['source_commit']=revision

groups=[dict(contentId='mycology', title='キノコ図鑑と鑑定の案内', intro='赤色・茶色の35種類と、鑑定を楽しむための使い方。Webの一覧はゲーム内の個人の発見記録とは連動していません。', groups=[
    dict(id='guide',title='図鑑・鑑定の使い方',entries=[e['id'] for e in records if e['contentId']=='mycology' and not e['id'].startswith('mycology-')]),
    dict(id='red',title='赤色キノコ',entries=[e['id'] for e in records if e['id'].startswith('mycology-r')]),
    dict(id='brown',title='茶色キノコ',entries=[e['id'] for e in records if e['id'].startswith('mycology-b')])]),
    dict(contentId='infinite-castle',title='城を歩く前に知っておきたいこと',intro='戦闘部屋の編成から、宝箱・庭・帰還まで。詳しい説明を種類別に探せます。',groups=[
        dict(id='rooms',title='6種類の戦闘部屋',entries=['castle-'+s[0]+'-room' for s in room_specs]),
        dict(id='exploration',title='戦闘・報酬・探索の仕組み',entries=[id for id in added if id.startswith('castle-') and not id.endswith('-room')])])]
assert len(added)==15
for c in contents['contents']:
    if c['id'] in ['mycology','infinite-castle']: assert all(p in tree for p in c['evidence']['paths'])
write('field-guide.json',records);write('content-registry.json',contents);write('pack-registry.json',packs);write('exploration-guides.json',groups)
(web/'artifacts/exploration-audit.json').write_text(json.dumps(dict(sourceCommit=revision,added=added,reviewedChangedMycologyEvidence=sorted(set(reviewed)),counts={owner:sum(e['contentId']==owner for e in records) for owner in ['mycology','infinite-castle']}),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Added',len(added),'Total',len(records),'Source',revision)

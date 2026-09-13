"""Stage source-audited Dungeons artifacts without modifying shared guide data.

Reads immutable Git objects and copies their exact textures into the Web tree.
Re-run against the recorded pre-batch website revision to reproduce the same batch.
"""
import json
import re
import subprocess
from collections import Counter
from functools import lru_cache
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]
REPO = WEB.parent
REV = '3b66fddebe8006ea5f3656d509bf833d7594a09f'
BASE_WEB_REV = '90cae3be'


def git(*args):
    return subprocess.check_output(['git', '-c', 'core.quotePath=false', *args], cwd=REPO)


@lru_cache(None)
def raw(path):
    return git('show', REV + ':' + path)


@lru_cache(None)
def text(path):
    return raw(path).decode('utf-8-sig')


@lru_cache(None)
def source(path):
    return json.loads(text(path))


TREE = set(git('ls-tree', '-r', '--name-only', REV).decode('utf-8').splitlines())
BP = next(p.rsplit('/', 1)[0] for p in TREE if p.startswith('behavior_packs/bp_08_') and p.endswith('/manifest.json'))
RP = next(p.rsplit('/', 1)[0] for p in TREE if p.startswith('resource_packs/rp_06_') and p.endswith('/manifest.json'))
records = json.loads(git('show', BASE_WEB_REV + ':website/src/data/field-guide.json').decode('utf-8'))
existing = {e['id']: e for e in records}
langpath = RP + '/texts/ja_JP.lang'
lang = dict(line.split('=', 1) for line in text(langpath).splitlines() if '=' in line)
atlaspath = RP + '/textures/item_texture.json'
atlas = source(atlaspath)['texture_data']
scripts = BP + '/scripts/components/artefacts/'
importpath = BP + '/scripts/components/artefacts.js'
cooldownpath = scripts + 'artefactCooldown.js'


def clean(value):
    return re.sub(r'[\ue000-\uf8ff]', '', re.sub(r'§.', '', value)).strip()


VANILLA = dict(nether_wart_block='ネザーウォートブロック', warped_wart_block='歪んだウォートブロック', tnt='TNT',
 amethyst_shard='アメジストの欠片', end_crystal='エンドクリスタル', moss_block='苔ブロック', fermented_spider_eye='発酵したクモの目',
 lapis_lazuli='ラピスラズリ', gold_ingot='金インゴット', book='本', glass='ガラス', sea_lantern='シーランタン', iron_block='鉄ブロック',
 amethyst_block='アメジストブロック', bone_block='骨ブロック', soul_soil='ソウルソイル', blue_ice='青氷', packed_ice='氷塊', emerald='エメラルド',
 copper_ingot='銅インゴット', experience_bottle='エンチャントの瓶', wheat='小麦', blaze_powder='ブレイズパウダー', nether_wart='ネザーウォート',
 sugar='砂糖', ender_pearl='エンダーパール', leather='革', porkchop='生の豚肉', apple='リンゴ', bread='パン', tropical_fish='熱帯魚',
 redstone='レッドストーンダスト', chorus_fruit='コーラスフルーツ', lightning_rod='避雷針', iron_ingot='鉄インゴット', echo_shard='残響の欠片',
 copper_block='銅ブロック', gold_block='金ブロック', diamond='ダイヤモンド', soul_sand='ソウルサンド', totem_of_undying='不死のトーテム', feather='羽根')


def label(identifier):
    if identifier.startswith('dungeons:'):
        value = lang.get('item.' + identifier) or lang.get('item.' + identifier + '.name') or lang.get('tile.' + identifier + '.name')
        assert value, identifier
        return clean(value)
    return VANILLA[identifier.removeprefix('minecraft:')]


def slug(identifier):
    return 'dungeons-' + identifier.split(':')[1].replace('_', '-')


itempaths = {}
for path in sorted(p for p in TREE if p.startswith(BP + '/items/artifact/') and p.endswith('.json')):
    item = source(path)['minecraft:item']
    identifier = item['description']['identifier']
    assert identifier not in itempaths
    itempaths[identifier] = path

entitypaths = {}
for path in sorted(p for p in TREE if p.startswith(BP + '/entities/') and p.endswith('.json')):
    item = source(path).get('minecraft:entity', {})
    identifier = item.get('description', {}).get('identifier')
    if identifier:
        entitypaths[identifier] = path

# Each text was reviewed against this pinned script, then the stated key values
# are asserted below. Rare status never substitutes for the actual params.type.
SPECS = {
 'blast_fungus': ('blastFungus', '爆発するキノコを5発放つ道具。', '視線方向へ、少しずつ向きの違うキノコの弾を5発続けて放ちます。着弾点から4ブロック以内の有効な対象へ爆発ダメージを与え、命中成功時に吐き気を付与する処理です。', ['maxDistance: 4', 'target.addEffect("nausea", 100)', 'owner, target, 11'], ['爆発ダメージ処理に渡す基礎値は11。吐き気の設定は100ティック（5秒）です。']),
 'corrupted_beacon': ('corruptedBeacon', 'ソウルを消費して光線を撃ち続ける道具。', 'ソウルが1以上あると起動し、手に持っている間、視線方向へ光線の弾を連続発射します。発射を続けるとソウルを1ずつ消費し、持ち替えやソウル不足で停止する処理です。', ['soulGauge < 1', "soulScore.addScore(player, -1)", "spawnEntity('dungeons:corrupted_beacon_ammo'"], ['発射中は使用者へ強い鈍足を付与する処理があります。']),
 'corrupted_seeds': ('corruptedSeeds', '周囲へ毒と鈍足を付与する種。', '使用者から5ブロック以内の有効な対象へ、致死性の毒と鈍足を付与する処理です。周囲の敵の動きを抑える用途を持つアーティファクトです。', ['maxDistance: 5', 'target.addEffect("fatal_poison", 160)', 'target.addEffect("slowness", 160, { amplifier: 3 })'], ['毒と鈍足の継続設定は160ティック（8秒）です。対象の耐性や他の攻撃処理による違いは実機未検証です。']),
 'enchanters_tome': ('enchantersTome', '自分の対応ペットを強化する本。', '16ブロック以内にいる自分のペットのうち、強化対象に指定された種類へエンチャント化イベントと短時間の再生を与える処理です。すでに強化済みの対象は再度強化しません。', ['maxDistance: 16', "families: ['enchantable_pet']", "mob.triggerEvent('dungeons:pet_become_enchanted')", 'if (owner !== player) continue'], ['すべての動物が対象ではありません。ペット側が対応している必要があります。']),
 'eye_of_the_guardian': ('eyeGuardian', '一定時間、視線方向へ光線を放つ目。', '使用すると一定時間、視線方向へ専用の光線の弾を連続発射します。手に持つ道具を替えると停止し、発射中は使用者へ強い鈍足を付与する処理です。', ['guardianEye.setScore(player, 70)', 'guardianEye.setScore(player, 121)', "spawnEntity('dungeons:eye_guardian_ammo'"], []),
 'gong_of_weakening': ('gongWeakening', '周囲の対象を弱らせるドラ。', '使用者から6ブロック以内の有効な対象に弱体化と専用の虚無効果を付与します。虚無効果中は、対象が受けるダメージを増やす処理があります。', ['maxDistance: 6', 'addVoidedEffect(target, 100)', 'addVoidedEffect(target, 200)'], ['虚無効果の補正は、ボス分類の対象では1.25倍、それ以外では2倍。ただし、ダメージの原因がoverrideの場合は対象外です。別の補正を含む最終ダメージは実機未検証です。']),
 'harvester': ('harvester', 'ソウル15を使う周囲への爆発攻撃。', 'ソウル15を消費し、少し遅れて使用者の周囲へソウル属性の爆発ダメージを与える処理です。ソウル不足では起動しません。', ['soulGauge < 15', 'soulScore.addScore(player, -15)', 'range = 5', 'damage = 15'], []),
 'ice_wand': ('iceWand', '狙った位置に氷の塊を呼ぶ杖。', '視線方向の32ブロック以内にある対象やブロックの位置へ、専用の氷の塊を呼び出します。氷の命中イベントでは、周囲3ブロックの有効な対象へ凍結ダメージ、鈍足、押し返しを与える処理です。', ['maxDistance: 32', 'maxDistance: 3', 'owner, target, 10'], ['氷の命中時のダメージ処理へ渡す基礎値は10です。狙える地形や当たり判定は実機未検証です。']),
 'lightning_rod': ('lightningRod', 'ソウル8で狙った場所へ雷撃を起こす杖。', 'ソウル8を消費し、視線方向の24ブロック以内で狙った場所へ、20ティック（1秒）後に範囲雷撃を起こします。クリーパーには帯電イベントを発生させ、通常の対象とは異なるダメージ分岐を使います。', ['maxDistance: 24', 'soulScore.addScore(player, -8)', 'range = 3.5', 'range = 4.5'], []),
 'love_medallion': ('loveMedallion', '対応する敵を一時的に味方にするメダル。', '8ブロック以内の対応対象から、まだ手なずけられていない最大2体を使用者の味方にする処理です。400ティック（20秒）の時間設定があり、時間切れには対象を消す処理があります。', ['maxDistance: 8', 'i < 2', '"dungeons:love_medallion_ticks", 400', 'entity.kill()'], ['恒久的なペットの入手手段ではありません。魅了できる種類は専用の対象分類に限定されます。']),
 'powershaker': ('powershaker', '近接攻撃に最大5回の爆発を加える道具。', '使用後の一定時間、プレイヤーの近接攻撃をきっかけに、命中位置の周囲へ爆発を起こす処理です。爆発の使用回数は最大5回で、時間切れでも終了します。', ['usesLeft.setScore(player, 5)', 'maxDistance: 4', 'damageSource, target, 8', 'timeLeft.setScore(player, 300)', 'timeLeft.setScore(player, 400)'], ['爆発範囲は命中した対象から4ブロック、ダメージ処理に渡す基礎値は8です。']),
 'satchel_of_elements': ('satchelElements', '氷・炎・雷のいずれかを周囲へ放つ袋。', '8ブロック以内の有効な対象へ、使用時に選ばれた氷・炎・雷のいずれかを適用する処理です。氷は鈍足、炎は火属性の攻撃と着火、雷は雷属性の攻撃を行います。', ['maxDistance: 8', 'Math.random()', 'element = "ice"', 'element = "fire"', 'element = "electric"'], ['1回の使用で選ぶ属性は1つです。対象がいなければ効果を実行しない分岐があります。']),
 'satchel_of_elixirs': ('satchelElixirs', '攻撃力・移動速度・影の姿から効果を得る袋。', '使用者へ、攻撃力上昇・移動速度上昇・影の姿のいずれかを付与する処理です。すでに同系統の効果がある場合に再抽選する分岐があります。', ["player.addEffect('strength', 400)", "player.addEffect('speed', 550)", 'addShadowForm(player, 180)'], ['継続設定は攻撃力上昇20秒、移動速度上昇27.5秒、影の姿9秒。影の姿は攻撃で早く終了する場合があります。']),
 'satchel_of_snacks': ('satchelSnacks', '体力と満腹度を補う袋。', '使用者の体力を上限までの範囲でランダムに回復し、満腹度を補う効果を与える処理です。体力と満腹度が両方とも最大なら使用を止めます。', ['healAmt = 2 + Math.ceil(Math.random() * 3)', "player.addEffect('saturation', foodRand", 'current >= max && currentHP >= maxHP'], ['回復量の計算は「2＋1〜3の乱数」が基本です。表示上のハート数と体力の内部値は区別してください。']),
 'scatter_mines': ('scatterMines', '周囲の最大3か所へ地雷を置く道具。', '使用者の周囲3か所で地面の高さを調べ、上下5ブロックの条件を満たした位置に専用地雷を置きます。爆発時は地雷から3ブロック以内の有効な対象へダメージと押し返しを与える処理です。', ['var locations = [loc1, loc2, loc3]', 'loc.y - player.location.y <= 5', 'maxDistance: 3', 'owner, target, 20'], ['地形によって設置数が減る場合があります。爆発のダメージ処理に渡す基礎値は20です。']),
 'shadow_shifter': ('shadowShifter', 'ソウル12で影の姿になる道具。', 'ソウル12を消費して、透明化を伴う専用の影の姿を使用者へ付与します。影の姿の攻撃補正と、攻撃後に姿を解除する処理があります。', ['soulScore.addScore(player, -12)', 'addShadowForm(player, 220)', 'addShadowForm(player, 340)'], ['すでに影の姿であるときや、ソウルが足りないときには起動しません。']),
 'shock_powder': ('shockPowder', '周囲の動きと攻撃を抑える粉。', '使用者から5ブロック以内の有効な対象へ、弱体化・鈍足・採掘速度低下を付与する処理です。各効果の強さには高い設定値が使われています。', ['maxDistance: 5', 'var duration = 3.5', 'duration = 6', 'amplifier: 9'], []),
 'soul_healer': ('soulHealer', 'ソウル10を使って自分を回復する道具。', '体力が減っているときにソウル10を消費し、使用者の体力を回復する処理です。最大体力を超える分は切り捨て、一部をソウルとして返す分岐があります。', ['soulScore.addScore(player, -10)', 'healAmt = 7', 'healAmt = 11', 'if (surplus > 4) surplus = 4'], ['返却するソウルは最大4です。体力が満タンのときは回復処理を開始しません。']),
 'spinblade': ('spinblade', '投げた刃が持ち主へ戻る道具。', '視線方向へ回転する刃を投げ、帰還イベントで持ち主の方へ戻す処理です。飛行中は再使用の待ち時間を延長し、受け取りイベントで短縮します。', ['dungeons:spinblade_projectile', 'dungeons:rare_spinblade_projectile', '2400', 'dungeons:recieved'], ['アイテムの基本待ち時間とは別に、刃が戻るまで再使用を待たせる処理があります。実際の帰還や地形との衝突は未検証です。']),
 'tome_of_duplication': ('tomeDuplication', '直前のアーティファクト使用を再現する本。', '直前に使ったアーティファクトの記録を参照し、対応する使用処理を再実行する仕組みです。アイテムの個数を増やす製作レシピとは異なります。', ["tag.substring(0, 9) === 'tod:used_'", 'dungeons.warn.no_artefact_to_copy'], ['対象となる使用記録がなければ再現できません。必要ソウルや対象条件は、再現する道具側の処理でも確認されます。', 'すべてのアーティファクトの組み合わせを実機で確認したものではありません。']),
 'totem_of_casting': ('totemCasting', 'ソウル12で再使用を助けるトーテムを置く。', 'ソウル12を消費し、使用者にひも付いたトーテムを置く処理です。周囲5ブロック以内の該当トーテム数に応じて、アーティファクトの再使用待ち時間を短縮する共通処理があります。', ['soulScore.addScore(player, -12)', "spawnEntity('dungeons:totem_of_casting'"], ['トーテムが1つの場合、待ち時間の倍率へ0.3を掛けます。装備などの補正も別に適用され、最終倍率の下限は0.1です。']),
 'totem_of_shielding': ('totemShielding', '周囲の守りと飛び道具への対処を助けるトーテム。', 'トーテムを置き、作動イベントで周囲4ブロックのプレイヤーへ耐性を与えます。また、周囲7ブロックの対象となる飛び道具の進行方向を変える処理があります。', ['maxDistance: 4', 'maxDistance: 7', 'proj.shoot({ x: -v.x * 1.5', 'if (proj.owner == owner) continue'], ['持ち主が放った飛び道具は除外します。PvP設定による除外もあり、すべての飛び道具を防ぐとは保証していません。']),
 'totem_of_soul_protection': ('totemSoulProtection', 'ソウルを使って守護用トーテムを置く道具。', 'ソウル5を消費し、使用者にひも付いた専用トーテムを置く処理を確認しています。周囲のプレイヤーを守る処理も定義されていますが、致命傷を防ぐ実際の発動は未検証です。', ['soulScore.addScore(player, -5)', 'maxDistance: 3.66', 'if (hp.currentValue > 0) return'], ['自動復活や死亡回避を保証する道具としては案内していません。安全な検証用ワールドでの発動確認が必要です。']),
 'updraft_tome': ('updraftTome', '周囲の対象を風で打ち上げる本。', '使用者から7.5ブロック以内の有効な対象へ、10ティック（0.5秒）後に風属性の攻撃と上向きの押し返しを与える処理です。ダメージが成功した対象を最大7体まで数えます。', ['maxDistance: 7.5', 'var count = 7', 'player, target, 5', 'count -= 1'], ['ダメージ処理に渡す基礎値は5。実際の打ち上げ高さや落下ダメージは対象・地形ごとに未検証です。']),
 'boots_of_swiftness': ('swiftnessBoot', '短時間の移動速度上昇を得るブーツ。', '使用者へ移動速度上昇IIを短時間付与するアーティファクトです。防具スロットへ装備するブーツとは操作が異なり、手に持って使用します。', ["registerCustomComponent('dungeons:boots_of_switfness'", 'var duration = 60', 'duration = 90', 'amplifier: 1'], []),
 'buzzy_nest': ('buzzyNest', 'ハチを呼び出す専用の巣を置く道具。', '使用者にひも付いた専用の巣を置きます。巣のイベントからペットのハチを呼び出し、同じ持ち主になつかせる処理があります。', ["spawnEntity('dungeons:buzzy_nest'", "spawnEntity('dungeons:pet_bee'", 'tameable.tame(owner)'], ['ハチの同時数・戦闘中の生存時間は実機未検証です。']),
 'death_cap_mushroom': ('deathCap', '攻撃力と移動速度を一時的に高めるキノコ。', '使用者へ攻撃力上昇と移動速度上昇を付与する処理です。通常版とレア版は効果の継続時間が異なります。', ['player.addEffect("strength", 200)', 'player.addEffect("strength", 300)', 'player.addEffect("speed", 300)'], []),
 'enchanted_grass': ('enchantedGrass', '専用のヒツジを呼び出す草。', '使用者の位置へ専用のヒツジを1体呼び出し、使用者になつかせる処理です。', ["spawnEntity('dungeons:enchanted_sheep'", 'tameable.tame(player)'], []),
 'ghost_cloak': ('ghostCloak', '短時間、透明化と耐性を得るマント。', '使用者へ40ティック（2秒）の透明化・耐性II・移動速度上昇を付与する処理です。壁をすり抜けられるとは案内していません。', ["player.addEffect('invisibility', 40", "player.addEffect('resistance', 40", "player.addEffect('speed', 40"], []),
 'golem_kit': ('golemKit', '味方のアイアンゴーレムを呼び出すキット。', '使用者の位置へ専用のアイアンゴーレムを1体呼び出し、使用者になつかせる処理です。', ["spawnEntity('dungeons:pet_iron_golem'", 'tameable.tame(player)'], []),
 'iron_hide_amulet': ('ironHide', '耐性IIを得る守りのアミュレット。', '使用者へ耐性IIを付与する処理です。通常版とレア版は効果の継続時間が異なります。', ["player.addEffect('resistance', 150", "player.addEffect('resistance', 250"], []),
 'light_feather': ('lightFeather', '向いている方向へ素早く移動する羽根。', '視線方向への押し出しと短時間の耐性を使用者へ与え、周囲3.5ブロックの有効な対象には短時間の鈍足を付与する処理です。滑空中は移動の強さが変わります。', ['maxDistance: 3.5', 'if (player.isGliding)', 'makeVector(velocity, 5)'], ['実際の移動距離は地形や姿勢に左右されるため固定距離としては案内していません。']),
 'soul_lantern': ('soulLantern', 'ソウル13で味方を呼ぶランタン。', 'ソウル13を消費し、専用のソウルウィザードを呼び出して使用者になつかせる処理です。', ['soulScore.addScore(player, -13)', "spawnEntity('dungeons:soul_wizard'", 'tameable.tame(player)'], ['ソウルが足りないときは召喚しません。']),
 'tasty_bone': ('tastyBone', '味方のオオカミを呼び出す骨。', '使用者の位置へ専用のオオカミを1体呼び出し、使用者になつかせる処理です。', ["spawnEntity('dungeons:pet_wolf'", 'tameable.tame(player)'], []),
 'totem_of_regeneration': ('totemRegeneration', '周囲のプレイヤーを回復するトーテム。', '専用トーテムを置き、回復イベントのたびに周囲4ブロックのプレイヤーの体力を上限までの範囲で0.4ずつ回復する処理です。', ['maxDistance: 4', 'var healAmt = 0.4', 'hp.setCurrentValue(currentHP + healAmt)'], ['所有者だけ回復量が多いとは確認できません。1回のイベントでの回復値と、1秒あたりの回復量は異なります。']),
 'vexing_chant': ('vexingChant', '周囲3か所に守護ヴェックスを呼び出す本。', '使用者の周囲3か所へ専用のヴェックスを呼び出し、使用者になつかせる処理です。', ['const locations = [loc1, loc2, loc3]', "spawnEntity('dungeons:guardian_vex'", 'tameable.tame(player)'], ['地形ごとの召喚成功や戦闘中の挙動は実機未検証です。']),
 'wind_horn': ('windHorn', '周囲の対象を押し返すホルン。', '使用者から7ブロック以内の有効な対象を外側へ押し返し、鈍足を付与する処理です。通常版とレア版は押し返しの強さと鈍足の継続設定が異なります。', ['maxDistance: 7', 'var power = 3', 'power = 4.5', 'power * 20 + 40'], ['対象の耐性や地形による実際の飛距離は未検証です。']),
 'wonderful_wheat': ('wonderfulWheat', '味方のラマを呼び出す小麦。', '使用者の位置へ専用のラマを1体呼び出し、使用者になつかせる処理です。', ["spawnEntity('dungeons:pet_llama'", 'tameable.tame(player)'], []),
 'corrupted_pumpkin': ('corruptedPumpkin', 'ソウルで光線を放つ季節限定アーティファクト。', 'ソウルが1以上あると起動し、手に持っている間、視線方向へ専用の光線の弾を連続発射します。発射を続けるとソウルを1ずつ消費し、持ち替えやソウル不足で停止する処理です。', ['soulGauge < 1', 'soulScore.addScore(player, -1)', "spawnEntity('dungeons:corrupted_pumpkin_ammo'"], ['季節限定タグが付いています。現在の開催期間・入手可能期間は未確認です。'])
}


def proof(paths):
    paths = list(dict.fromkeys(paths))
    assert all(p in TREE for p in paths)
    return {'commit': REV, 'paths': paths}


ROOTS = sorted(p for p in TREE if p.startswith(BP + '/loot_tables/chests/diamond_chest/') and p.count('/') == BP.count('/') + 4 and p.endswith('.json'))
assert len(ROOTS) == 14, len(ROOTS)


@lru_cache(None)
def loot_path(path, identifier, seen=()):
    if path in seen:
        return None
    def visit(node):
        if isinstance(node, list):
            for child in node:
                found = visit(child)
                if found:
                    return found
        elif isinstance(node, dict):
            if node.get('weight', 1) <= 0:
                return None
            if node.get('type') == 'item' and node.get('name') == identifier:
                return [path]
            if node.get('type') == 'loot_table':
                target = BP + '/' + node['name']
                if target in TREE:
                    found = loot_path(target, identifier, (*seen, path))
                    if found:
                        return [path, *found]
            for key in ['pools', 'entries', 'children']:
                found = visit(node.get(key, []))
                if found:
                    return found
        return None
    return visit(source(path))


recipepaths = sorted(p for p in TREE if p.startswith(BP + '/recipes/artefacts/') and p.endswith('.json'))
recipes = {}
for path in recipepaths:
    r = source(path)['minecraft:recipe_shaped']
    assert r['tags'] == ['crafting_table'] and isinstance(r['result'], dict)
    assert r['result']['item'] not in recipes
    recipes[r['result']['item']] = (path, r)
assert len(recipes) == 38

entries = []
groups = {'artifacts': [], 'crafting': []}
rare_ids, limited_ids = [], []
accounted = []

for identifier, path in itempaths.items():
    item = source(path)['minecraft:item']
    c = item['components']
    sid = slug(identifier)
    if sid in existing:
        accounted.append({'identifier': identifier, 'path': path, 'status': 'already-published', 'entryId': sid})
        continue
    is_rare = '/rare/' in path
    is_limited = '/limited/' in path
    key = identifier.split(':')[1].removeprefix('rare_')
    scriptname, summary, description, required, base_details = SPECS[key]
    scriptpath = scripts + scriptname + '.js'
    code = text(scriptpath)
    assert all(t in code for t in required), (identifier, required)
    assert f'./artefacts/{scriptname}.js' in text(importpath)
    component = 'dungeons:' + ('boots_of_switfness' if key == 'boots_of_swiftness' else key)
    assert component in c and component in code
    behavior = c[component].get('type')
    assert behavior in [None, 'common', 'rare']
    effect_rare = behavior == 'rare'
    title = label(identifier)
    if is_rare and 'レア' not in title:
        title += '（レア）'
    if is_limited and '限定' not in title:
        title += '（季節限定）'
    paths = [path, langpath, atlaspath, importpath, scriptpath, cooldownpath]
    details = list(base_details)
    if is_rare:
        summary = 'レア版。' + summary
        commonpath = itempaths['dungeons:' + key]
        common = source(commonpath)['minecraft:item']['components']
        paths.append(commonpath)
        details.append(f"基本クールダウン：レア版{c['minecraft:cooldown']['duration']}秒／通常版{common['minecraft:cooldown']['duration']}秒。装備やトーテムの補正は別です。")
        if behavior == 'common':
            details.append('現在のアイテム定義は通常版と同じ効果を呼び出します。レア表記だけを理由に効果が強いとは案内していません。')
        elif behavior is None and key != 'tome_of_duplication':
            details.append('使用時の効果は通常版と共通の処理です。比較できる違いは、確認できた待ち時間などの設定です。')
    else:
        details.append(f"基本クールダウン：{c['minecraft:cooldown']['duration']}秒。装備やトーテムの補正は別です。")
    if key == 'corrupted_beacon':
        details.append('ソウル1を使って発射カウンターを延ばす値は' + ('6' if effect_rare else '4') + 'ティックです。')
    elif key == 'eye_of_the_guardian':
        details.append('発射時間の設定は' + ('121ティック（約6.05秒）' if effect_rare else '70ティック（3.5秒）') + 'です。持ち替えると早く止まります。')
    elif key == 'gong_of_weakening':
        paths.append(BP + '/scripts/misc/voidedEffect.js')
        assert 'e.damage * 1.25' in text(paths[-1]) and 'e.damage * 2' in text(paths[-1]) and 'if (e.damageSource.cause == "override") return;' in text(paths[-1])
        details.append('弱体化と虚無効果の継続設定：' + ('200ティック（10秒）' if effect_rare else '100ティック（5秒）') + '。')
    elif key == 'harvester':
        details.append('範囲とダメージ処理の基礎値：' + ('5.5ブロック／20' if effect_rare else '5ブロック／15') + '。相手や別の補正で最終ダメージは変わります。')
    elif key == 'lightning_rod':
        details.append('範囲と通常対象へのダメージ処理の基礎値：' + ('4.5ブロック／20' if effect_rare else '3.5ブロック／15') + '。')
    elif key == 'powershaker':
        details.append('効果時間の上限設定：' + ('400ティック（20秒）' if effect_rare else '300ティック（15秒）') + '。')
    elif key in ['shadow_shifter', 'satchel_of_elixirs']:
        paths.append(BP + '/scripts/misc/shadowForm.js')
        if key == 'shadow_shifter':
            details.append('影の姿の継続設定：' + ('340ティック（17秒）' if effect_rare else '220ティック（11秒）') + '。攻撃で早く終了する場合があります。')
    elif key == 'shock_powder':
        details.append('3つの効果の継続設定：' + ('6秒' if effect_rare else '3.5秒') + '。')
    elif key == 'soul_healer':
        details.append('体力の回復量設定：' + ('11' if effect_rare else '7') + '。ハートの個数ではなく、体力の内部値です。')
    elif key == 'satchel_of_snacks':
        details.append('満腹度を補う効果の継続値は、' + ('3＋1〜3の乱数' if effect_rare else '1〜3の乱数') + 'を用いる計算です。')
    elif key == 'boots_of_swiftness':
        details.append('速度上昇IIの継続設定：' + ('90ティック（4.5秒）' if effect_rare else '60ティック（3秒）') + '。')
    elif key == 'death_cap_mushroom':
        details.append('2つの効果の継続設定：' + ('300ティック（15秒）' if effect_rare else '200ティック（10秒）') + '。')
    elif key == 'ghost_cloak':
        details.append('移動速度上昇は' + ('II' if effect_rare else 'I') + 'の設定です。')
    elif key == 'iron_hide_amulet':
        details.append('耐性IIの継続設定：' + ('250ティック（12.5秒）' if effect_rare else '150ティック（7.5秒）') + '。')
    elif key == 'wind_horn':
        details.append('押し返しの水平の強さ：' + ('4.5' if effect_rare else '3') + '。鈍足の継続設定：' + ('6.5秒' if effect_rare else '5秒') + '。')
    elif key == 'spinblade':
        entityid = 'dungeons:' + ('rare_' if effect_rare else '') + 'spinblade_projectile'
        entitypath = entitypaths[entityid]
        damage = source(entitypath)['minecraft:entity']['component_groups']['dungeons:fly_out']['minecraft:projectile']['on_hit']['impact_damage']['damage']
        details.append(f'刃の直接命中ダメージの設定：{damage}。周囲攻撃や実際の最終ダメージとは別の値です。')
        paths.append(entitypath)
    # Include the actual spawned entity definitions alongside effect scripts.
    for entityid in re.findall(r"spawnEntity\(['\"]([^'\"]+)['\"]", code):
        assert entityid in entitypaths, entityid
        paths.append(entitypaths[entityid])
    icon = c['minecraft:icon']
    assert isinstance(icon, str)
    texture = atlas[icon]['textures']
    assert isinstance(texture, str)
    texturepath = RP + '/' + texture + '.png'
    assert texturepath in TREE
    imagepath = WEB / ('public/images/items/' + sid + '.png')
    imagepath.write_bytes(raw(texturepath))
    paths.append(texturepath)
    if identifier in recipes:
        paths.append(recipes[identifier][0])
        obtaining = '作業台で通常版を製作するレシピがあります。関連レシピで材料の個数・配置・完成数を確認できます。'
    else:
        found = next((route for root in ROOTS if (route := loot_path(root, identifier))), None)
        if found:
            paths.extend(found)
            obtaining = 'ボスチェスト報酬テーブルの抽選候補に含まれます。毎回の入手や、すべてのボスからの入手を保証するものではありません。'
        else:
            obtaining = 'アイテム定義と使用処理は確認済みです。個別の入手経路は未確認です。'
        if is_limited:
            obtaining += ' 季節限定の報酬候補です。現在のイベント開催・実際の入手可否は未確認です。'
    details.append('説明は現在のコードにある処理を照合したものです。ゲーム内での操作・効果・入手の実証は未完了です。')
    entry = dict(id=sid, name=title, kind='item', contentId='minecraft-dungeons', summary=summary, description=description,
      usage='手に持って使用します。再使用までの待ち時間や、対象・必要ソウルの条件を確認してください。', obtaining=obtaining, details=details,
      image=dict(src='/images/items/' + sid + '.png', alt=title + 'のパック内画像', kind='pack-texture'), recipe=None, visibility='public', evidence=proof(paths))
    entries.append(entry)
    (rare_ids if is_rare else limited_ids if is_limited else groups['artifacts']).append(sid)
    accounted.append({'identifier': identifier, 'path': path, 'status': 'added', 'entryId': sid})

byid = {**existing, **{e['id']: e for e in entries}}
existing_recipe_paths = {p for e in records if e['contentId'] == 'minecraft-dungeons' and e['kind'] == 'recipe' for p in e['evidence']['paths']}
recipe_accounted = []
for identifier, (path, r) in recipes.items():
    if path in existing_recipe_paths:
        recipe_accounted.append({'path': path, 'status': 'already-published'})
        continue
    resultid = slug(identifier)
    target = byid[resultid]
    assert target['kind'] == 'item'
    keys = {k: label(v['item']) for k, v in r['key'].items()}
    assert all(set(v) == {'item'} for v in r['key'].values())
    assert all(ch == ' ' or ch in keys for row in r['pattern'] for ch in row)
    grid = [[keys.get(ch, '') for ch in row] for row in r['pattern']]
    counts = Counter(cell for row in grid for cell in row if cell)
    sid = resultid + '-recipe'
    assert sid not in byid
    details = ['完成するのは通常版です。レア版への強化レシピではありません。']
    assert r['unlock'] == [{'item': 'dungeons:diamond_dust'}]
    details.append('レシピ解放条件にはダイヤモンドの粉が設定されています。実際の解放表示は未検証です。')
    entries.append(dict(id=sid, name=target['name'] + 'のレシピ', kind='recipe', contentId='minecraft-dungeons',
       summary=target['name'] + 'を作る材料と配置。', description='通常版アーティファクトの配置付きレシピです。ダイヤモンドの粉と、道具ごとの材料を使います。',
       usage='作業台で下の配置どおりに材料を並べます。', obtaining='最新リポジトリのレシピ定義を照合しています。実際の製作・解放表示は未検証です。',
       details=details, image=None, recipe=dict(shaped=True, grid=grid, ingredients=[dict(name=k, count=v) for k, v in counts.items()], resultId=resultid, count=r['result'].get('count', 1)),
       visibility='public', evidence=proof([path, langpath, itempaths[identifier]])))
    groups['crafting'].append(sid)
    recipe_accounted.append({'path': path, 'status': 'added', 'entryId': sid})

assert len(accounted) == 77
assert len(entries) == 87, len(entries)
assert len(groups['artifacts']) == 24 and len(rare_ids) == 38 and len(limited_ids) == 1
assert len(groups['crafting']) == 24
assert len({e['id'] for e in entries}) == len(entries)
newgroups = [dict(id='rare-artifacts', title='レアアーティファクト', intro='通常版38種のレア版。待ち時間や、コードで確認できた効果の違いを比較できます。', entries=rare_ids),
 dict(id='limited-artifacts', title='季節限定アーティファクト', intro='季節限定タグと報酬テーブルに登録された道具。現在の開催・入手可能期間は未確認です。', entries=limited_ids)]
result = dict(sourceCommit=REV, baseWebsiteCommit=BASE_WEB_REV, entries=entries, groupEntries=groups, newGroups=newgroups, excluded=[],
 accountedItems=accounted, accountedRecipes=recipe_accounted,
 auditNotes=['rare_gong_of_weakening と rare_harvester は type:common を渡すため通常の効果設定で掲載。',
  'totem_of_soul_protection は被ダメージ前に現在HP > 0 で終了する条件があるため、死亡回避・復活を保証しない。',
  'tome_of_duplication の boots_of_swiftness 成分名は登録名 boots_of_switfness と一致しない。すべての複製組み合わせが動くとは案内しない。',
  'corrupted_pumpkin は seasonal_item タグを持つが spooky_monstrosity の報酬テーブルに正の重み3で登録。現在のイベント開催は未確認。'])
(WEB / 'artifacts/batch-artifacts.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'added': len(entries), 'items': sum(e['kind'] == 'item' for e in entries), 'recipes': len(groups['crafting']), 'accountedItems': len(accounted), 'accountedRecipes': len(recipe_accounted)}, ensure_ascii=False))

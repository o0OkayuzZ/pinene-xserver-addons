"""Package production BP/RP and a review bundle. Never deploys or launches Minecraft."""
from pathlib import Path
import argparse,hashlib,json,subprocess,zipfile
ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output',type=Path,default=Path.home()/'Downloads/ZombieGear_FINAL_1.2.0')
args=parser.parse_args();out=args.output;out.mkdir(parents=True,exist_ok=True)
packs=[ROOT/'behavior_packs/bp_09_7c8ac348-47ad-4f71-8503-dc40a6f813f1',ROOT/'resource_packs/rp_07_4ab7ea5c-8d31-44e6-b3d6-42cc32ad2f10']
for pack in packs:
    assert json.loads((pack/'manifest.json').read_text(encoding='utf-8-sig'))['header']['version']==[1,2,0]
    assert 'engine-smoke' not in (pack/'scripts/main.js').read_text(encoding='utf-8') if (pack/'scripts/main.js').exists() else True
mcaddon=out/'ZombieGear_FINAL_1.2.0.mcaddon'
with zipfile.ZipFile(mcaddon,'w',zipfile.ZIP_DEFLATED) as z:
    for pack in packs:
        for f in sorted(pack.rglob('*')):
            if f.is_file():z.write(f,f.relative_to(pack.parent))
patch=out/'ZombieGear_FINAL.patch'
patch.write_bytes(subprocess.check_output(['git','format-patch','-1','--stdout','--binary'],cwd=ROOT))
report=ROOT/'docs/zombie_gear_final'
readme='''Zombie Gear FINAL 1.2.0

実装・検証状況は docs/zombie_gear_final/IMPLEMENTATION_REPORT.md を確認してください。
実機44項目合格・エラー0。回帰テスト47件合格。検証方法と互換性の範囲は報告書に記載しています。

ZombieGear_FINAL_1.2.0.mcaddon: 既存UUIDを保つ本番BP/RP。既存の共通Core依存は維持しています。
テスト用ダミー幹細胞や自動テストは含みません。
ZombieGear_FINAL.patch: origin/main 08b41ef5 からの実装コミット。最新ブランチへ git am -3 で適用・競合確認できます。
リポジトリ内のpack登録JSONは、この差分でZombie Gearのversionだけ更新しています。
運用中ワールドの登録ファイル全体を置き換えず、Zombie Gearの登録versionを [1,2,0] に合わせてください。

GitHubへのpush・本番デプロイは行っていません。
'''
(out/'README.txt').write_text(readme,encoding='utf-8')
archive=out.parent/(out.name+'.zip')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for f in [mcaddon,patch,out/'README.txt']:z.write(f,f.name)
    for folder in [report,ROOT/'tools/zombie_gear_v4']:
        for f in sorted(folder.rglob('*')):
            if f.is_file() and '__pycache__' not in f.parts:z.write(f,f.relative_to(ROOT))
checksums={f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in [archive,mcaddon,patch]}
(out/'SHA256.json').write_text(json.dumps(checksums,indent=2)+'\n',encoding='utf-8')
for f in [archive,mcaddon,patch]:
    if f.suffix in {'.zip','.mcaddon'}:
        with zipfile.ZipFile(f) as z:assert z.testzip() is None
    print(f'{f.name}: {f.stat().st_size} bytes; SHA256 {checksums[f.name]}')

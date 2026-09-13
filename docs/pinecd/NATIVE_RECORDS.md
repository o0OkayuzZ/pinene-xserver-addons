# ピネCD：独自音源のネイティブ音楽ディスク

2026-09-13、`origin/main` の `08b41ef55689c1dce2f5119f10ecbb1294f18812` を基準に実装。
専用コピー `C:/workspaces/pinecd-native-review-20260913`、ブランチ `fix/pinecd-native-records`。
既存の開発コピーの未コミット変更は変更していない。本番配置、再起動、実際のワールド設定変更は未実施。

## 対応環境と公式仕様

- Bedrock **1.26.30 以降、ワールドの「Beta APIs」実験が必要**。アイテムの format_version とピネCD BP/RP の min_engine_version は 1.26.30。
- [公式 1.26.30 更新仕様](https://learn.microsoft.com/en-us/minecraft/creator/documents/update1.26.30?view=minecraft-bedrock-stable) は、Beta APIs 有効時に `minecraft:record.sound_event` から sound_definitions.json の独自名を参照可能と明記している。
- [record コンポーネント参照](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/itemreference/examples/itemcomponents/minecraft_record?view=minecraft-bedrock-stable) の通常の列挙値説明だけでは独自音源対応を判断できない。今回の根拠は上記の実験機能の更新仕様。duration は秒、comparator_signal は 1～13。
- [公式サウンド入門](https://learn.microsoft.com/en-us/minecraft/creator/documents/introductiontosound?view=minecraft-bedrock-stable)、[sound_definitions 検証仕様](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/mctoolsvalreference/sndsdef?view=minecraft-bedrock-stable) を参照。音源定義は RP の `sounds/sound_definitions.json` に集約する。
- Beta APIs の設定が必要でも、ピネCD自体にスクリプトモジュールや `@minecraft/server` 依存は不要。既存の他パックの API バージョンは変更していない。
- サーバー・接続クライアントの実バージョン、実ワールドの実験状態は未確認。最低条件を満たすことと、各将来バージョンで動作確認済みであることは別。

## 変更内容と添付案の判定

添付 `pinecd_native_record_fix(1).py` は読んだだけで実行していない。

- 19枚の `pinecd:cd_01`～`pinecd:cd_19` を `pinecd.record.01`～`.19` に接続。専用 RP の `sounds/records/pinecd_track_XX.ogg` だけを参照する。
- 添付案の独自名への移行と 1.26.30 / Beta APIs 条件は採用。バニラ `record.*` を「復元用」に再定義する方式は不採用。他パックの意図した上書きまで覆ってしまうため。
- ピネCD RP（rp_01）、統合 RP（rp_02）、音楽連携 RP（rp_13）にあった合計57件のバニライベント上書きを除去。rp_01/rp_02 のルート sounds.json に重複した定義・records 欄も整理。統合 RP の牛の音声イベントは保持。
- rp_01 の英語・日本語にあったバニラCD説明の空白化キーを各76件除去。ピネCD自身の名前・説明と全アイコン参照は維持。
- `min_distance: null`、非公開風の `__use_legacy_max_distance`、候補音源を複数並べる定義は追加しない。独自イベントは category=record、stream=true、volume=0.5、max_distance=64。
- 最新の全BPの scripts/functions を検索し、ピネCDやジュークボックスの代替再生処理は見つからなかった。統合 main.js のCD参照は配布用の抽選リスト。スクリプトは全て変更なし。外部の未収録パックまでは保証対象外。
- 既存19枚のID、表示名、アイコン、比較器出力、durationを保持。最新リポジトリにはピネCD用クラフトレシピは存在しない。全既存レシピ、戦利品、抽選処理は維持し、新しい入手経路は追加していない。
- CD09の元OGGには Theora 動画と Vorbis 音声が混在。`ffmpeg -map 0:a:0 -c:a copy -vn` で音声のみへ無再圧縮リマックスした。音声PCMのSHA-256は変更前後とも `257aa1075deb17340ecdd0bfe25d48840e7d6a5621a918bb3c48b84810f50bf8`。残り18音源と19アイコンは元コミットとバイナリ一致。互換RP内の未参照音源コピーは削除していない。

## パック依存とバージョン

ピネCD BP に専用 RP のUUID依存を追加。既存UUID・登録順序は維持。
変更したパックおよびそこに依存するパックを更新し、リポジトリ内の root/worlds 両方の登録JSONを同期した。これは配置用ソースの差分であり、本番ワールド変更ではない。

| パック | 変更後 | 理由 |
| --- | --- | --- |
| bp_04 / rp_01 | 1.0.28 / 1.0.28 | ネイティブ独自レコード |
| rp_02 | 1.0.58 | ピネCD上書き除去 |
| bp_15 | 1.0.69 | rp_02 依存更新 |
| bp_09 / rp_07 | 1.1.9 / 1.1.9 | 統合BPへの依存と相互依存の更新 |
| rp_13 | 1.1.13 | ピネCD上書き除去 |
| bp_12 | 1.1.9 | rp_13 への依存更新 |

これ以外のマニフェストの変更はない。

## 曲の追加

1. `rp_01_1497b511-a764-46d4-b726-dd0f5c5d7784/sounds/records/` に音声のみの OGG Vorbis、`textures/items/` にPNGを追加する。
2. [tracks.json](../../tools/pinecd/tracks.json) のエントリーをコピーして末尾へ追加。既存IDを再利用しない。例：

```json
{
  "id": "pinecd:cd_20",
  "item_file": "compat_pinecd_cd_20.item.json",
  "display_name": "PineCD 20",
  "duration": 240,
  "comparator_signal": 10,
  "icon": "pinecdpack_cd_20",
  "texture": "textures/items/pinecd_cd_20",
  "sound_event": "pinecd.record.20",
  "sound": "sounds/records/pinecd_track_20"
}
```

3. リポジトリルートで `python -X utf8 tools/pinecd/build.py`。19固定ではなく曲一覧からアイテム、音源定義、アイコン参照を生成する。実行時の再生スクリプトではない。
4. `python -X utf8 tools/pinecd/build.py --check` と `python -X utf8 tools/pinecd/validate.py --probe-audio` を実行。通常のビルドはPython標準ライブラリのみ。音源検証には ffprobe/ffmpeg が必要。
5. 新曲の入手方法を明示的に追加する。クラフトならエントリーに完全な shaped/shapeless レシピJSONを `recipe` として指定でき、BP/recipesへ生成する。戦利品や抽選へ入れる場合は該当表・CDタグも別途更新する。既存の表へ自動追加はしない。
6. 配布前に影響するパックの header/modules/version、UUID依存、登録JSON両方、READMEを更新して実機確認する。生成ツールはバージョンやワールド登録を自動変更しない。

音源パスはRPルートからの拡張子なしパス。複数候補はランダム選択になるため入れない。比較器は最大13なので20枚目を20にはしない。曲一覧の削除・ID変更では既存所持品が失われ得るため、追加を基本とする。生成ツールは古いアイテムやレシピを自動削除しない。

## 実施した検証

- `build.py --check`：生成結果との一致、再実行時の差分ゼロ。
- `test_build.py`：6件。現行一覧、ID重複、イベント重複、音源欠落、パス逸脱の拒否、任意レシピの生成。
- `validate.py --probe-audio`：19枚の定義が各1件、独自音源イベントが専用RPに各1件、バニラ名へのピネCD音源割当なし、ルート sounds.json の旧定義なし。
- 既存19アイテムは format_version/sound_event 以外一致。保護対象7,350ファイルをGitで確認（CD09リマックス1件を除く）。18音源・19アイコンのSHA-256一致、CD09の復号音声一致。全19曲が単一Vorbis音声ストリーム。
- 35マニフェストのUUID依存、変更パックの登録バージョン、登録順序、root/worldsの一致を検証。
- durationは元の整数秒を維持。実音声との差は全曲0.5秒未満。曲末端と比較器の停止タイミングは実機確認が必要。
- `git diff --check`。最新mainのSHAを `git ls-remote` で再確認。

機械可読の結果は [validation.json](validation.json)。静的検証はエンジン受理や実再生の合格証明ではない。

## 未実施の検証と残る事項

- Minecraft/BDSでのロード、Content Log、19曲すべての視聴、取り出し・破壊時の停止、曲末端、ホッパー、比較器、複数ジュークボックス、複数プレイヤー、距離減衰・音量設定・再接続。
- バニラCD全曲および併用パック固有音の実聴、既存所持CDの外観・入手経路、クライアントキャッシュ更新。これらをコピーした検証ワールドで確認する必要がある。
- 本番のバージョン・実験設定の確認と変更、配置・再起動、GitHubへのpushはしていない。
- 全体の `tools/validate.py` / npm test は未実施。前者はMycologyの過去リリースの固定ハッシュと変更範囲を検証する専用ツールで、この移行の合否判定ではない。今回は独立したピネCD検証を追加した。
- 基準コミットから存在する登録不整合7件は維持：BP 423276… 1.0.14→manifest 1.0.17、BP ef6e99… 1.0.32→1.0.33、BP 2c5e0d… 2.0.4→2.0.6、BP 3efeca… 0.1.42→0.2.5、RP ab296f… 2.0.4→2.0.6。BP 6b1f1e… と RP 8f4cb6… は登録先のマニフェストが収録されていない。詳細UUIDはvalidation.json。今回のCD関連依存は整合するが、リポジトリ全体をそのまま本番へ配置可能とは判断していない。

将来レビュー後に適用するときは削除差分も反映すること。削除される `rp_01/sounds.json`、`rp_02/sounds/sound_definitions.json`、`rp_13/sounds/sound_definitions.json` を残したまま上書きコピーすると旧バニラ音源上書きが残る。

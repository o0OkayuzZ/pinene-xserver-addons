# ピネCD：独自音源のネイティブ音楽ディスク

19枚の `pinecd:cd_01` ～ `pinecd:cd_19` は、`minecraft:record` から専用RPの `pinecd.record.01` ～ `.19` を参照する。再生スクリプトは使わない。既存のID、表示名、アイコン、曲、比較器出力、duration、レシピ、戦利品・抽選処理を維持する。

## 対応条件

- 実機読み込み確認：**BDS 1.26.45.1**。Windowsクライアントのインストール版は1.26.4501.0。試聴は未実施。
- アイテムの **`format_version: "beta"`** とワールドの **Beta APIs** が必要。数値の1.26.30 / 1.26.40では、Beta APIs有効でも独自sound_eventが拒否された。
- groupは `minecraft:itemGroup.name.record`。use_beta_features、他の実験設定、BP側音登録、再生用Script API依存は不要。
- BP/RPのmin_engine_versionは公式の機能追加版1.26.30。1.26.30実機や将来版での確認を意味しない。
- [公式1.26.30更新仕様](https://learn.microsoft.com/en-us/minecraft/creator/documents/update1.26.30?view=minecraft-bedrock-stable) にBeta APIsでの独自文字列音イベント対応がある。通常のrecord参照だけでは実験形式の条件を判断できない。

## 移行内容

音定義はrp_01のsounds/sound_definitions.jsonに集約。各イベントは専用sounds/records/pinecd_track_XX.oggだけを参照する。category=record、stream=true、volume=0.5、max_distance=64。パスはRPルート相対・拡張子なし。

rp_01・rp_02・rp_13のバニラrecord.*上書き57件、ルートsounds.jsonの重複、バニラCD説明を空白化する言語キーを除去。統合RPの牛の音などは維持する。削除差分も配置先へ反映する必要がある。

添付pinecd_native_record_fix(1).pyはレビューのみで実行していない。独自イベント化は採用し、実機で拒否された数値形式はbeta形式へ修正した。バニラ音を「復元用」に再定義する案は他パックを妨げるため不採用。min_distance:null、非公開風フラグ、複数音源候補も不採用。

CD09は元OGGにTheora動画が混在していたため、ffmpeg -map 0:a:0 -c:a copy -vnで音声のみへ無再圧縮リマックスした。復号PCMのSHA-256は前後とも257aa1075deb17340ecdd0bfe25d48840e7d6a5621a918bb3c48b84810f50bf8。残り18音源と19アイコンはバイト一致。

既存CDを作る専用レシピはリポジトリにない。CDを材料にするオンソを含め既存レシピは保持する。調査したscripts/functionsに代替再生はなく、CD参照は配布用の抽選一覧だった。未収録の外部パックは検証範囲外。

## 曲の追加

1. 専用RPのsounds/records/に音声のみのOGG Vorbis、textures/items/にPNGを追加する。
2. [tracks.json](../../tools/pinecd/tracks.json)にエントリーを追加する。既存IDを再利用しない。

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

3. python -X utf8 tools/pinecd/build.pyでアイテム・音定義・アイコン参照を生成する。開発用ツールでありゲーム内再生スクリプトではない。
4. build.py --check、test_build.py、validate.py --probe-audioを実行する。音源検証にはffprobe/ffmpegが必要。
5. 入手方法を追加する。任意のrecipeフィールドに完全なshaped/shapelessレシピJSONを指定するとBP/recipesへ生成する。抽選・戦利品・CD材料タグへ追加する場合は該当一覧も更新する。
6. 変更パックのheader/modules/version、UUID依存、登録JSONを更新し、コピーしたワールドで実機確認する。生成ツールはバージョンや実ワールドを変更しない。

比較器出力は1～13。曲一覧からの削除は既存所持品に影響するため追加を基本にする。生成ツールは古いアイテムやレシピを自動削除しない。

## 検証範囲

静的検証は19枚の一意性、音源参照、バニラ音上書き除去、既存素材・レシピ・スクリプト保持、依存関係を確認する。durationは既存整数秒を維持し実音源との差は全曲0.5秒未満。

隔離BDSで通常形式／beta形式、Beta APIs無効／有効を比較し、beta形式＋Beta APIsで独自イベントを読み込めることを確認。読み込み成功と実際に音が正しく聞こえることは別の検証である。

未実施：クライアントで19曲とバニラ・他パック音の試聴、取り出し・破壊時の停止、曲末、ホッパー・比較器、複数ジュークボックス・プレイヤー、距離減衰、再接続、キャッシュ更新。適用結果は[適用記録](../deployments/2026-09-14-pinecd-beta.md)に記載する。

過去の数値形式の失敗・復旧は[旧記録](../deployments/2026-09-14-pinecd-attempt.md)。そこでの対応未確認という判断は今回のbeta形式検証で更新された。

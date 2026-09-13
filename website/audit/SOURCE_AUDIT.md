# Web用の現行ソース確認

対象: o0OkayuzZ/pinene-xserver-addons
確認commit: aea85120954a8b74033b86253c17a04b691dab21（取得時のorigin/main）
確認日: 2026-09-11 JST

公開レコードの根拠はsource-evidence.json。BP/RPは読み取りのみ。Xserverへの接続・起動・ゲーム内確認は実施していません。

- PvP Island: BP17 manifestのscripts/main.jsから島の生成・保護・能力振り分けのimportを確認。island_bootstrap.js、protection_service.js、ability_router.jsの該当処理を読みました。個別武器の効果・入手条件は掲載していません。
- 無限城: BP16のscripts/main.jsとinfinite_castle/infiniteCastleManager.jsを読み、部屋グラフ、生成・再構築への接続を確認。PvP Islandから独立したページです。隠しTierや報酬を実装済みとは記載していません。
- Minecraft Dungeons: BP08のmanifest、items/melee/longsword/sword_hawkbrand.json（dungeons:hawkbrand）、items/book_of_heroes.json、entities/variant/vindicator_chef.jsonを読みました。定義の存在を紹介し、スポーンやドロップ・能力の動作は断定していません。
- Mycology: BP15 scripts/main.jsからmycology/index.jsへのimport、鑑定UI・図鑑・効果への接続、field_guide.jsを確認。入手・効果数値・ゲーム内UIの動作は掲載していません。
- 各BP/RP manifestのheader UUID・versionをルートworld_behavior_packs.json/world_resource_packs.jsonと照合。選定した8パックは一致。これを本番配備の証明とは扱いません。
- BP15のフォルダ名中UUIDとmanifest header UUIDは異なります。レジストリはheader UUIDを使用します。
- 公開用パック名はWeb向けに編集した表示名です。生のmanifest description、管理ログ、ワールドデータ、接続情報はコピーしていません。
- その他の引き継ぎ候補はdraftとし、旧説明・効果・配備状態を引き継いでいません。Waystone系の統合や休眠判定も保留しています。

source-evidenceのパスは公開サイトに出力しない開発資料です。リポジトリ自体はGitHubの公開リポジトリとして確認しました。

## 紹介文の追加確認

公開4件の概要・特徴・遊び方の説明を具体化しました。PvP Islandのability_gate.jsは対象エリア外で処理を止めることを確認し、この制御を通る能力に限定して説明しています。無限城のroomRegistry.jsでは廊下・階段・広間・吹き抜けの接続定義を確認しました。部屋カテゴリだけを根拠に報酬や敵の実装を断定していません。

Mycologyのui.js、appraisal.js、progress.js、config.jsを追加で読み、通常の赤色・茶色キノコを対象に、最初の該当スタックを消費する鑑定処理、個人の発見記録、未発見項目を伏せる図鑑の構成を確認しました。出現率・効果数値は紹介文に掲載せず、鑑定士の出現・画面操作の本番動作は未確認のままです。DungeonsのMob・剣・本の定義パスもsource-evidence.jsonに追加しました。

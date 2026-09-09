# API照合メモ

参照日2026-09-09。Microsoft Learnのstableページは更新されるため、Codexは**実際に入っているserver2.7.0の型定義**でも照合すること。最新stableページの全機能が古い実行版で使えるとは限らない。

今回使う主なAPI：`system.beforeEvents.startup`、custom item `onConsume/onUse`、`world.afterEvents.playerInteractWithEntity/entityLoad/entityDie/playerSpawn/playerLeave/itemCompleteUse/worldLoad`、`ActionFormData`、Dynamic Property、`getBiome`、`getTopmostBlock`、`ItemStack.isStackableWith`、`Entity.remove`。

- Item custom component tutorial: https://learn.microsoft.com/en-us/minecraft/creator/documents/scripting/components-tutorial?view=minecraft-bedrock-stable
- Item food: https://learn.microsoft.com/en-us/minecraft/creator/reference/content/itemreference/examples/itemcomponents/minecraft_food?view=minecraft-bedrock-stable
- Item custom component: https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/itemcustomcomponent?view=minecraft-bedrock-stable
- Item cooldown: https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/itemcooldowncomponent?view=minecraft-bedrock-stable
- Item use event: https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/itemcomponentuseevent?view=minecraft-bedrock-stable
- Action form: https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server-ui/actionformdata?view=minecraft-bedrock-stable
- World events: https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/worldafterevents?view=minecraft-bedrock-stable
- World: https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/world?view=minecraft-bedrock-stable
- Dimension: https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/dimension?view=minecraft-bedrock-stable
- Biome type: https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/biometype?view=minecraft-bedrock-stable
- Changelog: https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/changelog?view=minecraft-bedrock-stable

`BiomeType.hasTags(tags: string[])`は複数タグすべての一致。実装はタグ1個ごとの配列を渡す。
`ItemCooldownComponent.startCooldown(player)`を使用。食品の天然の消費とcrushの手動消費を二重適用しないよう実機で確認する。
`minecraft:food`の隠し満腹度は `nutrition × saturation_modifier × 2`。係数の既定値は今回のゲームバランス値で、実物の栄養価ではない。

`ItemStack.clone()`と `isStackableWith()`で、固有メタデータを持つアイテムを単純にIDだけで上書きしない。`isStackableWith()`は数量そのものではなく互換性の照合に使う。

`entityRemove`はアンロードでも起こるので、自然個体死亡の判定に用いない。`getEntity()`未取得も同様。entityLoadでtoken整合、期限判定を再実施。

Molangの歩行は `query.modified_distance_moved` / `query.modified_move_speed`、視線は `query.target_x_rotation` / `query.target_y_rotation`を使用する。純粋JSON検証ではMolangの実行意味までは検証できない。

盲目を非プレイヤーの『索敵停止保証』として使わない。Glowing・LuckなどのJavaの効果を標準Bedrock効果として登録しない。

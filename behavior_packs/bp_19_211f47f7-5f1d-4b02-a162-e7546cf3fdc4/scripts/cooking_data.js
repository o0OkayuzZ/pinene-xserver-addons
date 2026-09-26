export const COOKING_RECIPES = [
  {
    "id": "pine:milk_bottle",
    "name": "ミルク瓶",
    "rank": 0,
    "description": "料理に使いやすい小分けのミルク。まろやかな料理の基本素材。",
    "ingredients": [
      {
        "id": "minecraft:milk_bucket",
        "count": 1,
        "name": "ミルク入りバケツ",
        "icon": "textures/items/bucket_milk"
      },
      {
        "id": "minecraft:glass_bottle",
        "count": 8,
        "name": "ガラス瓶",
        "icon": "textures/items/potion_bottle_empty"
      }
    ],
    "resultCount": 8,
    "icon": "textures/items/milk_bottle",
    "nutrition": null,
    "saturation": null
  },
  {
    "id": "pine:butter",
    "name": "バター",
    "rank": 0,
    "description": "ミルクから作る濃厚なバター。パンや焼き料理のコクを引き出す。",
    "ingredients": [
      {
        "id": "minecraft:milk_bucket",
        "count": 1,
        "name": "ミルク入りバケツ",
        "icon": "textures/items/bucket_milk"
      }
    ],
    "resultCount": 16,
    "icon": "textures/items/butter",
    "nutrition": null,
    "saturation": null
  },
  {
    "id": "pine:chocolate",
    "name": "チョコ",
    "rank": 0,
    "description": "カカオと砂糖で作る甘い素材。パンやデザートの仕上げに。",
    "ingredients": [
      {
        "id": "minecraft:cocoa_beans",
        "count": 1,
        "name": "カカオ豆",
        "icon": "textures/items/dye_powder_brown"
      },
      {
        "id": "minecraft:sugar",
        "count": 1,
        "name": "砂糖",
        "icon": "textures/items/sugar"
      }
    ],
    "resultCount": 1,
    "icon": "textures/items/chocolate",
    "nutrition": null,
    "saturation": null
  },
  {
    "id": "pine:honey_bread",
    "name": "はちみつパン",
    "rank": 2,
    "description": "はちみつのやさしい甘さをまとわせた、手軽で食べやすいパン。",
    "ingredients": [
      {
        "id": "minecraft:bread",
        "count": 1,
        "name": "パン",
        "icon": "textures/items/bread"
      },
      {
        "id": "minecraft:honey_bottle",
        "count": 1,
        "name": "ハチミツ入りの瓶",
        "icon": "textures/items/honey_bottle"
      }
    ],
    "resultCount": 1,
    "icon": "textures/items/honey_bread",
    "nutrition": 7,
    "saturation": 0.7
  },
  {
    "id": "pine:chocolate_bread",
    "name": "チョコパン",
    "rank": 2,
    "description": "チョコの甘みをたっぷり楽しめる、素朴なデザートパン。",
    "ingredients": [
      {
        "id": "minecraft:bread",
        "count": 1,
        "name": "パン",
        "icon": "textures/items/bread"
      },
      {
        "id": "pine:chocolate",
        "count": 1,
        "name": "チョコ",
        "icon": "textures/items/chocolate"
      }
    ],
    "resultCount": 1,
    "icon": "textures/items/chocolate_bread",
    "nutrition": 7,
    "saturation": 0.8
  },
  {
    "id": "pine:sweet_berry_bread",
    "name": "ベリージャムパン",
    "rank": 2,
    "description": "甘酸っぱいスイートベリーを使った、軽やかなジャムパン。",
    "ingredients": [
      {
        "id": "minecraft:bread",
        "count": 1,
        "name": "パン",
        "icon": "textures/items/bread"
      },
      {
        "id": "minecraft:sweet_berries",
        "count": 2,
        "name": "sweet_berries",
        "icon": "textures/items/sweet_berries"
      },
      {
        "id": "minecraft:sugar",
        "count": 1,
        "name": "砂糖",
        "icon": "textures/items/sugar"
      }
    ],
    "resultCount": 1,
    "icon": "textures/items/sweet_berry_bread",
    "nutrition": 7,
    "saturation": 0.7
  },
  {
    "id": "pine:carrot_salad",
    "name": "キャロットサラダ",
    "rank": 2,
    "description": "ニンジンの甘みとビートルートの彩りを楽しむ、さっぱりしたサラダ。",
    "ingredients": [
      {
        "id": "minecraft:carrot",
        "count": 2,
        "name": "ニンジン",
        "icon": "textures/items/carrot"
      },
      {
        "id": "minecraft:beetroot",
        "count": 1,
        "name": "ビートルート",
        "icon": "textures/items/beetroot"
      },
      {
        "id": "minecraft:bowl",
        "count": 1,
        "name": "ボウル",
        "icon": "textures/items/bowl"
      }
    ],
    "resultCount": 1,
    "icon": "textures/items/carrot_salad",
    "nutrition": 7,
    "saturation": 0.8
  },
  {
    "id": "pine:glow_berry_bread",
    "name": "グロウベリージャムパン",
    "rank": 3,
    "description": "グロウベリーの独特な甘酸っぱさを閉じ込めた、不思議なパン。",
    "ingredients": [
      {
        "id": "minecraft:bread",
        "count": 1,
        "name": "パン",
        "icon": "textures/items/bread"
      },
      {
        "id": "minecraft:glow_berries",
        "count": 2,
        "name": "glow_berries",
        "icon": "textures/items/glow_berries"
      },
      {
        "id": "minecraft:sugar",
        "count": 1,
        "name": "砂糖",
        "icon": "textures/items/sugar"
      }
    ],
    "resultCount": 1,
    "icon": "textures/items/glow_berry_bread",
    "nutrition": 8,
    "saturation": 0.8
  },
  {
    "id": "pine:apple_bread",
    "name": "アップルパン",
    "rank": 3,
    "description": "リンゴの爽やかな甘みとバターの香りが広がるフルーツパン。",
    "ingredients": [
      {
        "id": "minecraft:bread",
        "count": 1,
        "name": "パン",
        "icon": "textures/items/bread"
      },
      {
        "id": "minecraft:apple",
        "count": 1,
        "name": "リンゴ",
        "icon": "textures/items/apple"
      },
      {
        "id": "pine:butter",
        "count": 1,
        "name": "バター",
        "icon": "textures/items/butter"
      }
    ],
    "resultCount": 1,
    "icon": "textures/items/apple_bread",
    "nutrition": 8,
    "saturation": 0.9
  },
  {
    "id": "pine:pumpkin_bread",
    "name": "かぼちゃパン",
    "rank": 3,
    "description": "カボチャの自然な甘みとバターのコクを合わせた、やさしいパン。",
    "ingredients": [
      {
        "id": "minecraft:bread",
        "count": 1,
        "name": "パン",
        "icon": "textures/items/bread"
      },
      {
        "id": "minecraft:pumpkin",
        "count": 1,
        "name": "カボチャ",
        "icon": "textures/blocks/pumpkin_side"
      },
      {
        "id": "pine:butter",
        "count": 1,
        "name": "バター",
        "icon": "textures/items/butter"
      }
    ],
    "resultCount": 1,
    "icon": "textures/items/pumpkin_bread",
    "nutrition": 8,
    "saturation": 0.9
  },
  {
    "id": "pine:kelp_salad",
    "name": "海藻サラダ",
    "rank": 3,
    "description": "乾燥昆布とニンジンを合わせた、海の風味を感じるサラダ。",
    "ingredients": [
      {
        "id": "minecraft:dried_kelp",
        "count": 2,
        "name": "乾燥昆布",
        "icon": "textures/items/dried_kelp"
      },
      {
        "id": "minecraft:carrot",
        "count": 1,
        "name": "ニンジン",
        "icon": "textures/items/carrot"
      },
      {
        "id": "minecraft:bowl",
        "count": 1,
        "name": "ボウル",
        "icon": "textures/items/bowl"
      }
    ],
    "resultCount": 1,
    "icon": "textures/items/kelp_salad",
    "nutrition": 8,
    "saturation": 0.9
  },
  {
    "id": "pine:egg_toast",
    "name": "エッグトースト",
    "rank": 3,
    "description": "パンと卵をバターでまとめた、シンプルで満足感のあるトースト。",
    "ingredients": [
      {
        "id": "minecraft:bread",
        "count": 1,
        "name": "パン",
        "icon": "textures/items/bread"
      },
      {
        "id": "minecraft:egg",
        "count": 1,
        "name": "卵",
        "icon": "textures/items/egg"
      },
      {
        "id": "pine:butter",
        "count": 1,
        "name": "バター",
        "icon": "textures/items/butter"
      }
    ],
    "resultCount": 1,
    "icon": "textures/items/egg_toast",
    "nutrition": 9,
    "saturation": 1.0
  },
  {
    "id": "pine:potato_sandwich",
    "name": "ポテトサンド",
    "rank": 3,
    "description": "ほくほくのベイクドポテトを挟んだ、腹持ちのよいサンド。",
    "ingredients": [
      {
        "id": "minecraft:bread",
        "count": 1,
        "name": "パン",
        "icon": "textures/items/bread"
      },
      {
        "id": "minecraft:baked_potato",
        "count": 2,
        "name": "ベイクドポテト",
        "icon": "textures/items/potato_baked"
      },
      {
        "id": "pine:butter",
        "count": 1,
        "name": "バター",
        "icon": "textures/items/butter"
      }
    ],
    "resultCount": 2,
    "icon": "textures/items/potato_sandwich",
    "nutrition": 8,
    "saturation": 0.9
  },
  {
    "id": "pine:steak_sandwich",
    "name": "ステーキサンド",
    "rank": 4,
    "description": "焼いた牛肉をパンで挟んだ、しっかり食べ応えのあるサンド。",
    "ingredients": [
      {
        "id": "minecraft:bread",
        "count": 1,
        "name": "パン",
        "icon": "textures/items/bread"
      },
      {
        "id": "minecraft:cooked_beef",
        "count": 1,
        "name": "ステーキ",
        "icon": "textures/items/beef_cooked"
      },
      {
        "id": "pine:butter",
        "count": 1,
        "name": "バター",
        "icon": "textures/items/butter"
      }
    ],
    "resultCount": 2,
    "icon": "textures/items/steak_sandwich",
    "nutrition": 10,
    "saturation": 1.0
  },
  {
    "id": "pine:pork_sandwich",
    "name": "ポークサンド",
    "rank": 4,
    "description": "香ばしい豚肉とバターを合わせた、コクのあるサンド。",
    "ingredients": [
      {
        "id": "minecraft:bread",
        "count": 1,
        "name": "パン",
        "icon": "textures/items/bread"
      },
      {
        "id": "minecraft:cooked_porkchop",
        "count": 1,
        "name": "焼き豚",
        "icon": "textures/items/porkchop_cooked"
      },
      {
        "id": "pine:butter",
        "count": 1,
        "name": "バター",
        "icon": "textures/items/butter"
      }
    ],
    "resultCount": 2,
    "icon": "textures/items/pork_sandwich",
    "nutrition": 10,
    "saturation": 1.0
  },
  {
    "id": "pine:chicken_sandwich",
    "name": "チキンサンド",
    "rank": 4,
    "description": "焼き鳥のやわらかな旨味をパンで包んだ、食べやすいサンド。",
    "ingredients": [
      {
        "id": "minecraft:bread",
        "count": 1,
        "name": "パン",
        "icon": "textures/items/bread"
      },
      {
        "id": "minecraft:cooked_chicken",
        "count": 1,
        "name": "焼き鳥",
        "icon": "textures/items/chicken_cooked"
      },
      {
        "id": "pine:butter",
        "count": 1,
        "name": "バター",
        "icon": "textures/items/butter"
      }
    ],
    "resultCount": 2,
    "icon": "textures/items/chicken_sandwich",
    "nutrition": 9,
    "saturation": 1.0
  },
  {
    "id": "pine:mushroom_sandwich",
    "name": "キノコサンド",
    "rank": 4,
    "description": "赤と茶のキノコをバターでまとめた、香り豊かなサンド。",
    "ingredients": [
      {
        "id": "minecraft:bread",
        "count": 1,
        "name": "パン",
        "icon": "textures/items/bread"
      },
      {
        "id": "minecraft:red_mushroom",
        "count": 1,
        "name": "赤キノコ",
        "icon": "textures/blocks/mushroom_red"
      },
      {
        "id": "minecraft:brown_mushroom",
        "count": 1,
        "name": "茶キノコ",
        "icon": "textures/blocks/mushroom_brown"
      },
      {
        "id": "pine:butter",
        "count": 1,
        "name": "バター",
        "icon": "textures/items/butter"
      }
    ],
    "resultCount": 2,
    "icon": "textures/items/mushroom_sandwich",
    "nutrition": 9,
    "saturation": 1.1
  },
  {
    "id": "pine:pumpkin_soup",
    "name": "パンプキンスープ",
    "rank": 4,
    "description": "カボチャの甘みとミルクが広がる、ほっとする味わいのスープ。",
    "ingredients": [
      {
        "id": "minecraft:pumpkin",
        "count": 1,
        "name": "カボチャ",
        "icon": "textures/blocks/pumpkin_side"
      },
      {
        "id": "pine:milk_bottle",
        "count": 1,
        "name": "ミルク瓶",
        "icon": "textures/items/milk_bottle"
      },
      {
        "id": "pine:butter",
        "count": 1,
        "name": "バター",
        "icon": "textures/items/butter"
      },
      {
        "id": "minecraft:bowl",
        "count": 1,
        "name": "ボウル",
        "icon": "textures/items/bowl"
      }
    ],
    "resultCount": 1,
    "icon": "textures/items/pumpkin_soup",
    "nutrition": 10,
    "saturation": 1.3
  },
  {
    "id": "pine:honey_chicken",
    "name": "ハニーチキン",
    "rank": 4,
    "description": "はちみつの甘みが絡んだ香ばしいチキン。シンプルながら満足感のある一品。",
    "ingredients": [
      {
        "id": "minecraft:cooked_chicken",
        "count": 1,
        "name": "焼き鳥",
        "icon": "textures/items/chicken_cooked"
      },
      {
        "id": "minecraft:honey_bottle",
        "count": 1,
        "name": "ハチミツ入りの瓶",
        "icon": "textures/items/honey_bottle"
      }
    ],
    "resultCount": 1,
    "icon": "textures/items/honey_chicken",
    "nutrition": 10,
    "saturation": 1.2
  },
  {
    "id": "pine:fruit_bowl",
    "name": "フルーツボウル",
    "rank": 4,
    "description": "リンゴと2種のベリーを盛り合わせた、彩り豊かなフルーツボウル。",
    "ingredients": [
      {
        "id": "minecraft:apple",
        "count": 1,
        "name": "リンゴ",
        "icon": "textures/items/apple"
      },
      {
        "id": "minecraft:sweet_berries",
        "count": 2,
        "name": "sweet_berries",
        "icon": "textures/items/sweet_berries"
      },
      {
        "id": "minecraft:glow_berries",
        "count": 2,
        "name": "glow_berries",
        "icon": "textures/items/glow_berries"
      },
      {
        "id": "minecraft:bowl",
        "count": 1,
        "name": "ボウル",
        "icon": "textures/items/bowl"
      }
    ],
    "resultCount": 1,
    "icon": "textures/items/fruit_bowl",
    "nutrition": 11,
    "saturation": 1.2
  },
  {
    "id": "pine:honey_pork_sandwich",
    "name": "ハニーポークサンド",
    "rank": 5,
    "description": "ポークサンドにはちみつの照りを重ねた、濃厚で贅沢なサンド。",
    "ingredients": [
      {
        "id": "pine:pork_sandwich",
        "count": 2,
        "name": "ポークサンド",
        "icon": "textures/items/pork_sandwich"
      },
      {
        "id": "minecraft:honey_bottle",
        "count": 1,
        "name": "ハチミツ入りの瓶",
        "icon": "textures/items/honey_bottle"
      }
    ],
    "resultCount": 2,
    "icon": "textures/items/honey_pork_sandwich",
    "nutrition": 12,
    "saturation": 1.3
  },
  {
    "id": "pine:mushroom_cream_soup",
    "name": "キノコクリームスープ",
    "rank": 5,
    "description": "2種類のキノコの旨味とミルクのコクが溶け合う、濃厚でやさしいスープ。",
    "ingredients": [
      {
        "id": "minecraft:red_mushroom",
        "count": 1,
        "name": "赤キノコ",
        "icon": "textures/blocks/mushroom_red"
      },
      {
        "id": "minecraft:brown_mushroom",
        "count": 1,
        "name": "茶キノコ",
        "icon": "textures/blocks/mushroom_brown"
      },
      {
        "id": "pine:milk_bottle",
        "count": 1,
        "name": "ミルク瓶",
        "icon": "textures/items/milk_bottle"
      },
      {
        "id": "pine:butter",
        "count": 1,
        "name": "バター",
        "icon": "textures/items/butter"
      },
      {
        "id": "minecraft:bowl",
        "count": 1,
        "name": "ボウル",
        "icon": "textures/items/bowl"
      }
    ],
    "resultCount": 1,
    "icon": "textures/items/mushroom_cream_soup",
    "nutrition": 11,
    "saturation": 1.4
  },
  {
    "id": "pine:beef_stew",
    "name": "ビーフシチュー",
    "rank": 5,
    "description": "じっくり煮込んだ牛肉と野菜の旨味が詰まった、贅沢なシチュー。",
    "ingredients": [
      {
        "id": "minecraft:cooked_beef",
        "count": 1,
        "name": "ステーキ",
        "icon": "textures/items/beef_cooked"
      },
      {
        "id": "minecraft:baked_potato",
        "count": 1,
        "name": "ベイクドポテト",
        "icon": "textures/items/potato_baked"
      },
      {
        "id": "minecraft:carrot",
        "count": 1,
        "name": "ニンジン",
        "icon": "textures/items/carrot"
      },
      {
        "id": "minecraft:bowl",
        "count": 1,
        "name": "ボウル",
        "icon": "textures/items/bowl"
      }
    ],
    "resultCount": 1,
    "icon": "textures/items/beef_stew",
    "nutrition": 13,
    "saturation": 1.5
  },
  {
    "id": "pine:chicken_stew",
    "name": "チキンシチュー",
    "rank": 5,
    "description": "やわらかな鶏肉と野菜のやさしい味わい。体の芯から温まる定番シチュー。",
    "ingredients": [
      {
        "id": "minecraft:cooked_chicken",
        "count": 1,
        "name": "焼き鳥",
        "icon": "textures/items/chicken_cooked"
      },
      {
        "id": "minecraft:baked_potato",
        "count": 1,
        "name": "ベイクドポテト",
        "icon": "textures/items/potato_baked"
      },
      {
        "id": "minecraft:carrot",
        "count": 1,
        "name": "ニンジン",
        "icon": "textures/items/carrot"
      },
      {
        "id": "minecraft:bowl",
        "count": 1,
        "name": "ボウル",
        "icon": "textures/items/bowl"
      }
    ],
    "resultCount": 1,
    "icon": "textures/items/chicken_stew",
    "nutrition": 12,
    "saturation": 1.4
  },
  {
    "id": "pine:seafood_soup",
    "name": "海鮮スープ",
    "rank": 5,
    "description": "海の幸の旨味を昆布で引き出した、滋味深いスープ。",
    "ingredients": [
      {
        "id": "minecraft:cooked_salmon",
        "count": 1,
        "name": "焼き鮭",
        "icon": "textures/items/fish_salmon_cooked"
      },
      {
        "id": "minecraft:cooked_cod",
        "count": 1,
        "name": "焼き鱈",
        "icon": "textures/items/fish_cod_cooked"
      },
      {
        "id": "minecraft:dried_kelp",
        "count": 1,
        "name": "乾燥昆布",
        "icon": "textures/items/dried_kelp"
      },
      {
        "id": "minecraft:bowl",
        "count": 1,
        "name": "ボウル",
        "icon": "textures/items/bowl"
      }
    ],
    "resultCount": 1,
    "icon": "textures/items/seafood_soup",
    "nutrition": 13,
    "saturation": 1.5
  },
  {
    "id": "pine:chocolate_pancake",
    "name": "チョコパンケーキ",
    "rank": 5,
    "description": "パンケーキにチョコの濃厚な甘さを重ねた、王道のデザート。",
    "ingredients": [
      {
        "id": "myname:pancake",
        "count": 1,
        "name": "パンケーキ",
        "icon": "textures/items/pancake"
      },
      {
        "id": "pine:chocolate",
        "count": 1,
        "name": "チョコ",
        "icon": "textures/items/chocolate"
      }
    ],
    "resultCount": 1,
    "icon": "textures/items/chocolate_pancake",
    "nutrition": 13,
    "saturation": 1.5
  },
  {
    "id": "pine:apple_pancake",
    "name": "アップルパンケーキ",
    "rank": 5,
    "description": "リンゴと砂糖の甘酸っぱさを添えた、香りのよいパンケーキ。",
    "ingredients": [
      {
        "id": "myname:pancake",
        "count": 1,
        "name": "パンケーキ",
        "icon": "textures/items/pancake"
      },
      {
        "id": "minecraft:apple",
        "count": 1,
        "name": "リンゴ",
        "icon": "textures/items/apple"
      },
      {
        "id": "minecraft:sugar",
        "count": 1,
        "name": "砂糖",
        "icon": "textures/items/sugar"
      }
    ],
    "resultCount": 1,
    "icon": "textures/items/apple_pancake",
    "nutrition": 13,
    "saturation": 1.5
  },
  {
    "id": "pine:pumpkin_pancake",
    "name": "パンプキンパンケーキ",
    "rank": 5,
    "description": "カボチャのやさしい甘みを生かした、ほっこり濃厚なパンケーキ。",
    "ingredients": [
      {
        "id": "myname:pancake",
        "count": 1,
        "name": "パンケーキ",
        "icon": "textures/items/pancake"
      },
      {
        "id": "minecraft:pumpkin",
        "count": 1,
        "name": "カボチャ",
        "icon": "textures/blocks/pumpkin_side"
      },
      {
        "id": "minecraft:sugar",
        "count": 1,
        "name": "砂糖",
        "icon": "textures/items/sugar"
      }
    ],
    "resultCount": 1,
    "icon": "textures/items/pumpkin_pancake",
    "nutrition": 13,
    "saturation": 1.5
  },
  {
    "id": "pine:glow_berry_pancake",
    "name": "グロウベリーパンケーキ",
    "rank": 6,
    "description": "グロウベリーを贅沢に使った、鮮やかで特別感のあるパンケーキ。",
    "ingredients": [
      {
        "id": "myname:pancake",
        "count": 1,
        "name": "パンケーキ",
        "icon": "textures/items/pancake"
      },
      {
        "id": "minecraft:glow_berries",
        "count": 2,
        "name": "glow_berries",
        "icon": "textures/items/glow_berries"
      }
    ],
    "resultCount": 1,
    "icon": "textures/items/glow_berry_pancake",
    "nutrition": 14,
    "saturation": 1.6
  },
  {
    "id": "pine:carrot_cake",
    "name": "キャロットケーキ",
    "rank": 6,
    "description": "ニンジン、ミルク、バターをたっぷり使った、満足感の高いケーキ。",
    "ingredients": [
      {
        "id": "minecraft:carrot",
        "count": 2,
        "name": "ニンジン",
        "icon": "textures/items/carrot"
      },
      {
        "id": "minecraft:wheat",
        "count": 2,
        "name": "小麦",
        "icon": "textures/items/wheat"
      },
      {
        "id": "minecraft:egg",
        "count": 1,
        "name": "卵",
        "icon": "textures/items/egg"
      },
      {
        "id": "minecraft:sugar",
        "count": 2,
        "name": "砂糖",
        "icon": "textures/items/sugar"
      },
      {
        "id": "pine:butter",
        "count": 1,
        "name": "バター",
        "icon": "textures/items/butter"
      },
      {
        "id": "pine:milk_bottle",
        "count": 1,
        "name": "ミルク瓶",
        "icon": "textures/items/milk_bottle"
      }
    ],
    "resultCount": 1,
    "icon": "textures/items/carrot_cake",
    "nutrition": 14,
    "saturation": 1.7
  }
];
export const CATEGORY_ORDER = [0,1,2,3,4,5,6,7];

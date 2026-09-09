export const FOODS = {
  "pinene:enchanted_golden_carrot": {
    "name": "エンチャントされた金のニンジン",
    "family": "carrot",
    "tier": "enchanted",
    "food": {
      "nutrition": 6,
      "saturation_modifier": 1.2,
      "can_always_eat": true,
      "use_duration_s": 1.6,
      "numeric_status": "playtest_seed_not_final",
      "saturation_note": "付与量の計算値と、ゲーム内で実際に保持できる上限は別。対象環境の上限に従う。"
    },
    "effects": [
      {
        "id": "night_vision",
        "amplifier": 0,
        "seconds": 480
      }
    ],
    "features": [
      {
        "key": "cleanse_on_consume",
        "status": "capability_gated",
        "must_not_advertise_until_verified": true,
        "effect_ids": [
          "blindness",
          "darkness"
        ]
      },
      {
        "key": "prevent_effects",
        "status": "capability_gated",
        "must_not_advertise_until_verified": true,
        "duration_s": 480,
        "effect_ids": [
          "blindness",
          "darkness"
        ]
      }
    ],
    "icon": "textures/pinene_golden_foods/golden_carrot"
  },
  "pinene:golden_potato": {
    "name": "金のジャガイモ",
    "family": "potato",
    "tier": "golden_raw",
    "food": {
      "nutrition": 1,
      "saturation_modifier": 0.3,
      "can_always_eat": false,
      "use_duration_s": 1.6,
      "numeric_status": "playtest_seed_not_final",
      "saturation_note": "付与量の計算値と、ゲーム内で実際に保持できる上限は別。対象環境の上限に従う。"
    },
    "effects": [],
    "features": [],
    "icon": "textures/pinene_golden_foods/golden_potato"
  },
  "pinene:baked_golden_potato": {
    "name": "ベイクド金ジャガイモ",
    "family": "potato",
    "tier": "golden",
    "food": {
      "nutrition": 10,
      "saturation_modifier": 1.0,
      "can_always_eat": true,
      "use_duration_s": 1.6,
      "numeric_status": "playtest_seed_not_final",
      "saturation_note": "付与量の計算値と、ゲーム内で実際に保持できる上限は別。対象環境の上限に従う。"
    },
    "effects": [
      {
        "id": "haste",
        "amplifier": 0,
        "seconds": 180
      },
      {
        "id": "speed",
        "amplifier": 0,
        "seconds": 180
      }
    ],
    "features": [
      {
        "key": "exhaustion_reduction",
        "status": "capability_gated",
        "must_not_advertise_until_verified": true,
        "duration_s": 300,
        "rate": 0.3,
        "scope": "all_native_exhaustion",
        "value_status": "300秒は会話の3〜5分から選んだ暫定値"
      }
    ],
    "icon": "textures/pinene_golden_foods/baked_golden_potato"
  },
  "pinene:enchanted_baked_golden_potato": {
    "name": "エンチャントされたベイクド金ジャガイモ",
    "family": "potato",
    "tier": "enchanted",
    "food": {
      "nutrition": 20,
      "saturation_modifier": 1.0,
      "can_always_eat": true,
      "use_duration_s": 1.6,
      "numeric_status": "playtest_seed_not_final",
      "saturation_note": "付与量の計算値と、ゲーム内で実際に保持できる上限は別。対象環境の上限に従う。"
    },
    "effects": [
      {
        "id": "haste",
        "amplifier": 1,
        "seconds": 300
      },
      {
        "id": "speed",
        "amplifier": 0,
        "seconds": 300
      }
    ],
    "features": [
      {
        "key": "exhaustion_reduction",
        "status": "capability_gated",
        "must_not_advertise_until_verified": true,
        "duration_s": 300,
        "rate": 0.75,
        "scope": "all_native_exhaustion"
      },
      {
        "key": "energy_reserve",
        "status": "capability_gated",
        "must_not_advertise_until_verified": true,
        "duration_s": 300,
        "capacity_hunger_equivalent": 20,
        "phase": 2,
        "stacking": "maximum_not_sum",
        "value_status": "earlier_conversation_candidate"
      }
    ],
    "icon": "textures/pinene_golden_foods/baked_golden_potato"
  },
  "pinene:golden_beetroot": {
    "name": "金のビートルート",
    "family": "beetroot",
    "tier": "golden",
    "food": {
      "nutrition": 6,
      "saturation_modifier": 1.0,
      "can_always_eat": true,
      "use_duration_s": 1.6,
      "numeric_status": "playtest_seed_not_final",
      "saturation_note": "付与量の計算値と、ゲーム内で実際に保持できる上限は別。対象環境の上限に従う。"
    },
    "effects": [
      {
        "id": "speed",
        "amplifier": 0,
        "seconds": 120
      },
      {
        "id": "haste",
        "amplifier": 0,
        "seconds": 120
      },
      {
        "id": "regeneration",
        "amplifier": 0,
        "seconds": 10
      }
    ],
    "features": [
      {
        "key": "exhaustion_reduction",
        "status": "capability_gated",
        "must_not_advertise_until_verified": true,
        "duration_s": 120,
        "rate": 0.15,
        "scope": "sprint_only"
      }
    ],
    "icon": "textures/pinene_golden_foods/golden_beetroot"
  },
  "pinene:enchanted_golden_beetroot": {
    "name": "エンチャントされた金のビートルート",
    "family": "beetroot",
    "tier": "enchanted",
    "food": {
      "nutrition": 12,
      "saturation_modifier": 1.0,
      "can_always_eat": true,
      "use_duration_s": 1.6,
      "numeric_status": "playtest_seed_not_final",
      "saturation_note": "付与量の計算値と、ゲーム内で実際に保持できる上限は別。対象環境の上限に従う。"
    },
    "effects": [
      {
        "id": "speed",
        "amplifier": 1,
        "seconds": 240
      },
      {
        "id": "haste",
        "amplifier": 1,
        "seconds": 240
      },
      {
        "id": "regeneration",
        "amplifier": 0,
        "seconds": 240
      }
    ],
    "features": [
      {
        "key": "exhaustion_reduction",
        "status": "capability_gated",
        "must_not_advertise_until_verified": true,
        "duration_s": 240,
        "rate": 0.4,
        "scope": "sprint_and_jump_only"
      }
    ],
    "icon": "textures/pinene_golden_foods/golden_beetroot"
  },
  "pinene:enchanted_glistering_melon_slice": {
    "name": "エンチャントされたきらめくスイカの薄切り",
    "family": "melon",
    "tier": "enchanted",
    "food": {
      "nutrition": 12,
      "saturation_modifier": 1.0,
      "can_always_eat": true,
      "use_duration_s": 1.6,
      "numeric_status": "playtest_seed_not_final",
      "saturation_note": "付与量の計算値と、ゲーム内で実際に保持できる上限は別。対象環境の上限に従う。"
    },
    "effects": [
      {
        "id": "fire_resistance",
        "amplifier": 0,
        "seconds": 300
      },
      {
        "id": "speed",
        "amplifier": 0,
        "seconds": 300
      }
    ],
    "features": [
      {
        "key": "extinguish_on_consume",
        "status": "capability_gated",
        "must_not_advertise_until_verified": true
      },
      {
        "key": "exhaustion_reduction",
        "status": "capability_gated",
        "must_not_advertise_until_verified": true,
        "duration_s": 300,
        "rate": 0.3,
        "scope": "all_native_exhaustion"
      },
      {
        "key": "heat_exposure_regeneration",
        "status": "capability_gated",
        "must_not_advertise_until_verified": true,
        "duration_s": 300,
        "phase": 2,
        "trigger": "verified_environment_contact_not_entityHurt_only",
        "proc_effect": {
          "effect": "regeneration",
          "level": 1,
          "amplifier_zero_based": 0,
          "duration_s": 5,
          "value_status": "new_test_default"
        },
        "cooldown_s": 15,
        "value_status": "new_test_default"
      }
    ],
    "icon": "textures/pinene_golden_foods/glistering_melon_slice"
  },
  "pinene:golden_pumpkin_pie": {
    "name": "金のパンプキンパイ",
    "family": "pumpkin",
    "tier": "golden",
    "food": {
      "nutrition": 12,
      "saturation_modifier": 1.0,
      "can_always_eat": true,
      "use_duration_s": 1.6,
      "numeric_status": "playtest_seed_not_final",
      "saturation_note": "付与量の計算値と、ゲーム内で実際に保持できる上限は別。対象環境の上限に従う。"
    },
    "effects": [
      {
        "id": "resistance",
        "amplifier": 0,
        "seconds": 120
      },
      {
        "id": "regeneration",
        "amplifier": 1,
        "seconds": 10
      },
      {
        "id": "absorption",
        "amplifier": 1,
        "seconds": 120
      }
    ],
    "features": [
      {
        "key": "reduce_existing_effect_duration_once",
        "status": "capability_gated",
        "must_not_advertise_until_verified": true,
        "ratio": 0.25,
        "effect_ids": [
          "poison",
          "wither",
          "hunger"
        ]
      }
    ],
    "icon": "textures/pinene_golden_foods/golden_pumpkin_pie"
  },
  "pinene:enchanted_golden_pumpkin_pie": {
    "name": "エンチャントされた金のパンプキンパイ",
    "family": "pumpkin",
    "tier": "enchanted",
    "food": {
      "nutrition": 20,
      "saturation_modifier": 1.0,
      "can_always_eat": true,
      "use_duration_s": 1.6,
      "numeric_status": "playtest_seed_not_final",
      "saturation_note": "付与量の計算値と、ゲーム内で実際に保持できる上限は別。対象環境の上限に従う。"
    },
    "effects": [
      {
        "id": "resistance",
        "amplifier": 1,
        "seconds": 300
      },
      {
        "id": "absorption",
        "amplifier": 3,
        "seconds": 180
      },
      {
        "id": "regeneration",
        "amplifier": 1,
        "seconds": 30
      }
    ],
    "features": [
      {
        "key": "cleanse_on_consume",
        "status": "capability_gated",
        "must_not_advertise_until_verified": true,
        "effect_ids": [
          "poison",
          "wither",
          "hunger",
          "blindness"
        ]
      },
      {
        "key": "reduce_incoming_effect_duration",
        "status": "capability_gated",
        "must_not_advertise_until_verified": true,
        "duration_s": 120,
        "ratio": 0.75,
        "effect_ids": [
          "poison",
          "wither",
          "hunger",
          "blindness"
        ]
      }
    ],
    "icon": "textures/pinene_golden_foods/golden_pumpkin_pie"
  },
  "pinene:golden_poisonous_potato": {
    "name": "金の毒ジャガイモ",
    "family": "poison",
    "tier": "golden",
    "food": {
      "nutrition": 4,
      "saturation_modifier": 0.6,
      "can_always_eat": true,
      "use_duration_s": 1.6,
      "numeric_status": "playtest_seed_not_final",
      "saturation_note": "付与量の計算値と、ゲーム内で実際に保持できる上限は別。対象環境の上限に従う。"
    },
    "effects": [
      {
        "id": "absorption",
        "amplifier": 0,
        "seconds": 120
      }
    ],
    "features": [
      {
        "key": "cleanse_on_consume",
        "status": "capability_gated",
        "must_not_advertise_until_verified": true,
        "effect_ids": [
          "poison"
        ]
      },
      {
        "key": "prevent_effects",
        "status": "capability_gated",
        "must_not_advertise_until_verified": true,
        "duration_s": 120,
        "effect_ids": [
          "poison"
        ]
      },
      {
        "key": "reduce_incoming_effect_duration",
        "status": "capability_gated",
        "must_not_advertise_until_verified": true,
        "duration_s": 120,
        "ratio": 0.5,
        "effect_ids": [
          "nausea",
          "hunger"
        ]
      }
    ],
    "icon": "textures/pinene_golden_foods/golden_poisonous_potato"
  },
  "pinene:enchanted_golden_poisonous_potato": {
    "name": "エンチャントされた金の毒ジャガイモ",
    "family": "poison",
    "tier": "enchanted",
    "food": {
      "nutrition": 8,
      "saturation_modifier": 1.0,
      "can_always_eat": true,
      "use_duration_s": 1.6,
      "numeric_status": "playtest_seed_not_final",
      "saturation_note": "付与量の計算値と、ゲーム内で実際に保持できる上限は別。対象環境の上限に従う。"
    },
    "effects": [],
    "features": [
      {
        "key": "cleanse_on_consume",
        "status": "capability_gated",
        "must_not_advertise_until_verified": true,
        "effect_ids": [
          "poison",
          "nausea",
          "hunger"
        ]
      },
      {
        "key": "prevent_effects",
        "status": "capability_gated",
        "must_not_advertise_until_verified": true,
        "duration_s": 300,
        "effect_ids": [
          "poison"
        ]
      },
      {
        "key": "poison_to_regeneration",
        "status": "capability_gated",
        "must_not_advertise_until_verified": true,
        "duration_s": 300,
        "proc_effect": {
          "effect": "regeneration",
          "level": 1,
          "amplifier_zero_based": 0,
          "duration_s": 6,
          "value_status": "new_test_default"
        },
        "cooldown_s": 10,
        "value_status": "new_test_default"
      }
    ],
    "icon": "textures/pinene_golden_foods/golden_poisonous_potato"
  },
  "a:gwheat": {
    "name": "金の小麦",
    "family": "wheat",
    "tier": "golden",
    "food": null,
    "effects": [],
    "features": [],
    "icon": "textures/pinene_golden_foods/golden_wheat"
  },
  "a:egwheat": {
    "name": "エンチャントされた金の小麦",
    "family": "wheat",
    "tier": "enchanted",
    "food": null,
    "effects": [],
    "features": [],
    "icon": "textures/pinene_golden_foods/golden_wheat"
  },
  "a:gbread": {
    "name": "金のパン",
    "family": "bread",
    "tier": "golden",
    "food": {
      "nutrition": 10,
      "saturation_modifier": 1.0,
      "can_always_eat": true,
      "use_duration_s": 1.6,
      "numeric_status": "playtest_seed_not_final",
      "saturation_note": "付与量の計算値と、ゲーム内で実際に保持できる上限は別。対象環境の上限に従う。"
    },
    "effects": [
      {
        "id": "regeneration",
        "amplifier": 1,
        "seconds": 15
      },
      {
        "id": "speed",
        "amplifier": 0,
        "seconds": 90
      },
      {
        "id": "haste",
        "amplifier": 0,
        "seconds": 90
      }
    ],
    "features": [],
    "icon": "textures/pinene_golden_foods/golden_bread"
  },
  "a:egbread": {
    "name": "エンチャントされた金のパン",
    "family": "bread",
    "tier": "enchanted",
    "food": {
      "nutrition": 20,
      "saturation_modifier": 1.0,
      "can_always_eat": true,
      "use_duration_s": 1.6,
      "numeric_status": "playtest_seed_not_final",
      "saturation_note": "付与量の計算値と、ゲーム内で実際に保持できる上限は別。対象環境の上限に従う。"
    },
    "effects": [
      {
        "id": "regeneration",
        "amplifier": 1,
        "seconds": 30
      },
      {
        "id": "speed",
        "amplifier": 1,
        "seconds": 180
      },
      {
        "id": "haste",
        "amplifier": 1,
        "seconds": 180
      }
    ],
    "features": [
      {
        "key": "exhaustion_reduction",
        "status": "capability_gated",
        "must_not_advertise_until_verified": true,
        "duration_s": 180,
        "rate": 0.4,
        "scope": "all_native_exhaustion"
      }
    ],
    "icon": "textures/pinene_golden_foods/golden_bread"
  },
  "a:astew": {
    "name": "リンゴシチュー",
    "family": "apple_stew",
    "tier": "normal",
    "food": {
      "nutrition": 4,
      "saturation_modifier": 0.6,
      "can_always_eat": false,
      "use_duration_s": 1.6
    },
    "effects": [],
    "features": [],
    "icon": "textures/pinene_golden_foods/astew",
    "container_note": "食べ終わるとボウルが戻ります。"
  },
  "a:gstew": {
    "name": "金のリンゴシチュー",
    "family": "apple_stew",
    "tier": "golden",
    "food": {
      "nutrition": 8,
      "saturation_modifier": 1.0,
      "can_always_eat": true,
      "use_duration_s": 1.6
    },
    "effects": [
      {
        "id": "regeneration",
        "amplifier": 1,
        "seconds": 15
      }
    ],
    "features": [],
    "icon": "textures/pinene_golden_foods/gstew",
    "container_note": "食べ終わるとボウルが戻ります。"
  },
  "a:estew": {
    "name": "エンチャントされた金のリンゴシチュー",
    "family": "apple_stew",
    "tier": "enchanted",
    "food": {
      "nutrition": 16,
      "saturation_modifier": 1.0,
      "can_always_eat": true,
      "use_duration_s": 1.6
    },
    "effects": [
      {
        "id": "regeneration",
        "amplifier": 1,
        "seconds": 30
      },
      {
        "id": "absorption",
        "amplifier": 1,
        "seconds": 120
      }
    ],
    "features": [],
    "icon": "textures/pinene_golden_foods/gstew",
    "container_note": "食べ終わるとボウルが戻ります。"
  },
  "a:gmbucket": {
    "name": "金のミルク",
    "family": "milk",
    "tier": "golden",
    "food": {
      "nutrition": 4,
      "saturation_modifier": 0.6,
      "can_always_eat": true,
      "use_duration_s": 1.6
    },
    "effects": [
      {
        "id": "regeneration",
        "amplifier": 0,
        "seconds": 10
      },
      {
        "id": "absorption",
        "amplifier": 0,
        "seconds": 120
      }
    ],
    "features": [],
    "icon": "textures/pinene_golden_foods/gmbucket",
    "container_note": "飲み終わるとバケツが戻ります。通常の牛乳の状態異常解除はありません。"
  },
  "a:egmbucket": {
    "name": "エンチャントされた金のミルク",
    "family": "milk",
    "tier": "enchanted",
    "food": {
      "nutrition": 8,
      "saturation_modifier": 1.0,
      "can_always_eat": true,
      "use_duration_s": 1.6
    },
    "effects": [
      {
        "id": "regeneration",
        "amplifier": 1,
        "seconds": 20
      },
      {
        "id": "absorption",
        "amplifier": 1,
        "seconds": 180
      }
    ],
    "features": [],
    "icon": "textures/pinene_golden_foods/gmbucket",
    "container_note": "飲み終わるとバケツが戻ります。通常の牛乳の状態異常解除はありません。"
  }
};

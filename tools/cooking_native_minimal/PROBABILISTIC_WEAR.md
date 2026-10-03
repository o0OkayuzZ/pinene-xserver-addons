# Probabilistic knife wear — native crafting test

## Adopted game rule

One **used cooking session** means: the player opens a valid knife-equipped cutting board and at least one registered native cooking recipe is observed before that session is replaced or abandoned.

- A normal craft and a Shift batch both count as **one use** in that open screen.
- Merely opening the screen does not count.
- Picking up a cooking result by itself does not count.
- Losing ingredients by itself does not count.
- Minecraft remains responsible for recipe matching, ingredient consumption, container returns and output. The script never performs or refunds a recipe transaction.

Stable `@minecraft/server 2.7.0` has no native craft event, so this test uses conservative binary evidence only: a registered result must increase while that exact recipe's required ingredients decrease. Inventory and the player's cursor stack are counted together. This is intentionally not used to infer how many crafts occurred.

## Failure timing

The failure roll is made when the first valid craft is detected in the session and is persisted on the non-stackable knife. If the roll wins, the already-completed dish is kept and the current native screen is not disrupted. The knife is destroyed **before the next cutting-board interaction**, including an attempted sneak-retrieve. This makes the unit of wear the whole session and avoids post-hoc recipe rollback.

## Probability curve

The existing knife durability values are reused as each material's base-life scale:

| Knife | Base uses |
| --- | ---: |
| Gold | 64 |
| Copper | 96 |
| Iron | 128 |
| Diamond | 512 |
| Netherite | 640 |

The first 50% of the base life is guaranteed safe. After that, break probability rises smoothly with age using a Weibull-style cumulative hazard. The survival targets are the same at equal normalized age for every material: 100% at 0.5× base, about 95.5% at 0.75×, 69.5% at 1.0×, 29.2% at 1.25× and 5.4% at 1.5×. Because larger-life knives spread that hazard over more sessions, their per-session probability is lower.

Existing durability damage migrates to the same numeric use count, so an already worn knife is not reset. The vanilla durability bar advances by one per used session until it visually reaches its final usable point; custom use count continues beyond that if the knife survives.

## Persistence and safety

- Use count: `pinene_cooking:uses_v1` ItemStack dynamic property.
- Pending failure: `pinene_cooking:break_due_v1`.
- Placement/retrieval continues moving the original ItemStack, preserving dynamic properties, name, lore and enchantments.
- A pending failure cannot be avoided by retrieving the knife.
- This phase remains single-player test-only.
- No custom UI, form reopening, recipe substitution, Preview API, experiment toggle, main merge or Xserver deployment.

## Verification before engine test

- Python compiler/regression suite: 28 passed.
- JavaScript runtime + wear-curve suite: 67 passed.
- Full scripts typecheck against exact published `@minecraft/server 2.7.0`.
- Runtime mocks cover no-craft sessions, normal craft, Shift-style batch, cursor output, false-positive pickup/loss cases, mixed allowed oil seeds, one-use-only behavior, persisted pending failure, retrieval protection and metadata retention.

These are not Minecraft engine results. A new isolated world must still verify that actual Bedrock inventory/cursor timing matches the conservative detector.

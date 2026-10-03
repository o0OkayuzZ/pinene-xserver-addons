# Persistent cooking UI probe

This is an opt-in interaction prototype, NOT the final vanilla-style cooking screen.
The components are built once; rank/recipe changes and repeated crafts update Observable values without calling show() again. No modifications to main/Xserver are included. This branch starts at PR #33 head 494c5b48b821db3ce08a5595f2324e466d7b4d7a.

## Scope

- Stable @minecraft/server-ui 2.2.0 (no beta-only multiButtonRow/imageDetails).
- Rank and recipe dropdowns, material counts, selected base-material image, craft button and diagnostic counters.
- Reuses the existing server-side cooking recipes and synchronous craft function, including knife costs.
- Checks the current board, dimension, distance, knife, ingredients and output capacity before each craft.
- Closing/disconnecting clears the session and update timer. Queued callbacks cannot craft after closure.
- Recipes, existing resource-pack UI, textures and inventory-icon mapping are not overwritten.
- The final 3x3 layout and 36-slot inventory display have NOT been ported into CustomForm. The old UI remains available.

## Local installation

Run `python install_probe.py --pack <cooking-tools-BP-directory>` from this folder. The installer verifies UUID 211f47f7-5f1d-4b02-a162-e7546cf3fdc4, backs up main.js and manifest.json, adds the two modules, and switches only the server-ui dependency to 2.2.0. It preserves local UI-v2 edits. Use a development world and save first. Restart the world after installing so the new dependency and entry point are loaded. Installation is not evidence of runtime/rendering success.

## Enable for the current player

After re-entering the development world, run in chat:

```mcfunction
/scriptevent pinene_cooking:customform on
```

Open an existing cutting board with a placed knife. Only the opted-in player receives the new screen. Change Rank/recipe and craft repeatedly. The diagnostic counter should remain `表示 1回` during the same session.

Close the screen, then disable with:

```mcfunction
/scriptevent pinene_cooking:customform off
```

Ordinary cutting-board use then returns to the existing UI. Full file rollback is available with `python install_probe.py --rollback <backup-directory>`. Rollback refuses to overwrite files edited after installation.

## Validation recorded 2026-10-03

- Local JS mock tests: 24 passed, including 50 consecutive crafts with exactly one show() call. These are not Minecraft engine tests.
- Windows: exact published server-ui 2.2.0 / server 2.7.0 TypeScript API contract compiled successfully.
- Temporary-copy installer/rollback roundtrip passed.
- Four prototype files installed into the local cooking-tools BP; hashes verified. Existing local UI-v2 changes preserved exactly.
- Native Minecraft version observed: Microsoft.MinecraftUWP 1.26.5203.0.
- Native screen rendering and actual continuous crafting remain UNVERIFIED; world reload is pending. Focus was not granted during the guarded foreground check, so no keyboard input was sent.
- Do not treat an empty content log or a successful command-sender process as a gameplay test.

## API references

- https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server-ui/customform?view=minecraft-bedrock-stable
- https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server-ui/observablestring?view=minecraft-bedrock-stable
- https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server-ui/changelog?view=minecraft-bedrock-stable

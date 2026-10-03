# Cooking UI layout capability audit — 2026-10-03

## Confirmed interaction result

The user reported that the installed CustomForm probe worked. This confirms the user's test of the persistent-screen approach, not a screenshot audit of a completed crafting layout. Keep this working probe intact.

## Requested design remains the target

- Compact rank tabs (materials and I–VII).
- Recipe icon grid on the left.
- 3×3 ingredient preview, output, and craft action on the right.
- Player inventory (27 slots plus 9 hotbar slots).
- No recipe-description panel or knife-information panel.
- Rank/recipe selection and crafting must not close and reopen the screen.

## Blocking discovery

The published, locally installed `@minecraft/server-ui` 2.2.0 declarations expose CustomForm components and reactive updates, but do not expose arbitrary rows, columns, panels, a slot grid, or component coordinates. `ImageOptions` exposes width, visibility, tooltip, and a whole-image onClick callback; it does not expose a click position or per-region interactions.

The current Microsoft documentation shows `multiButtonRow` as prerelease (2.4.0 beta), limited to three buttons per row. This is not a complete solution to an eight-tab header, a two-column crafting panel, or a nine-column player inventory. It must not be enabled silently in the working stable pack.

A compile-only audit against the exact local 2.2.0 package passed on 2026-10-03. It checks the absence of row/grid/columns/panel/multiButtonRow and positional options, and checks a valid stable image/callback button call. This is a declaration check, not an engine rendering test.

## Changes during this audit

- Read the actual installed probe modules and exact type definitions.
- Created and compiled `C:\Users\Public\pinene-customform-probe-20261003\layout_contract_audit.ts` outside the Minecraft pack.
- No cooking-pack files, worlds, active UI, main, PR #33, or Xserver were changed by this audit.
- No keyboard/mouse input or crafting operations were sent.
- No preview-compatible CustomForm layout is claimed to be implemented.

## Next architectural decision

Do not silently replace the requested layout with a tall vertical list or a screenshot of fake inventory. Retain the working CustomForm probe. A separate native-container rendering proof is a candidate for investigating the requested layout and real inventory display. Its game-version support, per-player state, click handling, item conservation, and isolation from ordinary chests must be established before any live migration. No such migration has yet been implemented or verified.

## Primary references

- https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server-ui/customform?view=minecraft-bedrock-stable
- https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server-ui/imageoptions?view=minecraft-bedrock-stable
- https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server-ui/changelog?view=minecraft-bedrock-stable
- https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/ui/data_driven_container_screen.json

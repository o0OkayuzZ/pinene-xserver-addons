# Cooking UI v2 — 2026-10-03

## Scope
- PR #33 only. No merge or Xserver deployment.
- The approved generated image is a design reference, not proof of an in-game result.
- Replace the inherited, inset 286x242 dialog with a dedicated 398x236 panel.
- Left: compact rank tabs and 20 recipes per page. Right top: 3x3 recipe preview, result name, result slot and craft button. Right bottom: 27 inventory slots plus 9 hotbar slots.
- No description panel or persistent knife information.
- Arrow uses rectangular UI geometry; no missing font glyph.
- Use verified texture mappings rather than constructing a filename from every item ID. Unknown occupied slots display `?` and log the item ID, rather than pretending to be empty.

## Deliberate limits
- Inventory remains a read-only snapshot, refreshed when the form is rebuilt. It is not live native inventory and does not allow drag/drop.
- Block previews use a verified 2D block texture, not native 3D block rendering.
- The icon map was built from installed vanilla resource manifests and the development packs plus this repository's cooking packs. The JSON audit lists unresolved custom IDs. Resource-pack updates require regenerating the map.
- A syntactically valid UI is not the same as an in-game visual pass. Record those separately.

## Validation
`node --test tests/cooking-ui-v2.test.mjs`

The tests cover panel bounds, all 79 form indices, paging, 27+9 inventory order, read-only rendering, missing-icon fallback, actual form construction, and mixed-seed eligibility.

## Rebuild
`python tools/cooking_ui/generate_layout.py`

`python tools/cooking_ui/generate_icon_map.py --game-resource-packs <game-data/resource_packs> --mojang-root <com.mojang>`

## Runtime check
Reload the resource pack by saving and re-entering the development world. Check the actual cooking form with several inventory items and test a successful and insufficient-material recipe. Keep the PR in draft until this visual check passes.

## Concurrent-branch reconciliation
Remote commits 1dbe030 and 494c5b4 were inspected before integration. Their light-gray/wider layout, right-side inventory and refusal to guess unknown texture paths are retained by the rebuilt panel and verified-icon resolver. The new implementation also removes the inherited inset, fixes the missing arrow glyph, adds 20-slot paging and preserves unknown occupied slots as a visible question mark. No cooking balance or unrelated file changes were present in those two commits.
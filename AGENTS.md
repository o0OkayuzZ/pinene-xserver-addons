# Repository authority

- `o0OkayuzZ/pinene-xserver-addons/main` is the single source of truth for the entire server, including Infinite Castle.
- Before any Infinite Castle work, fetch the latest `main` of this repository and `o0OkayuzZ/pinene-infinite-castle`. Inspect current files, configuration and workflows first. Current repository state takes precedence over old chats, paths, commits and version numbers.
- Implement Infinite Castle changes here, for integration into `main`. BP/RP remain ordinary files; do not introduce submodules or bidirectional sync.
- `pinene-infinite-castle` is an automatically generated, one-way mirror for browsing/distribution. Do not develop there or manually patch generated files. If it is stale, diagnose the source sync workflow, credentials and recorded source commit.
- The extraction contract is `tools/infinite_castle_mirror/config.json`; pack locations are discovered by manifest UUID. Missing or ambiguous identities must fail, never fall back to historical paths. Update the contract and its tests when the layout changes.
- Mirror README, AGENTS and verification workflow are maintained as templates here. Historical mirror-only material is preserved outside generated paths; never import old implementations over current `main` without an explicit, reviewed feature change.
- See `docs/operations/infinite-castle-mirror.md` for ownership, credentials, validation and recovery. Do not delete historical branches without explicit authorization.

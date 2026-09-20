# Infinite Castle: single source of truth and one-way mirror

## Authority and scope

The only development authority is [o0OkayuzZ/pinene-xserver-addons/main](https://github.com/o0OkayuzZ/pinene-xserver-addons/tree/main). [pinene-infinite-castle](https://github.com/o0OkayuzZ/pinene-infinite-castle) is a generated browsing/distribution mirror, not a second development repository. No reverse sync, submodules, or runtime deployment changes are involved.

Always fetch both latest main branches before castle work. Inspect current config, manifests and workflow rather than relying on this document's historical paths or an old conversation. Implement changes in the source repository. Maintain mirror README, AGENTS and CI through `tools/infinite_castle_mirror/templates/` here.

`tools/infinite_castle_mirror/config.json` defines the export contract. The exporter searches committed `manifest.json` files for each pack's UUID and requires exactly one match. Renaming/moving source pack directories is supported without changing workflow path filters. Missing/duplicate UUIDs fail before export; changing pack identity requires reviewing the contract. Never silently select an old copy. Source and destination paths are recorded in `SOURCE_COMMIT.json`.

Generated ownership:

| Mirror path | Policy |
| --- | --- |
| `behavior_packs/infinite_castle/**` | Entire discovered source BP, including tests; exact Git blob bytes |
| `resource_packs/infinite_castle/**` | Entire discovered source RP; exact Git blob bytes |
| `.mirror/**` | Source-provided reference documents |
| `README.md`, `AGENTS.md`, `.github/workflows/verify-mirror.yml` | Source-owned templates |
| `SOURCE_COMMIT.json` | Generated provenance, UTC sync time, resolved pack paths, SHA-256 and mode per exported file |
| `archive/**`, `development/**`, `snapshot-files.json`, other docs | Historical/mirror-specific material, never removed by normal sync |

These packs use server-wide dependencies (for example `dungeons:*` entities and BSL loot). This is an exact extraction, not an independently repackaged server. Build utilities and full dependency configuration stay in the source repository. Mirror-relative links in copied historical documents may describe paths in the source repository.

## Actions and safety

`Sync Infinite Castle mirror` runs on every push to source `main` and on `workflow_dispatch` for `main`. It resolves current pack identities and compares the actual generated file set before obtaining a write token. Only relevant output changes are committed/pushed. We intentionally do not duplicate fixed source paths in GitHub's `paths` filter: pack moves and large changes must not bypass synchronization. Unrelated pushes incur a read-only check, not a mirror commit.

The source checkout is the latest `main` at execution time, not an old queued event's SHA. Jobs share a non-cancelling concurrency group. Before publishing, source main is fetched again; if it advanced, the job fails without pushing and should be rerun (a subsequent main push also queues a job). A race immediately after that check can temporarily publish an earlier valid main; the queued newer run converges to latest. Mirror commits use a normal fast-forward push, never force; concurrent mirror edits cause rejection rather than lost work. Rerun against fresh main after investigating.

Export is from Git objects, so local dirty files, OS line endings and file mtimes cannot change the source bytes. All paths, identities and expected content are resolved before mutation. Deletions affect generated ownership only. Export/validation/commit complete in the runner's disposable checkout before a single push atomically updates the remote branch. Local interrupted checkouts can be discarded and regenerated; no partial remote mirror is published.

The commit subject is `chore(mirror): auto-sync from pinene-xserver-addons@<full SHA>`. Identical output retains the previous source SHA and timestamp, avoiding metadata-only churn. Therefore mirror SOURCE_COMMIT need not equal today's main HEAD when only unrelated files changed; it identifies an actual source revision that produces the identical export.

`Test Infinite Castle exporter` runs the regression tests and exports/verifies the actual source layout on source PRs and main. Mirror `Verify mirror provenance` runs on push, PR, daily and manual dispatch. It checks that the recorded SHA belongs to source main, checks out that exact revision, and compares the complete managed file set, contents, modes and metadata with a fresh extraction. Extra/missing/edited generated files fail verification. Historical files are outside this check.

No credential is needed for verification while both repositories remain public. If either becomes private, configure narrowly scoped read authentication for the cross-repository checkouts as well.

## Required one-time authentication setup

The source `GITHUB_TOKEN` cannot write the other repository. Do not store a personal CLI login token or a secret in Git. Configure ONE of these options in **pinene-xserver-addons → Settings → Secrets and variables → Actions**.

### Recommended: GitHub App

1. Register a GitHub App for this automation. Disable webhooks if unused. Grant repository **Contents: Read and write** and **Workflows: Read and write** (the generated mirror verification workflow also needs updating); Metadata read is implicit.
2. Install it on **only `o0OkayuzZ/pinene-infinite-castle`**. It does not need source write access.
3. Set repository **variable** `INFINITE_CASTLE_MIRROR_APP_CLIENT_ID` to the App's Client ID.
4. Generate the App's private key and register its complete PEM as repository **secret** `INFINITE_CASTLE_MIRROR_APP_PRIVATE_KEY` on the source repo. Never commit it or paste it into issues/chat.
5. The action requests a short-lived installation token scoped to the mirror and revokes it at job completion. Keep the key rotated according to the owner's policy.

### Alternative: fine-grained PAT

1. Create a fine-grained personal access token with resource owner `o0OkayuzZ`, repository access **Only select repositories → pinene-infinite-castle**, and **Contents: Read and write**, **Workflows: Read and write**. Set an appropriate expiry and arrange rotation.
2. Register source repository **secret** `INFINITE_CASTLE_MIRROR_TOKEN`.
3. Leave `INFINITE_CASTLE_MIRROR_APP_CLIENT_ID` unset when using only the PAT. App configuration takes precedence if present.

If mirror branch rules later require PRs, configure a narrowly scoped automation bypass for the installed App or redesign publishing around approved PRs. Do not bypass owner rules by force push. At the migration audit neither main had branch protection or repository rulesets. Direct-edit prevention is currently the in-repo policy plus drift CI; UI permissions are not restricted by this change.

After setup, run [Sync Infinite Castle mirror](https://github.com/o0OkayuzZ/pinene-xserver-addons/actions/workflows/sync-infinite-castle.yml) → Run workflow → main. A no-op run does not exercise write authentication. The next actual source-owned change must also be observed reaching mirror/main, with a green provenance check. Missing credentials on a changed export fail explicitly; never report this as successful automatic publication.

Official references: [App tokens in Actions](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/making-authenticated-api-requests-with-a-github-app-in-a-github-actions-workflow), [App permissions including Workflows](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app), [fine-grained PATs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).

## Reproduction and recovery

Use fresh clones/checkouts. Fetch source main and mirror main before running commands; the target is a disposable mirror checkout, not a Minecraft runtime directory.

```sh
git -C source fetch origin
git -C mirror fetch origin
python3 source/tools/infinite_castle_mirror/sync.py sync --source source --source-ref origin/main --target mirror
python3 source/tools/infinite_castle_mirror/sync.py verify --source source --target mirror
```

Sync reads the config from the selected committed revision, not uncommitted local edits. Run local tests with `python3 -m unittest discover -s tools/infinite_castle_mirror -p 'test_*.py' -v`. Work on extractor/template changes in source and commit them before testing a complete Git-object export.

For a stale or failed mirror, check the source workflow logs, current UUID resolution and credentials; fix the source or settings and dispatch again. Never copy an old mirror implementation over current source main. A refused fast-forward means refetch and investigate current mirror changes; no force push is provided. Managed-path file/directory collisions or symlinks intentionally fail and require a reviewed migration. When changing the ownership contract itself (especially mirror target paths), plan preservation and cleanup explicitly instead of guessing from obsolete metadata.

## Migration audit: 2026-09-20

These are audit evidence, not future defaults:

- Source latest main: `8ed0ed90813202f1c7d79ab380a029cf799e9a53`.
- Mirror latest main: `962b52f284137ee0e4ab96dce053b3a7c433e790`.
- Source BP: `behavior_packs/bp_16_3efecae8-a036-4e14-94d3-876e29fe0ae9`, version 0.2.12; RP: `resource_packs/rp_19_c6529ee0-0a34-4f28-b5ff-66d335fee9bc`, version 0.1.7.
- Previous mirror BP/RP: `behavior_packs/infinite_castle` (0.1.17) / `resource_packs/infinite_castle` (0.1.5); partial development v0.1.36 snapshots, no separate docs directory.
- BP: 152 source files versus 87 mirror files; 60 identical, 13 changed, 79 source-only, 14 mirror-only. RP: 9 versus 7; 4 identical, 3 changed, 2 source-only.
- Mirror-only BP material includes `DESIGN_INTENT.md`, old README and 12 test/support files. `development/` has 58 files, including 26 whose blob content does not occur anywhere in source main. Preserve all as reference, do not promote older code to authority.
- No AGENTS, GitHub Actions, or castle synchronization implementation existed in either main. The food-item sync script elsewhere in source is unrelated. No Actions secrets were registered in source at audit time.
- Initial migration uses the exporter's `archive` command to preserve all 154 original mirror files, byte-for-byte and with their relative paths, beneath `archive/initial-snapshot/` before replacing any managed contents. The original development files and snapshot index also remain at their existing paths. The original snapshot index is meaningful for the archived snapshot, not new generated packs.
- Full per-file comparison: `infinite-castle-mirror-initial-audit.json` beside this document.

One-time migration command (never needed for subsequent synchronization):

```sh
python3 source/tools/infinite_castle_mirror/sync.py archive --target mirror --source-ref <reviewed-pre-migration-mirror-SHA>
```

Branch classification against the fetched source main:

| Branch | Latest comparison | Classification |
| --- | --- | --- |
| `implement/infinite-castle-phase1` at `196d0921` | 28 commits behind main, 0 unique commits | Integrated; cleanup candidate |
| `integrate/bsl-phase-0.5-v1.0.15` at `42fc7474` | 98 commits behind main, 0 unique commits | Integrated; related rewards integration cleanup candidate |
| Mirror repository | Only main exists | No historical branch candidate |

Pre-publication refetch found source main had advanced to `6b16d9e2863f113910ef18df414c9d1fe1563487` (unrelated More Geodes change), which was incorporated without changing castle implementation. It also revealed `fix/infinite-castle-dimension-safety` at `c02a5a28`: 1 commit behind that main and 9 unique commits, covering dimension guards, reconstruction cadence and tests. This is meaningful, unmerged work, NOT a cleanup candidate; only main is exported. Recheck its state before any later integration.

No branch was deleted. Do not interpret these historical counts as current branch state in a later session.

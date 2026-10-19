# Preserve food atlas edges at the existing runtime resolution

The 512px runtime atlases introduced partially transparent triangle boundaries.
Alpha-tested placed food showed bright holes at those boundaries in Vibrant
Visuals. A local beef/chicken comparison confirmed that alpha-weighted area RGB
and maximum alpha coverage greatly reduce those holes without changing geometry.

All 35 model atlases retain their current dimensions (long side at most 512px).
The approved pre-shrink images are read from commit
`cb95f2b791e53aa9344b3e7d047f35172bcfdc5d`; UV correspondence is checked before
rebuilding. Item icons, recipes, ranks, UI, model positions and triangle counts
are preserved. An alpha-tested boundary can become up to one runtime texel wider.
This does not remove baked shading or geometric faceting.

Install offline build dependencies with
`python -m pip install -r tools/meshy_food/requirements.txt`, then run
`python tools/meshy_food/rebuild_alpha_edges.py`. Use `--check` in validation.
For newly approved designs, supply the corresponding approved `--source-ref`;
never silently substitute an older source when UV correspondence fails.

`optimize_assets.py` also uses the same boundary-preserving method on future
high-resolution inputs. Running it on already optimized assets preserves pixels.
`alpha-edge-build.json` records original and deployed hashes and dimensions.

The previous lighting settings in main are retained. Live deployment is limited
to model atlases and version/registration/dependency metadata; it does not change
the live render controller. Local representative comparisons and asset/gameplay
regressions supplement, but do not replace, checking every food in a real client.

On 2026-10-11, all 35 foods rendered in a dedicated local Bedrock 26.52 world
using Vibrant Visuals. The live Xserver atlas update is RP 0.2.4. The pre-update
backup is `/opt/minecraft/server/_pinene_deploy_backups/food-35-alpha-edges-20261011T023946Z`.
The empty-player check preceded restart, and 109 unchanged resource-pack files
were hash-verified. Inventory/held-item/UI screen behavior was protected by scope
and regressions, rather than individually exercised for all 35 foods in this run.

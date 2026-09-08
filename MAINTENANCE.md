# Resource pack maintenance

## 2026-09-08: Waystone Portuguese text

Restored 117 corrupted values in `resource_packs/rp_12_4d6ce949-1de7-41ec-87ab-3068434459a4/texts/pt_BR.lang`, including Portuguese accents and the section sign used by formatting codes. The previous audit's 116-line heuristic missed one additional recoverable value. Each changed value was reversed from the mistaken CP932 interpretation of UTF-8 bytes and verified by a lossless round trip. Translation keys, placeholders, line endings, and all other languages are preserved.

Versions: Waystone BP 8.2.5 → 8.2.6; RP 8.2.7 → 8.2.8. The BP version also changes because its existing RP dependency changes. Both manifests, their existing reciprocal dependencies, and both copies of the world BP/RP registrations were updated together. UUIDs and pack order are preserved.

Validation: reversible conversion of every changed value; unchanged translation keys; all 33 header/module versions and UUID dependencies consistent; root/world registration copies identical. In-game rendering has not been tested; GitHub publication does not deploy the server files.

`snapshot-files.json` remains the hash inventory of the original 2026-09-07 server snapshot at commit `09ee3dc`; it is not an inventory of the maintained files. README version rows describe the current repository versions.

# PineCD texture lightweighting — 2026-09-22

- Policy: keep existing textures at or below 512 px unchanged; downscale only textures exceeding 512 px.
- Filter: Pillow LANCZOS; PNG output with lossless compression optimization.
- Unique PineCD texture files checked: 18.
- Textures resized: 12.
- PNG total: 15.32 MiB -> 4.01 MiB (73.8% smaller).

| file | before | after | bytes before | bytes after | action |
|---|---:|---:|---:|---:|---|
| pinecd_cd_01.png | 256x256 | 256x256 | 129,162 | 129,162 | kept |
| pinecd_cd_02.png | 256x256 | 256x256 | 87,856 | 87,856 | kept |
| pinecd_cd_03.png | 256x256 | 256x256 | 139,184 | 139,184 | kept |
| pinecd_cd_04.png | 256x256 | 256x256 | 111,654 | 111,654 | kept |
| pinecd_cd_05.png | 256x256 | 256x256 | 86,672 | 86,672 | kept |
| pinecd_cd_06.png | 256x256 | 256x256 | 142,193 | 142,193 | kept |
| pinecd_cd_07.png | 1024x1024 | 512x512 | 623,878 | 149,740 | resized |
| pinecd_cd_08.png | 1024x1024 | 512x512 | 1,806,578 | 361,685 | resized |
| pinecd_cd_09.png | 1024x1024 | 512x512 | 2,067,945 | 437,644 | resized |
| pinecd_cd_10.png | 1024x1024 | 512x512 | 1,368,461 | 310,834 | resized |
| pinecd_cd_11.png | 1024x1024 | 512x512 | 969,157 | 232,644 | resized |
| pinecd_cd_12.png | 1024x1024 | 512x512 | 1,064,885 | 242,880 | resized |
| pinecd_cd_13.png | 1024x1024 | 512x512 | 1,096,314 | 261,796 | resized |
| pinecd_cd_14.png | 1024x1024 | 512x512 | 1,570,938 | 369,819 | resized |
| pinecd_cd_16.png | 1024x1024 | 512x512 | 1,522,529 | 339,249 | resized |
| pinecd_cd_17.png | 1024x1024 | 512x512 | 1,668,199 | 360,524 | resized |
| pinecd_cd_18.png | 1024x1024 | 512x512 | 818,575 | 195,345 | resized |
| pinecd_cd_19.png | 1024x1024 | 512x512 | 794,955 | 248,456 | resized |

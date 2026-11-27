# World map tiles

Run `npm run export:world-map-tiles` on Windows to export the existing relief
image to `public/world-map-tiles`. This uses Windows PowerShell and
System.Drawing without extra packages. To export a larger source, run:

```sh
npm run export:world-map-tiles -- path/to/relief.jpg public/world-map-tiles
```

The source must be an equirectangular image covering the entire world, with a
2:1 aspect ratio. Use an empty output directory when changing the source to
avoid retaining unused tiles from an earlier export.

Tiles use the relative path `{z}/{x}/{y}.jpg`. Each tile is 256 pixels square,
except partial tiles at the right or bottom edge of non-power-of-two sources.
Read each level's dimensions and grid size from `manifest.json`.

For the current 4096 x 2048 source:

| Level | Image dimensions | Grid | Tiles |
| --- | --- | --- | --- |
| 0 | 512 x 256 | 2 x 1 | 2 |
| 1 | 1024 x 512 | 4 x 2 | 8 |
| 2 | 2048 x 1024 | 8 x 4 | 32 |
| 3 | 4096 x 2048 | 16 x 8 | 128 |
| 4 | 8192 x 4096 | 32 x 16 | 512 |

Level 4 uses the same `public/world_map.jpg`, upscaled with bicubic
interpolation before cutting. It preserves the original colors and adds smaller
tile coverage, without adding detail beyond the 4096 x 2048 source.
Generate only this level and merge it into the existing manifest with:

```sh
npm run export:world-map-tiles -- public/world_map.jpg public/world-map-tiles 4
```

The optional fourth argument selects one level (0–6) and preserves other tiles.
The default export stops at the source resolution; run the command above again
after a full export to restore the additional level.

The origin is the northwest corner (-180 longitude, +90 latitude); x increases
eastward and y increases southward. At a level with dimensions W x H, convert
longitude and latitude to source pixels using:

```text
pixelX = (longitude + 180) / 360 * W
pixelY = (90 - latitude) / 180 * H
tileX = min(columns - 1, floor(pixelX / 256))
tileY = min(rows - 1, floor(pixelY / 256))
```

These are equirectangular tiles matching WorldMap.vue's D3 projection, not
Web Mercator tiles. Exported levels do not correspond directly to D3's zoom
factor. A renderer should choose the smallest level whose image width covers
the projected world width multiplied by the D3 zoom factor and device pixel
ratio, capped at the highest available level.

WorldMap.vue renders visible tiles using useWorldMapTiles. It selects levels
using zoom and device pixel ratio, loads up to six tiles concurrently, and keeps
up to 96 decoded tiles in an LRU cache (or the visible working set if larger).
Low-resolution tiles cover the map while
the selected level loads. The original JPEG is loaded only if the manifest or a
tile fails. Requests are cleaned up when the component unmounts.

Tiles allow loading only visible regions; they cannot add detail beyond the source image's resolution.
Use a higher-resolution source and export again to improve deep zoom detail.

`InteractWorldMap` defaults to `tileMode="player"`: loaded target-level tiles
are drawn fully opaque with a thin white border fading out over 350 ms, without glow.
Visible columns are staggered from left to right over 200 ms. The 1 CSS pixel border stays
constant while zooming. Lower-resolution terrain stays visible while loading. The effect
starts on first visible draw and restarts when the target level changes, even
for cached tiles. Panning within the same level does not restart completed
fades. The lowest level renders immediately; reduced-motion preferences disable
the transition.
The admin fishing-area view explicitly uses `tileMode="admin"`, disabling fades
and drawing a diagnostic overlay after fog: blue base tiles, green loaded target
tiles, amber loading target tiles, and red failed target tiles, labeled `z/x/y`.
The header reports target level, drawn/visible target count, failures, D3 zoom,
and DPR. These counts describe the current viewport, not all pending requests.
`WorldMap` itself defaults to `tileMode="none"` for other consumers.

`InteractWorldMap.vue` renders the entry popup through `FishingAreaPopup.vue`,
passing the area, preview scene, entry loading state, and feature availability.
The popup emits close and enter events; selection, navigation, and entry checks
remain in `InteractWorldMap.vue`.

FishingAnchor, FishingAreaPopup, and FishingView share
`FishingModeBadge` to identify each area's mode: Survival when `survivalMode`
is true, otherwise Depth when `allowDepthTool` is true, otherwise Random.
The area repository includes both flags. Catalog snapshots from older RPCs
that omit either flag are completed through the area repository, and cached
area DTOs without both boolean flags are rejected and reloaded.

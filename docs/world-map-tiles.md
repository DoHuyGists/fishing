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

FishingAnchor, the WorldMap entry popup, and FishingView share
`FishingModeBadge` to identify each area's mode: Survival when `survivalMode`
is true, otherwise Depth when `allowDepthTool` is true, otherwise Random.
The area repository includes both flags. Catalog snapshots from older RPCs
that omit either flag are completed through the area repository, and cached
area DTOs without both boolean flags are rejected and reloaded.

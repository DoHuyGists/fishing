import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.resolve(root, process.argv[2] ?? 'public/world_map.jpg');
const output = path.resolve(root, process.argv[3] ?? 'public/world-map-tiles');
const selectedZoom = process.argv[4] === undefined ? null : Number(process.argv[4]);
if (selectedZoom !== null && (!Number.isInteger(selectedZoom) || selectedZoom < 0 || selectedZoom > 6)) {
  throw new Error('Expected an integer zoom level between 0 and 6.');
}
const existing = selectedZoom === null ? null : JSON.parse(await readFile(path.join(output, 'manifest.json'), 'utf8'));
if (existing && (existing.projection !== 'equirectangular' || existing.tileSize !== 256 || existing.template !== '{z}/{x}/{y}.jpg')) {
  throw new Error('Existing tile manifest is incompatible.');
}

if (process.platform !== 'win32') {
  throw new Error('This exporter requires Windows PowerShell and System.Drawing.');
}

// Keep image processing local, without adding a runtime or package dependency.
// Environment variables carry paths without interpolating them into shell code.
const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$source = [System.Drawing.Image]::FromFile($env:WORLD_MAP_TILE_SOURCE)
try {
  if ($source.Width -ne 2 * $source.Height -or $source.Height -lt 256) {
    throw 'Expected a 2:1 equirectangular image at least 512 x 256 pixels.'
  }
  $maxZoom = [int][Math]::Ceiling([Math]::Log($source.Height / 256, 2))
  $startZoom = 0
  if ($env:WORLD_MAP_TILE_ZOOM -ne '') {
    $startZoom = [int]$env:WORLD_MAP_TILE_ZOOM
    $maxZoom = $startZoom
  }
  $encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
    Where-Object { $_.MimeType -eq 'image/jpeg' }
  $parameters = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $parameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
    [System.Drawing.Imaging.Encoder]::Quality, [long]92)
  $levels = @()
  try {
    for ($z = $startZoom; $z -le $maxZoom; $z++) {
      # The last level preserves every source pixel, including non-power-of-two images.
      $height = [int][Math]::Min(256 * [Math]::Pow(2, $z), $source.Height)
      # Explicit levels may upscale the original relief before cutting tiles.
      if ($env:WORLD_MAP_TILE_ZOOM -ne '') { $height = [int](256 * [Math]::Pow(2, $z)) }
      $width = 2 * $height
      $columns = [int][Math]::Ceiling($width / 256)
      $rows = [int][Math]::Ceiling($height / 256)
      $level = New-Object System.Drawing.Bitmap($width, $height)
      try {
        $graphics = [System.Drawing.Graphics]::FromImage($level)
        try {
          $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
          $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
          $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
          $graphics.DrawImage($source, 0, 0, $width, $height)
        } finally { $graphics.Dispose() }
        for ($x = 0; $x -lt $columns; $x++) {
          $directory = [System.IO.Path]::Combine($env:WORLD_MAP_TILE_OUTPUT, "$z", "$x")
          [void][System.IO.Directory]::CreateDirectory($directory)
          for ($y = 0; $y -lt $rows; $y++) {
            $rectangle = New-Object System.Drawing.Rectangle(
              ($x * 256), ($y * 256),
              ([Math]::Min(256, $width - $x * 256)),
              ([Math]::Min(256, $height - $y * 256)))
            $tile = $level.Clone($rectangle, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
            try {
              $tile.Save([System.IO.Path]::Combine($directory, "$y.jpg"), $encoder, $parameters)
            } finally { $tile.Dispose() }
          }
        }
        $levels += @{ zoom = $z; width = $width; height = $height; columns = $columns; rows = $rows }
      } finally { $level.Dispose() }
    }
  } finally { $parameters.Dispose() }
  @{
    version = 1
    projection = 'equirectangular'
    bounds = @(-180, -90, 180, 90)
    origin = 'top-left'
    tileSize = 256
    format = 'jpg'
    template = '{z}/{x}/{y}.jpg'
    minZoom = 0
    maxZoom = $maxZoom
    source = @{ width = $source.Width; height = $source.Height }
    levels = $levels
  } | ConvertTo-Json -Depth 5 -Compress
} finally { $source.Dispose() }
`], {
  env: { ...process.env, WORLD_MAP_TILE_SOURCE: source, WORLD_MAP_TILE_OUTPUT: output, WORLD_MAP_TILE_ZOOM: selectedZoom === null ? '' : String(selectedZoom) },
  encoding: 'utf8',
  windowsHide: true,
});

if (result.error) throw result.error;
if (result.status !== 0) throw new Error(result.stderr || 'Tile export failed.');

const manifest = JSON.parse(result.stdout.trim());
if (existing) {
  manifest.levels = [...existing.levels.filter(level => level.zoom !== selectedZoom), ...manifest.levels].sort((a, b) => a.width - b.width);
  manifest.minZoom = Math.min(...manifest.levels.map(level => level.zoom));
  manifest.maxZoom = Math.max(...manifest.levels.map(level => level.zoom));
}
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
const count = manifest.levels.reduce((total, level) => total + level.columns * level.rows, 0);
console.log(`Exported ${count} tiles across ${manifest.levels.length} levels to ${output}`);

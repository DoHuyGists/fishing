import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

// Re-encode the existing game art; keep originals available to gameplay.
const root = new URL('../', import.meta.url);
const executablePath = process.env.HOME_BROWSER ?? [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium',
].find(existsSync);
if (!executablePath) throw new Error('Set HOME_BROWSER to an installed Chromium browser.');

const assets = [
  ['lobby_bg.png', 'harbor', 1600],
  ['lobby_bg.png', 'harbor-small', 800],
  ...['dawn', 'day', 'dusk', 'night'].map(phase => [`tutorial/new-player-fishing/scene/${phase}.png`, phase, 1200]),
  ...[['Carp', 'carp'], ['Silver-Carp', 'silver-carp'], ['Catfish', 'catfish'], ['Grouper', 'grouper'], ['Tuna', 'tuna'], ['Mackerel', 'mackerel']].map(([source, name]) => [`fish/VN/${source}.png`, name, 480]),
];

await mkdir(new URL('public/home/', root), { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage();
  let originalBytes = 0;
  let optimizedBytes = 0;
  for (const [source, name, maxWidth] of assets) {
    const input = await readFile(new URL(`public/${source}`, root));
    const output = await page.evaluate(async ({ encoded, maxWidth }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${encoded}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(maxWidth, image.naturalWidth);
      canvas.height = Math.round(image.naturalHeight * canvas.width / image.naturalWidth);
      const context = canvas.getContext('2d');
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/webp', 0.82).split(',')[1];
    }, { encoded: input.toString('base64'), maxWidth });
    const binary = Buffer.from(output, 'base64');
    const destination = new URL(`public/home/${name}.webp`, root);
    await writeFile(destination, binary);
    originalBytes += input.length;
    optimizedBytes += binary.length;
    console.log(`${fileURLToPath(destination)}: ${Math.round(binary.length / 1024)} KiB`);
  }
  console.log(`Total: ${Math.round(originalBytes / 1024)} -> ${Math.round(optimizedBytes / 1024)} KiB`);
} finally {
  await browser.close();
}

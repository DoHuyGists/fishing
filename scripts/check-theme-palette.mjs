import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { THEME_COLORS, normalizeThemeColor } from '../src/utils/themePalette.ts';

const allowed = new Set(Object.values(THEME_COLORS));
assert.equal(allowed.size, 10, 'The project must have exactly ten source colors');
const theme = readFileSync('src/styles/theme.css', 'utf8');
const declarations = new Map([...theme.matchAll(/--color-([\w-]+):\s*(#[\da-f]+);/gi)].map(match => [match[1], match[2]]));
assert.deepEqual(Object.fromEntries(declarations), THEME_COLORS, 'CSS and Canvas palettes must match');
assert.match(theme, /--color-\*:\s*initial;/, 'Disable Tailwind default color families');
const definedTokens = new Set([...theme.matchAll(/--color-([\w-]+):/g)].map(match => match[1]));
const failures = [];
const seen = new Set();

function walk(directory, extensions) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? walk(file, extensions) : extensions.test(file) ? [file] : [];
  });
}
function record(file, source, offset, message) {
  failures.push(`${file}:${source.slice(0, offset).split('\n').length}: ${message}`);
}
function inspect(file, compiled = false) {
  const bytes = readFileSync(file);
  const source = bytes.toString('utf8');
  if (!compiled && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) failures.push(`${file}: UTF-8 BOM is not allowed`);
  if (file.endsWith('.svg') && !/<svg\b[^>]*\bfill=/.test(source)) failures.push(`${file}: Set an explicit palette fill so the SVG cannot default to browser black`);
  for (const match of source.matchAll(/#([\da-f]{8}|[\da-f]{6}|[\da-f]{4}|[\da-f]{3})(?![\w-])/gi)) {
    let value = match[1].toLowerCase();
    if (value.length <= 4) value = [...value].map(channel => channel + channel).join('');
    if (value.length === 8 && value.slice(6) === '00') continue;
    const base = '#' + value.slice(0, 6);
    seen.add(base);
    if (!allowed.has(base)) record(file, source, match.index, `Color outside palette: ${match[0]}`);
  }
  for (const match of source.matchAll(/rgba?\(\s*(\d+(?:\.\d+)?)[, _]+(\d+(?:\.\d+)?)[, _]+(\d+(?:\.\d+)?)/gi)) {
    const base = '#' + match.slice(1).map(channel => Math.round(Number(channel)).toString(16).padStart(2, '0')).join('');
    seen.add(base);
    if (!allowed.has(base)) record(file, source, match.index, `RGB outside palette: ${match[0]}`);
  }
  if (compiled) return;
  for (const match of source.matchAll(/\b(?:bg|text|border(?:-[xytrblse])?|ring(?:-offset)?|from|via|to|fill|stroke|divide|outline|decoration|accent|caret|shadow|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)\b/g)) record(file, source, match.index, `Default Tailwind color: ${match[0]}`);
  for (const match of source.matchAll(/(?:var\(--color-|(?:bg|text|border|ring|from|via|to|fill|stroke)-)palette-[\da-f]+/gi)) record(file, source, match.index, `Legacy palette token: ${match[0]}`);
  for (const match of source.matchAll(/var\(--color-([\w-]+)\)/g)) if (!definedTokens.has(match[1])) record(file, source, match.index, `Undefined color token: ${match[1]}`);
  for (const match of source.matchAll(/\b(?:hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(/g)) record(file, source, match.index, `Use a palette token instead of ${match[0]}`);
}

const files = [...walk('src', /\.(?:vue|css|ts|svg)$/), ...walk('public', /\.svg$/), 'index.html'];
for (const file of files) inspect(file);
if (process.argv.includes('--dist')) for (const file of walk('dist', /\.(?:css|svg|html)$/)) inspect(file, true);

for (const value of allowed) assert.equal(normalizeThemeColor(value), value);
for (const value of ['#aabbcc', '#123', 'rgb(250, 180, 10)', 'rgba(5, 120, 90, 0.4)', 'invalid']) {
  assert.ok(allowed.has(normalizeThemeColor(value)), `Stored color must normalize to the palette: ${value}`);
}
assert.equal(normalizeThemeColor('var(--color-primary)'), THEME_COLORS.primary);
assert.deepEqual([...seen].sort(), [...allowed].sort(), 'Only the ten approved source colors may be used');
assert.deepEqual(failures, [], failures.join('\n'));
console.log(`Palette check passed: ${files.length} source files, exactly 10 source colors${process.argv.includes('--dist') ? ', production CSS/SVG checked' : ''}.`);

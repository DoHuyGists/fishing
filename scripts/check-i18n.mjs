import assert from 'node:assert/strict';
import fs from 'node:fs';
import { baseCompile } from '@intlify/message-compiler';

function flatten(value, prefix = '') {
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
    const name = prefix ? `${prefix}.${key}` : key;
    return typeof item === 'string' ? [[name, item]] : Object.entries(flatten(item, name));
  }));
}
const catalogs = {};
for (const locale of ['vi', 'en']) {
  const file = `src/i18n/locales/${locale}.json`;
  const source = fs.readFileSync(file, 'utf8');
  assert.notEqual(source.charCodeAt(0), 0xfeff, `${file}: unexpected BOM`);
  catalogs[locale] = flatten(JSON.parse(source));
  for (const [key, message] of Object.entries(catalogs[locale])) {
    assert.ok(message.trim(), `${locale}.${key}: empty translation`);
    baseCompile(message, { onError(error) { throw new Error(`${locale}.${key}: ${error.message}`); } });
  }
}
assert.deepEqual(Object.keys(catalogs.en).sort(), Object.keys(catalogs.vi).sort(), 'Locale keys must match');
for (const key of Object.keys(catalogs.vi)) {
  const params = value => [...new Set(value.match(/\{value\d+\}/g) || [])].sort();
  assert.deepEqual(params(catalogs.en[key]), params(catalogs.vi[key]), `${key}: interpolation parameters must match`);
}
let files = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = `${dir}/${entry.name}`;
    if (entry.isDirectory()) { walk(file); continue; }
    if (!/\.(vue|ts)$/.test(file)) continue;
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/(?:\btr|\$t)\(['"]([^'"]+)['"]/g)) {
      assert.ok(Object.hasOwn(catalogs.vi, match[1]), `${file}: missing translation ${match[1]}`);
    }
    files++;
  }
}
walk('src');
console.log(`Validated ${Object.keys(catalogs.vi).length} translations per locale and references in ${files} source files.`);

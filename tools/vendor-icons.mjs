#!/usr/bin/env node
// Vendors setting-icon artwork into docs/_assets/icons.json from a pre-fetched source file.
//   node tools/vendor-icons.mjs [--catalog ../winhance/extras/docs-export/catalog.json] [--source <path>] [--out docs/_assets/icons.json]
// Exits 1 (without writing) if any catalog icon identity is missing from the source.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const DEFAULT_CATALOG = resolve(here, '..', '..', 'winhance', 'extras', 'docs-export', 'catalog.json');
const DEFAULT_SOURCE = '/tmp/claude-1000/-home-mdp/79ffb703-5c81-4363-bba7-79ff783d52b7/scratchpad/icon-sources/icons.json';
const DEFAULT_OUT = resolve(here, '..', 'docs', '_assets', 'icons.json');

function iconIdentities(catalog) {
  const ids = new Set();
  for (const feature of catalog.features) {
    for (const setting of feature.settings) {
      if (setting.icon) ids.add(`${setting.icon.pack}/${setting.icon.name}`);
    }
  }
  return [...ids].sort();
}

export function vendorIcons({ catalog, source }) {
  const wanted = iconIdentities(catalog);
  const wantedSet = new Set(wanted);
  const icons = {};
  const missing = [];
  for (const key of wanted) {
    const entry = source.icons[key];
    if (entry) icons[key] = { viewBox: entry.viewBox, path: entry.path };
    else missing.push(key);
  }
  const unused = Object.keys(source.icons).filter((k) => !wantedSet.has(k)).sort();
  return { icons, meta: source._meta, missing, unused };
}

function main() {
  const { values } = parseArgs({ options: {
    catalog: { type: 'string' },
    source: { type: 'string' },
    out: { type: 'string' },
  } });
  const catalogPath = resolve(values.catalog ?? DEFAULT_CATALOG);
  const sourcePath = resolve(values.source ?? DEFAULT_SOURCE);
  const outPath = resolve(values.out ?? DEFAULT_OUT);

  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
  const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
  const { icons, meta, missing, unused } = vendorIcons({ catalog, source });

  console.log(`resolved ${Object.keys(icons).length}, missing ${missing.length}, unused ${unused.length}`);
  if (missing.length) {
    console.error(`missing ${missing.length} icon(s), not writing ${outPath}:\n  ${missing.join('\n  ')}`);
    process.exit(1);
  }

  writeFileSync(outPath, JSON.stringify({ _meta: meta, icons }, null, 2) + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

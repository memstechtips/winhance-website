#!/usr/bin/env node
// Copies named settings out of Winhance's real catalog export into tools/fixtures/catalog.sample.json.
//   node tools/cut-fixture.mjs <settingId>... [--catalog ../winhance/extras/docs-export/catalog.json]
// An id already in the fixture is refreshed in place; a new one is appended to its feature, creating the
// feature wrapper if the fixture has never carried it. Everything the fixture already holds is kept, so a
// hand-cut shape that no live setting produces any more (today: the scoped notes on theme-mode-windows)
// stays as renderer coverage instead of being quietly dropped.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CATALOG = resolve(here, '..', '..', 'winhance', 'extras', 'docs-export', 'catalog.json');
const FIXTURE = resolve(here, 'fixtures', 'catalog.sample.json');

export function cutFixture(fixture, catalog, ids) {
  // Walked in export order, not argument order, so a feature's settings keep the order the app lists them
  // in -- render-page groups by first appearance, so a shuffled cut would invent a group order.
  const wanted = new Set(ids);
  const seen = new Set();
  for (const feature of catalog.features) {
    for (const setting of feature.settings) {
      if (!wanted.has(setting.id)) continue;
      seen.add(setting.id);
      let target = fixture.features.find((f) => f.id === feature.id);
      if (!target) {
        target = { id: feature.id, settings: [] };
        fixture.features.push(target);
      }
      const at = target.settings.findIndex((s) => s.id === setting.id);
      if (at === -1) target.settings.push(setting);
      else target.settings[at] = setting;
    }
  }
  const missing = ids.filter((id) => !seen.has(id));
  if (missing.length) throw new Error(`not in the export: ${missing.join(', ')}`);
  fixture.winhanceVersion = catalog.winhanceVersion;
  fixture.settingCount = fixture.features.reduce((n, f) => n + f.settings.length, 0);
  return fixture;
}

function main() {
  const { values, positionals } = parseArgs({ options: { catalog: { type: 'string' } }, allowPositionals: true });
  if (positionals.length === 0) throw new Error('name at least one setting id to cut');
  const catalogPath = values.catalog ? resolve(values.catalog) : DEFAULT_CATALOG;
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
  const fixture = cutFixture(JSON.parse(readFileSync(FIXTURE, 'utf8')), catalog, positionals);
  // The export is CRLF and this repo is LF, so the fixture is re-serialised rather than spliced. Two
  // spaces and no trailing newline is byte-for-byte what the hand-cut fixture already is, which keeps a
  // cut's diff down to the settings it added.
  writeFileSync(FIXTURE, JSON.stringify(fixture, null, 2));
  console.log(`fixture now holds ${fixture.settingCount} setting(s) across ${fixture.features.length} feature(s)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();

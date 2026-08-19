#!/usr/bin/env node
// Renders the winhance.net setting docs from Winhance's catalog export.
//   node tools/gen-docs.mjs [--catalog ../winhance/extras/docs-export/catalog.json] [--site docs] [--check]
// --check renders in memory and exits 1 listing files that differ from what is on disk.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { loadPages, renderFeaturePage, renderHubPage } from './lib/render-page.mjs';
import { searchEntries, searchEntriesJs, spliceBetweenMarkers, docsConfigBlock, versionToIsoDate, renderSitemap } from './lib/site-meta.mjs';
import { themeCss } from './lib/theme-css.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CATALOG = resolve(here, '..', '..', 'winhance', 'extras', 'docs-export', 'catalog.json');
const DEFAULT_SITE = resolve(here, '..', 'docs');
const START = '// @generated:start docs-gen';
const END = '// @generated:end docs-gen';

function hasBlurb(entry) {
  if (typeof entry === 'string') return entry.length > 0;
  if (entry && typeof entry === 'object') return Boolean(entry.blurb);
  return false;
}

export function generate({ catalogPath, siteDir, warn = () => {}, themePath = join(dirname(catalogPath), 'theme.json') }) {
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
  if (catalog.schemaVersion !== 1) throw new Error(`unsupported export schemaVersion ${catalog.schemaVersion}`);
  const pages = loadPages(JSON.parse(readFileSync(join(siteDir, '_pages.json'), 'utf8')));
  const template = readFileSync(join(siteDir, '_templates', 'page.html'), 'utf8');

  const contents = {};
  for (const f of pages.features) contents[f.id] = readContent(siteDir, basename(f.path, '.html'));
  for (const key of Object.keys(pages.areas)) contents[key] = readContent(siteDir, key);

  const pageByFeature = Object.fromEntries(pages.features.map((f) => [f.id, f]));
  for (const f of catalog.features) if (!pageByFeature[f.id]) throw new Error(`no page mapped for feature ${f.id} in _pages.json`);

  const all = catalog.features.flatMap((f) => f.settings);
  const pageOfSetting = new Map();
  for (const f of catalog.features) for (const s of f.settings) pageOfSetting.set(s.id, pageByFeature[f.id].path);
  const childrenOf = new Map();
  for (const s of all) if (s.uiParentId) childrenOf.set(s.uiParentId, [...(childrenOf.get(s.uiParentId) ?? []), s]);

  const out = new Map();
  const counts = {};
  for (const feature of catalog.features) {
    const page = pageByFeature[feature.id];
    counts[feature.id] = feature.settings.length;
    const content = contents[feature.id];
    const groups = new Set(feature.settings.map((s) => s.group ?? 'General'));
    for (const g of groups) if (!hasBlurb(content.groups?.[g])) warn(`${page.path}: group "${g}" has no blurb`);
    for (const g of Object.keys(content.groups ?? {})) if (!groups.has(g)) warn(`${page.path}: blurb for "${g}" matches no group`);
    const ctx = {
      childrenOf,
      urlFor: (id) => {
        const target = pageOfSetting.get(id);
        if (!target) return null;
        return target === page.path ? `#${id}` : `${relative(page.path, target)}#${id}`;
      },
    };
    out.set(page.path, renderFeaturePage({ page, feature, content, template, ctx, pages }));
  }
  for (const [key, area] of Object.entries(pages.areas)) {
    out.set(area.path, renderHubPage({ area, areaKey: key, pages, counts, content: contents[key], template }));
  }

  const searchPath = join(siteDir, 'js', 'docs-search.js');
  out.set('js/docs-search.js', spliceBetweenMarkers(readFileSync(searchPath, 'utf8'), START, END, searchEntriesJs(searchEntries({ pages, catalog, contents }))));
  const configPath = join(siteDir, 'js', 'docs-config.js');
  out.set('js/docs-config.js', spliceBetweenMarkers(readFileSync(configPath, 'utf8'), START, END, docsConfigBlock(catalog.winhanceVersion)));
  const sitemapPath = join(siteDir, 'sitemap.xml');
  out.set('sitemap.xml', renderSitemap({ existing: existsSync(sitemapPath) ? readFileSync(sitemapPath, 'utf8') : '', pages, isoDate: versionToIsoDate(catalog.winhanceVersion) }));
  if (existsSync(themePath)) out.set('css/app-tokens.css', themeCss(JSON.parse(readFileSync(themePath, 'utf8'))));
  return out;
}

function readContent(siteDir, name) {
  const p = join(siteDir, '_content', `${name}.json`);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { intro: [], groups: {} };
}

function relative(fromPath, toPath) {
  const up = fromPath.split('/').length - 1;
  return '../'.repeat(up) + toPath;
}

function main() {
  const { values } = parseArgs({ options: { catalog: { type: 'string' }, site: { type: 'string' }, theme: { type: 'string' }, check: { type: 'boolean' } } });
  const catalogPath = resolve(values.catalog ?? DEFAULT_CATALOG);
  const siteDir = resolve(values.site ?? DEFAULT_SITE);
  const themePath = resolve(values.theme ?? join(dirname(catalogPath), 'theme.json'));
  const warnings = [];
  const out = generate({ catalogPath, siteDir, themePath, warn: (w) => warnings.push(w) });
  const changed = [];
  for (const [rel, text] of out) {
    const p = join(siteDir, rel);
    const current = existsSync(p) ? readFileSync(p, 'utf8') : null;
    if (current === text) continue;
    changed.push(rel);
    if (!values.check) writeFileSync(p, text);
  }
  for (const w of warnings) console.warn(`warn: ${w}`);
  if (values.check) {
    if (changed.length) {
      console.error(`docs are out of date (${changed.length} file(s)):\n  ${changed.join('\n  ')}`);
      process.exit(1);
    }
    console.log('docs are up to date');
    return;
  }
  console.log(changed.length ? `wrote ${changed.length} file(s):\n  ${changed.join('\n  ')}` : 'nothing changed');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

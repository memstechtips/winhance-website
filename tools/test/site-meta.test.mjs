import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { searchEntries, spliceBetweenMarkers, docsConfigBlock, versionToLongDate, versionToIsoDate, renderSitemap } from '../lib/site-meta.mjs';
import { loadPages } from '../lib/render-page.mjs';

const pages = loadPages(JSON.parse(readFileSync(new URL('../../docs/_pages.json', import.meta.url), 'utf8')));
const catalog = JSON.parse(readFileSync(new URL('../fixtures/catalog.sample.json', import.meta.url), 'utf8'));

test('version dates', () => {
  assert.equal(versionToLongDate('26.08.19'), 'Aug 19, 2026');
  assert.equal(versionToIsoDate('26.08.19'), '2026-08-19');
  assert.throws(() => versionToIsoDate('1.2'));
});

test('spliceBetweenMarkers replaces only the inside and keeps the markers', () => {
  const src = 'a\n// @generated:start x\nOLD\n// @generated:end x\nb';
  assert.equal(spliceBetweenMarkers(src, '// @generated:start x', '// @generated:end x', 'NEW'), 'a\n// @generated:start x\nNEW\n// @generated:end x\nb');
  assert.throws(() => spliceBetweenMarkers('no markers', '// s', '// e'));
});

test('search entries: one per generated page plus one per setting with page#id urls', () => {
  const entries = searchEntries({ pages, catalog, contents: {} });
  const sound = entries.find((e) => e.url === 'features/optimizations/sound.html');
  assert.ok(sound);
  assert.equal(sound.category, 'Optimizations');
  assert.ok(sound.sections.includes('System Sounds'));
  const startup = entries.find((e) => e.url === 'features/optimizations/sound.html#sound-startup');
  assert.equal(startup.title, 'Startup Sound During Boot');
  assert.ok(startup.keywords.includes('sound-startup'));
  assert.ok(entries.some((e) => e.url === 'features/optimize.html'));
  // every setting in the catalog gets an entry
  const settingCount = catalog.features.flatMap((f) => f.settings).length;
  assert.equal(entries.filter((e) => e.url.includes('#')).length, settingCount);
});

test('docsConfigBlock stamps version and dates', () => {
  const block = docsConfigBlock('26.08.19');
  assert.match(block, /version: 'Docs v26\.08\.19'/);
  assert.match(block, /lastUpdated: 'Aug 19, 2026'/);
  assert.match(block, /winhanceVersion: 'v26\.08\.19'/);
  assert.match(block, /githubReleasesUrl/);
});

test('renderSitemap keeps hand-page lastmod and stamps generated pages', () => {
  const existing = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>https://winhance.net/docs/guides/wimutil.html</loc><lastmod>2026-01-10</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>\n<url><loc>https://winhance.net/docs/features/optimizations/sound.html</loc><lastmod>2026-01-01</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>\n</urlset>`;
  const xml = renderSitemap({ existing, pages, isoDate: '2026-08-19' });
  assert.match(xml, /<loc>https:\/\/winhance\.net\/docs\/guides\/wimutil\.html<\/loc>\s*<lastmod>2026-01-10<\/lastmod>/);
  assert.match(xml, /<loc>https:\/\/winhance\.net\/docs\/features\/optimizations\/sound\.html<\/loc>\s*<lastmod>2026-08-19<\/lastmod>/);
  assert.match(xml, /<loc>https:\/\/winhance\.net\/docs\/features\/customizations\/explorer\.html<\/loc>/);
  assert.equal((xml.match(/<url>/g) ?? []).length, 1 + 12);
});

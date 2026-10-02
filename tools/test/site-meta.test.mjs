import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { searchEntries, staticSearchEntry, spliceBetweenMarkers, versionToLongDate, versionToIsoDate, renderSitemap } from '../lib/site-meta.mjs';
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
  const answerFile = entries.find((e) => e.url === 'features/autounattend/answer-file.html');
  assert.equal(answerFile.category, 'Autounattend');
  assert.ok(answerFile.sections.includes('Processor architecture'));
  // every setting in the catalog gets an entry
  const settingCount = catalog.features.flatMap((f) => f.settings).length;
  assert.equal(entries.filter((e) => e.url.includes('#')).length, settingCount);
});

test('a hand-written page is searchable by its own title, h2s and lead', () => {
  const body = '<h1>Install &amp; update</h1>\n<p class="lead">Get it running.</p>\n<h2 id="a">First <code>step</code></h2>\n<pre><code>irm x | iex</code></pre>';
  const e = staticSearchEntry({ path: 'getting-started/installation.html', label: 'Installation', group: 'Get started' }, body);
  assert.equal(e.title, 'Install & update');
  assert.equal(e.category, 'Get started');
  assert.deepEqual(e.sections, ['First step']);
  assert.match(e.content, /^Get it running\./);
  assert.doesNotMatch(e.content, /iex/); // code blocks stay out of the snippet text
});

test('renderSitemap lists the docs home by its folder URL and stamps hand pages it is given', () => {
  const xml = renderSitemap({ existing: '', pages, statics: ['index.html', 'guides/wimutil.html'], isoDate: '2026-08-19' });
  assert.match(xml, /<loc>https:\/\/winhance\.net\/docs\/<\/loc>\s*<lastmod>2026-08-19<\/lastmod>/);
  assert.doesNotMatch(xml, /docs\/index\.html/);
  assert.match(xml, /<loc>https:\/\/winhance\.net\/docs\/guides\/wimutil\.html<\/loc>\s*<lastmod>2026-08-19<\/lastmod>/);
});

test('renderSitemap keeps hand-page lastmod and stamps generated pages', () => {
  const existing = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>https://winhance.net/docs/guides/wimutil.html</loc><lastmod>2026-01-10</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>\n<url><loc>https://winhance.net/docs/features/optimizations/sound.html</loc><lastmod>2026-01-01</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>\n</urlset>`;
  const xml = renderSitemap({ existing, pages, isoDate: '2026-08-19' });
  assert.match(xml, /<loc>https:\/\/winhance\.net\/docs\/guides\/wimutil\.html<\/loc>\s*<lastmod>2026-01-10<\/lastmod>/);
  assert.match(xml, /<loc>https:\/\/winhance\.net\/docs\/features\/optimizations\/sound\.html<\/loc>\s*<lastmod>2026-08-19<\/lastmod>/);
  assert.match(xml, /<loc>https:\/\/winhance\.net\/docs\/features\/customizations\/explorer\.html<\/loc>/);
  assert.match(xml, /<loc>https:\/\/winhance\.net\/docs\/features\/autounattend\/answer-file\.html<\/loc>/);
  // 15 generated pages (12 feature pages and 3 area hubs), plus the one hand page the existing sitemap
  // carried that _pages.json knows nothing about.
  assert.equal((xml.match(/<url>/g) ?? []).length, 1 + 15);
});

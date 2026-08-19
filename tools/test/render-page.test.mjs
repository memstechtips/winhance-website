import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadPages, fillTemplate, sidebarSubNav, renderFeaturePage, renderHubPage, rootFor } from '../lib/render-page.mjs';

const pages = loadPages(JSON.parse(readFileSync(new URL('../../docs/_pages.json', import.meta.url), 'utf8')));
const template = readFileSync(new URL('../../docs/_templates/page.html', import.meta.url), 'utf8');
const fixture = JSON.parse(readFileSync(new URL('../fixtures/catalog.sample.json', import.meta.url), 'utf8'));
const sound = fixture.features.find((f) => f.id === 'Sound');
const power = fixture.features.find((f) => f.id === 'Power');
const all = fixture.features.flatMap((f) => f.settings);
const childrenOf = new Map();
for (const s of all) if (s.uiParentId) childrenOf.set(s.uiParentId, [...(childrenOf.get(s.uiParentId) ?? []), s]);
const ctx = { childrenOf, urlFor: () => null };

test('rootFor computes the relative prefix from the page depth', () => {
  assert.equal(rootFor('features/optimizations/sound.html'), '../../');
  assert.equal(rootFor('features/optimize.html'), '../');
  assert.equal(rootFor('index.html'), './');
});

test('fillTemplate replaces every placeholder and leaves none behind', () => {
  const html = fillTemplate(template, { title: 'T', root: '../../', content: '<p>x</p>', sidebarOptimize: '<a>o</a>', sidebarCustomize: '<a>c</a>' });
  assert.match(html, /<title>T - Winhance Docs<\/title>/);
  assert.match(html, /src="\.\.\/\.\.\/\.\.\/images\/winhance-rocket\.png"/);
  assert.doesNotMatch(html, /\{\{\w+\}\}/);
  assert.match(html, /docs-wip-banner/);
});

test('sidebarSubNav lists the area pages in _pages order with the root prefix', () => {
  const html = sidebarSubNav(pages, 'optimize', '../../');
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(hrefs, pages.features.filter((f) => f.area === 'optimize').map((f) => '../../' + f.path));
  assert.match(html, /sidebar-nav-item sub-item">Privacy &amp; Security</);
});

test('feature page groups cards under h2 with slug ids and blurbs, children not duplicated', () => {
  const content = { video: { id: 'abc123', start: 10 }, intro: ['<p>Intro.</p>'], groups: { 'System Sounds': 'Control sounds.' } };
  const page = pages.features.find((f) => f.id === 'Sound');
  const html = renderFeaturePage({ page, area: pages.areas.optimize, feature: sound, content, template, ctx, pages });
  assert.match(html, /<h1>Sound Optimizations<\/h1>/);
  assert.match(html, /youtube-nocookie\.com\/embed\/abc123\?start=10/);
  assert.match(html, /<p>Intro\.<\/p>/);
  assert.match(html, /<h2 id="system-sounds">System Sounds<\/h2>\s*<p>Control sounds\.<\/p>/);
  assert.match(html, /id="sound-startup"/);
  assert.match(html, /Technical Details<\/div>/); // the standard callout title
});

test('feature page group callout html renders after the blurb and before the setting cards', () => {
  const content = {
    video: { id: 'abc123', start: 10 },
    intro: ['<p>Intro.</p>'],
    groups: {
      'System Sounds': {
        blurb: 'Control sounds.',
        html: ['<div class="callout callout-tip"><div class="callout-title">T</div><p>Body</p></div>'],
      },
    },
  };
  const page = pages.features.find((f) => f.id === 'Sound');
  const html = renderFeaturePage({ page, area: pages.areas.optimize, feature: sound, content, template, ctx, pages });
  assert.match(html, /<h2 id="system-sounds">System Sounds<\/h2>\s*<p>Control sounds\.<\/p>\s*<div class="callout callout-tip">/);
  const calloutIndex = html.indexOf('callout-tip');
  const cardIndex = html.indexOf('id="sound-startup"');
  assert.ok(calloutIndex > -1 && cardIndex > -1 && calloutIndex < cardIndex);
});

test('feature page: ungrouped settings fall under General, grouped order follows first appearance', () => {
  const page = pages.features.find((f) => f.id === 'Power');
  const html = renderFeaturePage({ page, area: pages.areas.optimize, feature: power, content: { intro: [], groups: {} }, template, ctx, pages });
  const h2s = [...html.matchAll(/<h2 id="[^"]+">([^<]+)<\/h2>/g)].map((m) => m[1]);
  const expected = [];
  for (const s of power.settings) if (!s.uiParentId) { const g = s.group ?? 'General'; if (!expected.includes(g)) expected.push(g); }
  assert.deepEqual(h2s, expected);
  const kids = childrenOf.get('power-hibernation-enable') ?? [];
  for (const k of kids) assert.equal((html.match(new RegExp(`id="${k.id}"`, 'g')) ?? []).length, 1);
});

test('hub page lists the area pages with counts', () => {
  const html = renderHubPage({ area: pages.areas.optimize, areaKey: 'optimize', pages, counts: { Sound: 7, Power: 48 }, content: { intro: ['<p>Hub intro.</p>'], outro: ['<div class="callout">x</div>'] }, template });
  assert.match(html, /<h1>Optimizations<\/h1>/);
  assert.match(html, /<a href="optimizations\/sound\.html" class="feature-card">/);
  assert.match(html, /7 settings/);
  assert.match(html, /<p>Hub intro\.<\/p>[\s\S]*features-grid[\s\S]*<div class="callout">x<\/div>/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadPages, fillTemplate, navList, sidebarHtml, breadcrumbHtml, pagerHtml, tocHtml, renderFeaturePage, renderHubPage, renderStaticPage, rootFor, expandDemo } from '../lib/render-page.mjs';

const pages = loadPages(JSON.parse(readFileSync(new URL('../../docs/_pages.json', import.meta.url), 'utf8')));
const template = readFileSync(new URL('../../docs/_templates/page.html', import.meta.url), 'utf8');
const fixture = JSON.parse(readFileSync(new URL('../fixtures/catalog.sample.json', import.meta.url), 'utf8'));
const sound = fixture.features.find((f) => f.id === 'Sound');
const power = fixture.features.find((f) => f.id === 'Power');
const all = fixture.features.flatMap((f) => f.settings);
const childrenOf = new Map();
for (const s of all) if (s.uiParentId) childrenOf.set(s.uiParentId, [...(childrenOf.get(s.uiParentId) ?? []), s]);
const ctx = { childrenOf, urlFor: () => null, version: '26.10.01' };
const shellValues = { title: 'T', description: 'D', root: '../../', version: 'v26.10.01', sidebar: '<a>s</a>', breadcrumb: '', pager: '', toc: '', demoHead: '', demoScripts: '' };

test('rootFor computes the relative prefix from the page depth', () => {
  assert.equal(rootFor('features/optimizations/sound.html'), '../../');
  assert.equal(rootFor('features/optimize.html'), '../');
  assert.equal(rootFor('index.html'), './');
});

test('fillTemplate replaces every placeholder and leaves none behind', () => {
  const html = fillTemplate(template, { ...shellValues, content: '<p>x</p>' });
  assert.match(html, /<title>T - Winhance Docs<\/title>/);
  assert.match(html, /src="\.\.\/\.\.\/\.\.\/images\/winhance-rocket\.png"/);
  assert.doesNotMatch(html, /\{\{\w+\}\}/);
  assert.doesNotMatch(html, /docs-wip-banner/); // the "work in progress" banner is gone
  assert.match(html, /<meta name="description" content="D">/);
});

test('fillTemplate does not choke on literal {{...}} text inside injected content', () => {
  const html = fillTemplate(template, { ...shellValues, content: "<pre><code>$t = '{{dohtemplate}}';</code></pre>" });
  assert.match(html, /\{\{dohtemplate\}\}/);
});

test('fillTemplate does not let special replacement patterns in content ($&, $`, $\') corrupt the output', () => {
  const content = "<pre><code>$f -replace'\\.exe$', '.old.exe'</code></pre>";
  const html = fillTemplate(template, { ...shellValues, content });
  assert.ok(html.includes(content));
  assert.doesNotMatch(html, /\{\{content\}\}/);
});

test('fillTemplate still throws when the template shell itself has an unfilled placeholder', () => {
  const badTemplate = '<html>{{title}}{{root}}{{sidebar}}{{content}}{{oops}}</html>';
  assert.throws(
    () => fillTemplate(badTemplate, { ...shellValues, root: './', content: 'x' }),
    /template placeholder not filled: \{\{oops\}\}/
  );
});

test('the sidebar lists each area hub followed by its pages in _pages order, and marks the current page', () => {
  const html = sidebarHtml(pages, 'features/optimizations/sound.html', '../../');
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  const at = hrefs.indexOf('../../features/optimize.html');
  assert.ok(at >= 0);
  assert.deepEqual(hrefs.slice(at + 1, at + 1 + pages.features.filter((f) => f.area === 'optimize').length),
    pages.features.filter((f) => f.area === 'optimize').map((f) => '../../' + f.path));
  assert.match(html, /<a class="nav-item nav-sub" href="\.\.\/\.\.\/features\/optimizations\/sound\.html" aria-current="page">Sound<\/a>/);
  assert.equal((html.match(/aria-current/g) ?? []).length, 1);
});

test('breadcrumb, pager and toc follow the nav order and the page headings', () => {
  const list = navList(pages);
  const i = list.findIndex((x) => x.path === 'features/optimizations/sound.html');
  const pager = pagerHtml(pages, list[i].path, '../../');
  assert.match(pager, new RegExp(`href="\\.\\./\\.\\./${list[i - 1].path.replace(/[./]/g, (c) => '\\' + c)}"`));
  assert.match(pager, /class="pager-next"/);
  assert.match(breadcrumbHtml(pages, list[i].path, '../../'), /Features<\/span>.*href="\.\.\/\.\.\/features\/optimize\.html">Optimize</);
  assert.equal(breadcrumbHtml(pages, 'index.html', './'), '');
  assert.match(tocHtml('<h2 id="a">A</h2><p>x</p><h2 id="b">B <code>c</code></h2>'), /href="#a">A<.*href="#b">B c</s);
  assert.equal(tocHtml('<h2 id="a">Only one</h2>'), '');
});

test('a hand-written page takes its title from its h1 and its description from its lead', () => {
  const body = '<h1>Quick start</h1>\n<p class="lead">From first launch to <strong>first change</strong>.</p>\n<h2 id="one">One</h2><h2 id="two">Two</h2>';
  const html = renderStaticPage({ path: 'getting-started/quick-start.html', body, template, pages, version: '26.10.01' });
  assert.match(html, /<title>Quick start - Winhance Docs<\/title>/);
  assert.match(html, /<meta name="description" content="From first launch to first change\.">/);
  assert.match(html, /These docs describe Winhance v26\.10\.01/);
  assert.match(html, /aria-current="page">Quick start</);
  assert.throws(() => renderStaticPage({ path: 'x.html', body: '<p>no title</p>', template, pages }), /no <h1>/);
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
  assert.match(html, /Technical Details<\/p>/); // the standard callout title
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
  assert.match(html, /<a href="optimizations\/sound\.html" class="link-card">/);
  assert.match(html, /7 settings/);
  assert.match(html, /<p>Hub intro\.<\/p>[\s\S]*link-grid[\s\S]*<div class="callout">x<\/div>/);
});

// --- the third area: Autounattend ---

test('the sidebar lists the third area, and the shell fills it on every page', () => {
  const html = sidebarHtml(pages, 'features/autounattend/answer-file.html', '../../');
  assert.match(html, /nav-sub" href="\.\.\/\.\.\/features\/autounattend\/answer-file\.html" aria-current="page">Answer file</);
  const page = pages.features.find((f) => f.id === 'Autounattend');
  const feature = fixture.features.find((f) => f.id === 'Autounattend');
  const rendered = renderFeaturePage({ page, feature, content: { intro: [], groups: {} }, template, ctx, pages });
  const aside = rendered.match(/<aside[\s\S]*?<\/aside>/)[0];
  assert.doesNotMatch(aside, /undefined|\{\{/);
  assert.match(aside, /href="\.\.\/\.\.\/features\/autounattend\/answer-file\.html"/);
  assert.match(aside, /href="\.\.\/\.\.\/features\/customizations\/time-region-language\.html"/);
});

test('hub page renders the third area with its own feature card', () => {
  const html = renderHubPage({ area: pages.areas.autounattend, areaKey: 'autounattend', pages, counts: { Autounattend: 15 }, content: {}, template });
  assert.match(html, /<h1>Autounattend<\/h1>/);
  assert.match(html, /<a href="autounattend\/answer-file\.html" class="link-card">/);
  assert.match(html, /15 settings/);
});

// --- the live demo ---

test('a demo marker becomes the landing page window, locked to its page, and loads the demo scripts once', () => {
  const body = '<h1>Software &amp; Apps</h1>\n<p class="lead">Apps.</p>\n<div class="app-demo" data-page="SoftwareApps" data-tab="external"></div>';
  const html = renderStaticPage({ path: 'features/software-apps/external-apps.html', body, template, pages, version: '26.10.01' });
  assert.match(html, /<div id="winhance-demo" class="wd-host stage-window" data-page="SoftwareApps" data-tab="external" data-focus="This demo shows the Software &amp; Apps page"/);
  assert.match(html, /<div class="readout" id="readout"/);
  assert.match(html, /<link rel="stylesheet" href="\.\.\/\.\.\/\.\.\/demo\/winhance-demo\.css">/);
  assert.equal(html.match(/<script src="\.\.\/\.\.\/\.\.\/demo\/(app|winhance-demo|readout)\.js"><\/script>/g).length, 3);
  assert.ok(html.indexOf('demo/readout.js') < html.indexOf('js/docs.js'));
});

test('a page without a marker loads none of the demo, and data-full drops the lock', () => {
  const plain = renderStaticPage({ path: 'reference/cli-commands.html', body: '<h1>CLI</h1>', template, pages, version: '26.10.01' });
  assert.doesNotMatch(plain, /demo\/|winhance-demo/);
  assert.doesNotMatch(expandDemo('<div class="app-demo" data-page="Optimize" data-full></div>'), /data-focus/);
});

test('every generated settings page opens the demo on its own feature', () => {
  const page = pages.features.find((f) => f.id === 'Sound');
  const html = renderFeaturePage({ page, feature: sound, content: { intro: [], groups: {} }, template, ctx, pages });
  assert.match(html, /id="winhance-demo"[^>]* data-page="Optimize" data-feature="Sound" data-focus=/);
});

test('a demo marker with an unknown page, or two on one page, is an error', () => {
  assert.throws(() => expandDemo('<div class="app-demo" data-page="Nope"></div>'), /unknown data-page/);
  assert.throws(() => expandDemo('<div class="app-demo" data-page="Optimize"></div><div class="app-demo" data-page="Customize"></div>'), /once/);
});

test('a dialog still needs the demo on its page, since the demo scripts draw it', () => {
  assert.throws(() => renderStaticPage({ path: 'reference/cli-commands.html', body: '<h1>CLI</h1><div data-wd-dialog="remove"></div>', template, pages, version: '26.10.01' }), /needs an app-demo/);
  const ok = renderStaticPage({ path: 'features/software-apps/windows-apps.html', body: '<h1>W</h1><div class="app-demo" data-page="SoftwareApps"></div><div data-wd-dialog="remove"></div>', template, pages, version: '26.10.01' });
  assert.match(ok, /data-wd-dialog="remove"/);
});

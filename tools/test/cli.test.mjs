import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { generate } from '../gen-docs.mjs';

const here = new URL('.', import.meta.url).pathname;
const repo = join(here, '..', '..');
const fixture = join(here, '..', 'fixtures', 'catalog.sample.json');
// M10: gen-docs now fails closed on a missing theme.json rather than silently omitting app-tokens.css
// and every pill icon, so every generate() call below needs an explicit theme fixture -- the default
// (a theme.json next to catalog.sample.json) deliberately doesn't exist.
const themeFixture = join(here, '..', 'fixtures', 'theme.sample.json');

function scratchSite() {
  const dir = mkdtempSync(join(tmpdir(), 'docs-gen-'));
  cpSync(join(repo, 'docs'), join(dir, 'docs'), { recursive: true });
  return join(dir, 'docs');
}

test('generate renders every mapped page that has catalog data plus the side files', () => {
  const out = generate({ catalogPath: fixture, siteDir: join(repo, 'docs'), themePath: themeFixture });
  assert.ok(out.has('features/optimizations/sound.html'));
  assert.ok(out.has('features/optimize.html'));
  assert.ok(out.has('features/customize.html'));
  assert.ok(out.has('js/docs-search.js'));
  assert.ok(out.has('js/docs-config.js'));
  assert.ok(out.has('sitemap.xml'));
  assert.match(out.get('js/docs-config.js'), /winhanceVersion: 'v\d\d\.\d\d\.\d\d'/);
  assert.match(out.get('js/docs-search.js'), /"url":"features\/optimizations\/sound\.html#sound-startup"/);
});

test('generate is idempotent', () => {
  const a = generate({ catalogPath: fixture, siteDir: join(repo, 'docs'), themePath: themeFixture });
  const b = generate({ catalogPath: fixture, siteDir: join(repo, 'docs'), themePath: themeFixture });
  assert.deepEqual([...a.entries()], [...b.entries()]);
});

test('generate fails when a catalog feature has no page mapping', () => {
  const site = scratchSite();
  const pages = JSON.parse(readFileSync(join(site, '_pages.json'), 'utf8'));
  pages.features = pages.features.filter((f) => f.id !== 'Sound');
  writeFileSync(join(site, '_pages.json'), JSON.stringify(pages));
  assert.throws(() => generate({ catalogPath: fixture, siteDir: site, themePath: themeFixture }), /no page mapped for feature Sound/);
});

test('--check exits 1 when outputs differ and 0 after a write', () => {
  const site = scratchSite();
  const cli = join(repo, 'tools', 'gen-docs.mjs');
  let code = 0;
  try { execFileSync('node', [cli, '--catalog', fixture, '--site', site, '--theme', themeFixture, '--check'], { stdio: 'pipe' }); } catch (e) { code = e.status; }
  assert.equal(code, 1);
  execFileSync('node', [cli, '--catalog', fixture, '--site', site, '--theme', themeFixture], { stdio: 'pipe' });
  execFileSync('node', [cli, '--catalog', fixture, '--site', site, '--theme', themeFixture, '--check'], { stdio: 'pipe' });
  assert.ok(existsSync(join(site, 'features', 'optimizations', 'sound.html')));
});

test('generate throws when theme.json is missing rather than silently dropping pill icons and app-tokens.css', () => {
  assert.throws(() => generate({ catalogPath: fixture, siteDir: join(repo, 'docs'), themePath: join(here, 'nope-theme.json') }), /theme\.json not found/);
});

test('generate throws when icons.json is missing rather than silently dropping icon glyphs', () => {
  const site = scratchSite();
  const iconsPath = join(site, '_assets', 'icons.json');
  writeFileSync(iconsPath + '.bak', readFileSync(iconsPath));
  rmSync(iconsPath);
  try {
    assert.throws(() => generate({ catalogPath: fixture, siteDir: site, themePath: themeFixture }), /icons\.json not found/);
  } finally {
    writeFileSync(iconsPath, readFileSync(iconsPath + '.bak'));
    rmSync(iconsPath + '.bak');
  }
});

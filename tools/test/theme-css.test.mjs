import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cssVarName, themeCss, geometries } from '../lib/theme-css.mjs';
import { generate } from '../gen-docs.mjs';

const here = new URL('.', import.meta.url).pathname;
const repo = join(here, '..', '..');
const fixturePath = join(here, '..', 'fixtures', 'theme.sample.json');
const theme = JSON.parse(readFileSync(fixturePath, 'utf8'));

// --- cssVarName naming rule ---

test('cssVarName splits a plain PascalCase key at word boundaries', () => {
  assert.equal(cssVarName('BadgeRecommendedBackground'), '--app-badge-recommended-background');
});

test('cssVarName lowercases dotted-path segments without re-splitting them', () => {
  assert.equal(cssVarName('TechDetail.Table.HeaderBand'), '--app-techdetail-table-headerband');
  assert.equal(cssVarName('TechDetail.Table.StrokeBrush'), '--app-techdetail-table-strokebrush');
});

// --- themeCss shape ---

test('themeCss emits a :root block and a [data-theme="dark"] block', () => {
  const css = themeCss(theme);
  assert.match(css, /:root\s*\{/);
  assert.match(css, /\[data-theme="dark"\]\s*\{/);
});

test('themeCss says it is generated and how to regenerate it', () => {
  const css = themeCss(theme);
  assert.match(css, /generated/i);
  assert.match(css, /node tools\/gen-docs\.mjs/);
});

test('a literal colour setter converts XAML #AARRGGBB to CSS #RRGGBBAA (alpha FF dropped)', () => {
  const css = themeCss(theme);
  // TechDetail.CodeBlock.PowerShell Background: "#FF0D1117" (alpha FF -> dropped)
  assert.match(css, /--app-techdetail-codeblock-powershell-background:\s*#0d1117;/);
});

test('a theme colour token with real alpha keeps it as an 8-digit #RRGGBBAA', () => {
  const css = themeCss(theme);
  // themes.light.BadgeRecommendedBackground: "#221A7F37" -> RRGGBBAA reorder
  assert.match(css, /--app-badge-recommended-background:\s*#1a7f3722;/);
});

test('a {ThemeResource X} setter referencing a WinUI system token emits var(--winui-x)', () => {
  const css = themeCss(theme);
  // TechDetail.Table.HeaderBand Background: "{ThemeResource SubtleFillColorSecondaryBrush}"
  assert.match(css, /--app-techdetail-table-headerband-background:\s*var\(--winui-subtle-fill-color-secondary\);/);
});

test('a {ThemeResource X} setter referencing the accent role emits the accent var, not a mechanical one', () => {
  const css = themeCss(theme);
  // TechDetail.ChipLinkText Foreground: "{ThemeResource AccentTextFillColorPrimaryBrush}"
  assert.match(css, /--app-techdetail-chiplinktext-foreground:\s*var\(--winui-accent-text-primary\);/);
});

test('an alias resolves to a per-theme var(--winui-...) mapping', () => {
  const css = themeCss(theme);
  const root = css.slice(0, css.indexOf('[data-theme="dark"]'));
  const dark = css.slice(css.indexOf('[data-theme="dark"]'));
  assert.match(root, /--app-techdetail-table-strokebrush:\s*var\(--winui-card-stroke-color-default\);/);
  assert.match(dark, /--app-techdetail-table-strokebrush:\s*var\(--winui-control-stroke-color-default\);/);
});

test('a setter referencing an alias key resolves to the alias var, not the winui var directly', () => {
  const css = themeCss(theme);
  // TechDetail.Table.HeaderBand BorderBrush: "{ThemeResource TechDetail.Table.StrokeBrush}"
  assert.match(css, /--app-techdetail-table-headerband-border-brush:\s*var\(--app-techdetail-table-strokebrush\);/);
});

test('Padding "12,4" (H,V) converts to CSS "4px 12px" (T R shorthand order)', () => {
  const css = themeCss(theme);
  assert.match(css, /--app-techdetail-table-headerband-padding:\s*4px 12px;/);
});

test('four-part Padding "7,0,9,0" (L,T,R,B) converts to CSS "0 9px 0 7px"', () => {
  const css = themeCss(theme);
  assert.match(css, /--app-badge-pill-base-padding:\s*0 9px 0 7px;/);
});

test('four-part BorderThickness "3,0,0,0" (L,T,R,B) converts to CSS "0 0 0 3px"', () => {
  const css = themeCss(theme);
  assert.match(css, /--app-techdetail-codeblock-powershell-border-thickness:\s*0 0 0 3px;/);
});

test('MinHeight "32" converts to "32px"', () => {
  const css = themeCss(theme);
  assert.match(css, /--app-techdetail-table-headerband-min-height:\s*32px;/);
});

test('CornerRadius "10" converts to "10px"', () => {
  const css = themeCss(theme);
  assert.match(css, /--app-badge-pill-base-corner-radius:\s*10px;/);
});

test('a comma-separated non-numeric value (FontFamily) passes through verbatim', () => {
  const css = themeCss(theme);
  assert.match(css, /--app-techdetail-codetext-font-family:\s*Consolas,Cascadia Code,Courier New;/);
});

test('a plain non-numeric, non-reference value (VerticalAlignment) passes through verbatim', () => {
  const css = themeCss(theme);
  assert.match(css, /--app-badge-pill-base-vertical-alignment:\s*Center;/);
});

test('a BasedOn style inherits the base style\'s setters, base first, unless overridden', () => {
  const css = themeCss(theme);
  const declOrder = [...css.matchAll(/--app-badge-recommended-style-([a-z-]+):/g)].map((m) => m[1]);
  assert.deepEqual(declOrder, ['height', 'corner-radius', 'padding', 'vertical-alignment', 'border-thickness', 'background', 'border-brush']);
  assert.match(css, /--app-badge-recommended-style-height:\s*20px;/);
  assert.match(css, /--app-badge-recommended-style-background:\s*var\(--app-badge-recommended-background\);/);
});

test('a style based on a derived style inherits through the whole chain', () => {
  const css = themeCss(theme);
  // TechDetail.ChipLinkText is BasedOn TechDetail.ChipText
  assert.match(css, /--app-techdetail-chiplinktext-font-size:\s*10px;/);
});

test('themeCss is byte-stable across repeated calls', () => {
  assert.equal(themeCss(theme), themeCss(theme));
});

// --- geometries() ---

test('geometries returns the three pill geometries with their viewBox', () => {
  const g = geometries(theme);
  assert.equal(g.BadgeRecommendedIconPath.viewBox, 12);
  assert.equal(g.BadgeDefaultIconPath.viewBox, 11);
  assert.match(g.BadgeRecommendedIconPath.data, /^M/);
});

// --- CLI wiring ---

test('generate() adds css/app-tokens.css when a theme path is given', () => {
  const out = generate({ catalogPath: join(repo, 'tools', 'fixtures', 'catalog.sample.json'), siteDir: join(repo, 'docs'), themePath: fixturePath });
  assert.ok(out.has('css/app-tokens.css'));
  assert.equal(out.get('css/app-tokens.css'), themeCss(theme));
});

test('generate() omits css/app-tokens.css when no theme.json is found', () => {
  const out = generate({ catalogPath: join(repo, 'tools', 'fixtures', 'catalog.sample.json'), siteDir: join(repo, 'docs') });
  assert.ok(!out.has('css/app-tokens.css'));
});

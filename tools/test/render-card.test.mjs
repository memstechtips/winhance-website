import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderMatrix, renderCard, cardBadges } from '../lib/render-card.mjs';
import { geometries } from '../lib/theme-css.mjs';
import { esc } from '../lib/html.mjs';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/catalog.sample.json', import.meta.url), 'utf8'));
const theme = JSON.parse(readFileSync(new URL('../fixtures/theme.sample.json', import.meta.url), 'utf8'));
const icons = JSON.parse(readFileSync(new URL('../../docs/_assets/icons.json', import.meta.url), 'utf8')).icons;
const geo = geometries(theme);

const all = fixture.features.flatMap((f) => f.settings);
const byId = Object.fromEntries(all.map((s) => [s.id, s]));
const childrenOf = new Map();
for (const s of all) if (s.uiParentId) childrenOf.set(s.uiParentId, [...(childrenOf.get(s.uiParentId) ?? []), s]);
const ctx = { childrenOf, icons, geometries: geo, urlFor: (id) => (byId[id] ? `#${id}` : null) };

function rows(html, cls) {
  return [...html.matchAll(new RegExp(`<tr class="${cls}"[^>]*>`, 'g'))];
}

test('thead has exactly the three app header rows, in order', () => {
  const html = renderMatrix(byId['sound-startup'].matrix, { geometries: geo });
  assert.equal((html.match(/<tr class="mx-row-mechanism">/g) ?? []).length, 1);
  assert.equal((html.match(/<tr class="mx-row-paths">/g) ?? []).length, 1);
  assert.equal((html.match(/<tr class="mx-row-columns">/g) ?? []).length, 1);
  const thead = html.match(/<thead>([\s\S]*?)<\/thead>/)[1];
  assert.equal((thead.match(/<tr/g) ?? []).length, 3);
  const order = [...thead.matchAll(/<tr class="(mx-row-\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(order, ['mx-row-mechanism', 'mx-row-paths', 'mx-row-columns']);
});

test('the setting cell spans both frozen columns over both header rows', () => {
  const html = renderMatrix(byId['sound-startup'].matrix, { geometries: geo });
  assert.match(html, /<th class="mx-setting" colspan="2" rowspan="2">/);
  assert.match(html, /<span class="mx-group-label">Options<\/span>/);
});

test('column-header row leads with the Option/Role captions from the export', () => {
  const m = byId['sound-startup'].matrix;
  const html = renderMatrix(m, { geometries: geo });
  const columnsRow = html.match(/<tr class="mx-row-columns">([\s\S]*?)<\/tr>/)[1];
  assert.match(columnsRow, new RegExp(`^<th class="mx-h-option" scope="col">${esc(m.optionHeader)}</th><th class="mx-h-role" scope="col">${esc(m.roleHeader)}</th>`));
});

test('two adjacent same-kind groups share one mechanism-row band but keep separate path bands', () => {
  // sound-startup: two Registry groups, adjacent, same kind -> ConsecutiveByKind merges them into
  // ONE mx-group header (colspan 2), but AddGroupHeaders' path loop is per-group, not per-run, so the
  // path row still shows each group's own (different) registry hive separately.
  const html = renderMatrix(byId['sound-startup'].matrix, { geometries: geo });
  assert.equal((html.match(/<th class="mx-group" colspan="2" rowspan="1">/g) ?? []).length, 1);
  assert.equal((html.match(/<th class="mx-paths" colspan="1">/g) ?? []).length, 2);
  assert.match(html, /<span class="mx-caption">Path<\/span><code class="mx-path" title="HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion\\Authentication\\LogonUI\\BootAnimation">HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Authentication\\LogonUI\\BootAnimation<\/code>/);
  assert.match(html, /<code class="mx-name">DisableStartupSound<\/code>/);
  assert.match(html, /<span class="mx-caption">Value type<\/span><code class="mx-type">DWord<\/code>/);
});

test('a both-roles option carries exactly two pills in the role cell and none in the option cell', () => {
  const m = byId['security-uac-level'].matrix;
  const html = renderMatrix(m, { geometries: geo });
  const rowMatch = html.match(/<tr><th class="mx-option"[^]*?Notify when apps try to make changes<\/code><\/th>([^]*?)<\/tr>/);
  assert.ok(rowMatch, 'security-uac-level must carry the both-roles option row');
  const [optionCellHtml] = html.match(/<th class="mx-option"[^]*?<\/th>/g).filter((c) => c.includes('Notify when apps try to make changes<'));
  assert.doesNotMatch(optionCellHtml, /mx-pill/);
  const roleCellHtml = html.match(/Notify when apps try to make changes<\/code><\/th><td class="mx-role">([^]*?)<\/td>/)[1];
  assert.equal((roleCellHtml.match(/class="mx-pill mx-pill-(recommended|default)"/g) ?? []).length, 2);
  assert.match(roleCellHtml, /mx-pill-recommended/);
  assert.match(roleCellHtml, /mx-pill-default/);
});

test('pills carry the app icon geometry, its viewBox, and the qualified label', () => {
  const m = byId['security-uac-level'].matrix;
  const html = renderMatrix(m, { geometries: geo });
  assert.match(html, new RegExp(`<svg viewBox="0 0 ${geo.BadgeRecommendedIconPath.viewBox} ${geo.BadgeRecommendedIconPath.viewBox}" width="12" height="12"[^>]*><path d="${geo.BadgeRecommendedIconPath.data.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" fill="currentColor"/></svg>`));
  assert.match(html, new RegExp(`<svg viewBox="0 0 ${geo.BadgeDefaultIconPath.viewBox} ${geo.BadgeDefaultIconPath.viewBox}"`));
  assert.match(html, /<span class="mx-pill-label">Recommended<\/span>/);
  assert.match(html, /<span class="mx-pill-label">Default<\/span>/);
});

test('no is-current, current marker, or reading output anywhere in a card', () => {
  const html = renderCard(byId['security-uac-level'], ctx);
  assert.doesNotMatch(html, /is-current/);
  assert.doesNotMatch(html, /mx-empty-reading/);
  assert.doesNotMatch(html, /mx-reading/);
  assert.doesNotMatch(html, /CheckmarkCircle/);
  // the 21px marker gutter is kept for label alignment, but stays empty
  assert.match(html, /<span class="mx-gutter"><\/span>/);
});

test('no <details> anywhere in a rendered card -- the panel is always visible', () => {
  const html = renderCard(byId['sound-startup'], ctx);
  assert.doesNotMatch(html, /<details/);
  assert.doesNotMatch(html, /<summary/);
});

test('notes render as rows inside tbody, after the option rows, split label/detail by column count', () => {
  const s = byId['taskbar-clean'];
  const m = s.matrix;
  assert.ok(m.hasNotes && m.notes.length > 0, 'fixture must carry taskbar-clean notes');
  const html = renderMatrix(m, { geometries: geo });
  const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/)[1];
  assert.match(tbody, /<tr class="mx-notes-head">/);
  assert.equal((tbody.match(/<tr class="mx-note">/g) ?? []).length, m.notes.length);
  const lastOptionIndex = tbody.lastIndexOf('<tr><th class="mx-option"');
  const notesHeadIndex = tbody.indexOf('<tr class="mx-notes-head">');
  assert.ok(lastOptionIndex < notesHeadIndex, 'notes must follow every option row');
  assert.match(tbody, new RegExp(`<tr class="mx-notes-head"><th colspan="2" scope="col">${esc(m.notesHeading)}</th><th colspan="1" scope="col">${esc(m.notesDetailHeader)}</th></tr>`));
  const firstNote = m.notes[0];
  assert.match(tbody, new RegExp(`<th colspan="2" scope="row"><span class="mx-note-label">${esc(firstNote.label)}</span></th><td colspan="1">${esc(firstNote.detail)}</td>`));
});

test('code blocks render inside .mx-box but after .mx-scroll closes, one heading band per distinct heading', () => {
  const s = byId['system-restore-protection'];
  assert.ok(s.matrix.codeBlocks.length > 1, 'fixture must carry more than one system-restore-protection code block');
  const html = renderMatrix(s.matrix, { geometries: geo });
  const boxOpen = html.indexOf('<div class="mx-box mx-has-code"');
  const scrollClose = html.indexOf('</div>\n</div>'); // .mx-scroll then its own wrapper close, immediately before the code host
  const codeHostIndex = html.indexOf('<div class="mx-code-host">');
  const boxClose = html.lastIndexOf('</div>');
  assert.ok(boxOpen >= 0 && codeHostIndex > boxOpen, 'code host must be inside .mx-box');
  assert.ok(codeHostIndex > scrollClose, 'code host must come after .mx-scroll closes');
  assert.ok(codeHostIndex < boxClose, 'code host must close before .mx-box does');
  assert.equal((html.match(/<div class="mx-code-heading">/g) ?? []).length, 1);
  assert.equal((html.match(/<div class="mx-code-separator">/g) ?? []).length, 1);
  assert.equal((html.match(/<div class="mx-code-label">/g) ?? []).length, 2);
  assert.equal((html.match(/<pre class="mx-code-body mx-code-powershell">/g) ?? []).length, 2);
  assert.doesNotMatch(html, /<pre class="mx-code-body mx-code-powershell"><code>[^<]*<(?!\/code>)/);
});

test('null matrix renders the power-plan note instead of a table', () => {
  assert.match(renderMatrix(null), /<p class="mx-empty">/);
});

test('the setting icon renders as an inline svg with the app icon geometry', () => {
  const html = renderCard(byId['sound-startup'], ctx);
  const art = icons['Material/MonitorSpeaker'];
  assert.ok(art, 'icons.json must carry Material/MonitorSpeaker');
  assert.match(html, new RegExp(`<span class="setting-icon"><svg viewBox="${art.viewBox}" width="20" height="20"[^>]*><path d="${art.path.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
});

test('--mx-option-w is set inline on .mx-box from the longest option label', () => {
  const m = byId['sound-communication-ducking'].matrix;
  const longest = Math.max(...m.options.map((o) => o.label.length));
  const html = renderMatrix(m, { geometries: geo });
  assert.match(html, new RegExp(`<div class="mx-box" style="--mx-option-w: calc\\(45px \\+ ${longest}ch\\)">`));
});

test('twin win10/win11 matrices each render their own box under a build heading', () => {
  const soloCtx = { childrenOf: new Map(), icons, geometries: geo, urlFor: ctx.urlFor };
  const html = renderCard(byId['theme-mode-windows'], soloCtx);
  assert.match(html, /<h4 class="mx-build">Windows 11<\/h4>/);
  assert.match(html, /<h4 class="mx-build">Windows 10<\/h4>/);
  assert.equal((html.match(/<table class="mx-grid">/g) ?? []).length, 2);
});

test('requirement chips render inside the mechanism cell, not as card badges', () => {
  const s = byId['theme-mode-windows'];
  const link = s.matrix.requirements.find((c) => c.linkSettingId && byId[c.linkSettingId]);
  assert.ok(link, 'fixture must carry a linked requirement chip on theme-mode-windows');
  const html = renderCard(s, ctx);
  const settingCellHtml = html.match(/<th class="mx-setting"[^]*?<\/th>/)[0];
  assert.match(settingCellHtml, /class="mx-chip"/);
  assert.match(settingCellHtml, new RegExp(`<a href="#${link.linkSettingId}" class="mx-chip-link">${esc(link.linkText)}</a>`));
  // The link belongs to the matrix's own mechanism cell, never duplicated into the card header badges.
  const headerBadges = html.match(/<div class="setting-badges">([\s\S]*?)<\/div>/);
  if (headerBadges) assert.doesNotMatch(headerBadges[1], /mx-chip|req/);
});

test('card badges: win11-only, laptops-only, added-in, and the preference pill with its own icon', () => {
  assert.match(cardBadges(byId['explorer-customization-context-menu']), /<span class="setting-badge win11"[^>]*>Windows 11 only<\/span>/);
  assert.match(cardBadges(byId['lid-close-action']), /<span class="setting-badge laptops"[^>]*>Laptops only<\/span>/);
  assert.match(cardBadges(byId['power-hybrid-sleep']), /<span class="setting-badge hardware"[^>]*>Hybrid sleep capable PCs<\/span>/);
  assert.match(cardBadges(byId['theme-mode-apps']), /<span class="setting-badge added"[^>]*>Added in v26\.07\.22<\/span>/);
  const pref = cardBadges(byId['sound-startup'], () => null, geo);
  assert.match(pref, /<span class="mx-pill mx-pill-preference"/);
  assert.match(pref, new RegExp(`<svg viewBox="0 0 ${geo.BadgePreferenceIconPath.viewBox} ${geo.BadgePreferenceIconPath.viewBox}"`));
  assert.doesNotMatch(pref, /setting-badge preference/);
});

test('children render nested inside the parent card', () => {
  const html = renderCard(byId['power-hibernation-enable'], ctx);
  const kids = childrenOf.get('power-hibernation-enable') ?? [];
  assert.ok(kids.length > 0, 'fixture must carry hibernation children');
  assert.match(html, /<div class="setting-children">/);
  for (const k of kids) assert.match(html, new RegExp(`<div class="setting-card setting-card-child" id="${k.id}">`));
});

test('chips whose linkSettingId resolves become links on the setting name only', () => {
  const linked = all.find((s) => s.matrix && s.matrix.columns.some((c) => c.chips.some((ch) => ch.linkSettingId && byId[ch.linkSettingId])));
  if (!linked) return;
  const html = renderMatrix(linked.matrix, { urlFor: (id) => `#${id}`, geometries: geo });
  const chip = linked.matrix.columns.flatMap((c) => c.chips).find((ch) => ch.linkSettingId && byId[ch.linkSettingId]);
  assert.match(html, new RegExp(`<a href="#${chip.linkSettingId}" class="mx-chip-link">${chip.linkText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</a>`));
});

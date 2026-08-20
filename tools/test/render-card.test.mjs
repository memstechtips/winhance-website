import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderMatrix, renderCard, cardBadges, CHAR_W, CHAR_W_SM } from '../lib/render-card.mjs';
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

// fix round 1 (finding 6): HasColumnHeaderRow is false when a matrix has neither columns nor
// options -- an Option/Role band over an empty table is a table that lost its rows.
// start-menu-clean-10 is exactly that shape (notes/requirements/code carry the whole setting).
test('a matrix with no columns and no options renders no mx-row-columns row at all', () => {
  const m = byId['start-menu-clean-10'].matrix;
  assert.equal(m.columns.length, 0);
  assert.equal(m.options.length, 0);
  const html = renderMatrix(m, { geometries: geo });
  assert.doesNotMatch(html, /<tr class="mx-row-columns">/);
  assert.doesNotMatch(html, /class="mx-h-option"/);
  assert.doesNotMatch(html, /class="mx-h-role"/);
  const thead = html.match(/<thead>([\s\S]*?)<\/thead>/)[1];
  assert.equal((thead.match(/<tr/g) ?? []).length, 2, 'only mechanism + paths rows remain');
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

test('pills carry the app icon geometry at native size, centred in a 12x12 box, with the qualified label', () => {
  // M8: the outer <svg>/viewBox stay 12x12 for EVERY pill -- stretching BadgeDefaultIconPath's 11x11
  // geometry to fill a 12x12 viewBox scaled it 9% and re-blurred the 1px pane gaps it exists to keep
  // crisp. A geometry already on a 12x12 canvas (Recommended) renders unwrapped; an 11x11 one
  // (Default, the Windows logo) is centred with a (12-11)/2 = 0.5 translate, like WinUI's PathIcon.
  const m = byId['security-uac-level'].matrix;
  const html = renderMatrix(m, { geometries: geo });
  assert.equal(geo.BadgeRecommendedIconPath.viewBox, 12);
  assert.equal(geo.BadgeDefaultIconPath.viewBox, 11);
  assert.match(html, new RegExp(`<svg viewBox="0 0 12 12" width="12" height="12"[^>]*><path d="${geo.BadgeRecommendedIconPath.data.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" fill="currentColor"/></svg>`));
  assert.match(html, new RegExp(`<svg viewBox="0 0 12 12" width="12" height="12"[^>]*><g transform="translate\\(0\\.5 0\\.5\\)"><path d="${geo.BadgeDefaultIconPath.data.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" fill="currentColor"/></g></svg>`));
  assert.doesNotMatch(html, /viewBox="0 0 11 11"/);
  assert.match(html, /<span class="mx-pill-label">Recommended<\/span>/);
  assert.match(html, /<span class="mx-pill-label">Default<\/span>/);
});

test('no is-current, current marker, or reading output anywhere in a card', () => {
  const html = renderCard(byId['security-uac-level'], ctx);
  assert.doesNotMatch(html, /is-current/);
  assert.doesNotMatch(html, /mx-empty-reading/);
  assert.doesNotMatch(html, /mx-reading/);
  assert.doesNotMatch(html, /CheckmarkCircle/);
  // no gutter either -- the app reserves 21px beside the label for the current marker; the web,
  // which never draws one, would just be reserving room for something that cannot appear.
  assert.doesNotMatch(html, /mx-gutter/);
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
  // The heading row carries the app's own GroupLabel/HeaderCaption text styles (fix round 1),
  // not bare text.
  assert.match(tbody, new RegExp(`<tr class="mx-notes-head"><th colspan="2" scope="col"><span class="mx-group-label">${esc(m.notesHeading)}</span></th><th colspan="1" scope="col"><span class="mx-caption">${esc(m.notesDetailHeader)}</span></th></tr>`));
  const firstNote = m.notes[0];
  assert.ok(!firstNote.hasScope, 'first taskbar-clean note must be scope-less for this assertion');
  assert.match(tbody, new RegExp(`<th colspan="2" scope="row"><span class="mx-note-name"><span class="mx-note-label">${esc(firstNote.label)}</span></span></th><td colspan="1">${esc(firstNote.detail)}</td>`));
});

test('a scoped note stacks its label above its scope, not side by side (AddNotes StackPanel{Spacing=1})', () => {
  const m = byId['theme-mode-windows'].matrix;
  const scoped = m.notes.find((n) => n.hasScope);
  assert.ok(scoped, 'fixture must carry a scoped theme-mode-windows note');
  const html = renderMatrix(m, { geometries: geo });
  const reEscape = (s) => esc(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(html, new RegExp(`<span class="mx-note-name"><span class="mx-note-label">${reEscape(scoped.label)}</span><span class="mx-caption">${reEscape(scoped.scope)}</span></span>`));
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

test('--mx-option-w is set inline on .mx-box from the longest option label, in var(--mx-char-w) multiples', () => {
  // fix round 1 (finding 2): `<N>ch` re-resolves per element against whatever font it inherits --
  // a <col> can't carry a font-family at all -- so the same value used to compute three different
  // pixel widths. A literal var(--mx-char-w) multiplier resolves identically everywhere.
  const m = byId['sound-communication-ducking'].matrix;
  const longest = Math.max(...m.options.map((o) => o.label.length));
  const html = renderMatrix(m, { geometries: geo });
  assert.match(html, new RegExp(`<div class="mx-box" style="--mx-option-w: calc\\(24px \\+ ${longest} \\* var\\(--mx-char-w\\)\\);`));
  assert.doesNotMatch(html, /--mx-option-w:[^;]*ch\)/);
});

test('--mx-table-w is set inline on .mx-box as the sum of every column, so table-layout: fixed has nothing left to redistribute', () => {
  // fix round 1 (finding 2, follow-on): `width: 100%` with only the option column sized left Role
  // and every data column as "auto" -- table-layout: fixed then divided the leftover space over them
  // EVENLY regardless of content, squeezing values into overlapping text. Verified live that even
  // giving every column its own width doesn't fix it while the table's own width is a percentage
  // narrower than its natural content: Chromium proportionally stretches every column, including the
  // option column, past --mx-option-w. An explicit width equal to the exact sum leaves nothing over.
  const m = byId['security-uac-level'].matrix;
  const html = renderMatrix(m, { geometries: geo });
  assert.match(html, /--mx-table-w: calc\([\d.]+px \+ \d+ \* var\(--mx-char-w\)\)"/);
  // Role and every data column but the last carry their own explicit width -- only the option column
  // uses the CSS-rule-driven var(--mx-option-w); the frozen role column still needs its own <col>
  // width or it falls into "auto" and gets divided up with the data columns.
  assert.match(html, /<col class="mx-col-role" style="width: calc\([\d.]+px \+ \d+ \* var\(--mx-char-w\)\)">/);
  const dataCols = [...html.matchAll(/<col style="width: calc\(([\d.]+)px \+ (\d+) \* var\(--mx-char-w\)\)">/g)];
  assert.equal(dataCols.length, m.columns.length - 1);
});

test("the last column is left auto so it absorbs the slack, mirroring TableLayout.StretchToViewport", () => {
  // The app grows only the last column to fill the viewport, "which keeps the earlier columns aligned
  // with their headers"; without it "a short table stops mid-card and leaves dead space beside it".
  // On the web that is .mx-grid's max(--mx-table-w, 100%) plus exactly one auto <col> to take the
  // remainder -- giving every column a width instead made Chromium share the slack proportionally and
  // pushed the option column past --mx-option-w (fix round 1's sticky-column bug).
  const html = renderMatrix(byId['security-uac-level'].matrix, { geometries: geo });
  const colgroup = html.match(/<colgroup>(.*?)<\/colgroup>/s)[1];
  const cols = [...colgroup.matchAll(/<col[^>]*>/g)].map(([c]) => c);
  assert.ok(cols.length > 2);
  for (const col of cols.slice(1, -1)) assert.match(col, /style="width: calc\(/, `${col} must carry its own width`);
  assert.equal(cols.at(-1), '<col>', 'the last column carries no width at all');
  // --mx-table-w still counts that column, so the remainder can never be narrower than its content.
  const tableW = html.match(/--mx-table-w: calc\(([\d.]+)px \+ (\d+) \* var\(--mx-char-w\)\)/);
  const sized = [...colgroup.matchAll(/width: calc\(([\d.]+)px \+ (\d+) \* var\(--mx-char-w\)\)/g)];
  const option = html.match(/--mx-option-w: calc\(([\d.]+)px \+ (\d+) \* var\(--mx-char-w\)\)/);
  const px = ([, fixed, chars]) => Number(fixed) + Number(chars) * CHAR_W;
  const accounted = px(option) + sized.reduce((sum, m) => sum + px(m), 0);
  assert.ok(px(tableW) > accounted, 'the unsized last column must still be part of --mx-table-w');
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

// --- fix round 2: charge a group's paths and the mechanism cell's requirement chips ---
// (both are `white-space: nowrap`, so unlike wrapping prose they can't absorb a narrow cell on their
// own -- table-layout: fixed (fix round 1) made the base per-column width authoritative, so anything
// nowrap that isn't charged against a column just overflows it instead of growing it the way
// table-layout: auto used to.)

// Every data column's rendered width, INCLUDING the last one -- which carries no width of its own
// (it is the auto column that absorbs the viewport slack, mirroring TableLayout.StretchToViewport),
// so its own base width is recovered from --mx-table-w minus everything that is sized.
function dataColWidths(html) {
  const px = ([, fixed, chars]) => Number(fixed) + Number(chars) * CHAR_W;
  const sized = [...html.matchAll(/<col[^>]*style="width: calc\(([\d.]+)px \+ (\d+) \* var\(--mx-char-w\)\)">/g)];
  const tableW = px(html.match(/--mx-table-w: calc\(([\d.]+)px \+ (\d+) \* var\(--mx-char-w\)\)/));
  const optionW = px(html.match(/--mx-option-w: calc\(([\d.]+)px \+ (\d+) \* var\(--mx-char-w\)\)/));
  const data = sized.slice(1).map(px); // sized[0] is the role column
  return [...data, tableW - optionW - sized.slice(0, 1).map(px)[0] - data.reduce((s, w) => s + w, 0)];
}

test('a narrow-column group with a long path widens exactly enough to fit it, each group independent of its siblings (finding A)', () => {
  const m = byId['gaming-xbox-game-dvr'].matrix;
  assert.equal(m.groups.length, 3, 'fixture must carry three single-column registry groups');
  assert.ok(m.groups.every((g) => g.columnSpan === 1), 'this case only proves per-group isolation if every group is its own column');
  const html = renderMatrix(m, { geometries: geo });
  const colWidths = dataColWidths(html);
  assert.equal(colWidths.length, 3);
  m.groups.forEach((g, i) => {
    const path = g.paths[0];
    const needed = 24 + (path.label.length + 1 + path.display.length) * CHAR_W_SM;
    assert.ok(colWidths[i] >= needed - 0.01, `column ${i} is ${colWidths[i]}px, needs >= ${needed}px for "${path.display}"`);
  });
  // The three paths are different lengths (27/54/48 chars) -- if widenForPaths pooled the deficit
  // across the whole matrix instead of per group, the three columns would come out equal instead of
  // tracking their own group's path.
  assert.notEqual(colWidths[0], colWidths[1]);
  assert.notEqual(colWidths[1], colWidths[2]);
});

test('a group whose path already fits comfortably across its wide span is left at the base width (no spurious widening)', () => {
  // security-uac-level's one registry group spans BOTH data columns -- two columns' worth of base
  // width comfortably covers its one path, so widenForPaths must find zero deficit and leave
  // dataColumnWidth's own fixed part (24px, unwidened) on both columns. (M6 bumped CHAR_W_SM from
  // 6.6 to 6.8 for real overshoot headroom, which tipped theme-mode-windows' own path -- previously
  // this test's fixture -- into genuinely needing a few px of widening; security-uac-level's shorter
  // path still has comfortable margin.)
  const m = byId['security-uac-level'].matrix;
  const html = renderMatrix(m, { geometries: geo });
  const g = m.groups.find((g) => g.hasPaths);
  assert.equal(g.columnSpan, 2, 'this case only proves the no-op path if the group spans more than one column');
  const path = g.paths[0];
  const neededPx = 24 + (path.label.length + 1 + path.display.length) * CHAR_W_SM;
  const colWidths = dataColWidths(html);
  const spanned = colWidths.slice(g.startColumn, g.startColumn + g.columnSpan);
  assert.ok(neededPx < spanned.reduce((s, w) => s + w, 0), 'fixture path must genuinely fit already, or this test proves nothing');
  // Both data columns are still on dataColumnWidth's bare 24px base -- the first shows it in its own
  // <col>; the second is the auto column, so its width comes back out of --mx-table-w, where an
  // unwidened base leaves a whole number of --mx-char-w on top of the same 24px.
  assert.equal((html.match(/<col style="width: calc\(24px \+ \d+ \* var\(--mx-char-w\)\)">/g) ?? []).length, 1);
  assert.equal(colWidths.length, 2);
  const charsOnTop = (colWidths[1] - 24) / CHAR_W;
  assert.ok(Math.abs(charsOnTop - Math.round(charsOnTop)) < 0.01,
    `the auto column's ${colWidths[1]}px is 24px + ${charsOnTop} chars -- a fractional count means widenForPaths widened it`);
});

test("a per-option warning renders as a banner naming the option that raises it", () => {
  const s = byId['start-recommended-section'];
  assert.equal(s.optionWarnings.length, 1, 'fixture must carry the Windows 11 Home warning');
  const html = renderCard(s, ctx);
  assert.match(html, /<span class="setting-banner-when">When set to Hide<\/span>/);
  assert.ok(html.includes(s.optionWarnings[0].text), 'the banner carries the app\'s own text, verbatim');
  // Above the panel, not below it -- the app's Technical Details are collapsed, the web's never are.
  assert.ok(html.indexOf('setting-banner') < html.indexOf('mx-box'));
});

test('one warning authored on several options becomes one banner naming them all', () => {
  const s = byId['gaming-connected-devices-platform-service'];
  assert.equal(s.optionWarnings.length, 2, 'fixture must carry the same text on two options');
  assert.equal(s.optionWarnings[0].text, s.optionWarnings[1].text);
  const html = renderCard(s, ctx);
  assert.equal((html.match(/setting-banner"/g) ?? []).length, 1, 'the repeated text prints once');
  assert.match(html, /When set to Disabled or Manual \(Recommended\)/);
});

test('a setting with no option warnings renders no banner', () => {
  assert.doesNotMatch(renderCard(byId['sound-startup'], ctx), /setting-banner/);
});

test('the option column is never narrower than its own "Option" heading', () => {
  // table-layout: fixed means a column sized only to its cell text clips its heading instead of
  // growing for it -- an On/Off selection's 3-character labels left "Option" printing over Role.
  const m = byId['gaming-memory-integrity'].matrix;
  const longestLabel = Math.max(...m.options.map((o) => o.label.length));
  assert.ok(longestLabel < m.optionHeader.length, 'fixture must have labels shorter than the heading');
  const html = renderMatrix(m, { geometries: geo });
  assert.match(html, new RegExp(`--mx-option-w: calc\\(24px \\+ ${m.optionHeader.length} \\* var\\(--mx-char-w\\)\\);`));
});

test("a long requirement chip widens the role column only -- the option column's sticky width never moves (finding B)", () => {
  const m = byId['gaming-memory-integrity'].matrix;
  const longestChip = m.requirements.reduce((max, c) => (c.text.length > max.length ? c.text : max), '');
  assert.ok(longestChip.length > 40, 'fixture must carry a genuinely long requirement chip');
  const html = renderMatrix(m, { geometries: geo });
  // --mx-option-w is untouched: still exactly optionColumnWidth's own formula (24px fixed + the
  // longest of the option labels and the "Option" heading), never widened by widenForChips.
  const longestOption = Math.max(m.optionHeader.length, ...m.options.map((o) => o.label.length));
  assert.match(html, new RegExp(`--mx-option-w: calc\\(24px \\+ ${longestOption} \\* var\\(--mx-char-w\\)\\);`));
  // The role column (2nd <col>) is wider than its own base formula (58px fixed) -- it absorbed the deficit.
  const roleMatch = html.match(/<col class="mx-col-role" style="width: calc\(([\d.]+)px \+ (\d+) \* var\(--mx-char-w\)\)">/);
  assert.ok(roleMatch, 'role column must carry an explicit width');
  const roleFixed = Number(roleMatch[1]);
  assert.ok(roleFixed > 58, `role column's fixed part (${roleFixed}px) must exceed the unwidened 58px base`);
  // And it's wide enough for the chip: 24px mx-setting padding + 18px chip chrome + the chip's own
  // text at the 11px rate, minus whatever the option+role base already covered.
  const neededPx = 24 + 18 + longestChip.length * CHAR_W_SM;
  const optionPx = 24 + longestOption * CHAR_W;
  const roleChars = Number(roleMatch[2]);
  const rolePx = roleFixed + roleChars * CHAR_W;
  assert.ok(optionPx + rolePx >= neededPx - 0.01, `option+role (${optionPx + rolePx}px) must cover the chip's ${neededPx}px`);
});

test('a row carrying BOTH pills sizes the role column for the pair side by side, not the longer one alone', () => {
  // AddOptionRow stacks an option's badges horizontally, so security-uac-level's "Recommended +
  // Default" row shows both pills on one line and stays 40px like every other row. Charging only the
  // longest single label left the pair to wrap onto a second line, which grew that row alone.
  const m = byId['security-uac-level'].matrix;
  const both = m.options.filter((o) => o.isRecommended && o.isWindowsDefault);
  assert.equal(both.length, 1, 'fixture must carry exactly one row that is both Recommended and the Windows default');
  const labels = [m.recommendedLabel, m.defaultLabel];
  const html = renderMatrix(m, { geometries: geo });
  // 24px cell padding + a pill's 34px of chrome each + the 4px StackPanel spacing between them.
  const expected = 24 + 34 * 2 + 4;
  const chars = labels.reduce((sum, l) => sum + l.length, 0);
  assert.match(html, new RegExp(`<col class="mx-col-role" style="width: calc\\(${expected}px \\+ ${chars} \\* var\\(--mx-char-w\\)\\)">`));
});

test('a matrix with no requirement chips leaves the role column at its base width (no spurious widening)', () => {
  const m = byId['sound-communication-ducking'].matrix;
  assert.equal(m.requirements.length, 0);
  const html = renderMatrix(m, { geometries: geo });
  const labels = ['Role'];
  for (const o of m.options) {
    if (o.isRecommended) labels.push(o.recommendedContext ? `${m.recommendedLabel} (${o.recommendedContext})` : m.recommendedLabel);
    if (o.isWindowsDefault) labels.push(o.defaultContext ? `${m.defaultLabel} (${o.defaultContext})` : m.defaultLabel);
  }
  const longest = Math.max(...labels.map((l) => l.length));
  assert.match(html, new RegExp(`<col class="mx-col-role" style="width: calc\\(58px \\+ ${longest} \\* var\\(--mx-char-w\\)\\)">`));
});

// --- whole-branch review C1: widenForNotes ---

test('a note label/heading longer than the bare option floor widens the option column when no option rows exist (C1, split shape)', () => {
  // start-menu-clean-10: 0 columns, 0 options -- AddNotes' own split rule (mirrored in noteSpans)
  // puts the note label alone in the option column, so widening role (widenForChips' own move) can't
  // reach it. Safe here specifically because a matrix this shape has no .mx-option/.mx-role anywhere.
  const m = byId['start-menu-clean-10'].matrix;
  assert.equal(m.columns.length, 0);
  assert.equal(m.options.length, 0);
  assert.ok(m.hasNotes && m.notes.length > 1, 'fixture must carry several start-menu-clean-10 notes');
  const longest = Math.max(m.notesHeading.length, ...m.notes.map((n) => n.label.length));
  assert.ok(longest > 20, 'fixture must carry a note label/heading long enough to prove the widening');
  const html = renderMatrix(m, { geometries: geo });
  const optionMatch = html.match(/--mx-option-w: calc\(([\d.]+)px \+ (\d+) \* var\(--mx-char-w\)\)/);
  assert.ok(optionMatch, '--mx-option-w must be set inline');
  const optionPx = Number(optionMatch[1]) + Number(optionMatch[2]) * CHAR_W;
  const neededPx = 24 + longest * CHAR_W;
  assert.ok(optionPx >= neededPx - 0.01, `option column is ${optionPx}px, needs >= ${neededPx}px for the longest note label/heading`);
});

test('a note label longer than the base role floor widens role only when option rows exist (C1, non-split shape)', () => {
  // taskbar-clean has real columns/options, so AddNotes spans the label over option+role together --
  // the same shape widenForChips already charges, and the fix must leave optionW exactly alone here.
  const m = byId['taskbar-clean'].matrix;
  assert.ok(m.columns.length > 0 && m.options.length > 0, 'fixture must carry both columns and options');
  assert.ok(m.hasNotes && m.notes.length > 1, 'fixture must carry several taskbar-clean notes');
  const longest = Math.max(m.notesHeading.length, ...m.notes.map((n) => n.label.length));
  const html = renderMatrix(m, { geometries: geo });
  const longestOption = Math.max(m.optionHeader.length, ...m.options.map((o) => o.label.length));
  assert.match(html, new RegExp(`--mx-option-w: calc\\(24px \\+ ${longestOption} \\* var\\(--mx-char-w\\)\\);`), 'optionW must stay untouched');
  const optionMatch = html.match(/--mx-option-w: calc\(([\d.]+)px \+ (\d+) \* var\(--mx-char-w\)\)/);
  const roleMatch = html.match(/<col class="mx-col-role" style="width: calc\(([\d.]+)px \+ (\d+) \* var\(--mx-char-w\)\)">/);
  assert.ok(roleMatch, 'role column must carry an explicit width');
  const optionPx = Number(optionMatch[1]) + Number(optionMatch[2]) * CHAR_W;
  const rolePx = Number(roleMatch[1]) + Number(roleMatch[2]) * CHAR_W;
  const neededPx = 24 + longest * CHAR_W;
  assert.ok(optionPx + rolePx >= neededPx - 0.01, `option+role (${optionPx + rolePx}px) must cover the note's ${neededPx}px`);
});

// --- whole-branch review C2: availability-gated matrix rendering ---

test('a Windows-11-only setting with a differing win10 export renders exactly one table, no build heading', () => {
  const s = byId['privacy-turn-off-copilot'];
  assert.ok(s.matrixWin10, 'fixture must carry a matrixWin10 twin for this setting');
  assert.deepEqual(s.availability.builds, [{ min: '22000.0', max: '*' }]);
  const html = renderCard(s, ctx);
  assert.equal((html.match(/<table class="mx-grid">/g) ?? []).length, 1);
  assert.doesNotMatch(html, /<h4 class="mx-build">/);
});

test('a Windows-10-only setting with a differing win11 export renders exactly one table, headed neither build (C2)', () => {
  // start-menu-clean-10's badge says "Windows 10 only" (availability blocks the win11 reference
  // build), but rendering unconditionally showed its WIN11 export -- headed "Windows 11" -- since
  // matrixWin10 exists whenever the two builds' exports differ, regardless of availability.
  const s = byId['start-menu-clean-10'];
  assert.ok(s.matrixWin10, 'fixture must carry a matrixWin10 twin for this setting');
  assert.deepEqual(s.availability.builds, [{ min: '0.0', max: '21999.2147483647' }]);
  const html = renderCard(s, ctx);
  assert.equal((html.match(/<table class="mx-grid">/g) ?? []).length, 1);
  assert.doesNotMatch(html, /<h4 class="mx-build">/);
  // The surviving table must be the WIN10 export, not the (unavailable) win11 one.
  assert.match(html, new RegExp(esc(s.matrixWin10.notes[0].label)));
});

test('a twin whose availability excludes neither reference build still renders both, headed', () => {
  const s = byId['theme-mode-windows'];
  assert.ok(s.matrixWin10, 'fixture must carry a matrixWin10 twin for this setting');
  assert.deepEqual(s.availability.builds, [], 'fixture must carry an ungated (both-builds) twin');
  // theme-mode-windows has a UI child (theme-mode-apps) with its own single table -- render solo so
  // the count below is exactly this card's own two.
  const soloCtx = { childrenOf: new Map(), icons, geometries: geo, urlFor: ctx.urlFor };
  const html = renderCard(s, soloCtx);
  assert.equal((html.match(/<table class="mx-grid">/g) ?? []).length, 2);
  assert.match(html, /<h4 class="mx-build">Windows 11<\/h4>/);
  assert.match(html, /<h4 class="mx-build">Windows 10<\/h4>/);
});

test('C2 build gating threads through renderCard via ctx.referenceBuilds, defaulting to the app export constants', () => {
  const s = byId['privacy-turn-off-copilot'];
  // An explicit reference build outside the allowed range (a pre-22000 "win11") reproduces the same
  // single-table, no-heading result the default win11=26100 constant already proves above --
  // confirms the gate reads ctx.referenceBuilds rather than a value baked in at import time.
  const html = renderCard(s, { ...ctx, referenceBuilds: { win10: 19045, win11: 19045 } });
  assert.equal((html.match(/<table class="mx-grid">/g) ?? []).length, 1);
});

// --- whole-branch review M9: pathsRow's document-order assumption ---

test('pathsRow throws if a hasPaths group is not at its own declared startColumn (M9)', () => {
  const base = byId['gaming-xbox-game-dvr'].matrix;
  const tampered = { ...base, groups: base.groups.map((g, i) => (i === 1 ? { ...g, startColumn: g.startColumn + 1 } : g)) };
  assert.throws(() => renderMatrix(tampered, { geometries: geo }), /pathsRow:.*expected at column/);
});

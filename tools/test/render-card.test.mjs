import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderMatrix, renderCard, cardBadges } from '../lib/render-card.mjs';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/catalog.sample.json', import.meta.url), 'utf8'));
const all = fixture.features.flatMap((f) => f.settings);
const byId = Object.fromEntries(all.map((s) => [s.id, s]));
const childrenOf = new Map();
for (const s of all) if (s.uiParentId) childrenOf.set(s.uiParentId, [...(childrenOf.get(s.uiParentId) ?? []), s]);
const ctx = { childrenOf, urlFor: (id) => (byId[id] ? `#${id}` : null) };

test('matrix renders one column per registry value under a spanning path header', () => {
  const html = renderMatrix(byId['sound-startup'].matrix);
  assert.match(html, /<table class="registry-table mx-table">/);
  // two targets on two different paths -> two registry groups of one column each (mirrors share a group)
  assert.equal((html.match(/colspan="1" class="mx-group mx-group-registry"/g) ?? []).length, 2);
  assert.match(html, /HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Authentication\\LogonUI\\BootAnimation/);
  assert.match(html, /title="HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion\\Authentication\\LogonUI\\BootAnimation"/);
  assert.match(html, /<code>DisableStartupSound<\/code>\s*<span class="mx-type">DWord<\/span>/);
  assert.equal((html.match(/<tr class="mx-option-row/g) ?? []).length, 2);
});

test('matrix marks recommended and windows-default rows with the matrix labels', () => {
  const m = byId['sound-startup'].matrix;
  const html = renderMatrix(m);
  assert.match(html, new RegExp(`<span class="role-badge rec"[^>]*>${m.recommendedLabel}</span>`));
  assert.match(html, new RegExp(`<span class="role-badge def"[^>]*>${m.defaultLabel}</span>`));
});

test('selection matrix renders every option row', () => {
  const html = renderMatrix(byId['sound-communication-ducking'].matrix);
  assert.equal((html.match(/<tr class="mx-option-row/g) ?? []).length, 4);
  assert.match(html, /Do nothing/);
});

test('null matrix renders the power-plan note instead of a table', () => {
  assert.match(renderMatrix(null), /<p class="mx-empty">/);
});

test('card has id anchor, name, id, description and collapsed details', () => {
  const html = renderCard(byId['sound-startup'], ctx);
  assert.match(html, /<div class="setting-card" id="sound-startup">/);
  assert.match(html, /<span class="setting-name">Startup Sound During Boot<\/span>/);
  assert.match(html, /<span class="setting-id">sound-startup<\/span>/);
  assert.match(html, /<p class="setting-desc">Play the Windows startup sound when your computer boots up<\/p>/);
  assert.match(html, /<details class="registry-details">\s*<summary>Technical Details<\/summary>/);
  assert.doesNotMatch(html, /Windows 10<\/h4>/);
});

test('card with a win10 matrix renders both tables under build headings', () => {
  const html = renderCard(byId['theme-mode-windows'], ctx);
  assert.match(html, /<h4 class="mx-build">Windows 11<\/h4>/);
  assert.match(html, /<h4 class="mx-build">Windows 10<\/h4>/);
  assert.equal((html.match(/<table class="registry-table mx-table">/g) ?? []).length, 2);
});

test('badges: win11-only, laptops-only, preference, added-in', () => {
  assert.match(cardBadges(byId['explorer-customization-context-menu']), /<span class="setting-badge win11"[^>]*>Windows 11 only<\/span>/);
  assert.match(cardBadges(byId['lid-close-action']), /<span class="setting-badge laptops"[^>]*>Laptops only<\/span>/);
  assert.match(cardBadges(byId['power-hybrid-sleep']), /<span class="setting-badge hardware"[^>]*>Hybrid sleep capable PCs<\/span>/);
  assert.match(cardBadges(byId['sound-startup']), /<span class="setting-badge preference"[^>]*>Preference<\/span>/);
  const added = all.find((s) => s.addedInVersion);
  if (added) assert.match(cardBadges(added), new RegExp(`<span class="setting-badge added"[^>]*>Added in v${added.addedInVersion.replace(/\./g, '\\.')}</span>`));
  assert.equal(cardBadges({ ...byId['sound-communication-ducking'], isSubjectivePreference: false, addedInVersion: null, matrix: { ...byId['sound-communication-ducking'].matrix, requirements: [] } }), '');
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
  const html = renderMatrix(linked.matrix, { urlFor: (id) => `#${id}` });
  const chip = linked.matrix.columns.flatMap((c) => c.chips).find((ch) => ch.linkSettingId && byId[ch.linkSettingId]);
  assert.match(html, new RegExp(`<a href="#${chip.linkSettingId}">${chip.linkText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</a>`));
});

test('code blocks render with language header and escaped body', () => {
  const withCode = all.find((s) => s.matrix && s.matrix.codeBlocks.length);
  if (!withCode) return;
  const html = renderCard(withCode, ctx);
  assert.match(html, /<div class="code-block">\s*<div class="code-header"><span class="code-language">(powershell|reg)<\/span>/);
  assert.doesNotMatch(html, /<pre><code>[^<]*<(?!\/code>)/);
});

// Controller ruling 1: requirement chips carry linkSettingId/linkText in the real export.
// cardBadges(s, urlFor) must run each requirement chip's text through the same chipText
// helper as column chips, so only the linked substring becomes an <a href>.
test('requirement chip whose linkSettingId resolves becomes a link inside the badge', () => {
  const withReqLink = all.find((s) => (s.matrix?.requirements ?? []).some((ch) => ch.linkSettingId && byId[ch.linkSettingId]));
  if (!withReqLink) return;
  const chip = withReqLink.matrix.requirements.find((ch) => ch.linkSettingId && byId[ch.linkSettingId]);
  const html = cardBadges(withReqLink, (id) => '#' + id);
  assert.match(html, new RegExp(`<a href="#${chip.linkSettingId}">${chip.linkText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</a>`));
});

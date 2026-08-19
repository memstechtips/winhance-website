import { esc } from './html.mjs';

const BUILD_HEADING = { win11: 'Windows 11', win10: 'Windows 10' };

export function renderMatrix(m, { heading = '', urlFor = () => null } = {}) {
  if (!m) {
    return `<p class="mx-empty">The options are the power plans installed on this PC, so there is no fixed table; Winhance lists them live.</p>`;
  }
  const head = heading ? `<h4 class="mx-build">${esc(heading)}</h4>\n` : '';
  return `${head}<div class="mx-scroll">
<table class="registry-table mx-table">
<thead>
<tr class="mx-groups"><th class="mx-corner" rowspan="2">${esc(m.optionHeader)}</th>${groupRow(m)}</tr>
<tr class="mx-cols">${m.columns.map((c) => columnHead(c, urlFor)).join('')}</tr>
</thead>
<tbody>
${m.options.map((o) => optionRow(m, o)).join('\n')}
</tbody>
</table>
</div>`;
}

function groupRow(m) {
  const starts = new Map(m.groups.map((g) => [g.startColumn, g]));
  const covered = new Set(m.groups.flatMap((g) => Array.from({ length: g.columnSpan }, (_, i) => g.startColumn + i)));
  const cells = [];
  for (let i = 0; i < m.columns.length; i++) {
    const g = starts.get(i);
    if (g) {
      cells.push(`<th colspan="${g.columnSpan}" class="mx-group mx-group-${g.kind.toLowerCase()}"${g.description ? ` title="${esc(g.description)}"` : ''}>${groupHead(g)}</th>`);
    } else if (!covered.has(i)) {
      cells.push('<th class="mx-group"></th>');
    }
  }
  return cells.join('');
}

function groupHead(g) {
  const paths = g.paths.map((p) => `<code class="mx-path" title="${esc(p.full)}">${esc(p.display || p.full)}</code>`).join('');
  return `<span class="mx-group-label">${esc(g.label)}</span>${paths}`;
}

function columnHead(c, urlFor) {
  const type = c.typeName ? `<span class="mx-type">${esc(c.typeName)}</span>` : '';
  const chips = c.chips.map((chip) => `<span class="mx-chip" title="${esc(chip.tooltip)}">${chipText(chip, urlFor)}</span>`).join('');
  return `<th class="mx-col mx-col-${c.kind.toLowerCase()}"${c.headerTooltip ? ` title="${esc(c.headerTooltip)}"` : ''}><code>${esc(c.header)}</code>${type}${chips}</th>`;
}

// Only the setting's name inside a chip is a link (the builder marks it with linkText); the prose around it is not.
// Shared by column chips and (Controller ruling 1) the matrix's own requirement chips, which are the ones
// that actually carry a linkSettingId/linkText in the real export.
function chipText(chip, urlFor) {
  const text = esc(chip.text);
  const url = chip.linkSettingId && chip.linkText ? urlFor(chip.linkSettingId) : null;
  if (!url) return text;
  const linkText = esc(chip.linkText);
  return text.replace(linkText, `<a href="${esc(url)}">${linkText}</a>`);
}

function optionRow(m, o) {
  const classes = ['mx-option-row'];
  if (o.isRecommended) classes.push('is-recommended');
  if (o.isWindowsDefault) classes.push('is-default');
  const badges = [];
  if (o.isRecommended) badges.push(`<span class="role-badge rec" title="${esc(m.recommendedTooltip)}">${esc(m.recommendedLabel)}</span>${context(o.recommendedContext)}`);
  if (o.isWindowsDefault) badges.push(`<span class="role-badge def" title="${esc(m.defaultTooltip)}">${esc(m.defaultLabel)}</span>${context(o.defaultContext)}`);
  const cells = m.columns.map((_, i) => cell(o.cells[i])).join('');
  return `<tr class="${classes.join(' ')}"><th scope="row" class="mx-option">${esc(o.label)}${badges.length ? ` <span class="mx-roles">${badges.join(' ')}</span>` : ''}</th>${cells}</tr>`;
}

function context(text) {
  return text ? `<span class="role-context">(${esc(text)})</span>` : '';
}

function cell(c) {
  if (!c) return '<td class="mx-cell"></td>';
  if (c.isCheck) return '<td class="mx-cell mx-check" aria-label="yes">&#10003;</td>';
  return `<td class="mx-cell">${esc(c.text)}</td>`;
}

function notes(m) {
  if (!m || !m.notes.length) return '';
  const items = m.notes.map((n) => `<li><strong>${esc(n.label)}</strong>${n.scope ? ` <em>(${esc(n.scope)})</em>` : ''}: ${esc(n.detail)}</li>`).join('\n');
  return `<div class="mx-notes"><h4>${esc(m.notesHeading)}</h4>\n<ul>\n${items}\n</ul></div>`;
}

function codeBlocks(m) {
  if (!m || !m.codeBlocks.length) return '';
  const sections = new Map();
  for (const b of m.codeBlocks) {
    if (!sections.has(b.heading)) sections.set(b.heading, { description: b.description, blocks: [] });
    sections.get(b.heading).blocks.push(b);
  }
  return [...sections.entries()].map(([heading, s]) => {
    const blocks = s.blocks.map((b) => `<div class="code-block">
<div class="code-header"><span class="code-language">${b.kind === 'PowerShell' ? 'powershell' : 'reg'}</span>${b.label ? `<span class="code-label">${esc(b.label)}</span>` : ''}</div>
<pre><code>${esc(b.body)}</code></pre>
</div>`).join('\n');
    return `<div class="mx-code"><h4>${esc(heading)}</h4>${s.description ? `<p>${esc(s.description)}</p>` : ''}\n${blocks}</div>`;
  }).join('\n');
}

// Card-level badges: OS gate, hardware, advanced unlock, preference, added-in, then the matrix's own
// requirement chips (confirmation / reboot / restart / "sets: X"), which arrive already worded and
// (Controller ruling 1) carry linkSettingId/linkText just like column chips, so they run through the
// same chipText helper keyed off the optional urlFor.
export function cardBadges(s, urlFor = () => null) {
  const out = [];
  const msg = s.availability.message;
  if (msg.win10 && !msg.win11) out.push(badge('win11', 'Windows 11 only', msg.win10));
  else if (msg.win11 && !msg.win10) out.push(badge('win10', 'Windows 10 only', msg.win11));
  else if (msg.win11 && msg.win10) out.push(badge('build', msg.win11, msg.win11));
  for (const hw of s.availability.hardware) {
    if (hw === 'Battery') out.push(badge('laptops', 'Laptops only', 'Only shown on devices with a battery'));
    else if (hw === 'HybridSleepCapable') out.push(badge('hardware', 'Hybrid sleep capable PCs', 'Only shown where the firmware supports hybrid sleep'));
    else out.push(badge('hardware', hw, ''));
  }
  if (s.availability.requiresAdvancedUnlock) out.push(badge('advanced', 'Advanced', 'Hidden until Advanced mode is unlocked in Winhance'));
  if (s.isSubjectivePreference) out.push(badge('preference', 'Preference', 'A matter of taste: Winhance does not recommend a value'));
  if (s.addedInVersion) out.push(badge('added', `Added in v${s.addedInVersion}`, ''));
  for (const chip of s.matrix?.requirements ?? []) out.push(badgeRaw('req', chipText(chip, urlFor), chip.tooltip));
  return out.join('');
}

function badge(cls, text, tooltip) {
  return badgeRaw(cls, esc(text), tooltip);
}

// Like badge(), but the text is already safe HTML (e.g. chipText's output, which may embed an <a>).
function badgeRaw(cls, html, tooltip) {
  return `<span class="setting-badge ${cls}"${tooltip ? ` title="${esc(tooltip)}"` : ''}>${html}</span>`;
}

export function renderCard(s, ctx, { child = false } = {}) {
  const urlFor = ctx.urlFor ?? (() => null);
  const badges = cardBadges(s, urlFor);
  const body = s.matrixWin10
    ? `${renderMatrix(s.matrix, { heading: BUILD_HEADING.win11, urlFor })}\n${renderMatrix(s.matrixWin10, { heading: BUILD_HEADING.win10, urlFor })}`
    : renderMatrix(s.matrix, { urlFor });
  const kids = (ctx.childrenOf.get(s.id) ?? []).map((k) => renderCard(k, ctx, { child: true })).join('\n');
  return `<div class="setting-card${child ? ' setting-card-child' : ''}" id="${esc(s.id)}">
<div class="setting-header">
<span class="setting-name">${esc(s.name)}</span>
<span class="setting-id">${esc(s.id)}</span>
</div>
${badges ? `<div class="setting-badges">${badges}</div>\n` : ''}<p class="setting-desc">${esc(s.description)}</p>
<details class="registry-details">
<summary>Technical Details</summary>
${body}
${notes(s.matrix)}${codeBlocks(s.matrix)}
</details>
${kids ? `<div class="setting-children">\n${kids}\n</div>\n` : ''}</div>`;
}

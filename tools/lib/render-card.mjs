// Mirrors OptionMatrixView.xaml.cs (Winhance.UI/Features/Common/Controls) row-for-row, cell-for-cell.
// Every metric/colour is a var(--app-*) or var(--winui-*) from the two generated/hand-written token
// sheets (see docs/css/docs-main.css); every string comes verbatim off the matrix export. Nothing here
// is authored data -- if it looks wrong, the fix is in the app's export or the token sheet, not here.
import { esc } from './html.mjs';

const BUILD_HEADING = { win11: 'Windows 11', win10: 'Windows 10' };

// 21px CurrentMarkerGutter + 2*12px Table.Cell padding: the fixed part of every option cell's width,
// on top of the longest label (monospace, so 1 character == 1ch).
const OPTION_CELL_FIXED_WIDTH = 21 + 12 * 2;

// Only the setting's name inside a chip is a link (the builder marks it with linkText); the prose around
// it is not. Shared by column chips, requirement chips (mechanism cell) and (Controller ruling 1) the
// matrix's own requirement chips, which are the ones that actually carry a linkSettingId/linkText in the
// real export.
function chipText(chip, urlFor) {
  const text = esc(chip.text);
  const url = chip.linkSettingId && chip.linkText ? urlFor(chip.linkSettingId) : null;
  if (!url) return text;
  const linkText = esc(chip.linkText);
  // Replacer function, not a template string, so a literal `$` in linkText can't be
  // misread as a replacement pattern (e.g. $&, $1) by String.replace.
  return text.replace(linkText, () => `<a href="${esc(url)}" class="mx-chip-link">${linkText}</a>`);
}

function chipEl(chip, urlFor) {
  return `<span class="mx-chip" title="${esc(chip.tooltip)}">${chipText(chip, urlFor)}</span>`;
}

function chipsEl(chips, urlFor) {
  if (!chips.length) return '';
  return `<span class="mx-chips">${chips.map((c) => chipEl(c, urlFor)).join('')}</span>`;
}

// "Recommended" when it holds whatever the power state, "Recommended (On Battery)" when the contexts
// disagree -- matches OptionMatrixView.Qualified().
function qualified(label, context) {
  return context ? `${label} (${context})` : label;
}

// The three pill-badge icon geometries are the app's own BadgeRecommendedIconPath / BadgeDefaultIconPath /
// BadgePreferenceIconPath (FeatureIcons.xaml, via theme.json). fill="currentColor" so the icon always
// matches the pill's own foreground -- no separate icon-colour var needed.
function pillIcon(geometry) {
  if (!geometry) return '';
  return `<svg viewBox="0 0 ${geometry.viewBox} ${geometry.viewBox}" width="12" height="12" aria-hidden="true"><path d="${esc(geometry.data)}" fill="currentColor"/></svg>`;
}

function pill(kind, label, tooltip, geometry) {
  return `<span class="mx-pill mx-pill-${kind}" title="${esc(tooltip)}">${pillIcon(geometry)}<span class="mx-pill-label">${esc(label)}</span></span>`;
}

function groupLabelBlock(label, description) {
  const l = label ? `<span class="mx-group-label">${esc(label)}</span>` : '';
  const d = description ? `<span class="mx-group-desc">${esc(description)}</span>` : '';
  return `${l}${d}`;
}

// A caption sits BESIDE its value rather than above it: a caption on its own line reads as another
// column heading (OptionMatrixView.CaptionedLine).
function captionedLine(caption, text, valueClass) {
  const value = `<code class="${valueClass}">${esc(text)}</code>`;
  return caption ? `<span class="mx-caption">${esc(caption)}</span>${value}` : value;
}

// Adjacent only: two registry groups separated by a scheduled task stay two headings rather than one
// reaching across the task (OptionMatrixView.ConsecutiveByKind).
function consecutiveByKind(groups) {
  const runs = [];
  for (const g of groups) {
    const last = runs.length ? runs[runs.length - 1] : null;
    const prev = last ? last[last.length - 1] : null;
    if (prev && prev.kind === g.kind && prev.startColumn + prev.columnSpan === g.startColumn) last.push(g);
    else runs.push([g]);
  }
  return runs;
}

// Row 0 (MechanismRow), cols 0-1, rowspan 2: the setting's own label/description, then its requirement
// chips. Spans both header bands because what the table IS doesn't change between the mechanism row and
// the path row.
function settingCell(matrix, urlFor) {
  const body = groupLabelBlock(matrix.settingLabel, matrix.settingDescription);
  const chips = matrix.requirements.length ? `<div class="mx-chips mx-setting-chips">${matrix.requirements.map((c) => chipEl(c, urlFor)).join('')}</div>` : '';
  return `<th class="mx-setting" colspan="2" rowspan="2">${body}${chips}</th>`;
}

// One band per run of consecutive groups sharing a mechanism, named once over all of their columns
// together (OptionMatrixView.AddGroupHeaders, first loop).
function groupHeaderRow(matrix) {
  return consecutiveByKind(matrix.groups).map((run) => {
    const first = run[0];
    const span = run.reduce((sum, g) => sum + g.columnSpan, 0);
    const rowSpan = run.some((g) => g.hasPaths) ? 1 : 2;
    return `<th class="mx-group" colspan="${span}" rowspan="${rowSpan}">${groupLabelBlock(first.label, first.description)}</th>`;
  }).join('');
}

// Row 1 (PathRow): one band per group WITH paths, one line per destination -- a mirrored value is
// written to all of them, so listing every path is the only honest answer to "where does this go"
// (OptionMatrixView.AddGroupHeaders, second loop + PathLine).
function pathsRow(matrix) {
  return matrix.groups.filter((g) => g.hasPaths).map((g) => {
    const lines = g.paths.map((p) => {
      const caption = p.hasLabel ? `<span class="mx-caption">${esc(p.label)}</span>` : '';
      return `<span class="mx-pathline">${caption}<code class="mx-path" title="${esc(p.full)}">${esc(p.display)}</code></span>`;
    }).join('');
    return `<th class="mx-paths" colspan="${g.columnSpan}">${lines}</th>`;
  }).join('');
}

// Row 2 (ColumnHeaderRow): the frozen Option/Role headers, then per column a caption+header, an optional
// caption+type, then the column's own chips (OptionMatrixView.AddColumnHeaders).
function columnHeaderRow(matrix, urlFor) {
  const frozen = `<th class="mx-h-option" scope="col">${esc(matrix.optionHeader)}</th><th class="mx-h-role" scope="col">${esc(matrix.roleHeader)}</th>`;
  const cols = matrix.columns.map((c) => {
    const nameCaption = c.kind === 'Value' ? matrix.valueNameLabel : c.kind === 'Task' ? matrix.taskLabel : '';
    const nameLine = captionedLine(nameCaption, c.header, 'mx-name');
    const typeCaption = c.kind === 'Value' ? matrix.valueTypeLabel : '';
    const typeLine = c.hasType ? captionedLine(typeCaption, c.typeName, 'mx-type') : '';
    const chips = chipsEl(c.chips, urlFor);
    const title = c.headerTooltip ? ` title="${esc(c.headerTooltip)}"` : '';
    return `<th class="mx-col mx-col-${c.kind.toLowerCase()}" scope="col"${title}>${nameLine}${typeLine}${chips}</th>`;
  }).join('');
  return frozen + cols;
}

// One option row: col 0 the label behind its 21px marker gutter (kept empty -- isCurrent is never read,
// Controller ruling 2), col 1 the Recommended/Windows-default pills, then one value cell per column
// (OptionMatrixView.AddOptionRow).
function optionRow(matrix, option, geometries) {
  const pills = [];
  if (option.isRecommended) pills.push(pill('recommended', qualified(matrix.recommendedLabel, option.recommendedContext), matrix.recommendedTooltip, geometries.BadgeRecommendedIconPath));
  if (option.isWindowsDefault) pills.push(pill('default', qualified(matrix.defaultLabel, option.defaultContext), matrix.defaultTooltip, geometries.BadgeDefaultIconPath));
  const cells = matrix.columns.map((_, i) => valueCell(option.cells[i])).join('');
  return `<tr><th class="mx-option" scope="row"><span class="mx-gutter"></span><code>${esc(option.label)}</code></th><td class="mx-role">${pills.join('')}</td>${cells}</tr>`;
}

function valueCell(cell) {
  if (!cell) return '<td class="mx-value"></td>';
  if (cell.isCheck) return '<td class="mx-value">✓</td>';
  if (!cell.hasText) return '<td class="mx-value"></td>';
  return `<td class="mx-value"><code>${esc(cell.text)}</code></td>`;
}

// Where the label/detail pair sits. With value columns the label covers the two frozen ones and the
// detail covers the rest; with none, the table IS those two frozen columns, so the pair splits across
// them one-for-one (OptionMatrixView.AddNotes).
function noteSpans(matrix) {
  const split = matrix.columns.length === 0;
  return { labelSpan: split ? 1 : 2, detailSpan: split ? 1 : Math.max(1, matrix.columns.length) };
}

// Not per-option facts, so no column of their own -- each note spans the full width, inside the same
// tbody as the option rows (no separate note table).
function notesRows(matrix) {
  if (!matrix.hasNotes) return '';
  const { labelSpan, detailSpan } = noteSpans(matrix);
  const head = `<tr class="mx-notes-head"><th colspan="${labelSpan}" scope="col">${esc(matrix.notesHeading)}</th><th colspan="${detailSpan}" scope="col">${esc(matrix.notesDetailHeader)}</th></tr>`;
  const rows = matrix.notes.map((n) => {
    const scope = n.hasScope ? `<span class="mx-caption">${esc(n.scope)}</span>` : '';
    return `<tr class="mx-note"><th colspan="${labelSpan}" scope="row"><span class="mx-note-label">${esc(n.label)}</span>${scope}</th><td colspan="${detailSpan}">${esc(n.detail)}</td></tr>`;
  }).join('');
  return head + rows;
}

// Under the grid, inside the same border: per heading a band (once per distinct heading, even across
// several blocks), per block a label row and the body in its own horizontal scroller
// (OptionMatrixView.AddCodeBlocks).
function codeHost(matrix) {
  if (!matrix.hasCode) return '';
  const parts = [];
  let heading = null;
  for (const block of matrix.codeBlocks) {
    if (block.heading !== heading) {
      heading = block.heading;
      parts.push(`<div class="mx-code-heading">${groupLabelBlock(heading, block.description)}</div>`);
    } else {
      parts.push('<div class="mx-code-separator"></div>');
    }
    const kindClass = block.kind === 'PowerShell' ? 'mx-code-powershell' : 'mx-code-regcontent';
    parts.push(`<div class="mx-code-label">${esc(block.label)}</div>`);
    parts.push(`<pre class="mx-code-body ${kindClass}"><code>${esc(block.body)}</code></pre>`);
  }
  return `<div class="mx-code-host">${parts.join('')}</div>`;
}

// Controller ruling 1: sticky columns need no JS. --mx-option-w is the fixed gutter+padding plus the
// longest option label in ch (labels render monospace, so ch is exact); .mx-col-option takes that width
// and the Role column/cells sit sticky at that same offset.
function optionColumnWidth(matrix) {
  const longest = matrix.options.reduce((max, o) => Math.max(max, o.label.length), 0);
  return `calc(${OPTION_CELL_FIXED_WIDTH}px + ${longest}ch)`;
}

export function renderMatrix(matrix, { heading = '', urlFor = () => null, geometries = {} } = {}) {
  if (!matrix) {
    return `<p class="mx-empty">The options are the power plans installed on this PC, so there is no fixed table; Winhance lists them live.</p>`;
  }
  const head = heading ? `<h4 class="mx-build">${esc(heading)}</h4>\n` : '';
  const cols = `<col class="mx-col-option"><col class="mx-col-role">${matrix.columns.map(() => '<col>').join('')}`;
  const body = matrix.options.map((o) => optionRow(matrix, o, geometries)).join('') + notesRows(matrix);
  const boxClass = matrix.hasCode ? 'mx-box mx-has-code' : 'mx-box';

  return `${head}<div class="${boxClass}" style="--mx-option-w: ${optionColumnWidth(matrix)}">
<div class="mx-scroll">
<table class="mx-grid">
<colgroup>${cols}</colgroup>
<thead>
<tr class="mx-row-mechanism">${settingCell(matrix, urlFor)}${groupHeaderRow(matrix)}</tr>
<tr class="mx-row-paths">${pathsRow(matrix)}</tr>
<tr class="mx-row-columns">${columnHeaderRow(matrix, urlFor)}</tr>
</thead>
<tbody>
${body}
</tbody>
</table>
</div>
${codeHost(matrix)}</div>`;
}

// Card-level facts about the SETTING (not any one option): OS gate, hardware, advanced unlock, added-in,
// and the app's own Preference pill (palette + person icon straight off theme.json -- InfoBadge_Preference
// text is verbatim from en.json). Requirement chips are NOT here: they belong to the matrix's own
// mechanism cell (Controller: spec table row 0), so they render once, inside the panel, not duplicated
// at the card header.
export function cardBadges(s, urlFor = () => null, geometries = {}) {
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
  if (s.isSubjectivePreference) {
    out.push(pill('preference', 'Preference', "Personal preference — Winhance may suggest a value, but there's no objectively correct answer. Choose whatever fits you.", geometries.BadgePreferenceIconPath));
  }
  if (s.addedInVersion) out.push(badge('added', `Added in v${s.addedInVersion}`, ''));
  return out.join('');
}

function badge(cls, text, tooltip) {
  return `<span class="setting-badge ${cls}"${tooltip ? ` title="${esc(tooltip)}"` : ''}>${esc(text)}</span>`;
}

function iconSvg(icon, icons) {
  const art = icon ? icons[`${icon.pack}/${icon.name}`] : null;
  if (!art) return '';
  return `<svg viewBox="${esc(art.viewBox)}" width="20" height="20" aria-hidden="true"><path d="${esc(art.path)}" fill="currentColor"/></svg>`;
}

// WinUI SettingsCard shape: icon · name + description · pills right-aligned, id kept beneath them as a
// docs-only cross-reference affordance. No <details> -- Technical Details is always visible, directly
// below the header (Controller ruling 5).
export function renderCard(s, ctx, { child = false } = {}) {
  const urlFor = ctx.urlFor ?? (() => null);
  const icons = ctx.icons ?? {};
  const geometries = ctx.geometries ?? {};
  const badges = cardBadges(s, urlFor, geometries);
  const body = s.matrixWin10
    ? `${renderMatrix(s.matrix, { heading: BUILD_HEADING.win11, urlFor, geometries })}\n${renderMatrix(s.matrixWin10, { heading: BUILD_HEADING.win10, urlFor, geometries })}`
    : renderMatrix(s.matrix, { urlFor, geometries });
  const kids = (ctx.childrenOf.get(s.id) ?? []).map((k) => renderCard(k, ctx, { child: true })).join('\n');

  return `<div class="setting-card${child ? ' setting-card-child' : ''}" id="${esc(s.id)}">
<div class="setting-header">
<span class="setting-icon">${iconSvg(s.icon, icons)}</span>
<div class="setting-header-text">
<span class="setting-name">${esc(s.name)}</span>
<p class="setting-desc">${esc(s.description)}</p>
</div>
<div class="setting-pills">
${badges ? `<div class="setting-badges">${badges}</div>\n` : ''}<span class="setting-id">${esc(s.id)}</span>
</div>
</div>
${body}
${kids ? `<div class="setting-children">\n${kids}\n</div>\n` : ''}</div>`;
}

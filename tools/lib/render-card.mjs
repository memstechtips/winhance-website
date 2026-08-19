// Mirrors OptionMatrixView.xaml.cs (Winhance.UI/Features/Common/Controls) row-for-row, cell-for-cell.
// Every metric/colour is a var(--app-*) or var(--winui-*) from the two generated/hand-written token
// sheets (see docs/css/docs-main.css); every string comes verbatim off the matrix export. Nothing here
// is authored data -- if it looks wrong, the fix is in the app's export or the token sheet, not here.
import { esc } from './html.mjs';

const BUILD_HEADING = { win11: 'Windows 11', win10: 'Windows 10' };

// 21px CurrentMarkerGutter + 2*12px Table.Cell padding: the fixed part of every option cell's width,
// on top of the longest label. Charged in var(--mx-char-w) multiples, not `ch`: `ch` re-resolves
// against whatever font the READING element inherits, and a <col> can't carry its own font-family at
// all -- the same --mx-option-w value used to end up three different pixel widths across
// col.mx-col-option's width and .mx-h-role/.mx-role's sticky `left` (Controller ruling 1, fix round 1).
// A literal px-per-character token sidesteps that: every consumer resolves the identical number.
const OPTION_CELL_FIXED_WIDTH = 21 + 12 * 2;

// 2*12px Table.Cell padding: every other column's fixed width (no CurrentMarkerGutter -- that's the
// option column's alone).
const DATA_CELL_FIXED_WIDTH = 12 * 2;

// BadgePillBase's own metrics: 12px icon + 4px icon-to-label gap + 1px border on both sides +
// 7px/9px left/right padding = 34px of chrome around whatever the pill's own label measures.
const PILL_CHROME = 12 + 4 + 2 + 7 + 9;

// The Spacing of the badges' horizontal StackPanel (OptionMatrixView.AddOptionRow).
const PILL_GAP = 4;

// Metrics chip: TechDetail.Chip's own chrome -- 8px left/right padding *2 + 1px border *2 = 18px --
// on top of the same 24px cell padding every header-band cell shares (mx-setting uses HeaderBand's
// padding, same 12,4 -> 24px horizontal as Table.Cell's own 12,0, so DATA_CELL_FIXED_WIDTH covers
// both).
const CHIP_CHROME = 8 * 2 + 1 * 2;

// var(--mx-char-w) mirrored as a plain number (fix round 1) plus var(--mx-char-w-sm) (fix round 2):
// two build-time numbers used ONLY to size the deficit passes below (a group's own path text, the
// mechanism cell's own requirement chips) against the base per-column widths already computed --
// the actual rendered pixels still come from the CSS vars themselves, these are never emitted as
// literals. Keep both numbers equal to docs-main.css's `--mx-char-w`/`--mx-char-w-sm` -- the
// `mirrors the CSS char-width tokens` test in theme-css.test.mjs fails loudly on drift.
export const CHAR_W = 7.5;
// TechDetail.Table.GroupPath/HeaderType are Consolas at 11px (not the 12px OptionLabel/HeaderText
// face var(--mx-char-w) was measured for) -- measured directly in a real render rather than derived
// by ratio, because font hinting doesn't scale linearly with size. Reused (safely -- it is WIDER,
// per char, than the ~4.4-4.6px/char a real requirement chip's 10px proportional text measured at)
// for chip text too, rather than adding a third token for one smaller, rarer case.
export const CHAR_W_SM = 6.6;

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
// column heading (OptionMatrixView.CaptionedLine). Always wrapped in its own block-level line (fix
// round 1, finding 5): the app builds this as one child of a vertical StackPanel, so the name line and
// the type line beneath it must never be free siblings inside the <th> -- left unwrapped, they flowed
// as plain inline content and a narrow column wrapped the caption away from its value instead of onto
// its own row.
function captionedLine(caption, text, valueClass) {
  const value = `<code class="${valueClass}">${esc(text)}</code>`;
  const cap = caption ? `<span class="mx-caption">${esc(caption)}</span>` : '';
  return `<span class="mx-line">${cap}${value}</span>`;
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

// With neither columns nor options the Option/Role headers would be a band over two empty columns --
// a table that lost its rows (OptionMatrixView.HasColumnHeaderRow). start-menu-clean-10 is exactly
// this shape: notes/requirements/code carry the whole setting, so the matrix has 0 columns and 0
// options, and the app renders no column-header row at all.
function hasColumnHeaderRow(matrix) {
  return matrix.columns.length > 0 || matrix.options.length > 0;
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
  // Named('TechDetail.Table.GroupLabel')/HeaderCaption -- the heading row carries the same two text
  // styles as every other header band, not bare unstyled text (fix round 1, app-fidelity item 2).
  const head = `<tr class="mx-notes-head"><th colspan="${labelSpan}" scope="col"><span class="mx-group-label">${esc(matrix.notesHeading)}</span></th><th colspan="${detailSpan}" scope="col"><span class="mx-caption">${esc(matrix.notesDetailHeader)}</span></th></tr>`;
  const rows = matrix.notes.map((n) => {
    // AddNotes: label and scope sit in a StackPanel{Spacing=1} -- stacked, not side by side (fix
    // round 1, app-fidelity item 1). mx-note-name is that stack.
    const scope = n.hasScope ? `<span class="mx-caption">${esc(n.scope)}</span>` : '';
    const name = `<span class="mx-note-name"><span class="mx-note-label">${esc(n.label)}</span>${scope}</span>`;
    return `<tr class="mx-note"><th colspan="${labelSpan}" scope="row">${name}</th><td colspan="${detailSpan}">${esc(n.detail)}</td></tr>`;
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

// A width is a fixed px budget plus a character count charged in var(--mx-char-w) -- keeping the two
// separate (rather than a pre-built calc() string) lets renderMatrix sum every column's width into one
// table-wide total below, instead of concatenating calc() expressions.
function widthCalc({ fixed, chars }) {
  return `calc(${fixed}px + ${chars} * var(--mx-char-w))`;
}

function sumWidths(widths) {
  return widths.reduce((sum, w) => ({ fixed: sum.fixed + w.fixed, chars: sum.chars + w.chars }), { fixed: 0, chars: 0 });
}

// Controller ruling 1: sticky columns need no JS. --mx-option-w is the fixed gutter+padding plus the
// longest option label's character count times var(--mx-char-w) (fix round 1: was `<N>ch`, which
// resolves per-element against whatever font it inherits rather than the table's monospace font --
// see the constant above); .mx-col-option takes that width and the Role column/cells sit sticky at
// that same offset, so both read the exact same pixel value no matter what resolves the var.
function optionColumnWidth(matrix) {
  const longest = matrix.options.reduce((max, o) => Math.max(max, o.label.length), 0);
  return { fixed: OPTION_CELL_FIXED_WIDTH, chars: longest };
}

// Sized to the widest ROW's badges, not the widest single label: AddOptionRow lays an option's badges
// out in a horizontal StackPanel inside an auto-width Grid column, so a row that is both Recommended
// and the Windows default shows both pills side by side and stays the same 40px tall as every other
// row. Charging only the longest label wrapped that pair onto a second line and grew the row past the
// app's Table.Cell MinHeight. Labels are qualified with their context (Qualified()) exactly like the
// pill itself renders. An explicit width is needed at all because table-layout: fixed (needed for the
// option column above) otherwise treats this column as "auto" and divides whatever space is left over
// it and every data column EVENLY, squeezing both far narrower than their content.
function roleColumnWidth(matrix) {
  // The header cell holds plain text rather than a pill, so only the cell's own padding applies to it.
  let widest = { fixed: DATA_CELL_FIXED_WIDTH, chars: matrix.roleHeader.length };
  for (const o of matrix.options) {
    const labels = [];
    if (o.isRecommended) labels.push(qualified(matrix.recommendedLabel, o.recommendedContext));
    if (o.isWindowsDefault) labels.push(qualified(matrix.defaultLabel, o.defaultContext));
    if (!labels.length) continue;
    const row = {
      fixed: DATA_CELL_FIXED_WIDTH + labels.length * PILL_CHROME + (labels.length - 1) * PILL_GAP,
      chars: labels.reduce((sum, l) => sum + l.length, 0),
    };
    if (pxOf(row) > pxOf(widest)) widest = row;
  }
  return widest;
}

// A caption+value pair sharing a line (captionedLine/mx-line) competes against every option's own cell
// text for this column's width -- the caption's own length has to be charged too, or a column sized
// only to its value text wraps/overflows under its own header. char-w is calibrated for the panel's
// monospace face; charging the caption's proportional text the same rate runs slightly wide rather
// than short, which is the safe direction for a column that must never wrap (fix round 1, finding 2).
function lineLength(caption, text) {
  return caption ? caption.length + 1 + text.length : text.length; // +1 stands in for the 6px caption-value gap
}

function dataColumnWidth(matrix, index, column) {
  const nameCaption = column.kind === 'Value' ? matrix.valueNameLabel : column.kind === 'Task' ? matrix.taskLabel : '';
  const lengths = [lineLength(nameCaption, column.header)];
  if (column.hasType) lengths.push(lineLength(column.kind === 'Value' ? matrix.valueTypeLabel : '', column.typeName));
  for (const o of matrix.options) {
    const cell = o.cells[index];
    if (cell && cell.hasText) lengths.push(cell.text.length);
  }
  return { fixed: DATA_CELL_FIXED_WIDTH, chars: lengths.reduce((max, n) => Math.max(max, n), 0) };
}

function pxOf(w) {
  return w.fixed + w.chars * CHAR_W;
}

// fix round 2, finding A (severe): a group's own PathRow band was never charged against the columns
// it spans -- table-layout: fixed made dataColumnWidth's base width authoritative, so a long path
// that used to just grow its column under table-layout: auto now overflowed it instead and visibly
// collided with the next column. .mx-path is nowrap (a script/registry path reads worse reflowed),
// so unlike .mx-group-desc it can never just wrap to absorb a narrow cell -- it has to be charged.
// Widens dataWidths IN PLACE, evenly across the group's own columns, before renderMatrix sums them.
function widenForPaths(matrix, dataWidths) {
  for (const g of matrix.groups) {
    if (!g.hasPaths) continue;
    const neededChars = g.paths.reduce((max, p) => Math.max(max, lineLength(p.hasLabel ? p.label : '', p.display)), 0);
    const neededPx = DATA_CELL_FIXED_WIDTH + neededChars * CHAR_W_SM;
    const span = dataWidths.slice(g.startColumn, g.startColumn + g.columnSpan);
    if (!span.length) continue;
    const deficit = neededPx - span.reduce((sum, w) => sum + pxOf(w), 0);
    if (deficit <= 0) continue;
    const perColumn = deficit / span.length;
    for (const w of span) w.fixed += perColumn;
  }
}

// fix round 2, finding B: the mechanism cell's own requirement chips (.mx-setting-chips) were never
// charged against option+role either, for the same table-layout: fixed reason -- a long unbreakable
// chip (.mx-chip is nowrap; a badge that reflows mid-word reads as broken, not as a badge) overflowed
// into the paths row beside it. Widens only the role column, never the option column: the option
// column's width IS the sticky offset (Controller ruling 1) and .mx-h-role/.mx-role's `left` reads
// var(--mx-option-w) directly, so growing it here would reopen the fix round 1 sticky-column bug.
// Plain data-column chips (.mx-col .mx-chips) are deliberately NOT charged -- confirmed live that
// those only ever spill into blank space at the end of their own row, never into another cell.
function widenForChips(matrix, optionW, roleW) {
  if (!matrix.requirements.length) return roleW;
  const longestChars = matrix.requirements.reduce((max, c) => Math.max(max, c.text.length), 0);
  const neededPx = DATA_CELL_FIXED_WIDTH + CHIP_CHROME + longestChars * CHAR_W_SM;
  const deficit = neededPx - (pxOf(optionW) + pxOf(roleW));
  return deficit > 0 ? { fixed: roleW.fixed + deficit, chars: roleW.chars } : roleW;
}

export function renderMatrix(matrix, { heading = '', urlFor = () => null, geometries = {} } = {}) {
  if (!matrix) {
    return `<p class="mx-empty">The options are the power plans installed on this PC, so there is no fixed table; Winhance lists them live.</p>`;
  }
  const head = heading ? `<h4 class="mx-build">${esc(heading)}</h4>\n` : '';
  const optionW = optionColumnWidth(matrix);
  let roleW = roleColumnWidth(matrix);
  const dataWidths = matrix.columns.map((c, i) => dataColumnWidth(matrix, i, c));
  // Fix round 2: the base per-column widths above are a floor, not the final word -- a group's own
  // path text and the mechanism cell's own requirement chips can each demand more than that floor,
  // and table-layout: fixed (finding 2) means nothing grows to meet them on its own anymore.
  widenForPaths(matrix, dataWidths);
  roleW = widenForChips(matrix, optionW, roleW);
  // table-layout: fixed (finding 2) makes every <col>'s width authoritative, but ONLY when the slack
  // between the table's own width and its columns has somewhere definite to go. --mx-table-w is the
  // exact sum, so a table at that width has none (verified live: with `width: 100%` on a matrix
  // narrower than its container, Chromium proportionally stretched every column, including the option
  // column, past --mx-option-w -- reopening the exact bug this fix round closes).
  const tableW = sumWidths([optionW, roleW, ...dataWidths]);
  // The LAST column is left auto, which is TableLayout.StretchToViewport ("only the last column grows,
  // which keeps the earlier columns aligned with their headers"): .mx-grid asks for at least its
  // container's width, and under fixed layout a single auto column takes the whole remainder -- so a
  // matrix narrower than the card fills it instead of stopping mid-card and leaving dead space beside
  // it, exactly as the app's own comment describes. --mx-table-w still carries that column's own
  // width, so the remainder can never come out narrower than its content.
  const sized = [{ w: roleW, cls: ' class="mx-col-role"' }, ...dataWidths.map((w) => ({ w, cls: '' }))];
  const cols = `<col class="mx-col-option">${sized
    .map(({ w, cls }, i) => (i === sized.length - 1 ? `<col${cls}>` : `<col${cls} style="width: ${widthCalc(w)}">`))
    .join('')}`;
  const body = matrix.options.map((o) => optionRow(matrix, o, geometries)).join('') + notesRows(matrix);
  const boxClass = matrix.hasCode ? 'mx-box mx-has-code' : 'mx-box';
  const columnsRow = hasColumnHeaderRow(matrix) ? `<tr class="mx-row-columns">${columnHeaderRow(matrix, urlFor)}</tr>` : '';

  return `${head}<div class="${boxClass}" style="--mx-option-w: ${widthCalc(optionW)}; --mx-table-w: ${widthCalc(tableW)}">
<div class="mx-scroll">
<table class="mx-grid">
<colgroup>${cols}</colgroup>
<thead>
<tr class="mx-row-mechanism">${settingCell(matrix, urlFor)}${groupHeaderRow(matrix)}</tr>
<tr class="mx-row-paths">${pathsRow(matrix)}</tr>
${columnsRow}
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

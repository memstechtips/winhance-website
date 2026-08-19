// Converts Winhance's exported theme.json into the generated docs/css/app-tokens.css: one CSS
// custom property per app-defined colour token, per alias, and per (style, setter) pair. Every
// value stays exactly what the app draws — this file has no opinions of its own, only the
// XAML-to-CSS syntax translation (colour reordering, Thickness shorthand, ThemeResource lookup).
//
// Naming (cssVarName): a dotted key ('TechDetail.Table.HeaderBand') lowercases each segment and
// joins with '-', dropping the dots — 'techdetail-table-headerband'. The app's own namespacing
// stays intact rather than being re-split at word boundaries. A plain PascalCase key with no dots
// ('BadgeRecommendedBackground') *is* split at word boundaries — 'badge-recommended-background'.
// A setter property name appended after a style key is always split ('MinHeight' -> 'min-height'),
// since it isn't part of the app's own namespace. Every var this module emits, other than a WinUI
// system-token passthrough, is prefixed '--app-'.

// WinUI system-token names this module recognises as belonging in docs/css/winui-tokens.css
// rather than app-tokens.css. The 30 mechanical entries decamel() to exactly the var names in
// that file (keep the two in sync if the verified token table changes); the two accent entries
// are WinUI's role mapping onto the OS accent, not mechanical names, so they're spelled out.
const WINUI_MECHANICAL = [
  'TextFillColorPrimary', 'TextFillColorSecondary', 'TextFillColorTertiary', 'TextFillColorDisabled',
  'SolidBackgroundFillColorBase', 'SolidBackgroundFillColorSecondary', 'SolidBackgroundFillColorTertiary', 'SolidBackgroundFillColorQuarternary',
  'LayerFillColorDefault', 'LayerFillColorAlt',
  'CardBackgroundFillColorDefault', 'CardBackgroundFillColorSecondary',
  'SubtleFillColorSecondary', 'SubtleFillColorTertiary',
  'CardStrokeColorDefault', 'CardStrokeColorDefaultSolid',
  'ControlStrokeColorDefault', 'ControlStrokeColorSecondary',
  'DividerStrokeColorDefault', 'SurfaceStrokeColorDefault',
  'ControlFillColorDefault',
  'SystemFillColorAttentionBackground', 'SystemFillColorSuccessBackground', 'SystemFillColorCautionBackground', 'SystemFillColorCriticalBackground',
  'SystemFillColorSuccess', 'SystemFillColorCaution', 'SystemFillColorCritical',
  'TextOnAccentFillColorPrimary', 'ControlStrokeColorOnAccentDefault',
];

const WINUI_TOKENS = new Map([
  ...WINUI_MECHANICAL.map((name) => [name, `--winui-${decamel(name)}`]),
  ['AccentFillColorDefault', '--winui-accent-fill-default'],
  ['AccentTextFillColorPrimary', '--winui-accent-text-primary'],
]);

function decamel(word) {
  return word.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

export function cssVarName(key) {
  const base = key.includes('.') ? key.split('.').map((s) => s.toLowerCase()).join('-') : decamel(key);
  return `--app-${base}`;
}

function setterVarName(styleKey, prop) {
  return `${cssVarName(styleKey)}-${decamel(prop)}`;
}

// XAML writes colour as #AARRGGBB (or #RRGGBB with no alpha); CSS wants #RRGGBB when alpha is
// FF (opaque — nothing to express) or #RRGGBBAA otherwise. Output is lowercased for consistency.
function convertColor(value) {
  const hex = value.slice(1);
  if (hex.length === 6) return `#${hex.toLowerCase()}`;
  const alpha = hex.slice(0, 2);
  const rgb = hex.slice(2);
  return alpha.toLowerCase() === 'ff' ? `#${rgb.toLowerCase()}` : `#${(rgb + alpha).toLowerCase()}`;
}

const NUMBER = /^-?\d+(\.\d+)?$/;
const HEX_COLOR = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;
const REF = /^\{(ThemeResource|StaticResource)\s+([^}]+)\}$/;

function px(n) {
  return n === '0' ? '0' : `${n}px`;
}

// XAML Thickness is 'all', 'H,V' or 'L,T,R,B'; CSS shorthand order is T R B L.
function convertThickness(parts) {
  if (parts.length === 1) return px(parts[0]);
  if (parts.length === 2) {
    const [h, v] = parts;
    return `${px(v)} ${px(h)}`;
  }
  const [l, t, r, b] = parts;
  return `${px(t)} ${px(r)} ${px(b)} ${px(l)}`;
}

// A {ThemeResource K} (or {StaticResource K}) reference resolves to a WinUI system-token var
// when K, with any trailing 'Brush' stripped (WinUI pairs a Color resource with a Brush resource
// of the same name plus 'Brush'), names a known system token; otherwise it's one of the app's
// own tokens — a colour, a style, or an alias key — so it resolves to that key's own app var.
function resolveRef(kind, key) {
  if (kind === 'ThemeResource') {
    const bare = key.replace(/Brush$/, '');
    if (WINUI_TOKENS.has(bare)) return `var(${WINUI_TOKENS.get(bare)})`;
  }
  return `var(${cssVarName(key)})`;
}

function convertValue(raw) {
  const ref = REF.exec(raw);
  if (ref) return resolveRef(ref[1], ref[2]);
  if (HEX_COLOR.test(raw)) return convertColor(raw);
  if (NUMBER.test(raw)) return px(raw);
  const parts = raw.split(',').map((p) => p.trim());
  if (parts.length > 1 && parts.every((p) => NUMBER.test(p))) return convertThickness(parts);
  return raw;
}

// Resolves a style's setters including everything it inherits via BasedOn, base setters first
// so a derived style (e.g. BadgeRecommendedStyle on BadgePillBase) carries the base's metrics
// as well as its own colours. Memoised so a base style used by several derived styles is only
// walked once.
function resolveSetters(styles, key, memo) {
  if (memo.has(key)) return memo.get(key);
  const style = styles[key];
  const setters = new Map();
  if (style.basedOn) for (const [prop, value] of resolveSetters(styles, style.basedOn, memo)) setters.set(prop, value);
  for (const [prop, value] of Object.entries(style.setters)) setters.set(prop, value);
  memo.set(key, setters);
  return setters;
}

function themeBlock(theme, colors, aliases) {
  const lines = [];
  for (const [key, value] of Object.entries(colors)) lines.push(`  ${cssVarName(key)}: ${convertValue(value)};`);
  for (const [key, value] of Object.entries(aliases)) lines.push(`  ${cssVarName(key)}: ${resolveRef('ThemeResource', value)};`);
  return lines;
}

export function themeCss(theme) {
  const memo = new Map();
  const styleLines = [];
  for (const key of Object.keys(theme.styles)) {
    for (const [prop, value] of resolveSetters(theme.styles, key, memo)) {
      styleLines.push(`  ${setterVarName(key, prop)}: ${convertValue(value)};`);
    }
  }

  const lightLines = [...themeBlock(theme, theme.themes.light, theme.aliases.light), ...styleLines];
  const darkLines = themeBlock(theme, theme.themes.dark, theme.aliases.dark);

  return `/*
 * Winhance's own design tokens — badge colours, table metrics, chip and code-block styling.
 * GENERATED from theme.json (schemaVersion ${theme.schemaVersion}) by tools/lib/theme-css.mjs.
 * Do not hand-edit. Regenerate with \`node tools/gen-docs.mjs\`.
 */

:root {
${lightLines.join('\n')}
}

[data-theme="dark"] {
${darkLines.join('\n')}
}
`;
}

// The three pill-badge icon geometries, as {key: {data, viewBox}}. Kept out of the CSS (path
// data isn't a style) and exported here so the card renderer doesn't need to re-read theme.json.
export function geometries(theme) {
  return theme.geometries;
}

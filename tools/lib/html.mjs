export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function slug(text) {
  return String(text)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Indents a multi-line fragment so the generated file stays readable in a diff.
export function indent(fragment, spaces) {
  const pad = ' '.repeat(spaces);
  return fragment.split('\n').map((line) => (line.length ? pad + line : line)).join('\n');
}

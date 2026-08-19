import { esc, slug, indent } from './html.mjs';
import { renderCard } from './render-card.mjs';

export function loadPages(json) {
  if (!json.areas || !Array.isArray(json.features)) throw new Error('_pages.json needs {areas, features[]}');
  for (const f of json.features) if (!json.areas[f.area]) throw new Error(`_pages.json: feature ${f.id} names unknown area ${f.area}`);
  return json;
}

export function rootFor(path) {
  const depth = path.split('/').length - 1;
  return depth === 0 ? './' : '../'.repeat(depth);
}

export function fillTemplate(template, values) {
  // Every replacement uses a replacer FUNCTION, not a string: real setting content (script bodies,
  // registry paths) can contain a literal `$&`, `` $` `` etc. (e.g. a PowerShell regex anchor like
  // `-replace'\.exe$'`), which String.replace would otherwise reinterpret as a special replacement
  // pattern (`$&` = "insert the match") and corrupt the output.
  // {{content}} is filled last and checked separately: real setting content can also legitimately
  // contain literal `{{...}}` text (e.g. a PowerShell template placeholder like `{{dohtemplate}}`),
  // which must not be mistaken for an unfilled shell placeholder.
  const shell = template
    .replace(/\{\{siteRoot\}\}/g, () => values.root + '../')
    .replace(/\{\{root\}\}/g, () => values.root)
    .replace(/\{\{title\}\}/g, () => esc(values.title))
    .replace(/\{\{sidebarOptimize\}\}/g, () => values.sidebarOptimize)
    .replace(/\{\{sidebarCustomize\}\}/g, () => values.sidebarCustomize);
  const left = (shell.match(/\{\{\w+\}\}/g) ?? []).find((m) => m !== '{{content}}');
  if (left) throw new Error(`template placeholder not filled: ${left}`);
  return shell.replace(/\{\{content\}\}/g, () => values.content);
}

export function sidebarSubNav(pages, areaKey, root) {
  const items = pages.features
    .filter((f) => f.area === areaKey)
    .map((f) => `    <a href="${root}${f.path}" class="sidebar-nav-item sub-item">${esc(f.navLabel)}</a>`)
    .join('\n');
  return `<div class="sidebar-sub-nav">\n${items}\n                    </div>`;
}

function shell(pages, page, title, content, template) {
  const root = rootFor(page.path);
  return fillTemplate(template, {
    title,
    root,
    content: indent(content, 12),
    sidebarOptimize: sidebarSubNav(pages, 'optimize', root),
    sidebarCustomize: sidebarSubNav(pages, 'customize', root),
  });
}

const CALLOUT = `<div class="callout callout-info">
    <div class="callout-title">Technical Details</div>
    <p>Every setting below can be expanded to show exactly what Winhance reads and writes: registry values, scheduled tasks, power settings and scripts, with the recommended value and the Windows default marked. This is the same table the app shows under each setting's Technical Details.</p>
</div>`;

function video(v) {
  if (!v || !v.id) return '';
  const start = v.start ? `?start=${Number(v.start)}` : '';
  return `<div class="video-container">
    <iframe src="https://www.youtube-nocookie.com/embed/${esc(v.id)}${start}" title="${esc(v.title ?? 'Winhance walkthrough')}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
</div>`;
}

export function renderFeaturePage({ page, feature, content, template, ctx, pages }) {
  const groups = new Map();
  for (const s of feature.settings) {
    if (s.uiParentId) continue;
    const g = s.group ?? 'General';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(s);
  }
  const sections = [...groups.entries()].map(([name, settings]) => {
    const entry = content.groups?.[name];
    const blurb = typeof entry === 'string' ? entry : entry?.blurb ?? '';
    const extra = typeof entry === 'object' && entry ? (entry.html ?? []).join('\n') : '';
    return `<h2 id="${slug(name)}">${esc(name)}</h2>
${blurb ? `<p>${blurb}</p>\n` : ''}${extra ? extra + '\n' : ''}${settings.map((s) => renderCard(s, ctx)).join('\n\n')}`;
  }).join('\n\n');
  const body = `<section id="${slug(page.title)}">
<h1>${esc(page.title)}</h1>
${video(content.video)}
${(content.intro ?? []).join('\n')}
${CALLOUT}

${sections}
</section>`;
  return shell(pages, page, page.title, body, template);
}

export function renderHubPage({ area, areaKey, pages, counts, content, template }) {
  const cards = pages.features.filter((f) => f.area === areaKey).map((f) => {
    const hubDir = area.path.slice(0, area.path.lastIndexOf('/') + 1); // "features/"
    const rel = f.path.startsWith(hubDir) ? f.path.slice(hubDir.length) : rootFor(area.path) + f.path;
    const n = counts[f.id] ?? 0;
    return `<a href="${rel}" class="feature-card">
    <div class="feature-card-title">${esc(f.navLabel)}</div>
    <p>${esc(f.blurb)}</p>
    <p class="feature-card-count">${n} setting${n === 1 ? '' : 's'}</p>
</a>`;
  }).join('\n');
  const body = `<section id="${slug(area.title)}-overview">
<h1>${esc(area.title)}</h1>
${(content.intro ?? []).join('\n')}
<div class="features-grid">
${cards}
</div>
${(content.outro ?? []).join('\n')}
</section>`;
  return shell(pages, area, area.title, body, template);
}

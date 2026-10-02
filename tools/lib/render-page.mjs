import { esc, slug, indent } from './html.mjs';
import { renderCard } from './render-card.mjs';

export function loadPages(json) {
  if (!json.areas || !Array.isArray(json.features) || !Array.isArray(json.nav)) throw new Error('_pages.json needs {areas, features[], nav[]}');
  for (const f of json.features) if (!json.areas[f.area]) throw new Error(`_pages.json: feature ${f.id} names unknown area ${f.area}`);
  for (const g of json.nav) for (const item of g.items) if (item.area && !json.areas[item.area]) throw new Error(`_pages.json: nav names unknown area ${item.area}`);
  return json;
}

// The sidebar, the breadcrumb and the prev/next links all read this one list, in reading order:
// [{ path, label, group, parent, depth }]. An {area} entry expands to the area hub and its feature pages.
export function navList(pages) {
  const list = [];
  const walk = (items, group, parent, depth) => {
    for (const item of items) {
      const area = item.area ? pages.areas[item.area] : null;
      const path = area ? area.path : item.path;
      const label = area ? area.navLabel : item.label;
      list.push({ path, label, group, parent, depth });
      const kids = area ? pages.features.filter((f) => f.area === item.area).map((f) => ({ path: f.path, label: f.navLabel })) : item.items ?? [];
      walk(kids, group, label, depth + 1);
    }
  };
  for (const g of pages.nav) walk(g.items, g.title, null, 0);
  return list;
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
  const fill = { ...values, siteRoot: values.root + '../', title: esc(values.title), description: esc(values.description ?? '') };
  delete fill.content;
  const shell = template.replace(/\{\{(\w+)\}\}/g, (m, key) => (key in fill ? fill[key] : m));
  const left = (shell.match(/\{\{\w+\}\}/g) ?? []).find((m) => m !== '{{content}}');
  if (left) throw new Error(`template placeholder not filled: ${left}`);
  return shell.replace(/\{\{content\}\}/g, () => values.content);
}

export function sidebarHtml(pages, current, root) {
  const list = navList(pages);
  const groups = [];
  for (const item of list) {
    let g = groups.find((x) => x.title === item.group);
    if (!g) groups.push(g = { title: item.group, items: [] });
    g.items.push(item);
  }
  return groups.map((g) => {
    const items = g.items.map((item) => {
      const cls = item.depth ? 'nav-item nav-sub' : 'nav-item';
      const here = item.path === current ? ' aria-current="page"' : '';
      return `    <a class="${cls}" href="${root}${item.path}"${here}>${esc(item.label)}</a>`;
    }).join('\n');
    return `<div class="nav-group">\n    <p class="nav-title">${esc(g.title)}</p>\n${items}\n</div>`;
  }).join('\n');
}

export function breadcrumbHtml(pages, current, root) {
  const list = navList(pages);
  const self = list.find((x) => x.path === current);
  if (!self || current === 'index.html') return '';
  const parent = self.parent ? list.find((x) => x.label === self.parent && x.depth === self.depth - 1) : null;
  const crumbs = [`<a href="${root}index.html">Docs</a>`, `<span>${esc(self.group)}</span>`];
  if (parent) crumbs.push(`<a href="${root}${parent.path}">${esc(parent.label)}</a>`);
  return `<nav class="breadcrumb" aria-label="Breadcrumb">${crumbs.join('<span class="sep" aria-hidden="true">/</span>')}</nav>`;
}

export function pagerHtml(pages, current, root) {
  const list = navList(pages);
  const i = list.findIndex((x) => x.path === current);
  if (i < 0) return '';
  const link = (item, dir) => item ? `<a class="pager-${dir}" href="${root}${item.path}"><span>${dir === 'prev' ? 'Previous' : 'Next'}</span>${esc(item.label)}</a>` : '<span></span>';
  return `<nav class="pager" aria-label="More pages">${link(list[i - 1], 'prev')}${link(list[i + 1], 'next')}</nav>`;
}

// "On this page": every h2 with an id, in order.
export function tocHtml(content) {
  const heads = [...content.matchAll(/<h2 id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => [m[1], m[2].replace(/<[^>]+>/g, '').trim()]);
  if (heads.length < 2) return '';
  return `<p class="toc-title">On this page</p>\n<ul>\n${heads.map(([id, text]) => `    <li><a href="#${id}">${text}</a></li>`).join('\n')}\n</ul>`;
}

// The live demo on a docs page. A page body asks for it with one marker,
//   <div class="app-demo" data-page="SoftwareApps" data-tab="external"></div>
// (data-page is a nav tag of the demo, data-feature / data-tab pick where it opens), and gets the landing
// page's own window and readout, run by the same demo/ scripts, opened on that page with the rest of the
// app locked. data-full drops the lock. One per page: the scripts bind to #winhance-demo.
const DEMO_PAGES = {
  SoftwareApps: ['Software & Apps', 'Tick some apps in the window above, then click a button above the list to see what Winhance would do.'],
  Optimize: ['Optimize', 'Flip any switch in the window above to see what Winhance would write to Windows.'],
  Customize: ['Customize', 'Flip any switch in the window above to see what Winhance would write to Windows.'],
  Autounattend: ['Unattend', 'Pick options in the window above. Winhance writes them into the answer file, never to this PC.'],
  WimUtil: ['WIMUtil', 'Click through the steps in the window above to see what each one does.'],
  Settings: ['Settings', 'Change a setting in the window above to see what it does.'],
};

export function expandDemo(content) {
  const marks = [...content.matchAll(/<div class="app-demo"([^>]*)><\/div>/g)];
  if (!marks.length) return null;
  if (marks.length > 1) throw new Error('a page can show the demo once (its scripts bind to #winhance-demo)');
  const attrs = marks[0][1];
  const page = attrs.match(/ data-page="(\w+)"/)?.[1];
  if (!DEMO_PAGES[page]) throw new Error(`app-demo: unknown data-page "${page}" (one of ${Object.keys(DEMO_PAGES).join(', ')})`);
  const [label, idle] = DEMO_PAGES[page];
  const full = / data-full\b/.test(attrs);
  const pass = [...attrs.matchAll(/ (data-(?:page|feature|tab))="([\w-]+)"/g)].map((m) => ` ${m[1]}="${m[2]}"`).join('');
  const focus = full ? '' : ` data-focus="This demo shows the ${esc(label)} page"`;
  const html = `<div class="app-demo desktop">
    <div id="winhance-demo" class="wd-host stage-window"${pass}${focus} role="region" aria-label="Interactive Winhance demo: ${esc(label)}">
        <noscript><p class="stage-fallback">Turn on JavaScript to try this page of Winhance in your browser.</p></noscript>
    </div>
    <div class="readout" id="readout" aria-live="polite">
        <p class="readout-idle">${esc(idle)}</p>
    </div>
</div>`;
  return content.replace(marks[0][0], () => html);
}

function shell(pages, path, title, description, content, template, version) {
  const root = rootFor(path);
  const demo = expandDemo(content);
  if (demo) content = demo;
  // A dialog still (data-wd-dialog) is drawn by the demo's scripts, so it needs the demo on the page.
  if (!demo && content.includes('data-wd-dialog')) throw new Error(`${path}: a data-wd-dialog still needs an app-demo on the same page`);
  const siteRoot = root + '../';
  const html = fillTemplate(template, {
    demoHead: demo ? `<link rel="stylesheet" href="${siteRoot}demo/winhance-demo.css">` : '',
    demoScripts: demo ? ['app.js', 'winhance-demo.js', 'readout.js'].map((f) => `<script src="${siteRoot}demo/${f}"></script>`).join('\n    ') : '',
    title,
    description,
    root,
    version: version ? `v${String(version).replace(/^v/, '')}` : '',
    sidebar: indent(sidebarHtml(pages, path, root), 16),
    breadcrumb: indent(breadcrumbHtml(pages, path, root), 12),
    pager: indent(pagerHtml(pages, path, root), 12),
    toc: indent(tocHtml(content), 12),
    content: indent(content, 16),
  });
  return html;
}

// A hand-written page: its body lives in docs/_content/pages/<path>; the title is its <h1> and the
// description its lead paragraph, so nothing about a page is written down twice.
export function renderStaticPage({ path, body, template, pages, version }) {
  const h1 = body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (!h1) throw new Error(`${path}: the page has no <h1>`);
  const lead = body.match(/<p class="lead">([\s\S]*?)<\/p>/);
  const text = (html) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return shell(pages, path, text(h1[1]), lead ? text(lead[1]) : '', body.trim(), template, version);
}

const CALLOUT = `<div class="callout callout-note">
    <p class="callout-title">Technical Details</p>
    <p>Each setting below lists exactly what Winhance reads and writes: registry values, scheduled tasks, power settings and scripts, with the recommended value and the Windows default marked. It is the same table the app shows when you turn on <strong>Technical Details</strong> in the <strong>View</strong> menu.</p>
</div>`;

function video(v) {
  if (!v || !v.id) return '';
  const start = v.start ? `?start=${Number(v.start)}` : '';
  return `<div class="video">
    <iframe src="https://www.youtube-nocookie.com/embed/${esc(v.id)}${start}" title="${esc(v.title ?? 'Winhance walkthrough')}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen loading="lazy"></iframe>
</div>`;
}

// Every settings page opens the demo on itself: Optimize or Customize with that feature picked, and the
// answer-file page on Unattend.
const AREA_DEMO = { optimize: 'Optimize', customize: 'Customize', autounattend: 'Autounattend' };
function demoMarker(page) {
  const tag = AREA_DEMO[page.area];
  if (!tag) return '';
  return `<div class="app-demo" data-page="${tag}"${tag === 'Autounattend' ? '' : ` data-feature="${esc(page.id)}"`}></div>`;
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
<p class="lead">${esc(page.blurb)}</p>
${demoMarker(page)}
${video(content.video)}
${(content.intro ?? []).join('\n')}
${CALLOUT}

${sections}
</section>`;
  return shell(pages, page.path, page.title, page.blurb, body, template, ctx.version);
}

export function renderHubPage({ area, areaKey, pages, counts, content, template, version }) {
  const cards = pages.features.filter((f) => f.area === areaKey).map((f) => {
    const hubDir = area.path.slice(0, area.path.lastIndexOf('/') + 1); // "features/"
    const rel = f.path.startsWith(hubDir) ? f.path.slice(hubDir.length) : rootFor(area.path) + f.path;
    const n = counts[f.id] ?? 0;
    return `<a href="${rel}" class="link-card">
    <span class="link-card-title">${esc(f.navLabel)}</span>
    <span>${esc(f.blurb)}</span>
    <span class="link-card-meta">${n} setting${n === 1 ? '' : 's'}</span>
</a>`;
  }).join('\n');
  const body = `<section id="${slug(area.title)}-overview">
<h1>${esc(area.title)}</h1>
${area.blurb ? `<p class="lead">${esc(area.blurb)}</p>\n` : ''}${(content.intro ?? []).join('\n')}
<div class="link-grid">
${cards}
</div>
${(content.outro ?? []).join('\n')}
</section>`;
  return shell(pages, area.path, area.title, area.blurb ?? '', body, template, version);
}

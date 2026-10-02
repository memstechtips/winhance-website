const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseVersion(v) {
  const m = /^(\d{2})\.(\d{2})\.(\d{2})/.exec(v);
  if (!m) throw new Error(`winhanceVersion "${v}" is not YY.MM.DD`);
  return { year: 2000 + Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function versionToLongDate(v) {
  const { year, month, day } = parseVersion(v);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

export function versionToIsoDate(v) {
  const { year, month, day } = parseVersion(v);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function spliceBetweenMarkers(text, start, end, replacement) {
  const a = text.indexOf(start);
  const b = text.indexOf(end);
  if (a === -1 || b === -1 || b < a) throw new Error(`markers "${start}" / "${end}" not found in order`);
  const afterStart = text.indexOf('\n', a) + 1;
  const endLineStart = text.lastIndexOf('\n', b) + 1;
  return text.slice(0, afterStart) + replacement + '\n' + text.slice(endLineStart);
}

function words(text) {
  return [...new Set(String(text).toLowerCase().replace(/<[^>]+>/g, ' ').split(/[^a-z0-9+.-]+/).filter((w) => w.length > 2))];
}

export function searchEntries({ pages, catalog, contents }) {
  const entries = [];
  const featureById = Object.fromEntries(catalog.features.map((f) => [f.id, f]));
  for (const [key, area] of Object.entries(pages.areas)) {
    const subs = pages.features.filter((f) => f.area === key);
    entries.push({
      title: area.title,
      url: area.path,
      category: 'Features',
      sections: subs.map((f) => f.navLabel),
      keywords: [key, ...subs.flatMap((f) => words(f.navLabel))],
      content: `${area.title}: ${subs.map((f) => f.blurb).join(' ')}`,
    });
  }
  for (const page of pages.features) {
    const feature = featureById[page.id];
    if (!feature) continue;
    const area = pages.areas[page.area];
    const groups = [...new Set(feature.settings.map((s) => s.group ?? 'General'))];
    const intro = (contents[page.id]?.intro ?? []).join(' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    entries.push({
      title: page.title,
      url: page.path,
      category: area.category,
      sections: groups,
      keywords: [...new Set(feature.settings.flatMap((s) => words(s.name)))].slice(0, 120),
      content: intro || page.blurb,
    });
    for (const s of feature.settings) {
      entries.push({
        title: s.name,
        url: `${page.path}#${s.id}`,
        category: page.title,
        sections: [s.group ?? 'General'],
        keywords: [s.id, ...words(s.group ?? ''), ...words(s.name)],
        content: s.description,
      });
    }
  }
  return entries;
}

// A hand-written page: its title, h2s and lead come straight from its body, so search can't drift from it.
export function staticSearchEntry(item, body) {
  const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const title = text(body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? item.label);
  const sections = [...body.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => text(m[1]));
  const lead = text(body.match(/<p class="lead">([\s\S]*?)<\/p>/)?.[1] ?? '');
  const prose = text(body.replace(/<pre[\s\S]*?<\/pre>/g, ' '));
  return {
    title,
    url: item.path,
    category: item.group,
    sections,
    keywords: words([item.label, ...sections].join(' ')),
    content: `${lead} ${prose}`.trim().slice(0, 1200),
  };
}

export function searchEntriesJs(entries) {
  return entries.map((e) => '        ' + JSON.stringify(e)).join(',\n') + (entries.length ? ',' : '');
}

const SITE = 'https://winhance.net/docs/';

export function renderSitemap({ existing, pages, statics = [], isoDate }) {
  const generated = new Map();
  // The docs home is listed by its folder URL, as it always has been.
  for (const p of statics) generated.set(p === 'index.html' ? '' : p, p === 'index.html' ? 1 : 0.7);
  for (const a of Object.values(pages.areas)) generated.set(a.path, 0.9);
  for (const f of pages.features) generated.set(f.path, 0.8);
  const kept = [];
  for (const m of existing.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>\s*<changefreq>([^<]+)<\/changefreq>\s*<priority>([^<]+)<\/priority>\s*<\/url>/g)) {
    const rel = m[1].startsWith(SITE) ? m[1].slice(SITE.length) : null;
    if (rel !== null && generated.has(rel)) continue;
    kept.push({ loc: m[1], lastmod: m[2], changefreq: m[3], priority: m[4] });
  }
  const gen = [...generated.entries()].map(([rel, priority]) => ({ loc: SITE + rel, lastmod: isoDate, changefreq: 'monthly', priority: priority.toFixed(1) }));
  const url = (u) => `    <url>\n        <loc>${u.loc}</loc>\n        <lastmod>${u.lastmod}</lastmod>\n        <changefreq>${u.changefreq}</changefreq>\n        <priority>${u.priority}</priority>\n    </url>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...kept, ...gen].map(url).join('\n')}\n</urlset>\n`;
}

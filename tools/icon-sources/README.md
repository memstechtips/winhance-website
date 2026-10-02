# Icon sources

`icons.json` is the vendored artwork for every setting-icon identity the
Winhance catalog export references (`setting.icon.{pack,name}`). It is
third-party data with its own licences, so it lives in the repo rather than
being re-fetched at build time.

Two upstreams, keyed `Material/<PascalName>` and `Fluent/<PascalName>`:

- **Material** — Material Design Icons 7.4.47 (Pictogrammers Free License;
  the path data itself is icons, so Apache-2.0). Path data pulled from
  `https://raw.githubusercontent.com/Templarian/MaterialDesign-JS/master/mdi.js`.
- **Fluent** — microsoft/fluentui-system-icons
  `main@84e8a2ae0e55b3cbe176b5cc33154fe82ef363cc` (2026-08-13), MIT
  (Copyright (c) 2020 Microsoft Corporation). Source:
  `https://github.com/microsoft/fluentui-system-icons`.

A third pack, `AppAsset/<file>`, is first-party and not stored here: `vendor-icons.mjs`
reads the PNG from the Winhance repo's `src/Winhance.UI/Assets/AppIcons/<file>` and embeds
it as a data URI, and the card paints it in the text colour, as the app does.

Full licence text and source URLs for both are recorded verbatim in the
file's own `_meta` block.

Fetched through the egress-filtered sandbox on 2026-08-19.

## Refreshing

`tools/vendor-icons.mjs` reads this file and reports any catalog icon
identity it can't resolve as `missing`. To refresh: re-fetch just those
names from the same upstreams above through the sandbox, and merge the
results into this file. Never hand-edit path data.

## Site chrome icons

`site-icons.json` holds the Fluent icons the landing page and its live app demo draw
(nav, title bar, buttons): the same names the app's XAML uses, from the same pinned
Fluent commit, fetched through the sandbox on 2026-10-01. `tools/gen-demo.mjs` reads it,
builds the demo's glyphs from it, and inlines the icons `index.html` uses as a sprite. Most
entries are `_20_regular` path data; `...Filled` keys are `_20_filled`. `...Color` keys (nav
buttons, breadcrumbs, status icons) keep the whole `_20_color` SVG body with its gradients, ids
renamed to the key, and `...ColorLarge` keys are the `_48_color` artwork (or `_32_color` where
no 48 exists) the 64px page headers scale down from. `Material/Disc` is the one non-Fluent
entry: Fluent has no optical-disc icon to stand in for the Segoe glyph WIMUtil's ISO card draws.
Refresh it the same way: fetch the missing files and merge them. Never hand-edit it, and drop
an entry once nothing uses it.

## App icons

`demo/icons/` holds memstechtips/package-icons, the repo the app fetches each Software & Apps
icon from, as one image. `tools/app-icons.py` trims and shrinks every icon in the repo's
manifest, packs them into `demo/icons/atlas.webp` (one download, so the icons appear together)
and writes `demo/icons/index.json` (source commit, each icon's cell and file hash);
`tools/gen-demo.mjs` refuses to build when that index disagrees with the package-icons
checkout, so re-run the script whenever that repo changes.

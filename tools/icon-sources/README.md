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

Full licence text and source URLs for both are recorded verbatim in the
file's own `_meta` block.

Fetched through the egress-filtered sandbox on 2026-08-19.

## Refreshing

`tools/vendor-icons.mjs` reads this file and reports any catalog icon
identity it can't resolve as `missing`. To refresh: re-fetch just those
names from the same upstreams above through the sandbox, and merge the
results into this file. Never hand-edit path data.

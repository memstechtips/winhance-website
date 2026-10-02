#!/usr/bin/env python3
"""Bundle the package-icons the app shows on Software & Apps, small enough for a landing page.

    tools/app-icons.py [--repo ../package-icons] [--site .]

The app fetches each icon from memstechtips/package-icons at the path RepoIconKey.cs builds from the
item's ids, then trims its transparent border (AppIconResolver, alpha threshold 32). The originals run
to 15 MB, so this trims each one, fits it inside a 72x72 cell (twice the card's 36px icon box) and packs
every cell into one image, demo/icons/atlas.webp: one download and one decode, so switching tabs or views
draws every icon at once. demo/icons/index.json names the source commit, the grid, and each icon's cell
and source sha256 from the repo's manifest. tools/gen-demo.mjs reads that index and fails when it
disagrees with the repo's manifest, so re-run this whenever package-icons changes.
"""
import argparse
import json
import math
import os
import subprocess

from PIL import Image

SIZE = 72
ALPHA_TRIM = 32


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser()
    ap.add_argument('--repo', default=os.path.join(here, '..', '..', 'package-icons'))
    ap.add_argument('--site', default=os.path.join(here, '..'))
    a = ap.parse_args()

    manifest = json.load(open(os.path.join(a.repo, 'manifest.json')))['icons']
    commit = subprocess.check_output(['git', '-C', a.repo, 'rev-parse', 'HEAD'], text=True).strip()
    out_dir = os.path.join(a.site, 'demo', 'icons')
    rels = sorted(manifest)
    columns = math.ceil(math.sqrt(len(rels)))
    rows = math.ceil(len(rels) / columns)
    atlas = Image.new('RGBA', (columns * SIZE, rows * SIZE), (0, 0, 0, 0))
    index = {'source': 'memstechtips/package-icons@' + commit, 'cell': SIZE, 'columns': columns, 'rows': rows, 'icons': {}}
    for i, rel in enumerate(rels):
        im = Image.open(os.path.join(a.repo, 'icons', rel)).convert('RGBA')
        box = im.getchannel('A').point(lambda v: 255 if v >= ALPHA_TRIM else 0).getbbox()
        if box:
            im = im.crop(box)
        im.thumbnail((SIZE, SIZE), Image.LANCZOS)
        x, y = (i % columns) * SIZE, (i // columns) * SIZE
        atlas.paste(im, (x + (SIZE - im.width) // 2, y + (SIZE - im.height) // 2))
        index['icons'][rel] = {'cell': i, 'sha256': manifest[rel]['sha256']}
    os.makedirs(out_dir, exist_ok=True)
    atlas.save(os.path.join(out_dir, 'atlas.webp'), quality=90, method=6)
    with open(os.path.join(out_dir, 'index.json'), 'w', newline='\n') as f:
        json.dump(index, f, indent=1, sort_keys=True)
        f.write('\n')
    print(f'{len(rels)} icons in a {columns}x{rows} atlas from {index["source"]}')


if __name__ == '__main__':
    main()

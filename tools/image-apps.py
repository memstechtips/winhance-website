#!/usr/bin/env python3
"""Snapshot what a fresh Windows install has, read offline from one install.wim edition's hives.

    tools/image-apps.py <hive-dir> <out.json> --iso NAME --index N --name "Windows 11 Pro"

--name is the image's own name (wimlib-imagex info), since the SOFTWARE hive's ProductName still
says Windows 10 on Windows 11. <hive-dir> holds that edition's SOFTWARE and Users/Default NTUSER.DAT (the same extraction
winhance/extras/probe/image-probe.py reads). The landing page's Software & Apps demo shows the
apps it lists as installed; tools/gen-demo.mjs resolves each catalog item against it with the
app's own identity fields. Re-run after a Windows feature update and commit the result.

What counts as installed, matching how Winhance itself detects each kind:
  appx          package Name (PackageFullName up to the first "_"), from AppxAllUserStore
                Applications (provisioned for every new user) and InboxApplications. Winhance
                matches these names exactly (AppStatusDiscoveryService).
  capabilities  CBS CapabilityIndex entries with at least one package in state Installed (0x70).
Two apps ship as Win32 installs in the image and register their AppX identity on first run, so
they are recorded under that identity when the image carries them:
  Microsoft.MicrosoftEdge.Stable  Edge's Uninstall key in WOW6432Node
  Microsoft.OneDriveSync          OneDriveSetup in the default user's Run key
Optional features are not listed: the hives carry no enabled/disabled state for them (Windows
resolves it during setup), so the demo shows every one as off.
"""
import argparse
import json
import os

import hivex

INSTALLED = 0x70


class Hive:
    def __init__(self, path):
        self.h = hivex.Hivex(path)

    def node(self, path):
        n = self.h.root()
        for part in path.split('\\'):
            n = self.h.node_get_child(n, part)
            if n is None:
                return None
        return n

    def children(self, path):
        n = self.node(path)
        return [] if n is None else [(self.h.node_name(c), c) for c in self.h.node_children(n)]

    def values(self, node):
        return {self.h.value_key(v): self.h.value_value(v) for v in self.h.node_values(node)}

    def string(self, path, name):
        v = self.values(self.node(path)).get(name)
        return v[1].decode('utf-16le').rstrip('\0') if v else None

    def dword(self, node, name):
        v = self.values(node).get(name)
        return int.from_bytes(v[1][:4], 'little') if v else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('hive_dir')
    ap.add_argument('out')
    ap.add_argument('--iso', required=True)
    ap.add_argument('--index', type=int, required=True)
    ap.add_argument('--name', required=True)
    a = ap.parse_args()

    sw = Hive(os.path.join(a.hive_dir, 'SOFTWARE'))
    user = Hive(os.path.join(a.hive_dir, 'NTUSER.DAT'))

    store = r'Microsoft\Windows\CurrentVersion\Appx\AppxAllUserStore'
    appx = {name.split('_')[0] for sub in ('Applications', 'InboxApplications') for name, _ in sw.children(store + '\\' + sub)}
    if sw.node(r'WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Microsoft Edge') is not None:
        appx.add('Microsoft.MicrosoftEdge.Stable')
    run = user.node(r'Software\Microsoft\Windows\CurrentVersion\Run')
    if run is not None and 'OneDriveSetup' in user.values(run):
        appx.add('Microsoft.OneDriveSync')

    cbs = r'Microsoft\Windows\CurrentVersion\Component Based Servicing'
    packages = dict(sw.children(cbs + r'\Packages'))
    capabilities = set()
    for cap, node in sw.children(cbs + r'\CapabilityIndex'):
        for pkg in sw.values(node):
            if pkg in packages and sw.dword(packages[pkg], 'CurrentState') == INSTALLED:
                capabilities.add(cap)
                break

    nt = r'Microsoft\Windows NT\CurrentVersion'
    out = {
        'source': {
            'name': a.name,
            'iso': a.iso,
            'index': a.index,
            'edition': sw.string(nt, 'EditionID'),
            'version': sw.string(nt, 'DisplayVersion'),
            'build': sw.string(nt, 'CurrentBuild'),
        },
        'appx': sorted(appx, key=str.lower),
        'capabilities': sorted(capabilities, key=str.lower),
    }
    with open(a.out, 'w', newline='\n') as f:
        json.dump(out, f, indent=2)
        f.write('\n')
    print(f"{out['source']['edition']} {out['source']['version']}: {len(appx)} appx, {len(capabilities)} capabilities")


if __name__ == '__main__':
    main()

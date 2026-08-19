import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { vendorIcons } from '../vendor-icons.mjs';

const SOURCE_PATH = new URL('../icon-sources/icons.json', import.meta.url);
const source = JSON.parse(readFileSync(SOURCE_PATH, 'utf8'));

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

function stubCatalog() {
  return {
    features: [
      {
        id: 'Stub',
        settings: [
          { id: 'a', icon: { pack: 'Material', name: 'AccountCog' } },
          { id: 'b', icon: { pack: 'Fluent', name: 'Apps' } },
          { id: 'c', icon: { pack: 'Material', name: 'NotAnIcon' } },
        ],
      },
    ],
  };
}

test('vendorIcons resolves catalog icon identities from the source', () => {
  const catalog = stubCatalog();
  const { icons, meta, missing, unused } = vendorIcons({ catalog, source });

  assert.deepEqual(Object.keys(icons).sort(), ['Fluent/Apps', 'Material/AccountCog']);
  for (const key of Object.keys(icons)) {
    assert.match(icons[key].path, /^M/);
    assert.match(icons[key].viewBox, /^0 0 \d+ \d+$/);
  }
  assert.deepEqual(icons['Material/AccountCog'], source.icons['Material/AccountCog']);
  assert.deepEqual(icons['Fluent/Apps'], source.icons['Fluent/Apps']);

  assert.deepEqual(missing, ['Material/NotAnIcon']);

  assert.equal(unused.length, Object.keys(source.icons).length - 2);
  assert.ok(!unused.includes('Fluent/Apps'));
  assert.ok(!unused.includes('Material/AccountCog'));

  assert.deepEqual(meta, source._meta);
});

test('vendorIcons does not mutate its inputs', () => {
  const catalog = deepFreeze(stubCatalog());
  const frozenSource = deepFreeze({ _meta: source._meta, icons: source.icons });
  assert.doesNotThrow(() => vendorIcons({ catalog, source: frozenSource }));
});

test('vendorIcons dedupes repeated icon identities across settings', () => {
  const catalog = {
    features: [
      {
        id: 'Stub',
        settings: [
          { id: 'a', icon: { pack: 'Material', name: 'AccountCog' } },
          { id: 'b', icon: { pack: 'Material', name: 'AccountCog' } },
        ],
      },
    ],
  };
  const { icons, missing } = vendorIcons({ catalog, source });
  assert.deepEqual(Object.keys(icons), ['Material/AccountCog']);
  assert.deepEqual(missing, []);
});

function scratchDir() {
  return mkdtempSync(join(tmpdir(), 'vendor-icons-'));
}

test('CLI writes a deterministic, sorted icons.json and reports counts', () => {
  const dir = scratchDir();
  const catalogPath = join(dir, 'catalog.json');
  const sourcePath = join(dir, 'source.json');
  const outPath = join(dir, 'icons.json');
  writeFileSync(catalogPath, JSON.stringify(stubCatalog().features[0].settings.slice(0, 2).reduce(
    (acc, s) => { acc.features[0].settings.push(s); return acc; },
    { features: [{ id: 'Stub', settings: [] }] },
  )));
  writeFileSync(sourcePath, JSON.stringify(source));

  const cli = new URL('../vendor-icons.mjs', import.meta.url).pathname;
  const stdout = execFileSync('node', [cli, '--catalog', catalogPath, '--source', sourcePath, '--out', outPath], { encoding: 'utf8' });

  assert.match(stdout, /resolved 2, missing 0, unused \d+/);
  const written = readFileSync(outPath, 'utf8');
  assert.ok(written.endsWith('\n'));
  const parsed = JSON.parse(written);
  assert.deepEqual(Object.keys(parsed.icons), ['Fluent/Apps', 'Material/AccountCog']);
  assert.deepEqual(parsed._meta, source._meta);

  const again = execFileSync('node', [cli, '--catalog', catalogPath, '--source', sourcePath, '--out', outPath], { encoding: 'utf8' });
  assert.equal(again, stdout);
  assert.equal(readFileSync(outPath, 'utf8'), written);
});

test('CLI exits 1 and prints missing names without writing when an icon is unresolved', () => {
  const dir = scratchDir();
  const catalogPath = join(dir, 'catalog.json');
  const sourcePath = join(dir, 'source.json');
  const outPath = join(dir, 'icons.json');
  writeFileSync(catalogPath, JSON.stringify(stubCatalog()));
  writeFileSync(sourcePath, JSON.stringify(source));

  const cli = new URL('../vendor-icons.mjs', import.meta.url).pathname;
  let code = 0;
  let stderr = '';
  try {
    execFileSync('node', [cli, '--catalog', catalogPath, '--source', sourcePath, '--out', outPath], { encoding: 'utf8' });
  } catch (e) {
    code = e.status;
    stderr = e.stderr;
  }
  assert.equal(code, 1);
  assert.match(stderr, /Material\/NotAnIcon/);
  assert.throws(() => readFileSync(outPath, 'utf8'));
});

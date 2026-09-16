import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cutFixture } from '../cut-fixture.mjs';

function catalog() {
  return {
    winhanceVersion: '26.09.10',
    features: [
      { id: 'Theme', settings: [{ id: 'theme-a', v: 'fresh' }, { id: 'theme-b', v: 'fresh' }] },
      { id: 'Autounattend', settings: [{ id: 'unattend-a', v: 'fresh' }] },
    ],
  };
}

test('an id already in the fixture is refreshed in place and its version stamp follows the export', () => {
  const fixture = { winhanceVersion: '26.08.20', settingCount: 1, features: [{ id: 'Theme', settings: [{ id: 'theme-b', v: 'stale' }] }] };
  const out = cutFixture(fixture, catalog(), ['theme-b']);
  assert.deepEqual(out.features[0].settings, [{ id: 'theme-b', v: 'fresh' }]);
  assert.equal(out.winhanceVersion, '26.09.10');
  assert.equal(out.settingCount, 1);
});

test('a new id lands in export order, creating the feature wrapper the fixture never carried', () => {
  const fixture = { winhanceVersion: '26.08.20', settingCount: 1, features: [{ id: 'Theme', settings: [{ id: 'theme-b', v: 'stale' }] }] };
  const out = cutFixture(fixture, catalog(), ['unattend-a', 'theme-a']);
  assert.deepEqual(out.features.map((f) => f.id), ['Theme', 'Autounattend']);
  // Appended after what the fixture held, not sorted into the export's position: the cutter keeps existing rows.
  assert.deepEqual(out.features[0].settings.map((s) => s.id), ['theme-b', 'theme-a']);
  assert.deepEqual(out.features[1].settings.map((s) => s.id), ['unattend-a']);
  assert.equal(out.settingCount, 3);
});

test('an id the export does not carry is an error, not a silent skip', () => {
  const fixture = { winhanceVersion: '26.08.20', settingCount: 0, features: [] };
  assert.throws(() => cutFixture(fixture, catalog(), ['theme-a', 'nope']), /not in the export: nope/);
});

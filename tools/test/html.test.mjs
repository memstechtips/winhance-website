import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc, slug } from '../lib/html.mjs';

test('esc escapes the five html specials and tolerates null', () => {
  assert.equal(esc(`a<b>&"c'`), 'a&lt;b&gt;&amp;&quot;c&#39;');
  assert.equal(esc(null), '');
  assert.equal(esc(0), '0');
});

test('slug lowercases, replaces & with and, collapses punctuation', () => {
  assert.equal(slug('Privacy & Security'), 'privacy-and-security');
  assert.equal(slug('  System  Sounds '), 'system-sounds');
  assert.equal(slug('Files and Folders'), 'files-and-folders');
});

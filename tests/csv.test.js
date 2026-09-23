import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsvEntries, loadFolder } from '../src/data.js';
import { restoreCollection } from '../src/collections.js';

test('CSV accepts Excel BOM, CRLF, semicolons, Unicode and empty image paths', () => {
  const entries = parseCsvEntries('\uFEFFtext;image\r\n Jürgen ;images/photo.jpg\r\nText only;\r\n;\r\n');
  assert.equal(entries.length, 2);
  assert.equal(entries[0].text, 'Jürgen');
  assert.equal(entries[0].image, 'images/photo.jpg');
  assert.equal(entries[1].image, null);
  assert.ok(entries.every(entry => entry.category === ''));
});

test('CSV preserves quoted delimiters, escaped quotes and multiline text', () => {
  const [entry] = parseCsvEntries('text,image\n"Hello, ""Alex""; welcome\nto the draw","images/a,b.jpg"');
  assert.equal(entry.text, 'Hello, "Alex"; welcome\nto the draw');
  assert.equal(entry.image, 'images/a,b.jpg');
  assert.equal(parseCsvEntries('"IMAGE";"TEXT"\n;"Hello; world"')[0].text, 'Hello; world');
});

test('CSV generates unique repeatable IDs, preserving identity when rows move', () => {
  const entries = parseCsvEntries('text,image\nAlex,\nAlex,\nBob,');
  const reordered = parseCsvEntries('text,image\nBob,\nAlex,\nAlex,');
  assert.equal(new Set(entries.map(entry => entry.id)).size, 3);
  assert.deepEqual(entries.map(entry => entry.id).sort(), reordered.map(entry => entry.id).sort());
  const restored = restoreCollection({ id: 'csv-test', entries, images: new Map(), selectedIds: entries.map(entry => entry.id) });
  assert.deepEqual(restored.entries, entries);
  assert.equal(restored.selectedIds.length, 3);
});

test('CSV imports optional sub text and preserves it when restoring a collection', () => {
  const entries = parseCsvEntries('sub;text;image\n" Extra; details ";Alex;\n   ;Bob;');
  assert.equal(entries[0].sub, 'Extra; details');
  assert.equal(entries[1].sub, '');
  const restored = restoreCollection({ id: 'sub-test', entries, images: new Map() });
  assert.deepEqual(restored.entries, entries);
  const [legacy] = parseCsvEntries('text,image\nBob,');
  assert.equal(legacy.sub, '');
  assert.equal(entries[1].id, legacy.id);
  const reordered = parseCsvEntries('text,image,sub\nAlex,,Second\nAlex,,First');
  const original = parseCsvEntries('text,image,sub\nAlex,,First\nAlex,,Second');
  assert.deepEqual(original.map(entry => entry.id).sort(), reordered.map(entry => entry.id).sort());
  assert.notEqual(original[0].id, original[1].id);
  assert.throws(() => parseCsvEntries('text,image,sub,sub\nAlex,,,extra'), /column/);
  assert.throws(() => parseCsvEntries('text,image,sub\nAlex,'), /row 2/);
});

test('CSV rejects invalid headers, malformed quotes, missing text and unsafe paths', () => {
  for (const source of ['', 'text,image', 'text,category\nA,B', 'text,image,extra\nA,,',
    'text,image\nA', 'text,image\nA,,', 'text,image\n,image.jpg',
    'text,image\n"Unclosed,', 'text,image\nA"B,', 'text,image\n"A"oops,',
    'text,image\nA,../secret.jpg', 'text,image\nA,https://example.com/a.jpg']) {
    assert.throws(() => parseCsvEntries(source), /CSV/);
  }
  assert.throws(() => parseCsvEntries('text,image\n"Multi\nline",\n,photo.jpg'), /row 4/);
});

test('folder import loads CSV images and rejects nested or ambiguous manifests', async () => {
  const manifest = { webkitRelativePath: 'team/entries.csv', text: async () => 'text,image\nAlex,images/a.jpg\nText only,' };
  const image = { webkitRelativePath: 'team/images/a.jpg' };
  const loaded = await loadFolder([manifest, image, { webkitRelativePath: 'team/unrelated.jpg' }]);
  assert.equal(loaded.name, 'team');
  assert.equal(loaded.entries.length, 2);
  assert.equal(loaded.images.size, 1);
  assert.equal(loaded.images.get('images/a.jpg'), image);
  await assert.rejects(loadFolder([{ ...manifest, webkitRelativePath: 'parent/team/entries.csv' }]));
  await assert.rejects(loadFolder([manifest, { webkitRelativePath: 'team/entries.json' }]), /only one/);
});

test('folder import accepts arbitrary filenames and case-insensitive extensions', async () => {
  for (const filename of ['participants.csv', 'My List.CSV', 'people.json', 'Draw Data.JsOn']) {
    const manifest = {
      webkitRelativePath: `team/${filename}`,
      text: async () => /\.csv$/i.test(filename) ? 'text,image\nAlex,' : '[{"id":"alex","text":"Alex"}]',
    };
    const loaded = await loadFolder([manifest, { webkitRelativePath: 'team/images/metadata.json' }, { webkitRelativePath: 'team/notes.csv.bak' }]);
    assert.equal(loaded.entries[0].text, 'Alex');
    assert.equal(loaded.name, 'team');
    await assert.rejects(loadFolder([{ ...manifest, webkitRelativePath: `team/nested/${filename}` }]));
    await assert.rejects(loadFolder([manifest, { webkitRelativePath: 'team/another.csv' }]), /only one/);
  }
  await assert.rejects(loadFolder([{ webkitRelativePath: 'team/people.csv.bak' }]), /directly contains/);
});

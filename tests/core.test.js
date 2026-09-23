import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEntries, safeImagePath, loadFolder } from '../src/data.js';
import { draw, eligibleEntries, randomInt } from '../src/random.js';
const entries = Array.from({ length: 8 }, (_, i) => ({ id: String(i), text: `Person ${i}` }));
test('accepts list and wrapped datasets, trims values, preserves duplicate text', () => {
  const input = [{ id: ' a ', text: ' Alex ' }, { id: 'b', text: 'Alex', image: 'images/alex.jpg' }];
  for (const data of [input, { entries: input }]) {
    const result = parseEntries(JSON.stringify(data));
    assert.equal(result[0].id, 'a'); assert.equal(result[0].text, 'Alex'); assert.equal(result.length, 2);
  }
});
test('rejects invalid JSON, empty data, duplicate IDs, invalid fields and unsafe images', () => {
  for (const source of ['{', '{}', '[]', '[null]', '[{"id":"a"}]', '[{"id":1,"text":"a"}]', '[{"id":"a","text":"a","category":3}]', '[{"id":"a","text":"a","image":3}]', '[{"id":"a","text":"a"},{"id":" a ","text":"b"}]', '[{"id":"a","text":"a","image":"../secret.png"}]']) assert.throws(() => parseEntries(source));
});
test('JSON supports optional sub text while retaining category and rejects non-text values', () => {
  const [entry] = parseEntries(JSON.stringify([{ id: 'a', text: 'Alex', category: 'Team', sub: ' Extra details ' }]));
  assert.equal(entry.sub, 'Extra details');
  assert.equal(entry.category, 'Team');
  for (const sub of [undefined, null, '', '   ']) {
    assert.equal(parseEntries(JSON.stringify([{ id: 'a', text: 'Alex', sub }]))[0].sub, '');
  }
  for (const sub of [12, false, [], {}]) {
    assert.throws(() => parseEntries(JSON.stringify([{ id: 'a', text: 'Alex', sub }])), /sub must be text/);
  }
});
test('rejects absolute paths, traversal, URLs and encoded path tricks', () => {
  for (const path of ['/a.png', '../a.png', 'images/../a.png', 'C:\\a.png', 'https://x/a.png', '//x/a', 'images/%2e%2e/a', './a.png', 'images//a.png', 'a.png?x=1']) assert.equal(safeImagePath(path), null);
  assert.equal(safeImagePath('images/A photo.jpg'), 'images/A photo.jpg');
});
test('folder loader requires a root manifest and retains only referenced images', async () => {
  const manifest = { webkitRelativePath: 'team/entries.json', text: async () => JSON.stringify([{ id: 'a', text: 'A', image: 'images/a.png' }, { id: 'b', text: 'B', image: 'missing.jpg' }]) };
  const image = { webkitRelativePath: 'team/images/a.png' };
  const data = await loadFolder([manifest, image, { webkitRelativePath: 'team/private.txt' }]);
  assert.equal(data.name, 'team'); assert.equal(data.images.size, 1); assert.equal(data.images.get('images/a.png'), image); assert.equal(data.entries.length, 2);
  await assert.rejects(loadFolder([{ ...manifest, webkitRelativePath: 'parent/team/entries.json' }]));
});
test('selection mode uses checked IDs, global mode uses all', () => {
  const selected = new Set(['2', '4', '6', 'missing']);
  assert.deepEqual(eligibleEntries(entries, selected, 'selected').map(x => x.id), ['2', '4', '6']);
  assert.equal(eligibleEntries(entries, selected, 'all').length, 8);
});
test('draw respects bounds, returns unique eligible entries and does not mutate input', () => {
  const original = structuredClone(entries);
  for (let count = 1; count <= 8; count++) {
    const results = draw(entries, count);
    assert.equal(results.length, count); assert.equal(new Set(results.map(x => x.id)).size, count);
    assert.ok(results.every(entry => entries.includes(entry)));
  }
  assert.deepEqual(entries, original);
  for (const count of [0, -1, 9, 1.5, NaN]) assert.throws(() => draw(entries, count));
  assert.throws(() => draw([], 1));
});
test('Fisher–Yates maps all possible random choices to all six three-item permutations', () => {
  const permutations = new Set();
  for (let first = 0; first < 3; first++) for (let second = 0; second < 2; second++) {
    const choices = [first, second];
    permutations.add(draw([1, 2, 3], 3, () => choices.shift()).join(','));
  }
  assert.equal(permutations.size, 6);
});
test('secure random integers respect bounds, including singleton pools', () => {
  assert.equal(randomInt(1), 0);
  for (let i = 0; i < 100; i++) { const value = randomInt(7); assert.ok(value >= 0 && value < 7 && Number.isInteger(value)); }
  for (const max of [0, -1, 1.5, Infinity, 0x100000001]) assert.throws(() => randomInt(max));
});

test('completed draws never repeat across plays or mode changes until reset', () => {
  const history = new Set();
  const selected = new Set(entries.slice(0, 4).map(entry => entry.id));
  const first = draw(eligibleEntries(entries, selected, 'selected', history), 2);
  first.forEach(entry => history.add(entry.id));
  assert.equal(eligibleEntries(entries, selected, 'selected', history).length, 2);
  assert.equal(eligibleEntries(entries, selected, 'all', history).length, 6);
  while (history.size < entries.length) {
    const [entry] = draw(eligibleEntries(entries, selected, 'all', history), 1);
    assert.ok(!history.has(entry.id));
    history.add(entry.id);
  }
  assert.equal(eligibleEntries(entries, selected, 'all', history).length, 0);
  assert.equal(eligibleEntries(entries, selected, 'selected', history).length, 0);
  history.clear();
  assert.equal(eligibleEntries(entries, selected, 'all', history).length, 8);
  assert.equal(eligibleEntries(entries, selected, 'selected', history).length, 4);
});

test('insufficient remaining entries cannot silently repeat previous winners', () => {
  const remaining = eligibleEntries(entries, new Set(), 'all', new Set(entries.slice(0, 7).map(entry => entry.id)));
  assert.throws(() => draw(remaining, 2));
  assert.equal(draw(remaining, 1)[0].id, '7');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreCollection, collectionPool, configurationProblem, migrateLegacyDataset } from '../src/collections.js';
import { draw } from '../src/random.js';
const entries = [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }];
const collection = (overrides = {}) => ({ id: 'one', name: 'Team', entries, images: new Map(), selectedIds: ['a', 'b'], mode: 'shuffle', count: 1, ...overrides });

test('restores selection and Pick settings, filtering IDs no longer in the dataset', () => {
  const saved = collection({ selectedIds: ['b', 'missing'], mode: 'pick', count: 2 });
  const restored = restoreCollection(saved);
  assert.deepEqual(restored.selectedIds, ['b']);
  assert.equal(restored.mode, 'pick');
  assert.equal(restored.count, 2);
  assert.deepEqual(saved.selectedIds, ['b', 'missing']);
  assert.ok(configurationProblem(restored));
});
test('both modes use selected entries and exclude prior winners', () => {
  for (const mode of ['shuffle', 'pick']) {
    const item = collection({ mode });
    assert.deepEqual(collectionPool(item).map(entry => entry.id), ['a', 'b']);
    assert.deepEqual(collectionPool(item, new Set(['a'])).map(entry => entry.id), ['b']);
  }
});
test('Shuffle exhausts its pool; editing modes does not restore previous winners', () => {
  const item = collection();
  const pool = collectionPool(item);
  const history = new Set(draw(pool, pool.length).map(entry => entry.id));
  assert.equal(collectionPool(item, history).length, 0);
  assert.deepEqual(collectionPool({ ...item, mode: 'pick', selectedIds: ['a', 'b', 'c'] }, history).map(entry => entry.id), ['c']);
  history.clear();
  assert.equal(collectionPool(item, history).length, 2);
});
test('Pick validates integer counts and selection size; Shuffle ignores result count', () => {
  for (const count of [0, -1, 1.5, NaN, 3]) assert.ok(configurationProblem(collection({ mode: 'pick', count })));
  assert.equal(configurationProblem(collection({ mode: 'pick', count: 2 })), '');
  assert.equal(configurationProblem(collection({ count: NaN })), '');
  assert.ok(configurationProblem(collection({ selectedIds: [] })));
  assert.ok(configurationProblem(collection({ selectedIds: ['missing'] })));
  assert.ok(configurationProblem(collection({ entries: [] })));
});
test('legacy snapshot converts to a selectable collection with images intact', () => {
  const images = new Map([['a.png', new Blob(['image'])]]);
  const legacy = { name: 'Old collection', entries, images };
  const migrated = migrateLegacyDataset(legacy);
  assert.equal(migrated.id, 'legacy');
  assert.equal(migrated.name, 'Old collection');
  assert.equal(migrated.images, images);
  assert.deepEqual(migrated.selectedIds, ['a', 'b', 'c']);
  assert.equal(migrated.mode, 'shuffle');
  assert.equal(configurationProblem(migrated), '');
  assert.equal(legacy.id, undefined);
  assert.equal(migrateLegacyDataset(undefined), null);
});
test('invalid stored data is rejected without silently restoring broken collections', () => {
  for (const value of [collection({ id: '' }), collection({ images: {} }), collection({ entries: [] }), collection({ selectedIds: 42 })]) assert.throws(() => restoreCollection(value));
  assert.throws(() => migrateLegacyDataset({ entries: [] }));
});

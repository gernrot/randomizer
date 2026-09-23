import { parseEntries } from './data.js';
import { eligibleEntries } from './random.js';

export function restoreCollection(value) {
  if (typeof value.id !== 'string' || !value.id) throw new Error('Invalid collection ID.');
  const entries = parseEntries(JSON.stringify(value.entries));
  if (!(value.images instanceof Map)) throw new Error('Invalid saved images.');
  const ids = new Set(entries.map(entry => entry.id));
  return {
    id: value.id,
    name: String(value.name || 'Untitled collection'),
    entries,
    images: value.images,
    selectedIds: (value.selectedIds || []).filter(id => ids.has(id)),
    mode: value.mode === 'pick' ? 'pick' : 'shuffle',
    count: Number.isInteger(value.count) && value.count > 0 ? value.count : 1,
  };
}
export function collectionPool(collection, history = new Set()) {
  return eligibleEntries(collection.entries, new Set(collection.selectedIds), 'selected', history);
}
export function configurationProblem(collection) {
  if (!collection?.entries.length) return 'Select a folder containing a .csv or .json file to get started.';
  const size = collectionPool(collection).length;
  if (!size) return 'Select at least one entry.';
  if (collection.mode === 'pick' && (!Number.isInteger(collection.count) || collection.count < 1)) return 'Enter a whole number of results, starting at 1.';
  if (collection.mode === 'pick' && collection.count > size) return `Select at least ${collection.count} entries or lower the result count.`;
  return '';
}

export function migrateLegacyDataset(value) {
  if (!value) return null;
  const entries = parseEntries(JSON.stringify(value.entries));
  return restoreCollection({ ...value, id: 'legacy', entries, selectedIds: entries.map(entry => entry.id), mode: 'shuffle', count: 1 });
}

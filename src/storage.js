import { migrateLegacyDataset } from './collections.js';

function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('randomizer', 2);
    let blocked = false;
    request.onupgradeneeded = () => {
      const db = request.result;
      const collections = db.createObjectStore('collections', { keyPath: 'id' });
      if (db.objectStoreNames.contains('datasets')) {
        const legacy = request.transaction.objectStore('datasets').get('last');
        legacy.onsuccess = () => {
          try {
            const migrated = migrateLegacyDataset(legacy.result);
            if (migrated) collections.put(migrated);
          } catch { /* Preserve an unreadable legacy record without blocking new collections. */ }
        };
      }
    };
    request.onsuccess = () => { if (blocked) { request.result.close(); return; } request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onerror = () => reject(request.error);
    request.onblocked = () => { blocked = true; reject(new Error('Close other Randomizer tabs and reload to update saved collections.')); };
  });
}
async function operation(mode, action) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('collections', mode);
      const request = action(tx.objectStore('collections'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Storage transaction aborted.'));
    });
  } finally { db.close(); }
}
export function saveCollection(collection) { return operation('readwrite', store => store.put(collection)); }
export function restoreCollections() { return operation('readonly', store => store.getAll()); }

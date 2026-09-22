const KEY = 'randomizer.lastDataset';
function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('randomizer', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('datasets');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Storage is blocked by another tab.'));
  });
}
async function operation(mode, action) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('datasets', mode);
      const request = action(tx.objectStore('datasets'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Storage transaction aborted.'));
    });
  } finally { db.close(); }
}
export async function saveDataset(dataset) {
  await operation('readwrite', store => store.put(dataset, 'last'));
  // Local storage remembers the folder label; IndexedDB holds the files themselves.
  try { localStorage.setItem(KEY, JSON.stringify({ name: dataset.name, savedAt: Date.now() })); } catch { /* The dataset remains available in IndexedDB. */ }
}
export async function restoreDataset() {
  return operation('readonly', store => store.get('last'));
}
export async function forgetDataset() {
  await operation('readwrite', store => store.delete('last'));
  try { localStorage.removeItem(KEY); } catch { /* Storage may be unavailable. */ }
}

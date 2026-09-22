export function safeImagePath(path) {
  if (typeof path !== 'string' || !path.trim()) return null;
  const value = path.trim();
  if (value.startsWith('/') || value.includes('\\') || value.includes(':') || value.includes('?') || value.includes('#') || value.includes('%') || value.split('/').some(part => !part || part === '..' || part === '.')) return null;
  return value;
}

export function parseEntries(source) {
  let data;
  try { data = JSON.parse(source); } catch { throw new Error('entries.json is not valid JSON. Check commas, quotes, and brackets.'); }
  const entries = Array.isArray(data) ? data : data?.entries;
  if (!Array.isArray(entries) || !entries.length) throw new Error('entries.json must contain a non-empty array, or an object with a non-empty entries array.');
  const ids = new Set();
  return entries.map((entry, index) => {
    const label = `Entry ${index + 1}`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`${label} must be an object.`);
    if (typeof entry.id !== 'string' || !entry.id.trim()) throw new Error(`${label} needs a non-empty string id.`);
    const id = entry.id.trim();
    if (ids.has(id)) throw new Error(`${label} has duplicate id "${id}".`);
    ids.add(id);
    if (typeof entry.text !== 'string' || !entry.text.trim()) throw new Error(`${label} needs non-empty text.`);
    if (entry.category != null && typeof entry.category !== 'string') throw new Error(`${label}: category must be text.`);
    if (entry.image != null && typeof entry.image !== 'string') throw new Error(`${label}: image must be a relative path string.`);
    if (entry.image?.trim() && !safeImagePath(entry.image)) throw new Error(`${label}: image must be a relative path inside the selected folder (for example images/alex.jpg).`);
    return { id, text: entry.text.trim(), category: entry.category?.trim() || '', image: safeImagePath(entry.image) };
  });
}

export async function loadFolder(fileList) {
  const files = [...fileList];
  const manifest = files.find(file => {
    const parts = file.webkitRelativePath.split('/');
    return parts.length === 2 && parts[1] === 'entries.json';
  });
  if (!manifest) throw new Error('Select the folder that directly contains entries.json, not its parent or the images subfolder.');
  const name = manifest.webkitRelativePath.split('/')[0];
  const entries = parseEntries(await manifest.text());
  const referenced = new Set(entries.map(entry => entry.image).filter(Boolean));
  const images = new Map();
  for (const file of files) {
    const path = file.webkitRelativePath.slice(name.length + 1);
    if (referenced.has(path)) images.set(path, file);
  }
  return { name, entries, images };
}

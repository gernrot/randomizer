export function safeImagePath(path) {
  if (typeof path !== 'string' || !path.trim()) return null;
  const value = path.trim();
  if (value.startsWith('/') || value.includes('\\') || value.includes(':') || value.includes('?') || value.includes('#') || value.includes('%') || value.split('/').some(part => !part || part === '..' || part === '.')) return null;
  return value;
}

export function parseEntries(source) {
  let data;
  try { data = JSON.parse(source); } catch { throw new Error('Invalid JSON. Check commas, quotes, and brackets.'); }
  const entries = Array.isArray(data) ? data : data?.entries;
  if (!Array.isArray(entries) || !entries.length) throw new Error('The JSON data must contain a non-empty array, or an object with a non-empty entries array.');
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
    if (entry.sub != null && typeof entry.sub !== 'string') throw new Error(`${label}: sub must be text.`);
    if (entry.image != null && typeof entry.image !== 'string') throw new Error(`${label}: image must be a relative path string.`);
    if (entry.image?.trim() && !safeImagePath(entry.image)) throw new Error(`${label}: image must be a relative path inside the selected folder (for example images/alex.jpg).`);
    return { id, text: entry.text.trim(), category: entry.category?.trim() || '', sub: entry.sub?.trim() || '', image: safeImagePath(entry.image) };
  });
}

export function parseCsvEntries(source) {
  source = source.replace(/^\uFEFF/, '');
  const rows = [];
  let cells = [], value = '', quoted = false, closed = false, delimiter = null;
  let line = 1, rowLine = 1;
  const fail = message => { throw new Error(`CSV row ${rowLine}: ${message}`); };
  const endCell = () => { cells.push(value); value = ''; closed = false; };
  const endRow = () => {
    endCell();
    if (cells.some(cell => cell.trim())) rows.push({ cells, line: rowLine });
    cells = [];
  };
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') { value += '"'; i++; }
        else { quoted = false; closed = true; }
      } else {
        value += char;
        if (char === '\n' || (char === '\r' && source[i + 1] !== '\n')) line++;
      }
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      endRow(); line++; rowLine = line;
    } else if (char === delimiter || (!delimiter && !rows.length && (char === ',' || char === ';'))) {
      delimiter ||= char;
      endCell();
    } else if (char === '"') {
      if (value || closed) fail('Unexpected quote. Quote the entire field and double any quotes inside it.');
      quoted = true;
    } else {
      if (closed) fail('Unexpected text after a closing quote.');
      value += char;
    }
  }
  if (quoted) fail('Unclosed quoted field.');
  endRow();
  const headers = rows.shift()?.cells.map(cell => cell.trim().toLowerCase());
  if (!headers || !headers.includes('text') || !headers.includes('image') || new Set(headers).size !== headers.length || headers.some(header => !['text', 'image', 'sub'].includes(header))) {
    throw new Error('The CSV file must have text and image column headers, with an optional sub column (comma or semicolon separated).');
  }
  if (!rows.length) throw new Error('The CSV file must contain at least one entry.');
  const occurrences = new Map();
  return rows.map(row => {
    rowLine = row.line;
    if (row.cells.length !== headers.length) fail(`Expected ${headers.length} fields matching the column headers.`);
    const text = row.cells[headers.indexOf('text')].trim();
    const image = row.cells[headers.indexOf('image')].trim();
    const sub = headers.includes('sub') ? row.cells[headers.indexOf('sub')].trim() : '';
    if (!text) fail('Text must not be empty.');
    if (image && !safeImagePath(image)) fail('Image must be a relative path inside the selected folder (for example images/alex.jpg).');
    const identity = sub ? [text, image, sub] : [text, image];
    const key = JSON.stringify(identity);
    const occurrence = (occurrences.get(key) || 0) + 1;
    occurrences.set(key, occurrence);
    return { id: `csv:${JSON.stringify([...identity, occurrence])}`, text, image: image || null, category: '', sub };
  });
}

export async function loadFolder(fileList) {
  const files = [...fileList];
  const manifests = files.filter(file => {
    const parts = file.webkitRelativePath.split('/');
    return parts.length === 2 && /\.(json|csv)$/i.test(parts[1]);
  });
  if (!manifests.length) throw new Error('Select the folder that directly contains a .csv or .json file, not its parent or the images subfolder.');
  if (manifests.length > 1) throw new Error('Keep only one .csv or .json file directly in the selected folder.');
  const [manifest] = manifests;
  const name = manifest.webkitRelativePath.split('/')[0];
  const entries = /\.csv$/i.test(manifest.webkitRelativePath) ? parseCsvEntries(await manifest.text()) : parseEntries(await manifest.text());
  const referenced = new Set(entries.map(entry => entry.image).filter(Boolean));
  const images = new Map();
  for (const file of files) {
    const path = file.webkitRelativePath.slice(name.length + 1);
    if (referenced.has(path)) images.set(path, file);
  }
  return { name, entries, images };
}

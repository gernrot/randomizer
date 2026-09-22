import { loadFolder, parseEntries } from './data.js';
import { draw, eligibleEntries, randomInt } from './random.js';
import { saveDataset, restoreDataset, forgetDataset } from './storage.js';

const $ = id => document.getElementById(id);
const placeholder = new URL('../assets/placeholder.svg', import.meta.url).href;
let dataset = { name: '', entries: [], images: new Map() };
let selected = new Set();
const drawn = new Set();
let busy = false;
let urls = new Map();
let broken = new Set();
let observer;
let mode = 'all';
let controlsScroll = 0;

function focusResults() {
  if (!document.body.classList.contains('results-focus')) controlsScroll = window.scrollY;
  document.body.classList.add('results-focus');
  $('back-to-controls').hidden = false;
  window.scrollTo(0, 0);
  $('results').scrollTop = 0;
  (busy ? $('back-to-controls') : $('results')).focus({ preventScroll: true });
}
function returnToControls() {
  if (!document.body.classList.contains('results-focus')) return;
  document.body.classList.remove('results-focus');
  $('back-to-controls').hidden = true;
  window.scrollTo(0, controlsScroll);
  ($('play').disabled ? document.querySelector('.brand') : $('play')).focus({ preventScroll: true });
}

function notice(id, message = '') { $(id).textContent = message; $(id).hidden = !message; }
function pool() { return eligibleEntries(dataset.entries, selected, mode, drawn); }
function requestedCount() { return mode === 'selected' && !$('limit').checked ? pool().length : Number($('result-count').value); }
function imageUrl(entry) {
  if (!entry.image || broken.has(entry.image) || !dataset.images.has(entry.image)) return placeholder;
  if (!urls.has(entry.image)) urls.set(entry.image, URL.createObjectURL(dataset.images.get(entry.image)));
  return urls.get(entry.image);
}
function showImage(img, entry) {
  img.alt = '';
  img.onerror = () => { if (entry.image) broken.add(entry.image); img.onerror = null; img.src = placeholder; };
  const url = imageUrl(entry);
  if (img.getAttribute('src') !== url) img.src = url;
}
function setBusy(value) {
  busy = value;
  $('library-controls').disabled = value;
  $('draw-controls').disabled = value;
  updateControls();
}
function updateControls() {
  const eligible = pool();
  const count = requestedCount();
  $('selection-count').textContent = `${selected.size} selected`;
  $('limit-label').hidden = mode !== 'selected';
  $('count-label').hidden = mode === 'selected' && !$('limit').checked;
  $('result-count').max = eligible.length;
  $('pool-summary').textContent = mode === 'selected' && !$('limit').checked ? `Shuffling all ${eligible.length} remaining selected entries` : `Picking ${Number.isInteger(count) && count > 0 ? count : '…'} from ${eligible.length} remaining ${mode === 'selected' ? 'selected entries' : 'entries'}`;
  let problem = '';
  if (!dataset.entries.length) problem = 'Open a data folder or try the example to get started.';
  else if (mode === 'selected' && !selected.size) problem = 'Check at least one entry to include in your draw.';
  else if (!eligible.length) problem = 'All entries in this pool have been drawn. Press Reset to make them available again.';
  else if (!Number.isInteger(count) || count < 1) problem = 'Enter a whole number of results, starting at 1.';
  else if (count > eligible.length) problem = `Only ${eligible.length} entries remain. Lower the result count, expand the pool, or press Reset.`;
  $('validation').textContent = problem;
  $('play').disabled = busy || !!problem;
  $('reset-draw').disabled = busy || !drawn.size;
  $('draw-progress').textContent = `${eligible.length} remaining in this pool · ${drawn.size} drawn overall`;
  $('select-visible').disabled = busy || !visibleEntries().length;
  $('clear-selection').disabled = busy || !selected.size;
}
function visibleEntries() {
  const query = $('search').value.trim().toLocaleLowerCase();
  const category = $('category').value;
  return dataset.entries.filter(entry => (!category || entry.category === category) && (!query || `${entry.text} ${entry.category}`.toLocaleLowerCase().includes(query)));
}
function renderEntries() {
  observer?.disconnect();
  const container = $('entries');
  container.replaceChildren();
  const visible = visibleEntries();
  if (!visible.length) {
    const empty = document.createElement('p');
    empty.className = 'list-empty';
    empty.textContent = dataset.entries.length ? 'No entries match these filters.' : 'Your next possibility starts here.\nOpen a folder, or explore the example collection.';
    container.append(empty);
  }
  observer = 'IntersectionObserver' in window ? new IntersectionObserver(items => {
    for (const item of items) if (item.isIntersecting) { showImage(item.target, item.target.entry); observer.unobserve(item.target); }
  }, { root: container, rootMargin: '100px' }) : null;
  for (const entry of visible) {
    const row = document.createElement('label'); row.className = 'entry-row';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = selected.has(entry.id);
    checkbox.addEventListener('change', () => { if (checkbox.checked) selected.add(entry.id); else selected.delete(entry.id); updateControls(); });
    const img = document.createElement('img'); img.width = 38; img.height = 38; img.alt = ''; img.loading = 'lazy'; img.src = placeholder;
    const copy = document.createElement('span'); copy.className = 'entry-copy';
    const title = document.createElement('strong'); title.textContent = entry.text;
    const subtitle = document.createElement('small'); subtitle.textContent = entry.category || 'Uncategorized';
    copy.append(title, subtitle); row.append(checkbox, img, copy); container.append(row);
    img.entry = entry;
    if (observer) observer.observe(img); else showImage(img, entry);
  }
  updateControls();
}
function applyDataset(next) {
  returnToControls();
  observer?.disconnect();
  for (const url of urls.values()) URL.revokeObjectURL(url);
  urls = new Map(); broken = new Set(); dataset = next; selected = new Set();
  drawn.clear();
  $('search').value = ''; $('category').replaceChildren(new Option('All categories', ''));
  for (const category of [...new Set(next.entries.map(entry => entry.category).filter(Boolean))].sort()) $('category').add(new Option(category, category));
  $('dataset-name').textContent = next.name || 'Bring your own list';
  $('dataset-detail').textContent = next.entries.length ? `${next.images.size} local image${next.images.size === 1 ? '' : 's'} · entries.json` : 'A folder with entries.json + images';
  $('entry-count').textContent = `${next.entries.length} entries`;
  $('forget').hidden = !next.entries.length;
  $('results').replaceChildren(); $('results').hidden = true; $('empty-result').hidden = false;
  $('announcement').textContent = ''; $('play-label').textContent = 'Play';
  $('result-count').value = '1'; $('limit').checked = false;
  renderEntries();
}
async function importDataset(loader) {
  if (busy) return;
  setBusy(true); notice('error'); notice('storage-note');
  try {
    const next = await loader();
    applyDataset(next);
    try { await saveDataset(next); notice('storage-note', 'Saved in this browser for next time. Reopen the folder to load changes to its files.'); }
    catch {
      // Do not let an older collection unexpectedly return after a failed replacement.
      try { await forgetDataset(); } catch { /* Storage may be completely unavailable. */ }
      notice('storage-note', 'Loaded for this session, but browser storage could not save it. You may need to reopen the folder next time.');
    }
    $('announcement').textContent = `Loaded ${next.entries.length} entries from ${next.name}.`;
  } catch (error) { notice('error', error.message); }
  finally { setBusy(false); }
}
function makeCard(index) {
  const card = document.createElement('article'); card.className = 'result-card';
  const badge = document.createElement('span'); badge.className = 'result-number'; badge.textContent = String(index + 1).padStart(2, '0');
  const img = document.createElement('img'); img.alt = ''; img.width = 110; img.height = 110;
  const title = document.createElement('h3'); const category = document.createElement('p');
  card.append(badge, img, title, category);
  return { card, img, title, category };
}
function fillCard(slot, entry, settled = false) {
  showImage(slot.img, entry); slot.title.textContent = entry.text; slot.category.textContent = entry.category;
  slot.card.classList.toggle('settled', settled);
}
async function preload(entries) {
  const paths = new Set();
  await Promise.all(entries.filter(entry => {
    if (!entry.image || paths.has(entry.image) || paths.size >= 24) return false;
    paths.add(entry.image); return true;
  }).map(entry => new Promise(resolve => {
    const img = new Image();
    const timeout = setTimeout(resolve, 500);
    const done = () => { clearTimeout(timeout); resolve(); };
    img.onload = done;
    img.onerror = () => { broken.add(entry.image); done(); };
    img.src = imageUrl(entry);
  })));
}
async function play() {
  if (busy || $('play').disabled) return;
  setBusy(true); notice('error'); $('announcement').textContent = '';
  const results = $('results');
  let completed = false;
  try {
    const eligible = pool();
    const winners = draw(eligible, requestedCount());
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const previews = draw(eligible, Math.min(eligible.length, 12));
    const slots = winners.map((_, index) => makeCard(index));
    results.replaceChildren(...slots.map(slot => slot.card));
    results.className = `results${winners.length === 1 ? ' single' : ''}`;
    results.hidden = false; $('empty-result').hidden = true;
    results.setAttribute('aria-busy', 'true'); results.setAttribute('aria-hidden', 'true');
    $('play-label').textContent = 'Shuffling…';
    focusResults();
    if (!reduced) {
      results.classList.add('shuffling');
      slots.forEach((slot, i) => fillCard(slot, previews[i % previews.length]));
      await preload([...previews, ...winners]);
      await new Promise(resolve => {
        const start = performance.now();
        let nextPreview = 0;
        const tick = now => {
          const elapsed = now - start;
          const changePreview = elapsed >= nextPreview;
          slots.forEach((slot, i) => {
            const stopAt = slots.length === 1 ? 2400 : 2000 + (i / (slots.length - 1)) * 700;
            if (elapsed >= stopAt) {
              if (!slot.settled) { fillCard(slot, winners[i], true); slot.settled = true; }
            } else if (changePreview) fillCard(slot, previews[randomInt(previews.length)]);
          });
          if (changePreview) nextPreview = elapsed + 65 + 300 * Math.pow(Math.min(elapsed / 2700, 1), 2);
          if (slots.every(slot => slot.settled)) resolve(); else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }
    slots.forEach((slot, i) => fillCard(slot, winners[i], true));
    for (const entry of winners) drawn.add(entry.id);
    $('play-label').textContent = 'Play again';
    $('announcement').textContent = `Draw complete. ${winners.map((entry, i) => `${i + 1}: ${entry.text}`).join('. ')}`;
    completed = true;
  } catch (error) { notice('error', `Could not complete the draw: ${error.message}`); $('play-label').textContent = 'Play'; }
  finally {
    results.classList.remove('shuffling'); results.removeAttribute('aria-hidden'); results.setAttribute('aria-busy', 'false'); setBusy(false);
    if (!completed) returnToControls();
    else if (document.body.classList.contains('results-focus')) $('results').focus({ preventScroll: true });
  }
}
$('back-to-controls').addEventListener('click', returnToControls);
$('reset-draw').addEventListener('click', () => {
  if (busy) return;
  drawn.clear();
  updateControls();
  $('announcement').textContent = 'Draw history reset. All entries are available again.';
  $('play-label').textContent = 'Play';
  if (!$('play').disabled) $('play').focus({ preventScroll: true });
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.body.classList.contains('results-focus')) {
    event.preventDefault();
    returnToControls();
  }
});
$('open-folder').addEventListener('click', () => $('folder-input').click());
$('folder-input').addEventListener('change', event => {
  const files = [...event.target.files]; event.target.value = '';
  if (files.length) importDataset(() => loadFolder(files));
});
$('demo').addEventListener('click', () => importDataset(async () => {
  const response = await fetch('example-data/entries.json');
  if (!response.ok) throw new Error('Could not load the example collection.');
  return { name: 'The Sunday team', entries: parseEntries(await response.text()), images: new Map() };
}));
$('forget').addEventListener('click', async () => {
  if (busy) return;
  setBusy(true);
  try { await forgetDataset(); applyDataset({ name: '', entries: [], images: new Map() }); notice('storage-note', 'The saved dataset has been removed from this browser.'); notice('error'); }
  catch { notice('error', 'Could not remove the saved dataset. Try again or clear this site’s storage in your browser.'); }
  finally { setBusy(false); }
});
$('search').addEventListener('input', renderEntries);
$('category').addEventListener('change', renderEntries);
$('select-visible').addEventListener('click', () => { for (const entry of visibleEntries()) selected.add(entry.id); renderEntries(); });
$('clear-selection').addEventListener('click', () => { selected.clear(); renderEntries(); });
for (const radio of document.querySelectorAll('input[name=mode]')) radio.addEventListener('change', () => { mode = radio.value; updateControls(); });
$('limit').addEventListener('change', updateControls);
$('result-count').addEventListener('input', updateControls);
$('play').addEventListener('click', play);

setBusy(true); renderEntries();
try {
  const saved = await restoreDataset();
  if (saved) {
    saved.entries = parseEntries(JSON.stringify(saved.entries));
    if (!(saved.images instanceof Map)) throw new Error('Invalid saved images.');
    applyDataset(saved);
    notice('storage-note', 'Restored your last collection. Reopen its folder to load file changes.');
  }
} catch { notice('storage-note', 'Saved data could not be restored. Open a folder to continue; the app also works without saved data.'); }
finally { setBusy(false); }

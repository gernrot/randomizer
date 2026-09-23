import { loadFolder } from './data.js';
import { draw, randomInt } from './random.js';
import { saveCollection, deleteCollection, restoreCollections } from './storage.js';
import { restoreCollection, collectionPool, configurationProblem } from './collections.js';

const $ = id => document.getElementById(id);
const placeholder = new URL('../assets/placeholder.svg', import.meta.url).href;
const collections = new Map();
const histories = new Map();
const urls = new Map();
const broken = new Set();
let dataset = null;
let draft = null;
let busy = false;
let modalBusy = false;
let observer;
let modalOpener;

function notice(id, message = '') { $(id).textContent = message; $(id).hidden = !message; }
function history() {
  if (!histories.has(dataset.id)) histories.set(dataset.id, new Set());
  return histories.get(dataset.id);
}
function pool() { return dataset ? collectionPool(dataset, history()) : []; }
function requestedCount() { return dataset?.mode === 'shuffle' ? pool().length : dataset?.count; }
function clearResults() {
  $('results').replaceChildren(); $('results').hidden = true;
  $('play-label').textContent = 'Run';
}
function imageUrl(entry, source = dataset) {
  const file = source?.images.get(entry.image);
  if (!file || broken.has(file)) return placeholder;
  if (!urls.has(file)) urls.set(file, URL.createObjectURL(file));
  return urls.get(file);
}
function showImage(img, entry, source = dataset) {
  img.alt = '';
  img.hidden = !entry.image;
  if (!entry.image) { img.onerror = null; img.removeAttribute('src'); return; }
  img.onerror = () => { const file = source?.images.get(entry.image); if (file) broken.add(file); img.onerror = null; img.src = placeholder; };
  const url = imageUrl(entry, source);
  if (img.getAttribute('src') !== url) img.src = url;
}
function releaseUnusedImages() {
  const retained = new Set([...collections.values(), ...(draft ? [draft] : [])].flatMap(item => [...item.images.values()]));
  for (const [file, url] of urls) if (!retained.has(file)) { URL.revokeObjectURL(url); urls.delete(file); broken.delete(file); }
}
function setBusy(value) { busy = value; updateControls(); }
function updateControls() {
  const eligible = pool();
  let problem = dataset ? configurationProblem(dataset) : '';
  if (dataset && !problem && !eligible.length) problem = 'All selected entries have been drawn. Reset to start a new round.';
  else if (dataset && !problem && requestedCount() > eligible.length) problem = `Only ${eligible.length} entries remain. Lower the result count in Edit or reset the round.`;
  notice('validation', problem);
  $('play').disabled = busy || !dataset || !!problem;
  $('new').disabled = busy;
  $('collections').disabled = busy;
  $('edit').hidden = !dataset;
  $('edit').disabled = busy;
  $('reset-draw').disabled = busy || (!dataset && !histories.size);
  notice('draw-progress', dataset ? `${eligible.length} remaining · ${history().size} drawn` : '');
}
function renderCollections() {
  $('collections').replaceChildren(new Option('Select a folder…', ''));
  const totals = new Map();
  for (const item of collections.values()) totals.set(item.name, (totals.get(item.name) || 0) + 1);
  const seen = new Map();
  for (const item of collections.values()) {
    seen.set(item.name, (seen.get(item.name) || 0) + 1);
    const label = totals.get(item.name) > 1 ? `${item.name} (${seen.get(item.name)})` : item.name;
    $('collections').add(new Option(label, item.id));
  }
  $('collections').value = dataset?.id || '';
}
function updateDraftControls() {
  $('selection-count').textContent = `${draft.selectedIds.length} selected`;
  $('count-label').hidden = draft.mode !== 'pick';
  $('result-count').disabled = draft.mode !== 'pick';
  $('result-count').max = draft.selectedIds.length;
  $('select-all').disabled = !draft.entries.length;
  $('clear-selection').disabled = !draft.selectedIds.length;
  $('save-validation').textContent = configurationProblem(draft);
  $('save').disabled = modalBusy || !!configurationProblem(draft);
}
function renderEntries() {
  observer?.disconnect();
  const container = $('entries');
  container.replaceChildren();
  const query = $('search').value.trim().toLocaleLowerCase();
  const visible = draft.entries.filter(entry => `${entry.text} ${entry.category} ${entry.sub || ''}`.toLocaleLowerCase().includes(query));
  if (!visible.length) {
    const empty = document.createElement('p'); empty.className = 'list-empty';
    empty.textContent = draft.entries.length ? 'No entries match your search.' : 'Select a folder containing a .csv or .json file and any images.';
    container.append(empty);
  }
  const source = draft;
  observer = 'IntersectionObserver' in window ? new IntersectionObserver(items => {
    for (const item of items) if (item.isIntersecting) { showImage(item.target, item.target.entry, source); observer.unobserve(item.target); }
  }, { root: container, rootMargin: '100px' }) : null;
  for (const entry of visible) {
    const row = document.createElement('label'); row.className = 'entry-row';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = draft.selectedIds.includes(entry.id);
    checkbox.addEventListener('change', () => {
      const selected = new Set(draft.selectedIds);
      if (checkbox.checked) selected.add(entry.id); else selected.delete(entry.id);
      draft.selectedIds = [...selected]; updateDraftControls();
    });
    const img = document.createElement('img'); img.width = 74; img.height = 74; img.alt = ''; img.hidden = !entry.image;
    if (entry.image) img.src = placeholder;
    const copy = document.createElement('span'); copy.className = 'entry-copy';
    const title = document.createElement('strong'); title.textContent = entry.text;
    const subtitle = document.createElement('small'); subtitle.textContent = entry.category; subtitle.hidden = !entry.category;
    const sub = document.createElement('small'); sub.textContent = entry.sub || ''; sub.hidden = !entry.sub;
    copy.append(title, subtitle, sub); row.append(checkbox, img, copy); container.append(row);
    img.entry = entry;
    if (entry.image) {
      if (observer) observer.observe(img); else showImage(img, entry, source);
    }
  }
  updateDraftControls();
}
function openConfiguration(item, opener) {
  if (busy) return;
  modalOpener = opener;
  draft = item ? { ...item, selectedIds: [...item.selectedIds] } : { id: crypto.randomUUID(), name: '', entries: [], images: new Map(), selectedIds: [], mode: 'shuffle', count: 1 };
  $('modal-title').textContent = item ? 'Edit collection' : 'New collection';
  $('delete-collection').hidden = !item;
  $('delete-note').hidden = !item;
  $('dataset-name').textContent = draft.name || 'None selected';
  $('open-folder').textContent = draft.name ? 'Change' : 'Select folder';
  $('search').value = '';
  $('result-count').value = draft.count;
  for (const radio of document.querySelectorAll('input[name=mode]')) radio.checked = radio.value === draft.mode;
  notice('modal-error');
  renderEntries();
  $('configuration').showModal();
  $('open-folder').focus();
}
function closeConfiguration() { if (!modalBusy) $('configuration').close(); }
function setModalBusy(value) {
  modalBusy = value;
  $('configuration-controls').disabled = value;
  $('close-modal').disabled = value;
  updateDraftControls();
}
async function importFolder(files) {
  setModalBusy(true); notice('modal-error');
  try {
    const next = await loadFolder(files);
    draft = { ...draft, ...next, selectedIds: [] };
    $('dataset-name').textContent = draft.name;
    $('open-folder').textContent = 'Change';
    $('search').value = '';
    renderEntries(); releaseUnusedImages();
  } catch (error) { notice('modal-error', error.message); }
  finally { setModalBusy(false); }
}
function makeCard(index) {
  const card = document.createElement('article'); card.className = 'result-card';
  const badge = document.createElement('span'); badge.className = 'result-number'; badge.textContent = String(index + 1).padStart(2, '0');
  const img = document.createElement('img'); img.alt = ''; img.width = 110; img.height = 110;
  const title = document.createElement('h3'); const category = document.createElement('p'); const sub = document.createElement('p');
  card.append(badge, img, title, category, sub);
  return { card, img, title, category, sub };
}
function fillCard(slot, entry, settled = false) {
  showImage(slot.img, entry); slot.title.textContent = entry.text; slot.category.textContent = entry.category;
  slot.sub.textContent = entry.sub || '';
  slot.card.classList.toggle('settled', settled);
}
async function preload(entries) {
  const source = dataset;
  const paths = new Set();
  await Promise.all(entries.filter(entry => {
    if (!entry.image || paths.has(entry.image) || paths.size >= 24) return false;
    paths.add(entry.image); return true;
  }).map(entry => new Promise(resolve => {
    const img = new Image();
    const timeout = setTimeout(resolve, 500);
    const done = () => { clearTimeout(timeout); resolve(); };
    img.onload = done;
    img.onerror = () => { broken.add(source.images.get(entry.image)); done(); };
    img.src = imageUrl(entry, source);
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
    results.hidden = false;
    results.setAttribute('aria-busy', 'true'); results.setAttribute('aria-hidden', 'true');
    $('play-label').textContent = 'Shuffling…';
    window.scrollTo(0, 0);
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
    for (const entry of winners) history().add(entry.id);
    $('play-label').textContent = 'Run again';
    $('announcement').textContent = `Draw complete. ${winners.map((entry, i) => `${i + 1}: ${entry.text}`).join('. ')}`;
    completed = true;
  } catch (error) { notice('error', `Could not complete the draw: ${error.message}`); $('play-label').textContent = 'Run'; }
  finally {
    results.classList.remove('shuffling'); results.removeAttribute('aria-hidden'); results.setAttribute('aria-busy', 'false'); setBusy(false);
    if (completed) results.focus({ preventScroll: true });
    else ($('play').disabled ? $('new') : $('play')).focus({ preventScroll: true });
  }
}
$('new').addEventListener('click', () => openConfiguration(null, $('new')));
$('edit').addEventListener('click', () => openConfiguration(dataset, $('edit')));
$('collections').addEventListener('change', () => {
  const item = collections.get($('collections').value);
  if (item) openConfiguration(item, $('collections'));
  else { dataset = null; clearResults(); updateControls(); }
});
$('close-modal').addEventListener('click', closeConfiguration);
$('cancel').addEventListener('click', closeConfiguration);
$('configuration').addEventListener('cancel', event => { if (modalBusy) event.preventDefault(); });
$('configuration').addEventListener('close', () => {
  observer?.disconnect(); draft = null; $('entries').replaceChildren();
  $('collections').value = dataset?.id || '';
  releaseUnusedImages();
  (modalOpener?.hidden ? $('new') : modalOpener)?.focus();
});
$('open-folder').addEventListener('click', () => $('folder-input').click());
$('folder-input').addEventListener('change', event => {
  const files = [...event.target.files]; event.target.value = '';
  if (files.length) importFolder(files);
});
$('search').addEventListener('input', renderEntries);
$('select-all').addEventListener('click', () => { $('search').value = ''; draft.selectedIds = draft.entries.map(entry => entry.id); renderEntries(); });
$('clear-selection').addEventListener('click', () => { draft.selectedIds = []; renderEntries(); });
for (const radio of document.querySelectorAll('input[name=mode]')) radio.addEventListener('change', () => { draft.mode = radio.value; updateDraftControls(); });
$('result-count').addEventListener('input', () => { draft.count = Number($('result-count').value); updateDraftControls(); });
$('save').addEventListener('click', async () => {
  if (modalBusy || configurationProblem(draft)) return;
  setModalBusy(true); notice('storage-note'); notice('error');
  const next = { ...draft, selectedIds: [...draft.selectedIds] };
  try { await saveCollection(next); }
  catch { notice('storage-note', 'Saved for this session only. Browser storage is unavailable or full; these changes will not survive a reload.'); }
  collections.set(next.id, next); dataset = next;
  clearResults(); renderCollections(); updateControls();
  setModalBusy(false); closeConfiguration();
  $('announcement').textContent = `Saved ${next.name}. Ready to run.`;
});
$('delete-collection').addEventListener('click', async () => {
  if (modalBusy || !draft || !collections.has(draft.id)) return;
  const item = collections.get(draft.id);
  if (!window.confirm(`Delete collection "${item.name}" from Randomizer?\n\nThe original folder and files will not be deleted from your hard drive.`)) return;
  setModalBusy(true); notice('modal-error');
  try {
    await deleteCollection(item.id);
  } catch (error) {
    notice('modal-error', `Could not delete the collection. Please try again. ${error.message}`);
    setModalBusy(false);
    return;
  }
  collections.delete(item.id); histories.delete(item.id);
  if (dataset?.id === item.id) { dataset = null; clearResults(); }
  renderCollections(); updateControls();
  modalOpener = $('collections');
  setModalBusy(false); closeConfiguration();
  $('announcement').textContent = `Deleted ${item.name} from Randomizer. The original folder and files are unchanged.`;
});
$('reset-draw').addEventListener('click', () => {
  if (busy) return;
  histories.clear(); clearResults(); updateControls();
  notice('error');
  $('announcement').textContent = 'Draw history reset. Ready to start a new round.';
  ($('play').disabled ? $('collections') : $('play')).focus();
});
$('play').addEventListener('click', play);

setBusy(true);
try {
  const saved = await restoreCollections();
  let invalid = 0;
  for (const value of saved) {
    try { const item = restoreCollection(value); collections.set(item.id, item); }
    catch { invalid++; }
  }
  renderCollections();
  if (invalid) notice('storage-note', 'Some saved collections could not be restored. Import their folders again.');
} catch (error) { notice('storage-note', `Saved collections could not be restored. You can still use New to load a folder. ${error.message}`); }
finally { setBusy(false); }

// Rejection sampling avoids modulo bias when converting secure random bytes.
export function randomInt(max) {
  if (!Number.isSafeInteger(max) || max < 1 || max > 0x100000000) throw new RangeError('Invalid random bound.');
  const limit = Math.floor(0x100000000 / max) * max;
  const value = new Uint32Array(1);
  do { globalThis.crypto.getRandomValues(value); } while (value[0] >= limit);
  return value[0] % max;
}
export function draw(entries, count, integer = randomInt) {
  if (!Number.isInteger(count) || count < 1 || count > entries.length) throw new RangeError('Choose a result count between 1 and the number of eligible entries.');
  const copy = [...entries];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = integer(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}
export function eligibleEntries(entries, selected, mode, drawn = new Set()) {
  return entries.filter(entry => !drawn.has(entry.id) && (mode !== 'selected' || selected.has(entry.id)));
}

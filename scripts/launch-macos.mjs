import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, openSync, closeSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const url = 'http://127.0.0.1:5173';
const expected = readFileSync(path.join(root, 'index.html'), 'utf8');

async function running() {
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(1000) });
  } catch {
    return false;
  }
  if (!response.ok || await response.text() !== expected) {
    throw new Error('Port 5173 is being used by another app or an older Randomizer server. Stop that server and try again.');
  }
  return true;
}

try {
  if (!await running()) {
    const runtime = path.join(root, '.runtime');
    mkdirSync(runtime, { recursive: true });
    const log = openSync(path.join(runtime, 'server.log'), 'a', 0o600);
    const server = spawn(process.execPath, [path.join(root, 'server.mjs')], {
      cwd: root,
      detached: true,
      stdio: ['ignore', log, log],
      env: { ...process.env, PORT: '5173' },
    });
    closeSync(log);
    let spawnError;
    server.on('error', error => { spawnError = error; });
    server.unref();
    let ready = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      if (spawnError) throw spawnError;
      if (await running()) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!ready) throw new Error(`Randomizer could not start. See ${path.join(runtime, 'server.log')} for details.`);
  }
  // Keep the original browser origin so existing IndexedDB collections remain available.
  execFileSync('/usr/bin/open', ['http://localhost:5173']);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

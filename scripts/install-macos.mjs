import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

if (process.platform !== 'darwin') throw new Error('This launcher requires macOS.');
const source = fileURLToPath(new URL('../build/Randomizer.app', import.meta.url));
const applications = path.join(homedir(), 'Applications');
const destination = path.join(applications, 'Randomizer.app');
if (existsSync(destination)) {
  const identifier = execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleIdentifier', path.join(destination, 'Contents/Info.plist')], { encoding: 'utf8' }).trim();
  if (identifier !== 'local.randomizer.launcher') throw new Error(`Another app already exists at ${destination}. Move it before installing.`);
}
mkdirSync(applications, { recursive: true });
execFileSync('/usr/bin/ditto', [source, destination]);
execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', destination]);

const preferences = execFileSync('/usr/bin/defaults', ['export', 'com.apple.dock', '-']);
// Dock tiles can contain binary bookmarks, which cannot be converted to JSON.
const tiles = execFileSync('/usr/bin/plutil', ['-extract', 'persistent-apps', 'xml1', '-o', '-', '-'], { input: preferences, encoding: 'utf8' });
const appURL = pathToFileURL(destination).href + '/';
const xmlURL = appURL.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const pinned = tiles.includes(`<string>${xmlURL}</string>`) || tiles.includes(`<string>${xmlURL.slice(0, -1)}</string>`);
if (!pinned) {
  const tile = `<dict><key>tile-data</key><dict><key>file-data</key><dict><key>_CFURLString</key><string>${xmlURL}</string><key>_CFURLStringType</key><integer>15</integer></dict><key>file-label</key><string>Randomizer</string></dict><key>tile-type</key><string>file-tile</string></dict>`;
  execFileSync('/usr/bin/defaults', ['write', 'com.apple.dock', 'persistent-apps', '-array-add', tile]);
}
// Refresh the icon even when an existing Dock entry is reused.
execFileSync('/usr/bin/touch', [destination]);
execFileSync('/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister', ['-f', destination]);
execFileSync('/usr/bin/killall', ['Dock']);
console.log(`Installed and pinned ${destination}`);

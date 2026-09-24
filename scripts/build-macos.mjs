import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

if (process.platform !== 'darwin') throw new Error('This launcher requires macOS.');
const root = fileURLToPath(new URL('../', import.meta.url));
const build = path.join(root, 'build');
const app = path.join(build, 'Randomizer.app');
const shellQuote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const appleQuote = value => '"' + value.replaceAll('\\', '\\\\').replaceAll('"', '\\"') + '"';
const command = [process.execPath, path.join(root, 'scripts/launch-macos.mjs')].map(shellQuote).join(' ');
mkdirSync(build, { recursive: true });
const source = path.join(build, 'Randomizer.applescript');
writeFileSync(source, `on run
  try
    do shell script ${appleQuote(command)}
  on error messageText
    display alert "Randomizer could not open" message messageText as critical
  end try
end run
`);
rmSync(app, { recursive: true, force: true });
execFileSync('/usr/bin/osacompile', ['-o', app, source], { stdio: 'inherit' });
execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Add :CFBundleIdentifier string local.randomizer.launcher', path.join(app, 'Contents/Info.plist')]);
// osacompile includes a stock asset-catalog icon that overrides the ICNS file.
execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Delete :CFBundleIconName', path.join(app, 'Contents/Info.plist')]);
execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Set :CFBundleIconFile applet.icns', path.join(app, 'Contents/Info.plist')]);
const iconset = path.join(build, 'Randomizer.iconset');
mkdirSync(iconset, { recursive: true });
for (const size of [16, 32, 128, 256, 512]) {
  for (const scale of [1, 2]) {
    const pixels = String(size * scale);
    const output = path.join(iconset, `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`);
    execFileSync('/usr/bin/sips', ['-z', pixels, pixels, path.join(root, 'assets/randomizer-icon.png'), '--out', output]);
  }
}
execFileSync('/usr/bin/iconutil', ['-c', 'icns', iconset, '-o', path.join(app, 'Contents/Resources/applet.icns')]);
execFileSync('/usr/bin/codesign', ['--force', '--sign', '-', app], { stdio: 'inherit' });
console.log(`Built ${app}`);

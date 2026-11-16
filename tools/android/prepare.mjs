// Prepares the Capacitor Android project after `npx cap add android` and `npx cap sync android`.
// Idempotent: safe to run on every build.
//  1. Location permissions for @capacitor/geolocation (not added automatically).
//  2. App icons generated from tools/icon/source.png (src-tauri/icons/android), with the dark background colour.
import { cpSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;
const ANDROID = join(ROOT, 'android');
const MANIFEST = join(ANDROID, 'app/src/main/AndroidManifest.xml');
const RES = join(ANDROID, 'app/src/main/res');
const ICONS = join(ROOT, 'src-tauri/icons/android');
const BACKGROUND = '#0B0F19';

if (!existsSync(MANIFEST)) {
  throw new Error('android/ not found: run `npx cap add android` first.');
}

// 1. Manifest permissions.
const PERMISSIONS = [
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
];
let manifest = readFileSync(MANIFEST, 'utf8');
const missing = PERMISSIONS.filter((p) => !manifest.includes(`android:name="${p}"`));
if (missing.length > 0) {
  const block = [
    ...missing.map((p) => `    <uses-permission android:name="${p}" />`),
    '    <uses-feature android:name="android.hardware.location.gps" android:required="false" />',
    '',
  ].join('\n');
  if (!manifest.includes('<application')) throw new Error('AndroidManifest.xml has no <application> element.');
  manifest = manifest.replace('    <application', `${block}    <application`);
  writeFileSync(MANIFEST, manifest);
  console.log(`manifest: added ${missing.length} permission(s)`);
} else {
  console.log('manifest: permissions already present');
}

// 2. Icons: copy Tauri-generated resources (PNG + adaptive icon XML).
if (!existsSync(ICONS)) {
  throw new Error('src-tauri/icons/android not found: run `npx tauri icon tools/icon/source.png -o src-tauri/icons`.');
}
cpSync(ICONS, RES, { recursive: true, force: true });
// The adaptive icon background colour must be ours; drop any existing definition to avoid duplicates.
const valuesDir = join(RES, 'values');
if (existsSync(valuesDir)) {
  for (const file of readdirSync(valuesDir)) {
    if (!file.endsWith('.xml')) continue;
    const p = join(valuesDir, file);
    const text = readFileSync(p, 'utf8');
    const cleaned = text.replace(/\s*<color name="ic_launcher_background">[^<]*<\/color>/g, '');
    if (cleaned !== text) writeFileSync(p, cleaned);
  }
}
writeFileSync(
  join(RES, 'values/ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <color name="ic_launcher_background">${BACKGROUND}</color>\n</resources>\n`,
);
console.log('icons: copied to res/ and background set to', BACKGROUND);

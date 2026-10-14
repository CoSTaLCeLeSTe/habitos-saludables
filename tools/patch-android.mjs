// Ajusta el proyecto Android generado por Capacitor: Health Connect, notificaciones,
// firma, versión, iconos, colores y pantalla de carga.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const and = path.join(root, 'android');
const app = path.join(and, 'app');
const res = path.join(app, 'src/main/res');
const run = Number(process.env.RUN_NUMBER || 1);

function edit(file, fn) {
  const p = path.join(and, file);
  const before = fs.readFileSync(p, 'utf8');
  const after = fn(before);
  if (after === before) throw new Error(`Sin cambios en ${file}: revisar el patrón`);
  fs.writeFileSync(p, after);
  console.log('✓', file);
}
function mustReplace(s, find, rep, label) {
  if (typeof find === 'string' ? !s.includes(find) : !find.test(s)) throw new Error(`No encuentro ${label}`);
  return s.replace(find, rep);
}

// 1) SDK mínimo 26 (Health Connect)
edit('variables.gradle', s => mustReplace(s, /minSdkVersion\s*=\s*\d+/, 'minSdkVersion = 26', 'minSdkVersion'));

// 2) Manifest: permisos, consulta a Health Connect y pantallas de justificación de permisos
edit('app/src/main/AndroidManifest.xml', s => {
  const perms = [
    'android.permission.health.READ_WEIGHT',
    'android.permission.health.READ_BODY_FAT',
    'android.permission.health.READ_BASAL_METABOLIC_RATE',
    'android.permission.health.READ_STEPS',
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.SCHEDULE_EXACT_ALARM',
    'android.permission.RECEIVE_BOOT_COMPLETED',
  ].map(p => `    <uses-permission android:name="${p}" />`).join('\n');
  const queries = `    <queries>\n        <package android:name="com.google.android.apps.healthdata" />\n        <intent>\n            <action android:name="androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" />\n        </intent>\n    </queries>`;
  s = mustReplace(s, '<application', `${perms}\n${queries}\n\n    <application`, '<application');
  s = mustReplace(s, /(<category android:name="android.intent.category.LAUNCHER"\s*\/>\s*<\/intent-filter>)/,
    `$1\n            <intent-filter>\n                <action android:name="androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" />\n            </intent-filter>`, 'intent-filter LAUNCHER');
  s = mustReplace(s, '</application>', `        <activity-alias\n            android:name="ViewPermissionUsageActivity"\n            android:exported="true"\n            android:targetActivity=".MainActivity"\n            android:permission="android.permission.START_VIEW_PERMISSION_USAGE">\n            <intent-filter>\n                <action android:name="android.intent.action.VIEW_PERMISSION_USAGE" />\n                <category android:name="android.intent.category.HEALTH_PERMISSIONS" />\n            </intent-filter>\n        </activity-alias>\n    </application>`, '</application>');
  return s;
});

// 3) Versión y firma
edit('app/build.gradle', s => {
  s = mustReplace(s, /versionCode\s+\d+/, `versionCode ${run}`, 'versionCode');
  s = mustReplace(s, /versionName\s+"[^"]*"/, `versionName "1.0.${run}"`, 'versionName');
  s = mustReplace(s, /\n(\s*)buildTypes\s*\{/, `\n$1signingConfigs {\n$1    release {\n$1        storeFile file("\${rootDir}/../signing/habitos.keystore")\n$1        storePassword "habitos2026"\n$1        keyAlias "habitos"\n$1        keyPassword "habitos2026"\n$1    }\n$1}\n$1buildTypes {`, 'buildTypes');
  s = mustReplace(s, /buildTypes\s*\{\s*release\s*\{/, m => `${m}\n            signingConfig signingConfigs.release`, 'release');
  return s;
});

// 4) El plugin de Health Connect usa Kotlin 1.8: lo subimos para que lea las librerías actuales
const hcGradle = path.join(root, 'node_modules/capacitor-health-connect/android/build.gradle');
if (fs.existsSync(hcGradle)) {
  const g = fs.readFileSync(hcGradle, 'utf8').replace(/ext\.kotlin_version\s*=\s*"[^"]+"/, 'ext.kotlin_version = "1.9.24"');
  fs.writeFileSync(hcGradle, g);
  console.log('✓ capacitor-health-connect: Kotlin 1.9.24');
}

// 5) Iconos, color de fondo del icono adaptativo e icono de notificación
const rsrc = path.join(root, 'resources');
for (const d of fs.readdirSync(path.join(rsrc, 'mipmap'))) {
  for (const f of fs.readdirSync(path.join(rsrc, 'mipmap', d))) {
    fs.mkdirSync(path.join(res, d), { recursive: true });
    fs.copyFileSync(path.join(rsrc, 'mipmap', d, f), path.join(res, d, f));
  }
}
for (const d of fs.readdirSync(path.join(rsrc, 'stat'))) {
  fs.mkdirSync(path.join(res, d), { recursive: true });
  fs.copyFileSync(path.join(rsrc, 'stat', d, 'ic_stat_hs.png'), path.join(res, d, 'ic_stat_hs.png'));
}
const bgFile = path.join(res, 'values/ic_launcher_background.xml');
fs.writeFileSync(bgFile, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#1F4D40</color>\n</resources>\n`);
console.log('✓ iconos');

// 6) Colores de la barra de estado y acentos
const valuesDir = path.join(res, 'values');
const allValues = fs.readdirSync(valuesDir).map(f => fs.readFileSync(path.join(valuesDir, f), 'utf8')).join('\n');
const colors = { colorPrimary: '#1F4D40', colorPrimaryDark: '#1F4D40', colorAccent: '#A9844A' };
const colorsFile = path.join(valuesDir, 'colors.xml');
if (fs.existsSync(colorsFile)) {
  let c = fs.readFileSync(colorsFile, 'utf8');
  for (const [k, v] of Object.entries(colors)) c = c.replace(new RegExp(`(<color name="${k}">)[^<]*(</color>)`), `$1${v}$2`);
  fs.writeFileSync(colorsFile, c);
} else {
  const missing = Object.entries(colors).filter(([k]) => !allValues.includes(`name="${k}"`));
  if (missing.length) fs.writeFileSync(colorsFile, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${missing.map(([k, v]) => `    <color name="${k}">${v}</color>`).join('\n')}\n</resources>\n`);
}
console.log('✓ colores');

// 7) Pantalla de carga: marfil con el logo, sin deformar en cada tamaño
const sharp = require('sharp');
const splashSrc = path.join(rsrc, 'splash.png');
const jobs = [];
for (const d of fs.readdirSync(res)) {
  const f = path.join(res, d, 'splash.png');
  if (!fs.existsSync(f)) continue;
  jobs.push((async () => {
    const meta = await sharp(f).metadata();
    const buf = await sharp(splashSrc).resize(meta.width, meta.height, { fit: 'cover', background: '#F6F2EA' }).png().toBuffer();
    fs.writeFileSync(f, buf);
  })());
}
await Promise.all(jobs);
console.log(`✓ splash (${jobs.length} tamaños)`);

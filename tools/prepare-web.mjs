// Copia a www/vendor las librerías que la app usa sin conexión (Capacitor y el lector de capturas).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const nm = path.join(root, 'node_modules');
const vendor = path.join(root, 'www', 'vendor');
const tess = path.join(vendor, 'tesseract');
fs.rmSync(vendor, { recursive: true, force: true });
fs.mkdirSync(path.join(tess, 'core'), { recursive: true });
fs.mkdirSync(path.join(tess, 'lang'), { recursive: true });

function copy(src, dst) {
  if (!fs.existsSync(src)) throw new Error(`No existe ${src}`);
  fs.copyFileSync(src, dst);
  console.log('✓', path.relative(root, dst));
}

// Capacitor (registerPlugin sin empaquetador)
copy(path.join(nm, '@capacitor/core/dist/capacitor.js'), path.join(vendor, 'capacitor.js'));

// Tesseract.js
copy(path.join(nm, 'tesseract.js/dist/tesseract.min.js'), path.join(tess, 'tesseract.min.js'));
copy(path.join(nm, 'tesseract.js/dist/worker.min.js'), path.join(tess, 'worker.min.js'));
const core = path.join(nm, 'tesseract.js-core');
for (const f of fs.readdirSync(core)) {
  if (/^tesseract-core.*\.(wasm|wasm\.js|js)$/.test(f)) copy(path.join(core, f), path.join(tess, 'core', f));
}

// Modelo de idioma (inglés: basta para números y etiquetas de Zepp Life)
const out = path.join(tess, 'lang', 'eng.traineddata.gz');
const sources = [
  ['gz', 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz'],
  ['gz', 'https://unpkg.com/@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz'],
  ['raw', 'https://github.com/tesseract-ocr/tessdata_fast/raw/main/eng.traineddata'],
];
let ok = false;
for (const [kind, url] of sources) {
  try {
    const r = await fetch(url, { redirect: 'follow' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    let buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 500000) throw new Error(`archivo demasiado pequeño (${buf.length} bytes)`);
    if (kind === 'raw') buf = zlib.gzipSync(buf);
    fs.writeFileSync(out, buf);
    console.log(`✓ modelo eng (${(buf.length / 1e6).toFixed(1)} MB) desde ${url}`);
    ok = true; break;
  } catch (e) { console.warn(`× ${url}: ${e.message}`); }
}
if (!ok) throw new Error('No se pudo descargar el modelo de idioma de Tesseract');

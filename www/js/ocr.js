// Lectura de la captura del resumen de Zepp Life, dentro del propio móvil (sin internet).

function num(s) {
  if (s == null) return null;
  let t = String(s).replace(/\s+/g, '').replace(/[oO]/g, '0');
  // "1.959" (miles) frente a "15.3" (decimal mal leído)
  if (/^\d{1,2}\.\d{3}$/.test(t)) t = t.replace('.', '');
  t = t.replace(',', '.');
  const n = parseFloat(t);
  return isNaN(n) ? null : n;
}
function norm(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[|]/g, 'I');
}

/** Devuelve { peso, imc, grasa, agua, proteina, bmr, visceral, musculo, osea, puntuacion, fecha, hora } */
export function parseZepp(raw, refYear = new Date().getFullYear()) {
  const text = norm(raw);
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const out = {};
  const grab = (re, key, ok = () => true) => { const m = text.match(re); if (m) { const v = num(m[1]); if (v != null && ok(v)) out[key] = v; } };

  grab(/grasa\s*corporal\s*([\d.,]+)/i, 'grasa', v => v > 3 && v < 70);
  grab(/agua\s*([\d.,]+)\s*%?/i, 'agua', v => v > 20 && v < 80);
  grab(/prote\S*na\s*([\d.,]+)/i, 'proteina', v => v > 5 && v < 30);
  grab(/metabolismo\s*basal\s*([\d.,\s]+?)\s*kcal/i, 'bmr', v => v > 800 && v < 4000);
  grab(/visceral\s*([\d.,]+)/i, 'visceral', v => v >= 1 && v <= 59);
  grab(/m\S{0,2}sculo\s*([\d.,]+)\s*k?g?/i, 'musculo', v => v > 15 && v < 120);
  grab(/masa\s*\S*sea\s*([\d.,]+)/i, 'osea', v => v > 0.5 && v < 8);
  grab(/[I1l']?MC\s*([\d.,]+)/i, 'imc', v => v > 10 && v < 70);

  // Peso: número con decimal en la línea que contiene "kg" antes de "Peso", o la línea anterior a "Peso"
  const iPeso = lines.findIndex(l => /^peso\b/i.test(l) || /\bpeso\s+tipo de cuerpo/i.test(l));
  const candidates = [];
  const pick = (l) => {
    const c = l.replace(/(\d)\s+(\d)/g, '$1$2');
    const m = c.match(/(\d{2,3}[.,]\d)\s*(k\s*g|\.\.|1\b|$|\s)/i) || c.match(/(\d{2,3}[.,]\d)/);
    if (m) { const v = num(m[1]); if (v > 30 && v < 300) candidates.push(v); }
  };
  if (iPeso > 0) { pick(lines[iPeso - 1]); if (!candidates.length && iPeso > 1) pick(lines[iPeso - 2]); }
  if (!candidates.length) { const m = text.match(/(\d{2,3}[.,]\d)\s*kg/i); if (m) { const v = num(m[1]); if (v > 30 && v < 300) candidates.push(v); } }
  if (candidates.length) out.peso = candidates[0];

  // Puntuación corporal: primer número de 2 cifras tras la etiqueta
  const iPunt = lines.findIndex(l => /puntuacion\s*corporal/i.test(l));
  if (iPunt >= 0) {
    for (let k = iPunt; k < Math.min(lines.length, iPunt + 3); k++) {
      const m = lines[k].replace(/puntuacion\s*corporal/i, '').replace(/(\d)[Ss]\b/g, '$15').match(/\b(\d{2,3})\b/);
      if (m) { const v = Number(m[1]); if (v >= 10 && v <= 100) { out.puntuacion = v; break; } }
    }
  }
  // Fecha "14/10 03:47 p. m."
  const f = text.match(/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})\s*([ap])?\.?\s*m?/i);
  if (f) {
    let h = Number(f[3]);
    if (f[5]?.toLowerCase() === 'p' && h < 12) h += 12;
    if (f[5]?.toLowerCase() === 'a' && h === 12) h = 0;
    out.fecha = `${refYear}-${String(f[2]).padStart(2, '0')}-${String(f[1]).padStart(2, '0')}`;
    out.hora = `${String(h).padStart(2, '0')}:${f[4]}`;
  }
  // Coherencia: si hay peso y altura no, el IMC confirma el peso más tarde en la vista
  return out;
}

export function ocrAvailable() { return typeof window.Tesseract?.createWorker === 'function'; }

function loadImage(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

function prepare(img, invert) {
  const scale = Math.min(2, 2400 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    let y = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
    if (invert) y = 255 - y;
    p[i] = p[i + 1] = p[i + 2] = y;
  }
  g.putImageData(d, 0, 0);
  return c;
}

export async function readZepp(file, onProgress = () => {}) {
  if (!ocrAvailable()) throw new Error('El lector de capturas solo está en la app instalada.');
  const img = await loadImage(file);
  const base = new URL('vendor/tesseract/', document.baseURI).href;
  const worker = await window.Tesseract.createWorker('eng', 1, {
    workerPath: base + 'worker.min.js',
    corePath: base + 'core/',
    langPath: base + 'lang/',
    gzip: true,
    logger: m => { if (m.status === 'recognizing text') onProgress(m.progress); },
  });
  try {
    const results = [];
    for (const inv of [false, true]) {
      const { data } = await worker.recognize(prepare(img, inv));
      const parsed = parseZepp(data.text);
      results.push({ parsed, n: Object.keys(parsed).length, text: data.text });
      if (results[results.length - 1].n >= 11) break;
    }
    // la primera lectura (gris sin invertir) manda; la segunda solo rellena huecos
    const best = { ...results[0].parsed };
    for (const r of results.slice(1)) for (const [k, v] of Object.entries(r.parsed)) if (best[k] == null) best[k] = v;
    return { values: best, text: results[0].text };
  } finally {
    await worker.terminate();
  }
}

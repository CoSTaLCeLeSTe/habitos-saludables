// Lectura de la captura del resumen de Zepp Life, dentro del propio móvil (sin internet).

function num(s) {
  if (s == null) return null;
  let t = String(s).replace(/\s+/g, '').replace(/[oO]/g, '0');
  // "1.959" o "1,959" son miles (metabolismo basal)
  if (/^\d{1,2}[.,]\d{3}$/.test(t)) t = t.replace(/[.,]/, '');
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
  // Si se pierde la coma decimal ("153" por "15,3"), se recoloca según el rango esperado
  const grab = (re, key, lo, hi) => {
    const m = text.match(re); if (!m) return;
    const v = num(m[1]); if (v == null) return;
    for (const d of [1, 10, 100]) { const x = Math.round(v / d * 100) / 100; if (x >= lo && x <= hi) { out[key] = x; return; } }
  };

  grab(/grasa\s*corporal\s*([\d.,]+)/i, 'grasa', 3, 70);
  grab(/agua\s*([\d.,]+)\s*%?/i, 'agua', 20, 80);
  grab(/prote\S*na\s*([\d.,]+)/i, 'proteina', 5, 30);
  grab(/metabolismo\s*basal\s*([\d.,\s]+?)\s*kcal/i, 'bmr', 800, 4000);
  grab(/visceral\s*([\d.,]+)/i, 'visceral', 1, 59);
  grab(/m\S{0,2}sculo\s*([\d.,]+)\s*k?g?/i, 'musculo', 15, 120);
  grab(/masa\s*\S*sea\s*([\d.,]+)/i, 'osea', 0.5, 8);
  grab(/[I1l']?MC\s*([\d.,]+)/i, 'imc', 10, 70);

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
  const iPunt = lines.findIndex(l => /puntuac\S*n\s*corporal/i.test(l));
  if (iPunt >= 0) {
    for (let k = iPunt; k < Math.min(lines.length, iPunt + 3); k++) {
      // solo una línea que sea únicamente el número (evita confundirlo con la fecha "14/10")
      const m = lines[k].replace(/puntuac\S*n\s*corporal/i, '').replace(/(\d)[Ss]\b/g, '$15').trim().match(/^[^\d/:]{0,4}(\d{2,3})[^\d/:]{0,4}$/);
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

function findLine(data, re) {
  const lines = data?.lines || (data?.blocks || []).flatMap(b => (b.paragraphs || []).flatMap(p => p.lines || []));
  return lines.find(l => re.test(l.text || '')) || null;
}

export async function readZepp(file, onProgress = () => {}) {
  if (!ocrAvailable()) throw new Error('El lector de capturas solo está en la app instalada.');
  const img = await loadImage(file);
  const base = new URL('vendor/tesseract/', document.baseURI).href;
  const worker = await window.Tesseract.createWorker('eng', 1, {
    workerPath: base + 'worker.min.js',
    corePath: base + 'core/',
    langPath: base + 'lang/',
    gzip: false,
    logger: m => { if (m.status === 'recognizing text') onProgress(m.progress); },
  });
  try {
    const results = [];
    let plain = null, plainData = null;
    for (const inv of [false, true]) {
      const canvas = prepare(img, inv);
      const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
      if (!inv) { plain = canvas; plainData = data; }
      const parsed = parseZepp(data.text);
      results.push({ parsed, n: Object.keys(parsed).length, text: data.text });
      if (results[results.length - 1].n >= 11) break;
    }
    // la primera lectura (gris sin invertir) manda; la segunda solo rellena huecos
    const best = { ...results[0].parsed };
    for (const r of results.slice(1)) for (const [k, v] of Object.entries(r.parsed)) if (best[k] == null) best[k] = v;
    // La puntuación corporal va en cifras grandes y finas: se relee solo esa franja
    if (best.puntuacion == null && plain) {
      try {
        const lbl = findLine(plainData, /puntuac/i);
        let y0 = plain.height * 0.21, h = plain.height * 0.07;
        if (lbl) { const lh = lbl.bbox.y1 - lbl.bbox.y0; y0 = lbl.bbox.y1; h = Math.max(lh * 5, plain.height * 0.04); }
        const crop = document.createElement('canvas');
        crop.width = plain.width; crop.height = Math.round(h);
        crop.getContext('2d').drawImage(plain, 0, y0, plain.width, h, 0, 0, plain.width, h);
        await worker.setParameters({ tessedit_pageseg_mode: '7', tessedit_char_whitelist: '0123456789' });
        const { data } = await worker.recognize(crop);
        const m = data.text.match(/\d{2,3}/);
        if (m) { const v = Number(m[0]); if (v >= 10 && v <= 100) best.puntuacion = v; }
      } catch { /* sin puntuación */ }
    }
    return { values: best, text: results[0].text };
  } finally {
    await worker.terminate();
  }
}

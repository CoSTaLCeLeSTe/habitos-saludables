// Utilidades: fechas en hora local, formato español, HTML seguro.
export const DAY = 86400000;

export function pad(n) { return String(n).padStart(2, '0'); }
export function iso(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function parseISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); }
export function addDays(s, n) { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); }
export function diffDays(a, b) { return Math.round((parseISO(b) - parseISO(a)) / DAY); }
export function today() { return iso(new Date()); }
export function dow(s) { return parseISO(s).getDay(); } // 0 = domingo
export function mondayOf(s) { const w = dow(s); return addDays(s, w === 0 ? -6 : 1 - w); }
export function saturdayOf(s) { const w = dow(s); return addDays(s, -((w + 1) % 7)); } // semana de menú: sábado → viernes
export function range(from, to) { const out = []; for (let s = from; s <= to; s = addDays(s, 1)) out.push(s); return out; }

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_C = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function fDateLong(s) { const d = parseISO(s); return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`; }
export function fDateShort(s) { const d = parseISO(s); return `${d.getDate()} ${MESES_C[d.getMonth()]}`; }
export function fDow(s) { return DIAS[dow(s)]; }
export function fDowShort(s) { return DIAS_C[dow(s)]; }
export function fMonth(m) { return MESES_C[m]; }

export function fNum(n, dec = 1) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
export function fInt(n) { return n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('es-ES'); }
export function fSigned(n, dec = 1) { if (n == null || isNaN(n)) return '—'; const s = fNum(Math.abs(n), dec); return n > 0 ? `+${s}` : n < 0 ? `−${s}` : s; }
export function fHours(min) { if (!min) return '0 h'; const h = Math.floor(min / 60), m = Math.round(min % 60); return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`; }
export function fHoursDec(min) { return `${fNum(min / 60, 1)} h`; }
export function toNum(v) { if (v == null || v === '') return null; const n = Number(String(v).replace(',', '.')); return isNaN(n) ? null : n; }
export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
export function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
export function hm(date = new Date()) { return `${pad(date.getHours())}:${pad(date.getMinutes())}`; }
export function minutesBetween(a, b) { // "23:30" → "07:15" (cruza medianoche)
  const [ah, am] = a.split(':').map(Number), [bh, bm] = b.split(':').map(Number);
  let m = (bh * 60 + bm) - (ah * 60 + am); if (m <= 0) m += 1440; return m;
}
// Generador pseudoaleatorio reproducible (para rotar menús por semana)
export function seeded(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
export function shuffle(arr, seed) { const r = seeded(seed), a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function sum(a) { return a.reduce((x, y) => x + (y || 0), 0); }
export function avg(a) { const v = a.filter(x => x != null && !isNaN(x)); return v.length ? sum(v) / v.length : null; }
export function linreg(points) { // [{x, y}] → pendiente por unidad de x
  const n = points.length; if (n < 2) return null;
  const mx = avg(points.map(p => p.x)), my = avg(points.map(p => p.y));
  let num = 0, den = 0; for (const p of points) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; }
  return den ? num / den : null;
}

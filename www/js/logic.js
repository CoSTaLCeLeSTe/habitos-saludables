// Cálculos de la app: peso, hitos, menú, compra, ejercicio, hábitos, logros e informe.
import { state, peekDay } from './store.js';
import { addDays, diffDays, dow, iso, mondayOf, saturdayOf, range, today, shuffle, sum, avg, linreg, fNum, fSigned, parseISO } from './util.js';

export const D = window.HS_DATA;
export const BASE_KCAL = 1830;           // media diaria de los menús base
export const MENU_EPOCH = '2026-01-03';  // un sábado de referencia para rotar menús
export const SLOTS = [
  { id: 'desayuno', nombre: 'Desayuno', tipo: 'desayuno', emoji: '☕' },
  { id: 'media', nombre: 'Media mañana', tipo: 'tentempie', emoji: '🍎' },
  { id: 'comida', nombre: 'Comida', tipo: 'comida', emoji: '🍽️' },
  { id: 'merienda', nombre: 'Merienda', tipo: 'tentempie', emoji: '🥪' },
  { id: 'cena', nombre: 'Cena', tipo: 'cena', emoji: '🌙' },
];

// ───────── Perfil ─────────
export function heightM() { return (state.profile.altura || 175) / 100; }
export function bmi(w) { return w ? w / heightM() ** 2 : null; }
export function kgForBmi(b) { return Math.round(b * heightM() ** 2 * 10) / 10; }
export function suggestKcal(p) {
  if (!p.pesoInicial || !p.altura || !p.edad) return 1900;
  const bmr = 10 * p.pesoInicial + 6.25 * p.altura - 5 * p.edad + (p.sexo === 'm' ? -161 : 5);
  const floor = p.sexo === 'm' ? 1400 : 1700;
  return Math.max(floor, Math.round((bmr * 1.2 - 450) / 50) * 50);
}
export function suggestProtein(p) { return Math.round((p.objetivo || 75) * 2 / 5) * 5; }

// ───────── Peso y composición ─────────
export function weighIns() {
  return Object.keys(state.days).sort().filter(d => state.days[d].peso).map(d => ({ date: d, peso: state.days[d].peso }));
}
export function metricSeries(key) {
  return Object.keys(state.days).sort().filter(d => state.days[d][key] != null).map(d => ({ date: d, v: state.days[d][key] }));
}
export function lastMetric(key, upTo = today()) {
  const ks = Object.keys(state.days).sort().filter(d => d <= upTo && state.days[d][key] != null);
  if (!ks.length) return null;
  const d = ks[ks.length - 1];
  return { date: d, v: state.days[d][key] };
}
export function prevMetric(key, before) {
  const ks = Object.keys(state.days).sort().filter(d => d < before && state.days[d][key] != null);
  if (!ks.length) return null;
  const d = ks[ks.length - 1];
  return { date: d, v: state.days[d][key] };
}
export function startWeight() { return state.profile.pesoInicial || weighIns()[0]?.peso || null; }
export function currentWeight() { return lastMetric('peso')?.v ?? startWeight(); }
export function goalWeight() { return state.profile.objetivo || 80; }
export function fatKg(date) { const d = peekDay(date); return d.peso && d.grasa ? d.peso * d.grasa / 100 : null; }

export function weightMessage(date) {
  const cur = peekDay(date).peso;
  const prev = prevMetric('peso', date);
  const base = '📏 El peso sube y baja 1–2 kg de un día a otro por el agua, la sal y la digestión. Un día no cambia nada; lo que cuenta es la dirección de las semanas.';
  if (!cur || !prev) return base;
  const d = cur - prev.v;
  if (d > 0.5) return `🌊 +${fNum(d)} kg desde el último pesaje. Casi siempre es agua: más sal o hidratos, entrenamiento de fuerza, poco sueño o la digestión. Sigue con el plan; la tendencia manda.`;
  if (d < -0.5) return `👏 ${fNum(Math.abs(d))} kg menos que en el último pesaje. Parte será agua, pero vas en la buena dirección. Sigue así.`;
  return base;
}

// ───────── Hitos y desbloqueos ─────────
export function milestones() {
  const g = goalWeight();
  const list = [
    { key: 'skate', kg: 100, emoji: '🛹', nombre: 'Skate' },
    { key: 'obesidad', kg: kgForBmi(29.99), emoji: '🎉', nombre: 'Fuera de obesidad' },
    { key: 'surf', kg: 90, emoji: '🏄', nombre: 'Surf' },
    { key: 'meta', kg: g, emoji: '🎯', nombre: 'Meta' },
  ];
  return list.filter(m => m.kg >= g).sort((a, b) => b.kg - a.kg);
}
function belowStreak(threshold) {
  // mañanas seguidas (días consecutivos con pesaje) por debajo del umbral, contando desde el último pesaje
  const w = weighIns();
  let n = 0, prevDate = null;
  for (let i = w.length - 1; i >= 0; i--) {
    if (w[i].peso >= threshold) break;
    if (prevDate && diffDays(w[i].date, prevDate) !== 1) break;
    n++; prevDate = w[i].date;
  }
  return n;
}
export function lastTest(tipo) { return state.tests.filter(t => t.tipo === tipo).sort((a, b) => a.fecha < b.fecha ? 1 : -1)[0] || null; }
export function unlockStatus(key) {
  const kg = key === 'skate' ? 100 : 90;
  const test = lastTest(key === 'skate' ? 'base' : 'surf');
  const streak = belowStreak(kg);
  const unlocked = !!state.logros[key];
  return { key, kg, unlocked, streak, pesoOk: streak >= 3, test, testOk: !!test?.superado };
}
export function phase() {
  if (state.logros.surf) return 3;
  if (state.logros.skate) return 2;
  return 1;
}

// ───────── Recetas y menú ─────────
export function recipe(id) { return D.recipes.find(r => r.id === id) || state.recetasExtra[id] || null; }
export function recipesFor(tipo) {
  const all = [...D.recipes, ...Object.values(state.recetasExtra)].filter(r => r.slot === tipo && !state.descartadas[r.id]);
  return all;
}
export function factor() { return Math.min(1.25, Math.max(0.8, (state.profile.kcal || 1900) / BASE_KCAL)); }

function weekIndex(sat) { return Math.round(diffDays(MENU_EPOCH, sat) / 7); }
function rotated(tipo, seed) {
  const list = recipesFor(tipo).filter(r => !r.extraSoloMenu);
  const fav = list.filter(r => state.favoritas[r.id]);
  const rest = shuffle(list.filter(r => !state.favoritas[r.id]), seed);
  return [...fav, ...rest];
}
export function generatedWeek(sat) {
  const w = weekIndex(sat);
  const des = rotated('desayuno', w * 11 + 1), com = rotated('comida', w * 11 + 2), cen = rotated('cena', w * 11 + 3), ten = rotated('tentempie', w * 11 + 4);
  const days = {};
  range(sat, addDays(sat, 6)).forEach((d, i) => {
    days[d] = {
      desayuno: des[i % des.length]?.id,
      media: ten[i % ten.length]?.id,
      comida: com[i % com.length]?.id,
      merienda: ten[(i + 3) % ten.length]?.id,
      cena: cen[i % cen.length]?.id,
    };
  });
  return days;
}
export function plannedMenu(date) {
  const sat = saturdayOf(date);
  const fromClaude = state.menus[sat]?.dias?.[date];
  const base = generatedWeek(sat)[date];
  return { ...base, ...(fromClaude || {}) };
}
export function menuFor(date) {
  const planned = plannedMenu(date);
  const choice = peekDay(date).eleccion || {};
  const out = {};
  for (const s of SLOTS) out[s.id] = choice[s.id] || planned[s.id];
  return out;
}
export function alternatives(date, slot) {
  const tipo = SLOTS.find(s => s.id === slot).tipo;
  const cur = recipe(menuFor(date)[slot]);
  const planned = plannedMenu(date)[slot];
  const list = recipesFor(tipo).filter(r => r.id !== cur?.id);
  list.sort((a, b) => Math.abs(a.kcal - (cur?.kcal || 0)) - Math.abs(b.kcal - (cur?.kcal || 0)));
  const off = diffDays(MENU_EPOCH, date) % Math.max(1, list.length - 2);
  const pool = list.slice(0, 6);
  const picks = [pool[off % pool.length], pool[(off + 1) % pool.length]].filter(Boolean);
  if (planned && planned !== cur?.id && !picks.some(r => r.id === planned)) picks.unshift(recipe(planned));
  return [...new Map(picks.filter(Boolean).map(r => [r.id, r])).values()].slice(0, 3);
}
export function baseDayKcal(date) {
  const m = menuFor(date);
  return sum(SLOTS.map(s => recipe(m[s.id])?.kcal || 0));
}
export function dayFactor(date) {
  const b = baseDayKcal(date);
  return b ? Math.min(1.3, Math.max(0.8, (state.profile.kcal || 1900) / b)) : factor();
}
export function scaledIngredients(r, f = factor()) {
  return (r.ings || []).map(it => {
    if (Array.isArray(it)) {
      const [fid, q] = it;
      const food = D.foods[fid];
      if (!food) return { name: fid, txt: String(q), key: fid, sec: 'Otros', g: q };
      if (food.u === 'ud' || food.u === 'lata') {
        const n = q;
        const label = food.u === 'lata' ? (n === 1 ? 'lata' : 'latas') : '';
        return { key: fid, name: food.n, sec: food.sec, u: food.u, q: n, g: n * food.gpu, txt: food.u === 'lata' ? `${n} ${label}` : `${n}` };
      }
      const g = Math.round(q * f / 5) * 5;
      return { key: fid, name: food.n, sec: food.sec, u: food.u, q: g, g, txt: `${g} ${food.u === 'ml' ? 'ml' : 'g'}` };
    }
    // ingrediente libre enviado por Claude: { n, q, u, sec }
    const g = it.u === 'ud' ? it.q : Math.round((it.q || 0) * f / 5) * 5;
    return { key: 'x:' + it.n, name: it.n, sec: it.sec || 'Otros', u: it.u || 'g', q: g, g, txt: `${g} ${it.u || 'g'}` };
  });
}
export function macros(r, f = factor()) {
  return { kcal: Math.round(r.kcal * f), p: Math.round(r.p * f), g: Math.round(r.g * f), hc: Math.round(r.hc * f) };
}
export function dayPlanTotals(date) {
  const m = menuFor(date), f = dayFactor(date);
  const t = { kcal: 0, p: 0, g: 0, hc: 0 };
  for (const s of SLOTS) { const r = recipe(m[s.id]); if (!r) continue; const x = macros(r, f); t.kcal += x.kcal; t.p += x.p; t.g += x.g; t.hc += x.hc; }
  return t;
}
export function freeMealUsed(date) {
  const sat = saturdayOf(date);
  for (const d of range(sat, addDays(sat, 6))) {
    const meals = peekDay(d).comidas || {};
    for (const s of SLOTS) if (meals[s.id] === 'libre') return { date: d, slot: s.id };
  }
  return null;
}

// ───────── Lista de la compra ─────────
export function shoppingList(sat) {
  const items = {};
  for (const d of range(sat, addDays(sat, 6))) {
    const m = menuFor(d), f = dayFactor(d);
    const meals = peekDay(d).comidas || {};
    for (const s of SLOTS) {
      if (meals[s.id] === 'libre') continue;
      const r = recipe(m[s.id]); if (!r) continue;
      for (const it of scaledIngredients(r, f)) {
        const k = it.key;
        if (!items[k]) items[k] = { key: k, name: it.name, sec: it.sec, u: it.u, q: 0 };
        items[k].q += it.q;
      }
    }
  }
  const order = ['Frutería', 'Carnicería', 'Pescadería', 'Charcutería', 'Lácteos y huevos', 'Panadería', 'Legumbres y conservas', 'Conservas', 'Despensa', 'Otros'];
  const secs = {};
  for (const it of Object.values(items)) {
    it.txt = fmtQty(it.q, it.u, it.key);
    (secs[it.sec] = secs[it.sec] || []).push(it);
  }
  return order.filter(s => secs[s]).map(s => ({ sec: s, items: secs[s].sort((a, b) => a.name.localeCompare(b.name, 'es')) }));
}
const PIEZA = { manzana: 150, platano: 120, naranja: 200, kiwi: 90, aguacate: 200, tomate: 120, pepino: 300, zanahoria: 80, cebolla: 150, pimiento: 150, calabacin: 300, boniato: 300, patata: 200, brocoli: 400, coliflor: 700, calabaza: 1000 };
function fmtQty(q, u, key) {
  if (PIEZA[key] && u === 'g') { const n = q / PIEZA[key]; const base = fmtQty(q, 'g*', key); return n >= 0.75 ? `${base} (≈ ${Math.max(1, Math.round(n))} ud${Math.round(n) > 1 ? 's' : ''})` : base; }
  if (u === 'g*') u = 'g';
  if (u === 'ud') return key === 'huevo' ? `${Math.ceil(q)} uds (${q > 12 ? Math.ceil(q / 6) + ' medias docenas' : 'media docena o docena'})` : `${Math.ceil(q)} uds`;
  if (u === 'lata') return `${Math.ceil(q)} latas`;
  if (u === 'ml') return q >= 1000 ? `${fNum(q / 1000, 1)} L` : `${Math.ceil(q / 50) * 50} ml`;
  if (q >= 1000) return `${fNum(Math.ceil(q / 50) * 50 / 1000, 2).replace(/0$/, '')} kg`;
  return `${Math.ceil(q / 10) * 10} g`;
}

// ───────── Ejercicio ─────────
export function weekNo(date) { return Math.max(1, Math.floor(diffDays(state.profile.inicio, date) / 7) + 1); }
export function blockFor(date) { const w = weekNo(date); return D.blocks.find(b => w >= b.desde && w <= b.hasta) || D.blocks[D.blocks.length - 1]; }
export function sessionsFor(date) {
  if (date < state.profile.inicio) return [];
  const b = blockFor(date);
  const ph = phase();
  return (b.dias[String(dow(date))] || []).map(([tipo, min, nota]) => {
    let t = tipo, n = nota;
    if (tipo === 'libre' && ph >= 2) { t = ph === 3 ? 'surf' : 'skate'; n = ph === 3 ? 'Surf (o skate si no hay olas) 🏄' : 'Skate con casco y protecciones 🛹'; }
    return { tipo: t, min, nota: n };
  });
}
export function sessionInfo(tipo) {
  if (tipo.startsWith('fuerza:')) { const r = D.routines[tipo.split(':')[1]]; return { emoji: '🏋️', nombre: r.nombre }; }
  return ({
    caminar: { emoji: '🚶', nombre: 'Caminar' },
    movilidad: { emoji: '🧘', nombre: 'Movilidad y estiramientos' },
    libre: { emoji: '⚡', nombre: 'Actividad libre' },
    skate: { emoji: '🛹', nombre: 'Skate' },
    surf: { emoji: '🏄', nombre: 'Surf' },
    otro: { emoji: '✨', nombre: 'Otra actividad' },
  })[tipo] || { emoji: '✨', nombre: tipo };
}
export function prescription(exId, date) {
  const b = blockFor(date);
  const timed = { plancha: [20, 30, 40, 45], lateral: [20, 25, 30, 35], equilibrio: [30, 30, 40, 45], remadasurf: [30, 40, 45, 60] };
  const bi = D.blocks.indexOf(b);
  if (timed[exId]) return `${b.series} × ${timed[exId][bi]} s`;
  const reps = { puente: '15', facepull: '15', abduccion: '15 por lado', deadbug: '8 por lado', zancada: '8 por pierna', remo1: '10 por lado', popup: '6–8', pallof: '10 por lado' };
  return `${b.series} × ${reps[exId] || b.reps}`;
}
export function exerciseMinutes(date) {
  const d = peekDay(date);
  const plan = sessionsFor(date);
  let m = 0;
  (d.sesiones || []).forEach((s, i) => { if (s?.hecho) m += s.min ?? plan[i]?.min ?? 0; });
  (d.extra || []).forEach(x => { m += x.min || 0; });
  return m;
}
export function weekExerciseMinutes(date) { const mon = mondayOf(date); return sum(range(mon, addDays(mon, 6)).map(exerciseMinutes)); }
export function plannedWeekMinutes(date) { const mon = mondayOf(date); return sum(range(mon, addDays(mon, 6)).map(d => sum(sessionsFor(d).map(s => s.min)))); }
export function nextTestDue() {
  const last = state.tests.length ? state.tests.map(t => t.fecha).sort().pop() : null;
  const from = last || state.profile.inicio;
  return addDays(from, 28);
}

// ───────── Hábitos ─────────
export function habitValue(h, date) {
  const d = peekDay(date);
  const hv = d.habitos || {};
  switch (h.id) {
    case 'estudio': return sum((d.estudio || []).map(x => x.min));
    case 'sueno': return d.sueno?.horas ?? null;
    case 'picoteo': return (d.picoteos || []).filter(p => p.comido).length;
    case 'pesaje': return d.peso ? 1 : 0;
    case 'pasos': return hv.pasos ?? null;
    default: return hv[h.id] ?? null;
  }
}
export function habitMet(h, date) {
  const v = habitValue(h, date);
  switch (h.id) {
    case 'estudio': return weekStudyMinutes(date) >= h.meta || v >= 90;
    case 'sueno': return v != null && v >= h.meta;
    case 'picoteo': return date in state.days && v === 0;
    case 'alcohol': case 'pantallas': return v === true;
    default: return v != null && v >= h.meta;
  }
}
export function weekStudyMinutes(date) { const mon = mondayOf(date); return sum(range(mon, addDays(mon, 6)).map(d => sum((peekDay(d).estudio || []).map(x => x.min)))); }
export function weekReadingPages(date) { const mon = mondayOf(date); return sum(range(mon, addDays(mon, 6)).map(d => (peekDay(d).habitos || {}).lectura || 0)); }
export function streak(h, date = today()) {
  let n = 0, d = date;
  if (!habitMet(h, d)) d = addDays(d, -1); // hoy aún puede completarse
  while (d >= state.profile.inicio && habitMet(h, d)) { n++; d = addDays(d, -1); if (n > 999) break; }
  return n;
}
export function dayHabitPct(date) {
  const list = D.habits.filter(h => h.id !== 'estudio');
  const met = list.filter(h => habitMet(h, date)).length;
  return Math.round(met / list.length * 100);
}
export function weekHabitPct(date) {
  const mon = mondayOf(date);
  const days = range(mon, addDays(mon, 6)).filter(d => d <= today() && d >= state.profile.inicio);
  return days.length ? Math.round(avg(days.map(dayHabitPct))) : 0;
}

// ───────── Comidas cumplidas ─────────
export function mealsDone(date) { const c = peekDay(date).comidas || {}; return SLOTS.filter(s => c[s.id] === 'ok' || c[s.id] === 'cambio' || c[s.id] === 'libre').length; }

// ───────── Logros ─────────
export const BADGES = [
  { id: 'primer-registro', e: '🌱', n: 'Primer registro' },
  { id: 'kg1', e: '🥇', n: 'Primer kilo menos' },
  { id: 'kg5', e: '🔥', n: '5 kg menos' },
  { id: 'kg10', e: '💪', n: '10 kg menos' },
  { id: 'skate', e: '🛹', n: 'Skate desbloqueado' },
  { id: 'obesidad', e: '🎉', n: 'Fuera de obesidad' },
  { id: 'kg15', e: '🚀', n: '15 kg menos' },
  { id: 'surf', e: '🏄', n: 'Surf desbloqueado' },
  { id: 'kg20', e: '🌟', n: '20 kg menos' },
  { id: 'meta', e: '🎯', n: 'Meta alcanzada' },
  { id: 'racha7', e: '📅', n: '7 días registrando' },
  { id: 'racha30', e: '🗓️', n: '30 días registrando' },
  { id: 'menu-completo', e: '🥗', n: 'Un día de menú completo' },
  { id: 'semana-10h', e: '⏱️', n: 'Semana de 10 h de ejercicio' },
  { id: 'estudio-10h', e: '📚', n: 'Semana de 10 h de estudio' },
  { id: 'ejercicio100', e: '🏅', n: '100 h de ejercicio' },
  { id: 'paginas1000', e: '📖', n: '1.000 páginas leídas' },
  { id: 'test-base', e: '✅', n: 'Test base superado' },
];
export function checkBadges(date = today()) {
  const got = [];
  const give = (id) => { if (!state.logros[id]) { state.logros[id] = date; got.push(BADGES.find(b => b.id === id) || { id, e: '🏆', n: id }); } };
  const days = Object.keys(state.days);
  if (days.length) give('primer-registro');
  const sw = startWeight(), cw = lastMetric('peso')?.v;
  if (sw && cw) {
    const lost = sw - cw;
    [[1, 'kg1'], [5, 'kg5'], [10, 'kg10'], [15, 'kg15'], [20, 'kg20']].forEach(([k, id]) => { if (lost >= k) give(id); });
    if (cw <= goalWeight()) give('meta');
    if (bmi(cw) < 30 && bmi(sw) >= 30) give('obesidad');
  }
  const sk = unlockStatus('skate'); if (sk.pesoOk && sk.testOk) give('skate');
  const sf = unlockStatus('surf'); if (sf.pesoOk && sf.testOk) give('surf');
  // racha de días con algún registro
  let n = 0, d = date; while (state.days[d] && Object.keys(state.days[d]).length) { n++; d = addDays(d, -1); }
  if (n >= 7) give('racha7'); if (n >= 30) give('racha30');
  if (mealsDone(date) === 5) give('menu-completo');
  if (weekExerciseMinutes(date) >= 600) give('semana-10h');
  if (weekStudyMinutes(date) >= 600) give('estudio-10h');
  if (sum(days.map(exerciseMinutes)) >= 6000) give('ejercicio100');
  if (sum(days.map(x => (state.days[x].habitos || {}).lectura || 0)) >= 1000) give('paginas1000');
  if (lastTest('base')?.superado) give('test-base');
  return got;
}

// ───────── Informe semanal y asesor ─────────
export function trendPerWeek(days = 14, upTo = today()) {
  const from = addDays(upTo, -days + 1);
  const pts = weighIns().filter(w => w.date >= from && w.date <= upTo).map(w => ({ x: diffDays(from, w.date), y: w.peso }));
  if (pts.length < 4) return null;
  const s = linreg(pts);
  return s == null ? null : s * 7;
}
export function weeklyReport(end = today()) {
  const start = addDays(end, -6);
  const ds = range(start, end).filter(d => d >= state.profile.inicio);
  const w = weighIns().filter(x => x.date >= start && x.date <= end);
  const prevW = weighIns().filter(x => x.date >= addDays(start, -7) && x.date < start);
  const pic = ds.flatMap(d => (peekDay(d).picoteos || []).map(p => ({ ...p, d })));
  const picCom = pic.filter(p => p.comido);
  const motivos = {}; pic.forEach(p => { motivos[p.motivo] = (motivos[p.motivo] || 0) + 1; });
  const horas = {}; pic.forEach(p => { const h = (p.t || '00:00').slice(0, 2); horas[h] = (horas[h] || 0) + 1; });
  const topMotivo = Object.entries(motivos).sort((a, b) => b[1] - a[1])[0];
  const topHora = Object.entries(horas).sort((a, b) => b[1] - a[1])[0];
  const meals = sum(ds.map(mealsDone)), mealsMax = ds.length * 5;
  const sueno = avg(ds.map(d => peekDay(d).sueno?.horas));
  const ex = sum(ds.map(exerciseMinutes));
  const est = sum(ds.map(d => sum((peekDay(d).estudio || []).map(x => x.min))));
  const pag = sum(ds.map(d => (peekDay(d).habitos || {}).lectura || 0));
  const hab = ds.length ? Math.round(avg(ds.map(dayHabitPct))) : 0;
  const trend = trendPerWeek(14, end);
  let consejo = { tipo: 'mantener', texto: 'Mantén las calorías: el ritmo es bueno.', kcal: state.profile.kcal };
  if (trend == null) consejo = { tipo: 'datos', texto: 'Aún faltan pesajes para valorar el ritmo (hacen falta unas dos semanas).', kcal: state.profile.kcal };
  else if (trend > -0.5) {
    const k = Math.max(state.profile.sexo === 'm' ? 1400 : 1700, state.profile.kcal - 100);
    consejo = k < state.profile.kcal ? { tipo: 'bajar', texto: `Bajas ${fNum(Math.abs(Math.min(0, trend)))} kg por semana, por debajo de 0,5. Propongo bajar a ${k} kcal.`, kcal: k }
      : { tipo: 'mantener', texto: 'Estás en el mínimo recomendado de calorías: mejor sumar actividad que comer menos.', kcal: state.profile.kcal };
  } else if (trend < -1.2) consejo = { tipo: 'subir', texto: `Bajas ${fNum(Math.abs(trend))} kg por semana, más de lo recomendable. Propongo subir a ${state.profile.kcal + 100} kcal.`, kcal: state.profile.kcal + 100 };
  // hábito más flojo como objetivo de la semana
  const weak = D.habits.filter(h => !['estudio', 'pesaje'].includes(h.id)).map(h => ({ h, n: ds.filter(d => habitMet(h, d)).length })).sort((a, b) => a.n - b.n)[0];
  return {
    start, end, dias: ds.length,
    pesoIni: w[0]?.peso ?? null, pesoFin: w[w.length - 1]?.peso ?? null,
    mediaPeso: avg(w.map(x => x.peso)), mediaPrev: avg(prevW.map(x => x.peso)),
    trend, meals, mealsMax, picoteos: pic.length, picoteosComidos: picCom.length,
    topMotivo: topMotivo?.[0], topHora: topHora ? `${topHora[0]}:00` : null,
    sueno, ex, est, pag, hab, consejo,
    foco: weak ? `${weak.h.emoji} ${weak.h.nombre}: cumplido ${weak.n} de ${ds.length} días` : null,
  };
}

// Resumen compacto para enviar a Claude (buzón)
export function summaryForClaude(end = today()) {
  const r = weeklyReport(end);
  const ds = range(addDays(end, -6), end);
  return {
    app: 'habitos-saludables', tipo: 'resumen-semanal', hasta: end,
    perfil: { kcal: state.profile.kcal, proteina: state.profile.proteina, objetivo: state.profile.objetivo, inicio: state.profile.inicio },
    dias: ds.map(d => { const x = peekDay(d); return { fecha: d, peso: x.peso ?? null, grasa: x.grasa ?? null, musculo: x.musculo ?? null, visceral: x.visceral ?? null, comidas: x.comidas || {}, eleccion: x.eleccion || {}, picoteos: (x.picoteos || []).length, ejercicioMin: exerciseMinutes(d), estudioMin: sum((x.estudio || []).map(e => e.min)), sueno: x.sueno?.horas ?? null }; }),
    resumen: { trendKgSemana: r.trend, comidasCumplidas: `${r.meals}/${r.mealsMax}`, ejercicioMin: r.ex, estudioMin: r.est, paginas: r.pag, habitosPct: r.hab, consejo: r.consejo.texto },
    favoritas: Object.keys(state.favoritas), descartadas: Object.keys(state.descartadas),
    proximaSemana: saturdayOf(addDays(end, 1)) === saturdayOf(end) ? addDays(saturdayOf(end), 7) : saturdayOf(addDays(end, 1)),
    recetas: [...D.recipes, ...Object.values(state.recetasExtra)].map(r => ({ id: r.id, nombre: r.nombre, slot: r.slot, kcal: r.kcal, p: r.p })),
    alimentos: Object.fromEntries(Object.entries(D.foods).map(([k, f]) => [k, `${f.n} · ${f.u === 'ud' ? `unidades de ${f.gpu} g` : f.u === 'lata' ? `latas de ${f.gpu} g` : f.u}`])),
    menusRecibidos: Object.keys(state.menus).sort(),
  };
}

export function validateClaudeMenu(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('No es un JSON válido.');
  const semana = obj.semana;
  if (!semana || !/^\d{4}-\d{2}-\d{2}$/.test(semana)) throw new Error('Falta "semana" (fecha del sábado).');
  if (dow(semana) !== 6) throw new Error('"semana" debe ser un sábado.');
  const recetas = {};
  for (const r of obj.recetas || []) {
    if (!r.id || !r.nombre || !r.slot) throw new Error('Cada receta necesita id, nombre y slot.');
    recetas[r.id] = { emoji: '🍽️', pasos: [], ings: [], tags: [], min: 20, ...r, kcal: Number(r.kcal) || 0, p: Number(r.p) || 0, g: Number(r.g) || 0, hc: Number(r.hc) || 0, claude: true };
  }
  const dias = {};
  for (const d of obj.dias || []) {
    if (!d.fecha) continue;
    dias[d.fecha] = {};
    for (const s of SLOTS) if (d[s.id]) {
      const id = d[s.id];
      if (!recipe(id) && !recetas[id]) throw new Error(`Receta desconocida: ${id}`);
      dias[d.fecha][s.id] = id;
    }
  }
  if (!Object.keys(dias).length) throw new Error('El menú no trae días.');
  return { semana, dias, recetas, nota: obj.nota || '', recibido: new Date().toISOString() };
}

export function daysSinceStart() { return Math.max(0, diffDays(state.profile.inicio, today())) + 1; }
export function quoteOfDay(date = today()) { const i = Math.abs(diffDays('2026-01-01', date)) % D.quotes.length; return D.quotes[i]; }
export { iso, parseISO, fSigned };

// Arranque, navegación y acciones de Hábitos Saludables.
import { state, load, save, day, peekDay, replaceState, exportJSON, defaultState } from './store.js';
import * as L from './logic.js';
import * as V from './views.js';
import { ui } from './views.js';
import { bindCharts } from './charts.js';
import { readZepp, ocrAvailable } from './ocr.js';
import * as N from './native.js';
import { today, addDays, iso, fDateLong, fNum, toNum, minutesBetween, hm, saturdayOf, esc, DAY, fDateShort } from './util.js';

const $ = (s, r = document) => r.querySelector(s);
const view = $('#view');

// ───────── Utilidades de interfaz ─────────
let toastT;
export function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
}
function openSheet(html) {
  const s = $('#sheet');
  s.innerHTML = `<div class="grab"></div><button class="icon-btn close" data-act="cerrar" aria-label="Cerrar">✕</button>${html}`;
  s.hidden = false; $('#backdrop').hidden = false;
  s.scrollTop = 0;
  bindCharts(s);
}
function closeSheet() { $('#sheet').hidden = true; $('#backdrop').hidden = true; $('#sheet').innerHTML = ''; clearInterval(picTimerI); }
function applyTheme() {
  const t = state.profile.tema;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
}
function celebrate(badges) {
  if (!badges.length) return;
  setTimeout(() => toast(`🏆 Logro desbloqueado: ${badges.map(b => `${b.e} ${b.n}`).join(' · ')}`, 4200), 400);
}
function commit(msg) {
  const got = L.checkBadges();
  save(); render();
  if (msg) toast(msg);
  celebrate(got);
}

// ───────── Navegación ─────────
const TABS = ['inicio', 'comida', 'ejercicio', 'habitos', 'progreso', 'ajustes'];
function route() { const h = location.hash.replace('#', ''); return TABS.includes(h) ? h : 'inicio'; }
let hcStatusMsg = '';
export function render() {
  $('#topDate').textContent = fDateLong(today());
  if (!state.profile.onboarded) {
    $('#tabbar').hidden = true; $('#fab').hidden = true;
    view.innerHTML = V.onboarding();
    return;
  }
  $('#tabbar').hidden = false; $('#fab').hidden = false;
  const r = route();
  document.querySelectorAll('#tabbar a').forEach(a => a.classList.toggle('active', a.dataset.tab === r));
  const html = r === 'ajustes' ? V.ajustes(hcStatusMsg) : V[r]();
  view.innerHTML = html;
  bindCharts(view);
}
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

// ───────── Acciones ─────────
let picTimerI = null;
let lastFileMode = 'ocr';
const actions = {
  cerrar: closeSheet,
  tab(el) { ui.tabs[el.dataset.k] = el.dataset.v; if (el.tagName === 'A') { location.hash = el.dataset.k; } render(); },
  day(el) { const k = el.dataset.k; ui.date[k] = addDays(ui.date[k] || today(), Number(el.dataset.n)); render(); },
  irDia(el) { ui.date.comida = el.dataset.d; ui.tabs.comida = 'hoy'; render(); window.scrollTo(0, 0); },
  irDiaEj(el) { ui.date.ejercicio = el.dataset.d; ui.tabs.ejercicio = 'hoy'; render(); window.scrollTo(0, 0); },
  semanaMenu(el) { ui.date.comida = addDays(ui.date.comida || today(), Number(el.dataset.n)); render(); },
  semanaCompra(el) { ui.compraManual = true; ui.date.comida = el.dataset.sat; render(); },

  // Comida
  receta(el) { openSheet(V.recetaSheet(el.dataset.id, el.dataset.d || null)); },
  meal(el) {
    const d = day(el.dataset.d); d.comidas = d.comidas || {};
    const v = el.dataset.v;
    if (!v || d.comidas[el.dataset.s] === v) delete d.comidas[el.dataset.s]; else d.comidas[el.dataset.s] = v;
    closeSheet(); commit(v === 'ok' ? '✓ Anotado. ¡Bien hecho!' : '');
  },
  cambiar(el) { openSheet(V.cambiarSheet(el.dataset.d, el.dataset.s)); },
  elegir(el) {
    const d = day(el.dataset.d); d.eleccion = d.eleccion || {}; d.eleccion[el.dataset.s] = el.dataset.id;
    closeSheet(); commit('Plato cambiado ↺');
  },
  libre(el) {
    if (L.freeMealUsed(el.dataset.d)) return toast('Ya has usado la comida libre de esta semana.');
    const d = day(el.dataset.d); d.comidas = d.comidas || {}; d.comidas[el.dataset.s] = 'libre';
    commit('🎉 ¡Disfrútala! El resto del día, según el plan.');
  },
  fav(el) { const id = el.dataset.id; if (state.favoritas[id]) delete state.favoritas[id]; else state.favoritas[id] = true; save(); openSheet(V.recetaSheet(id, el.dataset.d || null)); render(); },
  descartar(el) { const id = el.dataset.id; if (state.descartadas[id]) delete state.descartadas[id]; else state.descartadas[id] = true; save(); openSheet(V.recetaSheet(id, el.dataset.d || null)); render(); },
  async compartirCompra(el) {
    const list = L.shoppingList(el.dataset.sat);
    const done = state.compra[el.dataset.sat]?.hechos || {};
    const txt = `🛒 Lista de la compra · semana del ${fDateShort(el.dataset.sat)}\n\n` + list.map(s => `${s.sec.toUpperCase()}\n` + s.items.filter(i => !done[i.key]).map(i => `• ${i.name}: ${i.txt}`).join('\n')).join('\n\n');
    const r = await N.shareText('Lista de la compra', txt);
    if (r === 'copied') toast('Lista copiada al portapapeles');
  },
  picoteo() { openSheet(V.picoteoSheet(1)); },
  picoteoMotivo(el) {
    const m = el.dataset.v;
    openSheet(V.picoteoSheet(2, m));
    if (m !== 'Hambre') {
      const end = Date.now() + 10 * 60000;
      clearInterval(picTimerI);
      picTimerI = setInterval(() => {
        const t = $('#picTimer'); if (!t) return clearInterval(picTimerI);
        const s = Math.max(0, Math.round((end - Date.now()) / 1000));
        t.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        if (!s) { clearInterval(picTimerI); t.textContent = '¡Hecho! 💪'; }
      }, 1000);
    }
  },
  picoteoFin(el) {
    const d = day(today()); d.picoteos = d.picoteos || [];
    d.picoteos.push({ t: hm(), motivo: el.dataset.v, comido: el.dataset.c === '1' && el.dataset.v !== 'Hambre' });
    closeSheet(); commit(el.dataset.c === '1' ? (el.dataset.v === 'Hambre' ? 'Anotado. Comer cuando hay hambre es parte del plan 🍎' : 'Anotado. Mañana, otra oportunidad 🌱') : '💪 ¡Ganas superadas!');
  },

  // Báscula
  bascula(el) { openSheet(V.basculaSheet(el?.dataset?.d || today())); },
  ocr() {
    if (!ocrAvailable()) { toast('El lector de capturas funciona en la app instalada. Puedes anotar los datos a mano.'); return openSheet(V.basculaSheet(today())); }
    lastFileMode = 'ocr'; $('#fileInput').value = ''; $('#fileInput').click();
  },
  borrarMedicion(el) {
    const d = day(el.dataset.d);
    for (const k of ['peso', 'grasa', 'musculo', 'visceral', 'agua', 'proteina', 'osea', 'bmr', 'puntuacion', 'imc', 'fuentePeso']) delete d[k];
    closeSheet(); commit('Medición borrada');
  },

  // Ejercicio
  sesion(el) {
    const d = day(el.dataset.d); d.sesiones = d.sesiones || [];
    const i = Number(el.dataset.i); const plan = L.sessionsFor(el.dataset.d)[i];
    const cur = d.sesiones[i] || { min: plan.min };
    cur.hecho = !cur.hecho; d.sesiones[i] = cur;
    commit(cur.hecho ? `${L.sessionInfo(plan.tipo).emoji} ¡Sesión completada!` : '');
  },
  sesionMin(el) {
    const d = day(el.dataset.d); d.sesiones = d.sesiones || [];
    const i = Number(el.dataset.i); const plan = L.sessionsFor(el.dataset.d)[i];
    const cur = d.sesiones[i] || { min: plan.min, hecho: false };
    cur.min = Math.max(0, (cur.min ?? plan.min) + Number(el.dataset.n)); d.sesiones[i] = cur;
    save(); render();
  },
  extra(el) { openSheet(V.extraSheet(el?.dataset?.d || ui.date.ejercicio || today())); },
  borrarExtra(el) { const d = day(el.dataset.d); d.extra.splice(Number(el.dataset.j), 1); commit(); },
  test(el) { openSheet(V.testSheet(el.dataset.t)); },

  // Hábitos
  inc(el) {
    const date = el.dataset.d || today();
    const d = day(date); d.habitos = d.habitos || {};
    const h = el.dataset.h; d.habitos[h] = Math.max(0, (d.habitos[h] || 0) + Number(el.dataset.n));
    const meta = L.D.habits.find(x => x.id === h)?.meta;
    commit(meta && d.habitos[h] === meta ? '🌟 ¡Objetivo del día cumplido!' : '');
  },
  incAgua() { actions.inc({ dataset: { h: 'agua', n: '1' } }); closeSheet(); toast('💧 +1 vaso de agua'); },
  incPausa() { actions.inc({ dataset: { h: 'pausas', n: '1' } }); closeSheet(); toast('🧍 +1 pausa activa'); },
  toggleH(el) { const d = day(el.dataset.d || today()); d.habitos = d.habitos || {}; d.habitos[el.dataset.h] = !d.habitos[el.dataset.h]; commit(); },
  sueno(el) { openSheet(V.suenoSheet(el?.dataset?.d || today())); },
  pasos(el) { openSheet(V.pasosSheet(el.dataset.d)); },
  lecturaSheet() { openSheet(V.lecturaSheet(today())); },
  estudio() {
    if (state.estudio.inicio) {
      const min = Math.round((Date.now() - state.estudio.inicio) / 60000);
      const date = iso(new Date(state.estudio.inicio));
      state.estudio.inicio = null;
      if (min >= 1) { const d = day(date); d.estudio = d.estudio || []; d.estudio.push({ min, desde: 'crono' }); }
      commit(min >= 1 ? `📚 ${min} min de estudio anotados` : 'Cronómetro detenido');
    } else { state.estudio.inicio = Date.now(); save(); render(); toast('▶ Cronómetro en marcha. Puedes cerrar la app.'); }
  },
  estudioManual(el) { openSheet(V.estudioSheet(el?.dataset?.d || today())); },
  setVal(el) { const t = document.getElementById(el.dataset.target); if (t) t.value = el.dataset.v; },

  // Informe y asesor
  informe() { const sat = saturdayOf(today()); state.informes[sat] = true; save(); openSheet(V.informeSheet()); },
  aplicarKcal(el) {
    const k = Number(el.dataset.v);
    state.ajustes.push({ fecha: today(), de: state.profile.kcal, a: k });
    state.profile.kcal = k; closeSheet(); commit(`Calorías ajustadas a ${k} kcal`);
  },
  async copiarResumen() {
    const txt = 'Hola Claude, este es mi resumen semanal de Hábitos Saludables. Prepárame el menú de la semana siguiente en el formato JSON de la app (semana = sábado; usa los id de receta existentes o añade recetas nuevas en "recetas").\n\n' + JSON.stringify(L.summaryForClaude(), null, 1);
    const ok = await N.copyText(txt);
    if (ok) toast('📋 Resumen copiado. Pégalo en tu chat con Claude.'); else await N.shareText('Resumen semanal', txt);
  },
  pegarMenu() { openSheet(V.pegarMenuSheet()); },
  async buzonGuardar() {
    state.profile.buzonUrl = ($('#buzonUrl')?.value || '').trim(); save();
    if (!state.profile.buzonUrl) return toast('Buzón quitado');
    try { const r = await buzonSync(); toast(r); } catch (e) { toast(`No se pudo conectar con el buzón: ${e.message}`); }
  },

  // Ajustes
  sugerirKcal() {
    state.profile.kcal = L.suggestKcal(state.profile); state.profile.proteina = L.suggestProtein(state.profile);
    commit(`Plan recalculado: ${state.profile.kcal} kcal y ${state.profile.proteina} g de proteína`);
  },
  async programar() { const r = await scheduleReminders(true); if (r.startsWith('🔔')) { state.profile.notifActivas = true; save(); } toast(r); },
  async hcConectar() {
    try {
      const av = await N.hcAvailability();
      if (av === 'web') return toast('Health Connect solo funciona en la app instalada en Android.');
      if (av === 'NotSupported') return toast('Este móvil no es compatible con Health Connect.');
      const r = await N.hcRequest();
      state.hc.conectado = !!(r?.hasAllPermissions || r?.grantedPermissions?.length);
      save();
      if (state.hc.conectado) { hcStatusMsg = ''; await hcSync(false); } else { hcStatusMsg = 'Sin permisos. Vuelve a pulsar Conectar y acepta todo.'; render(); }
    } catch (e) { hcStatusMsg = `Error: ${e.message || e}`; render(); }
  },
  async hcSync() { await hcSync(false); },
  hcAjustes() { N.hcOpenSettings(); },
  async exportar() { await N.shareFile(`habitos-saludables-${today()}.json`, exportJSON()); },
  importar() { lastFileMode = 'backup'; $('#backupInput').value = ''; $('#backupInput').click(); },
  tema(el) { state.profile.tema = el.dataset.v; save(); applyTheme(); render(); },
  borrarTodo() {
    if (!confirm('¿Seguro que quieres borrar todos los datos? Haz antes una copia si la necesitas.')) return;
    replaceState(defaultState()); render(); toast('Datos borrados');
  },
};

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const a = el.dataset.act;
  if (el.tagName === 'A' && a !== 'tab') return;
  if (actions[a]) { ev.preventDefault(); actions[a](el); }
});
$('#backdrop').addEventListener('click', closeSheet);
$('#fab').addEventListener('click', () => openSheet(V.quickSheet()));
$('#btnAjustes').addEventListener('click', () => { location.hash = 'ajustes'; });

document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.dataset.change === 'compra') {
    const c = state.compra[el.dataset.sat] = state.compra[el.dataset.sat] || { hechos: {} };
    if (el.checked) c.hechos[el.dataset.k] = true; else delete c.hechos[el.dataset.k];
    save(); el.closest('.shop-item').classList.toggle('checked', el.checked);
  } else if (el.dataset.change === 'recordatorio') {
    state.profile.recordatorios[el.dataset.k] = el.checked; save();
  } else if (el.name === 'calidad') {
    el.closest('.btn-row').querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.contains(el)));
  }
});

// ───────── Formularios ─────────
document.addEventListener('submit', async (ev) => {
  const f = ev.target; ev.preventDefault();
  const v = Object.fromEntries(new FormData(f).entries());
  switch (f.id) {
    case 'formOnboarding': {
      const p = state.profile;
      Object.assign(p, { nombre: v.nombre.trim(), sexo: v.sexo, edad: toNum(v.edad), altura: toNum(v.altura), pesoInicial: toNum(v.pesoInicial), objetivo: toNum(v.objetivo), inicio: v.inicio || today(), dormir: v.dormir || p.dormir, despertar: v.despertar || p.despertar });
      p.kcal = L.suggestKcal(p); p.proteina = L.suggestProtein(p); p.onboarded = true;
      save(); render();
      openSheet(`<h2>Tu plan está listo 🚀</h2><p>Calorías: <b>${p.kcal} kcal</b> al día, en 5 comidas.<br>Proteína: <b>${p.proteina} g</b> al día para conservar el músculo.<br>Ejercicio: <b>10 h</b> a la semana, con intensidad progresiva.</p>
        <p class="small muted">Siguientes pasos: lee la captura de Zepp Life para registrar tu composición, conecta Health Connect y activa los recordatorios en Ajustes ⚙️.</p>
        <button class="btn primary block" data-act="cerrar">Empezar</button>`);
      return;
    }
    case 'formBascula': {
      const date = v.fecha || today();
      const d = day(date);
      for (const k of ['peso', 'grasa', 'musculo', 'visceral', 'agua', 'proteina', 'osea', 'bmr', 'puntuacion', 'imc']) { const n = toNum(v[k]); if (n != null) d[k] = n; else delete d[k]; }
      if (d.peso && !d.imc) d.imc = Math.round(L.bmi(d.peso) * 10) / 10;
      if (d.peso) d.fuentePeso = v.fuente || 'manual';
      closeSheet(); commit('⚖️ Medición guardada');
      return;
    }
    case 'formSueno': {
      const d = day(f.dataset.d);
      const min = minutesBetween(v.acostar, v.levantar);
      d.sueno = { acostar: v.acostar, levantar: v.levantar, calidad: Number(v.calidad) || null, horas: Math.round(min / 6) / 10 };
      closeSheet(); commit(`😴 ${fNum(d.sueno.horas)} h de sueño anotadas`);
      return;
    }
    case 'formEstudio': {
      const d = day(f.dataset.d); d.estudio = d.estudio || [];
      const m = toNum(v.min); if (!m) return;
      d.estudio.push({ min: m, tema: v.tema || '' });
      closeSheet(); commit(`📚 ${m} min de estudio anotados`);
      return;
    }
    case 'formLectura': {
      const d = day(f.dataset.d); d.habitos = d.habitos || {};
      d.habitos.lectura = toNum(v.paginas) || 0; state.profile.libro = v.libro || '';
      closeSheet(); commit('📖 Lectura anotada');
      return;
    }
    case 'formPasos': {
      const d = day(f.dataset.d); d.habitos = d.habitos || {};
      d.habitos.pasos = toNum(v.pasos); d.pasosManual = true;
      closeSheet(); commit('👣 Pasos anotados');
      return;
    }
    case 'formExtra': {
      const d = day(f.dataset.d); d.extra = d.extra || [];
      d.extra.push({ tipo: v.tipo, min: toNum(v.min) || 0, nota: v.nota || '' });
      closeSheet(); commit('✨ Actividad añadida');
      return;
    }
    case 'formTest': {
      const tipo = f.dataset.t, T = L.D.tests[tipo];
      const valores = {}; let ok = 0, total = 0;
      for (const [k, , , meta] of T.items) {
        const n = toNum(v[k]);
        if (n == null && k === 'nadar') continue;
        total++; valores[k] = n; if (n != null && n >= meta) ok++;
      }
      state.tests.push({ tipo, fecha: today(), valores, cumplidos: ok, total, superado: ok === total });
      closeSheet(); commit(ok === total ? '✅ ¡Test superado!' : `Test guardado: ${ok} de ${total} pruebas. ¡A por el siguiente!`);
      return;
    }
    case 'formPerfil': {
      const p = state.profile;
      Object.assign(p, { nombre: v.nombre, edad: toNum(v.edad), altura: toNum(v.altura), sexo: v.sexo, pesoInicial: toNum(v.pesoInicial), objetivo: toNum(v.objetivo), kcal: toNum(v.kcal) || p.kcal, proteina: toNum(v.proteina) || p.proteina, inicio: v.inicio || p.inicio, dormir: v.dormir, despertar: v.despertar });
      for (const s of L.SLOTS) if (v[`h_${s.id}`]) p.horarios[s.id] = v[`h_${s.id}`];
      commit('Ajustes guardados');
      return;
    }
    case 'formMenu': {
      try {
        const m = L.validateClaudeMenu(JSON.parse(v.json));
        state.menus[m.semana] = { dias: m.dias, nota: m.nota, recibido: m.recibido };
        Object.assign(state.recetasExtra, m.recetas);
        closeSheet(); commit(`🤖 Menú del ${fDateShort(m.semana)} cargado`);
      } catch (e) { toast(`No se pudo cargar: ${e.message}`); }
      return;
    }
  }
});

// ───────── Archivos (captura y copia de seguridad) ─────────
$('#fileInput').addEventListener('change', async (ev) => {
  const file = ev.target.files?.[0]; if (!file) return;
  toast('📷 Leyendo la captura… (unos segundos)', 15000);
  try {
    const { values } = await readZepp(file, p => { $('#toast').textContent = `📷 Leyendo la captura… ${Math.round(p * 100)} %`; });
    const date = values.fecha && values.fecha <= today() && values.fecha >= addDays(today(), -7) ? values.fecha : today();
    let aviso = '';
    const n = Object.keys(values).filter(k => !['fecha', 'hora'].includes(k)).length;
    if (!values.peso) aviso = 'No he podido leer el peso. Revísalo antes de guardar.';
    else if (values.imc && state.profile.altura) {
      const calc = values.imc * (state.profile.altura / 100) ** 2;
      if (Math.abs(calc - values.peso) > 1.5) aviso = `Comprueba el peso: con el IMC leído saldrían ${fNum(calc)} kg.`;
    }
    if (!aviso) aviso = `He leído ${n} datos${values.hora ? ` de la medición de las ${values.hora}` : ''}. Revísalos y guarda.`;
    toast('Listo ✓', 1200);
    openSheet(V.basculaSheet(date, values, esc(aviso)));
  } catch (e) {
    toast(`No se pudo leer la captura: ${e.message || e}`, 4000);
    openSheet(V.basculaSheet(today()));
  }
});
$('#backupInput').addEventListener('change', async (ev) => {
  const file = ev.target.files?.[0]; if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data.profile || !data.days) throw new Error('No parece una copia de Hábitos Saludables.');
    if (!confirm(`¿Sustituir los datos actuales por la copia del ${String(data.exportado || '').slice(0, 10)}?`)) return;
    delete data.app; delete data.exportado;
    replaceState(data); applyTheme(); render(); toast('Copia restaurada ✓');
  } catch (e) { toast(`No se pudo importar: ${e.message}`); }
});

// ───────── Health Connect ─────────
let hcBusy = false;
async function hcSync(silent = true) {
  if (!N.isNative()) { if (!silent) toast('Health Connect solo funciona en la app instalada.'); return; }
  if (hcBusy) return; hcBusy = true;
  try {
    if (!state.hc.conectado) { state.hc.conectado = await N.hcHasPermissions(); if (!state.hc.conectado) { if (!silent) toast('Conecta Health Connect en Ajustes.'); return; } }
    const end = new Date(), start = new Date(Date.now() - (state.hc.ultima ? 10 : 90) * DAY);
    const local = (t) => iso(new Date(t));
    let changes = 0;
    // Peso: el primer pesaje de cada día (el de la mañana)
    const ws = await N.hcRead('Weight', start, end);
    const byDay = {};
    for (const r of ws) { const d = local(r.time); if (!byDay[d] || r.time < byDay[d].time) byDay[d] = r; }
    for (const [d, r] of Object.entries(byDay)) {
      const kg = r.weight?.unit === 'gram' ? r.weight.value / 1000 : r.weight?.value;
      if (!kg) continue;
      const x = day(d);
      if (!x.peso || x.fuentePeso === 'hc') { const v = Math.round(kg * 10) / 10; if (x.peso !== v) { x.peso = v; x.fuentePeso = 'hc'; x.imc = Math.round(L.bmi(v) * 10) / 10; changes++; } }
    }
    const fs = await N.hcRead('BodyFat', start, end);
    for (const r of fs) { const x = day(local(r.time)); if (x.grasa == null && r.percentage?.value) { x.grasa = Math.round(r.percentage.value * 10) / 10; changes++; } }
    const bs = await N.hcRead('BasalMetabolicRate', start, end);
    for (const r of bs) { const x = day(local(r.time)); if (x.bmr == null && r.basalMetabolicRate?.value) { x.bmr = Math.round(r.basalMetabolicRate.value); changes++; } }
    // Pasos de los últimos 8 días: total por app de origen y nos quedamos con el mayor (evita contar dos veces)
    const s0 = new Date(); s0.setHours(0, 0, 0, 0); s0.setDate(s0.getDate() - 7);
    const st = await N.hcRead('Steps', s0, end);
    const steps = {};
    for (const r of st) { const d = local(r.startTime); const o = r.metadata?.dataOrigin || 'x'; steps[d] = steps[d] || {}; steps[d][o] = (steps[d][o] || 0) + (r.count || 0); }
    for (const [d, o] of Object.entries(steps)) { const x = day(d); if (x.pasosManual) continue; x.habitos = x.habitos || {}; const v = Math.max(...Object.values(o)); if (x.habitos.pasos !== v) { x.habitos.pasos = v; changes++; } }
    state.hc.ultima = `${today()}T${hm()}`;
    commit(silent ? '' : changes ? `🔄 Health Connect: ${changes} datos actualizados` : '🔄 Health Connect: todo al día');
  } catch (e) {
    if (!silent) toast(`Health Connect: ${e.message || e}`, 4000);
  } finally { hcBusy = false; }
}

// ───────── Buzón con Claude (Apps Script) ─────────
async function buzonSync() {
  const url = state.profile.buzonUrl; if (!url) return 'Sin buzón configurado';
  await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ accion: 'resumen', datos: L.summaryForClaude() }) });
  const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'accion=menu');
  const j = await r.json();
  if (j && j.semana) {
    const m = L.validateClaudeMenu(j);
    const nuevo = !state.menus[m.semana] || state.menus[m.semana].recibido !== (j.recibido || m.recibido);
    state.menus[m.semana] = { dias: m.dias, nota: m.nota, recibido: j.recibido || m.recibido };
    Object.assign(state.recetasExtra, m.recetas);
    save(); render();
    return nuevo ? `🤖 Menú del ${fDateShort(m.semana)} recibido` : 'Buzón al día ✓';
  }
  return 'Resumen enviado. Aún no hay menú nuevo.';
}

// ───────── Recordatorios ─────────
function at(t, delta = 0) { const [h, m] = t.split(':').map(Number); const x = h * 60 + m + delta; return { hour: Math.floor(((x % 1440) + 1440) % 1440 / 60), minute: ((x % 60) + 60) % 60 }; }
async function scheduleReminders(ask) {
  if (!N.isNative()) return 'Los recordatorios funcionan en la app instalada.';
  if (ask) { const p = await N.notifPermission(); if (p !== 'granted') return 'Sin permiso para notificaciones. Actívalo en los ajustes del móvil.'; }
  const p = state.profile, r = p.recordatorios, list = [];
  const add = (id, title, body, on) => list.push({ id, title, body, schedule: { on, allowWhileIdle: true } });
  if (r.pesaje) add(10, '⚖️ Buenos días', 'Pésate en ayunas antes de desayunar.', at(p.despertar, 10));
  if (r.comidas) {
    const msg = { desayuno: '☕ Hora del desayuno', media: '🍎 Media mañana', comida: '🍽️ Hora de comer', merienda: '🥪 Merienda', cena: '🌙 Hora de cenar' };
    L.SLOTS.forEach((s, i) => add(20 + i, msg[s.id], 'Tu menú de hoy te espera en Hábitos Saludables.', at(p.horarios[s.id])));
  }
  if (r.pausas) { let id = 40; for (let wd = 2; wd <= 6; wd++) for (let h = 10; h <= 19; h++) { if (h === 14) continue; add(id++, '🧍 Pausa activa', 'Levántate 3–5 minutos y muévete.', { weekday: wd, hour: h, minute: 50 }); } }
  if (r.agua) { add(90, '💧 Agua', '¿Cómo vas con los vasos de agua?', { hour: 12, minute: 15 }); add(91, '💧 Agua', 'Un vaso de agua ahora suma.', { hour: 18, minute: 15 }); }
  if (r.picoteo) add(92, '🚫 Hora de picoteo', 'Si tienes hambre, tienes la merienda planificada. Si no, pulsa SOS.', at(p.horarios.merienda, 75));
  if (r.dormir) add(93, '📵 En 30 minutos a dormir', 'Pantallas fuera y a descansar.', at(p.dormir, -30));
  if (r.semanal) { add(94, '📋 Informe semanal', 'Tu informe y el menú de la próxima semana están listos.', { weekday: 6, hour: 18, minute: 0 }); add(95, '🛒 Día de compra', 'Tu lista de la compra está en la app.', { weekday: 7, hour: 10, minute: 0 }); }
  const n = await N.notifReplace(list);
  return `🔔 ${n} recordatorios programados`;
}

// ───────── Arranque ─────────
async function init() {
  await load();
  applyTheme();
  ui.date.comida = ui.date.ejercicio = ui.date.habitos = null;
  render();
  L.checkBadges(); save();
  if (state.profile.onboarded) {
    setTimeout(() => hcSync(true), 800);
    if (state.profile.buzonUrl && new Date().getDay() >= 5) setTimeout(() => buzonSync().catch(() => {}), 2500);
  }
  N.onResume(() => { render(); hcSync(true); });
  N.onBack(() => {
    if (!$('#sheet').hidden) return closeSheet();
    if (route() !== 'inicio') { location.hash = 'inicio'; return; }
    N.exitApp();
  });
  // reprograma recordatorios al abrir (por si cambió el horario), sin volver a pedir permiso
  if (state.profile.notifActivas) setTimeout(() => scheduleReminders(false).catch(() => {}), 3000);
}
init();

// Para pruebas en el navegador
window.HS = { state: () => state, render, actions, L };

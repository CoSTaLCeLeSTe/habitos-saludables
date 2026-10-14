// Estado de la app, guardado en el móvil (localStorage + SharedPreferences como respaldo).
import { prefsGet, prefsSet } from './native.js';
import { today } from './util.js';

const KEY = 'hs.v1';

export function defaultState() {
  return {
    version: 1,
    profile: {
      onboarded: false,
      nombre: '',
      sexo: 'h',
      edad: null,
      altura: null,
      pesoInicial: null,
      objetivo: null,
      inicio: today(),
      kcal: 1900,
      proteina: 160,
      horarios: { desayuno: '08:30', media: '11:00', comida: '14:30', merienda: '17:00', cena: '20:30' },
      dormir: '23:30',
      despertar: '07:30',
      recordatorios: { comidas: true, pesaje: true, pausas: true, agua: true, dormir: true, picoteo: true, semanal: true },
      tema: 'auto',
      buzonUrl: '',
    },
    days: {},        // 'YYYY-MM-DD' → registro del día
    tests: [],       // tests de forma
    logros: {},      // id → fecha
    menus: {},       // sábado → menú recibido de Claude
    recetasExtra: {},// recetas enviadas por Claude
    compra: {},      // sábado → { hechos: {clave: true} }
    ajustes: [],     // historial de cambios de calorías
    favoritas: {},
    descartadas: {},
    estudio: { inicio: null }, // cronómetro en marcha
    hc: { conectado: false, ultima: null },
    buzon: { ultima: null },
    informes: {},    // sábado → informe ya visto
  };
}

export let state = defaultState();

function merge(base, data) {
  const out = { ...base, ...data };
  out.profile = { ...base.profile, ...(data.profile || {}) };
  out.profile.horarios = { ...base.profile.horarios, ...((data.profile || {}).horarios || {}) };
  out.profile.recordatorios = { ...base.profile.recordatorios, ...((data.profile || {}).recordatorios || {}) };
  for (const k of ['days', 'logros', 'menus', 'recetasExtra', 'compra', 'favoritas', 'descartadas', 'informes']) out[k] = data[k] || {};
  for (const k of ['tests', 'ajustes']) out[k] = data[k] || [];
  out.hc = { ...base.hc, ...(data.hc || {}) };
  out.estudio = { ...base.estudio, ...(data.estudio || {}) };
  return out;
}

export async function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch { raw = null; }
  if (!raw) raw = await prefsGet(KEY);
  if (raw) {
    try { state = merge(defaultState(), JSON.parse(raw)); } catch { state = defaultState(); }
  }
  return state;
}

let timer = null;
export function save() {
  const raw = JSON.stringify(state);
  try { localStorage.setItem(KEY, raw); } catch { /* lleno */ }
  clearTimeout(timer);
  timer = setTimeout(() => prefsSet(KEY, raw), 400);
}

export function replaceState(data) {
  state = merge(defaultState(), data);
  save();
}

export function day(date) {
  if (!state.days[date]) state.days[date] = {};
  return state.days[date];
}
export function peekDay(date) { return state.days[date] || {}; }

export function exportJSON() {
  return JSON.stringify({ app: 'habitos-saludables', exportado: new Date().toISOString(), ...state }, null, 1);
}

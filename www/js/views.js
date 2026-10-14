// Pantallas de la app (HTML a partir del estado).
import { state, peekDay } from './store.js';
import * as L from './logic.js';
import { D, SLOTS } from './logic.js';
import { lineChart, sparkline } from './charts.js';
import { esc, fNum, fInt, fSigned, fHours, fHoursDec, fDateLong, fDateShort, fDow, fDowShort, today, addDays, diffDays, mondayOf, saturdayOf, range, hm, dow } from './util.js';
import { isNative } from './native.js';

export const ui = { tabs: { comida: 'hoy', ejercicio: 'hoy', progreso: 'peso' }, date: { comida: null, ejercicio: null, habitos: null } };
const dayOf = (k) => ui.date[k] || today();

function dayNav(key) {
  const d = dayOf(key), t = today();
  const label = d === t ? 'Hoy' : d === addDays(t, -1) ? 'Ayer' : d === addDays(t, 1) ? 'Mañana' : fDateShort(d);
  return `<div class="row between" style="margin:4px 0 12px">
    <button class="btn small" data-act="day" data-k="${key}" data-n="-1" aria-label="Día anterior">‹</button>
    <div style="text-align:center"><div style="font-family:var(--serif);font-weight:600;font-size:17px">${label}</div><div class="tiny muted cap">${fDateLong(d)}</div></div>
    <button class="btn small" data-act="day" data-k="${key}" data-n="1" aria-label="Día siguiente">›</button></div>`;
}
const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-act="tab" data-k="${key}" data-v="${v}" class="${ui.tabs[key] === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
const bar = (p, cls = '') => `<div class="bar ${cls}"><span style="width:${Math.max(0, Math.min(100, p))}%"></span></div>`;
function deltaTag(v, goodWhenDown = true, unit = ' kg') {
  if (v == null || isNaN(v)) return '';
  const cls = Math.abs(v) < 0.05 ? 'flat' : (v < 0) === goodWhenDown ? 'down' : 'up';
  const arrow = Math.abs(v) < 0.05 ? '＝' : v < 0 ? '▼' : '▲';
  return `<span class="delta ${cls}">${arrow} ${fNum(Math.abs(v))}${unit}</span>`;
}
function visceralTag(v) { if (v == null) return ''; return v <= 9 ? '<span class="tag good">Normal</span>' : v <= 14 ? '<span class="tag warn">Alto</span>' : '<span class="tag bad">Muy alto</span>'; }
function greeting() { const h = new Date().getHours(); return h < 6 ? 'Buenas noches' : h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches'; }

// ═════════════ ONBOARDING ═════════════
export function onboarding() {
  const p = state.profile;
  return `<div class="welcome"><img src="assets/logo.svg" alt=""><h1>Hábitos Saludables</h1>
    <p>Tu plan para llegar a tu peso objetivo comiendo bien, entrenando y cuidando tus hábitos. ✨</p></div>
    <hr class="rule">
    <form id="formOnboarding" class="card">
      <div class="eyebrow">Tu punto de partida</div><h3 style="margin:4px 0 14px">Cuéntame sobre ti</h3>
      <label class="field"><span>Nombre</span><input name="nombre" value="${esc(p.nombre)}" autocomplete="given-name" required></label>
      <div class="fields2">
        <label class="field"><span>Sexo</span><select name="sexo"><option value="h" ${p.sexo === 'h' ? 'selected' : ''}>Hombre</option><option value="m" ${p.sexo === 'm' ? 'selected' : ''}>Mujer</option></select></label>
        <label class="field"><span>Edad</span><input name="edad" type="number" inputmode="numeric" min="14" max="99" value="${p.edad ?? ''}" required></label>
      </div>
      <div class="fields2">
        <label class="field"><span>Altura (cm)</span><input name="altura" type="number" inputmode="numeric" min="120" max="230" value="${p.altura ?? ''}" required></label>
        <label class="field"><span>Peso actual (kg)</span><input name="pesoInicial" type="text" inputmode="decimal" value="${p.pesoInicial ?? ''}" required></label>
      </div>
      <div class="fields2">
        <label class="field"><span>Peso objetivo (kg)</span><input name="objetivo" type="text" inputmode="decimal" value="${p.objetivo ?? ''}" required></label>
        <label class="field"><span>Empiezas el</span><input name="inicio" type="date" value="${p.inicio}" required></label>
      </div>
      <div class="fields2">
        <label class="field"><span>Te acuestas a las</span><input name="dormir" type="time" value="${p.dormir}"></label>
        <label class="field"><span>Te levantas a las</span><input name="despertar" type="time" value="${p.despertar}"></label>
      </div>
      <button class="btn primary block" type="submit">Calcular mi plan 🚀</button>
      <p class="tiny muted" style="margin:10px 0 0">Tus datos se guardan solo en este móvil.</p>
    </form>`;
}

// ═════════════ INICIO ═════════════
export function inicio() {
  const p = state.profile, t = today();
  const lw = L.lastMetric('peso');
  const prev = lw ? L.prevMetric('peso', lw.date) : null;
  const sw = L.startWeight(), gw = L.goalWeight(), cw = lw?.v ?? sw;
  const lost = sw && cw ? sw - cw : 0, total = sw ? sw - gw : 1;
  const pct = Math.max(0, Math.min(100, lost / total * 100));
  const ms = L.milestones();
  const next = ms.find(m => cw > m.kg);
  const msBar = ms.map(m => {
    const pos = Math.max(0, Math.min(100, (sw - m.kg) / total * 100));
    return `<div class="ms-mark ${cw <= m.kg ? 'done' : ''}" style="left:${pos}%"><div class="ms-emoji">${m.emoji}</div><div class="ms-dot"></div><div class="ms-label">${fNum(m.kg, m.kg % 1 ? 1 : 0)}</div></div>`;
  }).join('');
  const comp = ['grasa', 'musculo', 'visceral', 'puntuacion'].map(k => ({ k, last: L.lastMetric(k) }));
  const compDate = comp.map(c => c.last?.date).filter(Boolean).sort().pop();
  const grasaKg = compDate ? L.fatKg(compDate) : null;
  const firstFat = L.metricSeries('grasa')[0];
  const m = L.menuFor(t), meals = peekDay(t).comidas || {};
  const nextSlot = SLOTS.find(s => !meals[s.id]);
  const ses = L.sessionsFor(t), sesDone = (peekDay(t).sesiones || []).filter(s => s?.hecho).length;
  const hv = peekDay(t).habitos || {};
  const sueno = peekDay(t).sueno;
  const pic = peekDay(t).picoteos || [];
  const wkEx = L.weekExerciseMinutes(t), wkSt = L.weekStudyMinutes(t), wkPg = L.weekReadingPages(t);
  const free = L.freeMealUsed(t);
  const showReport = dow(t) === 5 || dow(t) === 6 || dow(t) === 0;
  const spark = L.weighIns().slice(-14).map(w => ({ v: w.peso }));
  const unlockKey = next?.key === 'skate' || next?.key === 'surf' ? next.key : null;
  const us = unlockKey ? L.unlockStatus(unlockKey) : null;

  return `
  <div class="eyebrow" style="margin-top:6px">${t < p.inicio ? `Empiezas el ${fDateLong(p.inicio)}` : `Día ${L.daysSinceStart()} · Semana ${L.weekNo(t)}`}</div>
  <h1 class="page-title">${greeting()}${p.nombre ? `, ${esc(p.nombre.split(' ')[0])}` : ''} 👋</h1>
  <div class="quote">${esc(L.quoteOfDay())}</div>

  <div class="card hero">
    <div class="row between"><div class="eyebrow">${lw?.date === t ? 'Peso de hoy' : lw ? `Último peso · ${fDateShort(lw.date)}` : 'Peso de partida'}</div>${spark.length > 1 ? sparkline(spark) : ''}</div>
    <div class="row" style="align-items:flex-end;gap:12px;margin-top:6px;flex-wrap:wrap">
      <div class="hero-num num">${fNum(cw)}<small>kg</small></div>
      <div class="stack" style="padding-bottom:6px">
        ${prev ? `<div>${deltaTag(lw.v - prev.v)} <span class="tiny muted">vs ${fDateShort(prev.date)}</span></div>` : ''}
        ${sw && lw ? `<div>${deltaTag(lw.v - sw)} <span class="tiny muted">desde el inicio</span></div>` : ''}
      </div>
    </div>
    <div class="note">${esc(L.weightMessage(lw?.date || t))}</div>
    <div class="btn-row" style="margin-top:12px">
      <button class="btn small primary" data-act="ocr">📷 Leer captura</button>
      <button class="btn small" data-act="bascula">✏️ Anotar</button>
      ${isNative() && state.hc.conectado ? `<button class="btn small" data-act="hcSync">🔄 Sincronizar</button>` : ''}
    </div>
  </div>

  <div class="card">
    <div class="row between"><div><div class="eyebrow">Camino a tu meta</div><h3 style="margin-top:4px">${fNum(Math.max(0, lost))} de ${fNum(total)} kg <span class="muted small" style="font-family:var(--sans);font-weight:500">· ${fInt(pct)} %</span></h3></div><div style="font-size:28px">🎯</div></div>
    <div class="milestones"><div class="ms-track"></div><div class="ms-fill" style="width:${pct}%"></div>${msBar}</div>
    ${next ? `<div class="small" style="margin-top:4px">${next.emoji} Te faltan <b>${fNum(cw - next.kg)} kg</b> para ${next.key === 'meta' ? 'tu meta' : next.key === 'obesidad' ? 'salir de la obesidad' : `desbloquear el <b>${esc(next.nombre.toLowerCase())}</b>`}.</div>` : `<div class="small">🏆 ¡Meta alcanzada! Ahora toca mantener.</div>`}
    ${us ? `<div class="lock-steps muted"><div>${us.pesoOk ? '✅' : '⬜'} Bajo ${us.kg} kg tres mañanas seguidas (${Math.min(3, us.streak)}/3)</div><div>${us.testOk ? '✅' : '⬜'} ${us.key === 'skate' ? 'Test base' : 'Test de surf'} superado</div></div>` : ''}
  </div>

  <div class="section-title"><h2>Composición corporal</h2><a class="link" href="#progreso" data-act="tab" data-k="progreso" data-v="composicion">Ver gráficas</a></div>
  ${compDate ? `<div class="grid2">
    <div class="kpi"><div class="label">🔥 Grasa</div><div class="value num">${fNum(L.lastMetric('grasa')?.v)}<small>%</small></div><div class="sub">${grasaKg ? `${fNum(grasaKg)} kg de grasa` : ''}${firstFat && L.lastMetric('grasa') && L.lastMetric('grasa').date !== firstFat.date ? ` · ${fSigned(L.lastMetric('grasa').v - firstFat.v)} pts` : ''}</div></div>
    <div class="kpi"><div class="label">💪 Músculo</div><div class="value num">${fNum(L.lastMetric('musculo')?.v)}<small>kg</small></div><div class="sub">Objetivo: mantenerlo</div></div>
    <div class="kpi"><div class="label">🫀 Grasa visceral</div><div class="value num">${fInt(L.lastMetric('visceral')?.v)}</div><div class="sub">${visceralTag(L.lastMetric('visceral')?.v)}</div></div>
    <div class="kpi"><div class="label">⭐ Puntuación</div><div class="value num">${fInt(L.lastMetric('puntuacion')?.v)}<small>/100</small></div><div class="sub">Zepp Life</div></div>
  </div><p class="tiny muted" style="margin:6px 2px 0">Medición del ${fDateShort(compDate)}. Son estimaciones de la báscula: varían con la hidratación.</p>`
    : `<div class="card flat empty"><span class="e">📷</span>Lee la captura del resumen de Zepp Life para ver tu composición.</div>`}

  <div class="section-title"><h2>Hoy</h2></div>
  <div class="list">
    <a class="item clickable" href="#comida" style="text-decoration:none;color:inherit"><div class="emoji">🍽️</div><div class="body"><div class="title">Comidas ${L.mealsDone(t)}/5</div><div class="meta">${nextSlot ? `Siguiente: ${esc(nextSlot.nombre)} · ${esc(L.recipe(m[nextSlot.id])?.nombre || '')}` : 'Día de menú completo 👏'}</div></div><span class="chev">›</span></a>
    <a class="item clickable" href="#ejercicio" style="text-decoration:none;color:inherit"><div class="emoji">🏋️</div><div class="body"><div class="title">Entrenamiento ${sesDone}/${ses.length}</div><div class="meta">${t < p.inicio ? `El plan empieza el ${fDateShort(p.inicio)}` : esc(ses.map(s => `${L.sessionInfo(s.tipo).nombre.split(' ·')[0]} ${s.min}′`).join(' · ') || 'Descanso')}</div></div><span class="chev">›</span></a>
    <div class="item"><div class="emoji">💧</div><div class="body"><div class="title">Agua ${hv.agua || 0}/10 vasos</div><div class="meta">2,5 L al día</div></div><button class="round-btn primary" data-act="inc" data-h="agua" data-n="1">+</button></div>
    <div class="item"><div class="emoji">🧍</div><div class="body"><div class="title">Pausas activas ${hv.pausas || 0}/6</div><div class="meta">Levántate 3–5 min cada hora</div></div><button class="round-btn primary" data-act="inc" data-h="pausas" data-n="1">+</button></div>
    <div class="item clickable" data-act="sueno"><div class="emoji">😴</div><div class="body"><div class="title">${sueno?.horas ? `Sueño ${fHours(sueno.horas * 60)}` : 'Anota cómo has dormido'}</div><div class="meta">${sueno?.horas ? `Calidad ${'★'.repeat(sueno.calidad || 0)}${'☆'.repeat(5 - (sueno.calidad || 0))}` : 'Hora de acostarte, de levantarte y calidad'}</div></div><span class="chev">›</span></div>
    <div class="item"><div class="emoji">🚫</div><div class="body"><div class="title">Picoteos hoy: ${pic.filter(x => x.comido).length}</div><div class="meta">${pic.length ? `${pic.filter(x => !x.comido).length} ganas superadas 💪` : 'Si te entran ganas, pulsa SOS'}</div></div><button class="btn small gold" data-act="picoteo">SOS</button></div>
  </div>

  <div class="section-title"><h2>Esta semana</h2><button class="link" data-act="informe">📋 Informe</button></div>
  <div class="grid2">
    <div class="kpi"><div class="label">🏋️ Ejercicio</div><div class="value num">${fNum(wkEx / 60)}<small>/ 10 h</small></div>${bar(wkEx / 6)}</div>
    <div class="kpi"><div class="label">📚 Estudio</div><div class="value num">${fNum(wkSt / 60)}<small>/ 10 h</small></div>${bar(wkSt / 6, 'gold')}</div>
    <div class="kpi"><div class="label">📖 Lectura</div><div class="value num">${fInt(wkPg)}<small>/ 140 págs</small></div>${bar(wkPg / 1.4)}</div>
    <div class="kpi"><div class="label">✅ Hábitos</div><div class="value num">${L.weekHabitPct(t)}<small>%</small></div>${bar(L.weekHabitPct(t))}</div>
  </div>
  <div class="card flat" style="margin-top:10px"><div class="row between"><div><div class="title" style="font-weight:600">🎉 Comida libre</div><div class="small muted">${free ? `Usada el ${fDow(free.date)} (${SLOTS.find(s => s.id === free.slot).nombre.toLowerCase()})` : 'Disponible esta semana (sábado a viernes)'}</div></div>${free ? '<span class="tag gold">Usada</span>' : '<span class="tag good">Disponible</span>'}</div></div>

  ${showReport ? `<div class="card accent" style="margin-top:12px"><div class="eyebrow">Asesor semanal</div><h3 style="margin:4px 0 8px">📋 Tu informe de la semana</h3><p class="small" style="margin:0 0 12px;opacity:.9">Resumen, ajuste de calorías y objetivo para la próxima semana.</p><button class="btn small" data-act="informe" style="background:var(--surface);color:var(--ink);border-color:transparent">Ver informe</button></div>` : ''}
  `;
}

// ═════════════ COMIDA ═════════════
export function comida() {
  return `<h1 class="page-title">Alimentación 🥗</h1><p class="page-sub">${fInt(state.profile.kcal)} kcal y ${state.profile.proteina} g de proteína al día · 5 comidas</p>
  ${seg('comida', [['hoy', 'Día'], ['semana', 'Semana'], ['compra', 'Compra'], ['recetas', 'Recetas']])}
  ${({ hoy: comidaDia, semana: comidaSemana, compra: comidaCompra, recetas: comidaRecetas })[ui.tabs.comida]()}`;
}
function comidaDia() {
  const d = dayOf('comida');
  const m = L.menuFor(d), st = peekDay(d).comidas || {};
  const tot = L.dayPlanTotals(d);
  const free = L.freeMealUsed(d);
  const pics = peekDay(d).picoteos || [];
  const rows = SLOTS.map(s => {
    const r = L.recipe(m[s.id]);
    const x = r ? L.macros(r, L.dayFactor(d)) : null;
    const v = st[s.id];
    const canFree = !free && (s.id === 'comida' || s.id === 'cena');
    return `<div class="meal ${v === 'libre' ? 'libre' : ''}">
      <div class="when"><div class="t num">${state.profile.horarios[s.id]}</div><div class="s">${esc(s.nombre)}</div></div>
      <div class="what">
        ${r ? `<div class="name" data-act="receta" data-id="${r.id}" data-d="${d}" style="cursor:pointer">${r.emoji} ${esc(r.nombre)}</div>
        <div class="macros num">${x.kcal} kcal · ${x.p} g proteína · ${r.min}′${state.favoritas[r.id] ? ' · ⭐' : ''}</div>` : '<div class="name">—</div>'}
        <div class="actions">
          <button class="status-btn ${v === 'ok' ? 'on-ok' : ''}" data-act="meal" data-d="${d}" data-s="${s.id}" data-v="ok" aria-label="Cumplida">✓</button>
          <button class="status-btn ${v === 'cambio' ? 'on-cambio' : ''}" data-act="cambiar" data-d="${d}" data-s="${s.id}" aria-label="Cambiar plato">↺</button>
          <button class="status-btn ${v === 'salto' ? 'on-salto' : ''}" data-act="meal" data-d="${d}" data-s="${s.id}" data-v="salto" aria-label="Saltada">✕</button>
          ${canFree ? `<button class="btn small ghost" data-act="libre" data-d="${d}" data-s="${s.id}">🎉 Comida libre</button>` : ''}
          ${v === 'libre' ? `<button class="btn small ghost" data-act="meal" data-d="${d}" data-s="${s.id}" data-v="">Deshacer</button>` : ''}
        </div>
      </div></div>`;
  }).join('');
  return `${dayNav('comida')}
  <div class="grid3" style="margin-bottom:12px">
    <div class="kpi"><div class="label">Energía</div><div class="value num" style="font-size:19px">${fInt(tot.kcal)}</div><div class="sub">kcal</div></div>
    <div class="kpi"><div class="label">Proteína</div><div class="value num" style="font-size:19px">${tot.p}</div><div class="sub">g</div></div>
    <div class="kpi"><div class="label">Cumplidas</div><div class="value num" style="font-size:19px">${L.mealsDone(d)}/5</div><div class="sub">comidas</div></div>
  </div>
  <div class="list">${rows}</div>
  <p class="tiny muted" style="margin:0 4px 14px">✓ cumplida · ↺ cambiar por otro plato equivalente · ✕ saltada. La comida libre es una por semana (de sábado a viernes) y el resto del día sigue el plan.</p>
  <div class="card"><div class="row between"><div><h3>🆘 ¿Ganas de picar?</h3><div class="small muted">Te ayudo a decidir en un minuto.</div></div><button class="btn gold" data-act="picoteo">Tengo ganas</button></div>
  ${pics.length ? `<div style="margin-top:10px" class="small">${pics.map(x => `<div class="row between" style="padding:4px 0;border-top:1px dashed var(--line)"><span>${x.t} · ${esc(x.motivo)}${x.que ? ` · ${esc(x.que)}` : ''}</span><span>${x.comido ? '🍪 Picado' : '💪 Superado'}</span></div>`).join('')}</div>` : ''}</div>`;
}
function comidaSemana() {
  const sat = saturdayOf(dayOf('comida'));
  const ds = range(sat, addDays(sat, 6));
  const src = state.menus[sat] ? `<span class="tag gold">Menú de Claude</span>` : `<span class="tag">Menú base</span>`;
  return `<div class="row between" style="margin-bottom:10px"><div><div class="eyebrow">Semana de menú</div><div style="font-family:var(--serif);font-weight:600;font-size:17px">Del ${fDateShort(sat)} al ${fDateShort(addDays(sat, 6))}</div></div>${src}</div>
  <div class="btn-row" style="margin-bottom:12px"><button class="btn small" data-act="semanaMenu" data-n="-7">‹ Anterior</button><button class="btn small" data-act="semanaMenu" data-n="7">Siguiente ›</button></div>
  ${state.menus[sat]?.nota ? `<div class="note" style="margin:0 0 12px">${esc(state.menus[sat].nota)}</div>` : ''}
  ${ds.map(d => {
    const m = L.menuFor(d), t = L.dayPlanTotals(d);
    return `<div class="card" data-act="irDia" data-d="${d}" style="cursor:pointer"><div class="row between"><div class="cap" style="font-family:var(--serif);font-weight:600">${fDow(d)} ${fDateShort(d).split(' ')[0]}</div><span class="tiny muted num">${fInt(t.kcal)} kcal · ${t.p} g prot.</span></div>
    <div class="small" style="margin-top:6px;line-height:1.6">${SLOTS.map(s => { const r = L.recipe(m[s.id]); return `<div><span class="muted">${s.emoji}</span> ${esc(r?.nombre || '—')}</div>`; }).join('')}</div></div>`;
  }).join('')}`;
}
function comidaCompra() {
  const t = today();
  const base = saturdayOf(dayOf('comida'));
  const sat = dow(t) === 5 && !ui.compraManual ? addDays(saturdayOf(t), 7) : base;
  const list = L.shoppingList(sat);
  const done = state.compra[sat]?.hechos || {};
  return `<div class="row between" style="margin-bottom:10px"><div><div class="eyebrow">Lista de la compra</div><div style="font-family:var(--serif);font-weight:600;font-size:17px">Menú del ${fDateShort(sat)} al ${fDateShort(addDays(sat, 6))}</div></div></div>
  <div class="btn-row" style="margin-bottom:6px"><button class="btn small" data-act="semanaCompra" data-sat="${addDays(sat, -7)}">‹</button><button class="btn small" data-act="semanaCompra" data-sat="${addDays(sat, 7)}">›</button><button class="btn small primary" data-act="compartirCompra" data-sat="${sat}">📤 Compartir lista</button></div>
  <p class="tiny muted" style="margin:6px 2px">Cantidades para los 7 días, ajustadas a tus calorías. Marca lo que ya tienes o compras.</p>
  ${list.map(sec => `<div class="shop-sec">${esc(sec.sec)}</div><div class="list">${sec.items.map(it => `<label class="shop-item ${done[it.key] ? 'checked' : ''}"><input type="checkbox" data-change="compra" data-sat="${sat}" data-k="${esc(it.key)}" ${done[it.key] ? 'checked' : ''}><span class="name">${esc(it.name)}</span><span class="qty">${esc(it.txt)}</span></label>`).join('')}</div>`).join('')}
  <div class="shop-sec">Despensa (revisar de vez en cuando)</div><div class="list">${D.pantry.map(x => `<div class="shop-item"><span class="name">${esc(x)}</span></div>`).join('')}</div>`;
}
function comidaRecetas() {
  const groups = [['desayuno', 'Desayunos ☕'], ['tentempie', 'Media mañana y merienda 🍎'], ['comida', 'Comidas 🍽️'], ['cena', 'Cenas 🌙']];
  const all = [...D.recipes, ...Object.values(state.recetasExtra)];
  return groups.map(([slot, title]) => `<div class="section-title"><h2>${title}</h2></div><div class="list">${all.filter(r => r.slot === slot).map(r => { const x = L.macros(r); return `<div class="item clickable" data-act="receta" data-id="${r.id}"><div class="emoji">${r.emoji}</div><div class="body"><div class="title">${esc(r.nombre)}${state.favoritas[r.id] ? ' ⭐' : ''}${state.descartadas[r.id] ? ' <span class="tag bad">Descartada</span>' : ''}</div><div class="meta num">${x.kcal} kcal · ${x.p} g prot. · ${r.min}′${r.tags?.includes('batch') ? ' · se puede dejar hecha' : ''}</div></div><span class="chev">›</span></div>`; }).join('')}</div>`).join('');
}
export function recetaSheet(id, d = null) {
  const r = L.recipe(id); if (!r) return '';
  const f = d ? L.dayFactor(d) : L.factor();
  const x = L.macros(r, f);
  return `<h2>${r.emoji} ${esc(r.nombre)}</h2><p class="small muted" style="margin:2px 0 12px">${r.min} minutos${r.tags?.includes('batch') ? ' · se puede cocinar para varios días' : ''}${r.claude ? ' · propuesta por Claude' : ''}</p>
  <div class="grid3" style="margin-bottom:12px"><div class="kpi"><div class="label">Energía</div><div class="value num" style="font-size:18px">${x.kcal}</div><div class="sub">kcal</div></div><div class="kpi"><div class="label">Proteína</div><div class="value num" style="font-size:18px">${x.p} g</div></div><div class="kpi"><div class="label">Hidratos · grasa</div><div class="value num" style="font-size:18px">${x.hc} · ${x.g}</div><div class="sub">g</div></div></div>
  <div class="eyebrow" style="margin:8px 0">Ingredientes (1 ración, en crudo)</div>
  <div class="list">${L.scaledIngredients(r, f).map(i => `<div class="shop-item"><span class="name">${esc(i.name)}</span><span class="qty">${esc(i.txt)}</span></div>`).join('')}</div>
  <div class="eyebrow" style="margin:12px 0 8px">Preparación</div>
  <ol style="padding-left:20px;margin:0 0 14px">${(r.pasos || []).map(p => `<li style="margin-bottom:6px">${esc(p)}</li>`).join('')}</ol>
  <div class="btn-row"><button class="btn small" data-act="fav" data-id="${r.id}" data-d="${d || ''}">${state.favoritas[r.id] ? '⭐ Quitar de favoritas' : '☆ Favorita'}</button><button class="btn small" data-act="descartar" data-id="${r.id}" data-d="${d || ''}">${state.descartadas[r.id] ? '↩︎ Recuperar' : '👎 No me gusta'}</button></div>`;
}
export function cambiarSheet(d, slot) {
  const cur = L.recipe(L.menuFor(d)[slot]);
  const alts = L.alternatives(d, slot);
  const s = SLOTS.find(x => x.id === slot);
  const f = L.dayFactor(d);
  return `<h2>Cambiar ${esc(s.nombre.toLowerCase())}</h2><p class="small muted" style="margin:2px 0 12px">Platos con calorías parecidas. ${esc(fDow(d))}.</p>
  <div class="list">${alts.map(r => { const x = L.macros(r, f); return `<div class="item clickable" data-act="elegir" data-d="${d}" data-s="${slot}" data-id="${r.id}"><div class="emoji">${r.emoji}</div><div class="body"><div class="title">${esc(r.nombre)}</div><div class="meta num">${x.kcal} kcal · ${x.p} g prot.</div></div><span class="chev">›</span></div>`; }).join('')}</div>
  <p class="tiny muted">Ahora: ${esc(cur?.nombre || '—')}</p>
  <button class="btn block" data-act="meal" data-d="${d}" data-s="${slot}" data-v="cambio">He comido otra cosa equivalente</button>`;
}

// ═════════════ EJERCICIO ═════════════
export function ejercicio() {
  const d = dayOf('ejercicio');
  const b = L.blockFor(d);
  const wk = L.weekExerciseMinutes(d), plan = L.plannedWeekMinutes(d);
  return `<h1 class="page-title">Entrenamiento 🏋️</h1><p class="page-sub">${esc(b.nombre)} · ${esc(b.intensidad)}</p>
  <div class="card"><div class="row"><div class="ring" style="--p:${Math.min(100, wk / 6)}"><span class="num">${fNum(wk / 60, 1)} h</span></div><div style="flex:1"><div class="eyebrow">Esta semana (lunes a domingo)</div><div style="font-family:var(--serif);font-size:20px;font-weight:600">${fHours(wk)} de 10 h</div><div class="small muted">Plan de la semana: ${fHours(plan)}</div></div></div></div>
  ${unlockCards()}
  ${seg('ejercicio', [['hoy', 'Día'], ['semana', 'Semana'], ['tabla', 'Tabla'], ['tests', 'Tests']])}
  ${({ hoy: ejDia, semana: ejSemana, tabla: ejTabla, tests: ejTests })[ui.tabs.ejercicio]()}`;
}
function unlockCards() {
  return ['skate', 'surf'].map(k => {
    const u = L.unlockStatus(k);
    const e = k === 'skate' ? '🛹' : '🏄';
    if (u.unlocked) return `<div class="card flat" style="border-color:var(--gold);background:var(--gold-tint)"><div class="unlock"><div class="big">${e}</div><div><div class="eyebrow">Desbloqueado el ${fDateShort(state.logros[k])}</div><div style="font-weight:600">${k === 'skate' ? 'Skate' : 'Surf'} en tu plan semanal 🎉</div></div></div></div>`;
    const cw = L.currentWeight();
    return `<div class="card flat"><div class="unlock"><div class="big" style="filter:grayscale(1);opacity:.6">${e}</div><div style="flex:1"><div class="row between"><div style="font-weight:600">${k === 'skate' ? 'Skate' : 'Surf'} 🔒</div><span class="tag">${cw ? `faltan ${fNum(Math.max(0, cw - u.kg + 0.1))} kg` : ''}</span></div>
    <div class="lock-steps muted"><div>${u.pesoOk ? '✅' : '⬜'} Bajo ${u.kg} kg tres mañanas seguidas (${Math.min(3, u.streak)}/3)</div><div>${u.testOk ? '✅' : '⬜'} ${k === 'skate' ? 'Test base' : 'Test de surf'} superado</div></div></div></div></div>`;
  }).join('');
}
function routineHTML(code, d) {
  const r = D.routines[code];
  return r.items.map(id => { const e = D.exercises[id]; return `<div class="ex"><div class="row between"><div class="t">${e.emoji} ${esc(e.nombre)}</div><span class="tag num">${esc(L.prescription(id, d))}</span></div><div class="d">${esc(e.como)}</div><div class="tiny muted">🧰 ${esc(e.material)}</div><div class="o">⚠️ ${esc(e.ojo)}</div></div>`; }).join('')
    + `<p class="tiny muted" style="margin:8px 0 0">Descanso entre series: ${esc(L.blockFor(d).descanso)}. Elige un peso con el que te sobren 2–3 repeticiones; cuando te sobren más, sube.</p>`;
}
function ejDia() {
  const d = dayOf('ejercicio');
  const ses = L.sessionsFor(d);
  const st = peekDay(d).sesiones || [];
  const extra = peekDay(d).extra || [];
  const list = ses.map((s, i) => {
    const info = L.sessionInfo(s.tipo);
    const done = st[i]?.hecho;
    const min = st[i]?.min ?? s.min;
    const detail = s.tipo.startsWith('fuerza:') ? routineHTML(s.tipo.split(':')[1], d)
      : s.tipo === 'movilidad' ? `<ul style="margin:6px 0 0;padding-left:18px" class="small">${D.mobility.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
    return `<div class="session ${done ? 'done' : ''}"><div class="head"><div class="emoji">${info.emoji}</div><div class="body" style="flex:1"><div class="title" style="font-weight:600">${esc(info.nombre)}</div><div class="meta small muted">${min} min${s.nota ? ` · ${esc(s.nota)}` : ''}</div></div>
      <button class="check ${done ? 'on' : ''}" data-act="sesion" data-d="${d}" data-i="${i}" aria-label="Hecho">${done ? '✓' : ''}</button></div>
      <div class="row" style="margin-top:8px;gap:6px"><button class="btn small" data-act="sesionMin" data-d="${d}" data-i="${i}" data-n="-5">−5′</button><span class="num small" style="min-width:52px;text-align:center">${min} min</span><button class="btn small" data-act="sesionMin" data-d="${d}" data-i="${i}" data-n="5">+5′</button></div>
      ${detail ? `<details style="margin-top:8px"><summary class="small" style="color:var(--brand);font-weight:600">Ver ejercicios ▾</summary>${detail}</details>` : ''}</div>`;
  }).join('');
  return `${dayNav('ejercicio')}
  ${ses.length ? `<div class="list">${list}</div>` : `<div class="card flat empty"><span class="e">🌿</span>${d < state.profile.inicio ? 'El plan empieza el ' + fDateShort(state.profile.inicio) : 'Día de descanso'}</div>`}
  ${extra.length ? `<div class="list">${extra.map((x, j) => `<div class="item"><div class="emoji">${L.sessionInfo(x.tipo).emoji}</div><div class="body"><div class="title">${esc(L.sessionInfo(x.tipo).nombre)}</div><div class="meta">${x.min} min${x.nota ? ` · ${esc(x.nota)}` : ''}</div></div><button class="btn small ghost" data-act="borrarExtra" data-d="${d}" data-j="${j}">Quitar</button></div>`).join('')}</div>` : ''}
  <button class="btn block" data-act="extra" data-d="${d}">＋ Añadir otra actividad</button>`;
}
function ejSemana() {
  const mon = mondayOf(dayOf('ejercicio'));
  return range(mon, addDays(mon, 6)).map(d => {
    const ses = L.sessionsFor(d), st = peekDay(d).sesiones || [];
    return `<div class="card" data-act="irDiaEj" data-d="${d}" style="cursor:pointer"><div class="row between"><div class="cap" style="font-family:var(--serif);font-weight:600">${fDow(d)} ${fDateShort(d).split(' ')[0]}${d === today() ? ' · hoy' : ''}</div><span class="tiny muted num">${fHours(L.exerciseMinutes(d))}</span></div>
    <div class="small" style="margin-top:6px">${ses.map((s, i) => `<div>${st[i]?.hecho ? '✅' : '⬜'} ${esc(L.sessionInfo(s.tipo).nombre)} · ${s.min}′</div>`).join('') || '<span class="muted">—</span>'}</div></div>`;
  }).join('');
}
function ejTabla() {
  const d = dayOf('ejercicio');
  const b = L.blockFor(d);
  return `<p class="small muted" style="margin:0 2px 10px">Bloque actual: ${esc(b.nombre)} · ${b.series} series · descanso ${esc(b.descanso)}.</p>` +
    Object.entries(D.routines).map(([code, r]) => `<div class="section-title"><h2>${esc(r.nombre)}</h2></div><div class="table-wrap"><table><thead><tr><th>Ejercicio</th><th class="n">Series × reps</th><th>Material</th></tr></thead><tbody>${r.items.map(id => { const e = D.exercises[id]; return `<tr><td>${e.emoji} ${esc(e.nombre)}</td><td class="n">${esc(L.prescription(id, d))}</td><td class="small">${esc(e.material)}</td></tr>`; }).join('')}</tbody></table></div>`).join('') +
    `<div class="section-title"><h2>Movilidad (10–20 min)</h2></div><div class="list">${D.mobility.map(x => `<div class="item"><div class="emoji">🧘</div><div class="body">${esc(x)}</div></div>`).join('')}</div>
    <div class="section-title"><h2>Semana tipo</h2></div><div class="table-wrap"><table><thead><tr><th>Día</th><th>Sesiones</th></tr></thead><tbody>${[1, 2, 3, 4, 5, 6, 0].map(w => `<tr><td class="cap">${['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][w]}</td><td class="small">${(b.dias[String(w)] || []).map(([t, m]) => `${esc(L.sessionInfo(t).nombre)} ${m}′`).join(' · ')}</td></tr>`).join('')}</tbody></table></div>`;
}
function ejTests() {
  const due = L.nextTestDue();
  return `<div class="card"><div class="eyebrow">Próximo test</div><h3 style="margin-top:4px">${due <= today() ? 'Toca hacer el test ✅' : `El ${fDateShort(due)}`}</h3><p class="small muted" style="margin:4px 0 12px">Cada 4 semanas. Mide tu forma física: es la otra llave de los desbloqueos.</p>
  <div class="btn-row"><button class="btn primary small" data-act="test" data-t="base">🛹 Test base</button><button class="btn small" data-act="test" data-t="surf">🏄 Test de surf</button></div></div>
  ${state.tests.length ? `<div class="list">${state.tests.slice().sort((a, b) => a.fecha < b.fecha ? 1 : -1).map(t => `<div class="item"><div class="emoji">${t.tipo === 'base' ? '🛹' : '🏄'}</div><div class="body"><div class="title">${esc(D.tests[t.tipo].nombre)}</div><div class="meta">${fDateShort(t.fecha)} · ${t.cumplidos}/${t.total} pruebas</div></div>${t.superado ? '<span class="tag good">Superado</span>' : '<span class="tag">En progreso</span>'}</div>`).join('')}</div>` : ''}`;
}
export function testSheet(tipo) {
  const T = D.tests[tipo];
  const prev = L.lastTest(tipo);
  return `<h2>${esc(T.nombre)}</h2><p class="small muted" style="margin:2px 0 12px">Apunta lo que consigas. Se supera al llegar al objetivo en todas las pruebas${tipo === 'surf' ? ' (nadar es opcional si no tienes piscina)' : ''}.</p>
  <form id="formTest" data-t="${tipo}">${T.items.map(([k, n, u, meta]) => `<label class="field"><span>${esc(n)} · objetivo ${meta} ${u}</span><input name="${k}" type="number" inputmode="decimal" value="${prev?.valores?.[k] ?? ''}" placeholder="${meta}"></label>`).join('')}
  <button class="btn primary block" type="submit">Guardar test</button></form>`;
}
export function extraSheet(d) {
  const tipos = [['caminar', 'Caminar 🚶'], ['fuerza:A', 'Fuerza 🏋️'], ['movilidad', 'Movilidad 🧘'], ['skate', 'Skate 🛹'], ['surf', 'Surf 🏄'], ['libre', 'Bici, natación u otra ⚡']];
  return `<h2>Añadir actividad</h2><form id="formExtra" data-d="${d}"><label class="field"><span>Tipo</span><select name="tipo">${tipos.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
  <label class="field"><span>Minutos</span><input name="min" type="number" inputmode="numeric" value="30" min="5" max="400"></label>
  <label class="field"><span>Nota (opcional)</span><input name="nota" placeholder="Ruta, sensaciones…"></label>
  <button class="btn primary block" type="submit">Guardar</button></form>`;
}

// ═════════════ HÁBITOS ═════════════
export function habitos() {
  const d = dayOf('habitos');
  const pct = L.dayHabitPct(d);
  const hv = peekDay(d).habitos || {};
  const wkSt = L.weekStudyMinutes(d);
  const running = state.estudio.inicio;
  const rows = D.habits.map(h => {
    const met = L.habitMet(h, d), sk = L.streak(h, d);
    const v = L.habitValue(h, d);
    let ctl = '';
    if (h.tipo === 'contador') ctl = `<button class="round-btn" data-act="inc" data-h="${h.id}" data-n="-1" data-d="${d}">−</button><span class="count">${v || 0}/${h.meta}</span><button class="round-btn primary" data-act="inc" data-h="${h.id}" data-n="1" data-d="${d}">+</button>`;
    else if (h.tipo === 'check') ctl = `<button class="check ${v === true ? 'on' : ''}" data-act="toggleH" data-h="${h.id}" data-d="${d}">${v === true ? '✓' : ''}</button>`;
    else if (h.id === 'lectura') ctl = `<button class="round-btn" data-act="inc" data-h="lectura" data-n="-5" data-d="${d}">−</button><span class="count">${v || 0}</span><button class="round-btn primary" data-act="inc" data-h="lectura" data-n="5" data-d="${d}">+5</button>`;
    else if (h.id === 'pasos') ctl = `<button class="btn small" data-act="pasos" data-d="${d}">${v != null ? fInt(v) : 'Anotar'}</button>`;
    else if (h.id === 'sueno') ctl = `<button class="btn small" data-act="sueno" data-d="${d}">${v != null ? fHours(v * 60) : 'Anotar'}</button>`;
    else if (h.id === 'estudio') ctl = `<button class="btn small ${running ? 'gold' : 'primary'}" data-act="estudio">${running ? '⏹ Parar' : '▶ Estudiar'}</button>`;
    else if (h.id === 'picoteo') ctl = `<span class="tag ${met ? 'good' : v ? 'bad' : ''}">${v ? `${v} picoteo${v > 1 ? 's' : ''}` : d in state.days ? 'Cero ✓' : '—'}</span>`;
    else if (h.id === 'pesaje') ctl = `<span class="tag ${met ? 'good' : ''}">${met ? 'Hecho ✓' : 'Pendiente'}</span>`;
    const meta = h.id === 'estudio' ? `${fHoursDec(wkSt)} de 10 h esta semana${running ? ` · en marcha desde las ${hm(new Date(running))}` : ''}` : h.texto;
    return `<div class="habit"><div class="emoji">${h.emoji}</div><div class="body"><div class="title">${esc(h.nombre)} ${met ? '<span style="color:var(--good)">✓</span>' : ''}</div><div class="meta">${esc(meta)}</div>${sk ? `<div class="streak">🔥 ${sk} día${sk > 1 ? 's' : ''} seguidos</div>` : ''}</div><div class="ctl">${ctl}</div></div>`;
  }).join('');
  return `<h1 class="page-title">Hábitos ✅</h1><p class="page-sub">Pequeñas victorias diarias que suman.</p>
  ${dayNav('habitos')}
  <div class="card"><div class="row"><div class="ring" style="--p:${pct}"><span class="num">${pct}%</span></div><div style="flex:1"><div class="eyebrow">Cumplimiento del día</div><div style="font-family:var(--serif);font-size:19px;font-weight:600">${pct >= 80 ? 'Día redondo 🌟' : pct >= 50 ? 'Vas bien, sigue 💪' : 'Cada hábito cuenta ✨'}</div><div class="small muted">Semana: ${L.weekHabitPct(d)} % · Estudio ${fHoursDec(wkSt)} / 10 h</div></div></div>${bar(wkSt / 6, 'gold')}</div>
  <div class="list">${rows}</div>
  <button class="btn block" data-act="estudioManual" data-d="${d}">📚 Añadir tiempo de estudio a mano</button>`;
}
export function suenoSheet(d) {
  const s = peekDay(d).sueno || {};
  return `<h2>😴 Sueño</h2><p class="small muted" style="margin:2px 0 12px">La noche que termina el ${fDateShort(d)}.</p>
  <form id="formSueno" data-d="${d}"><div class="fields2"><label class="field"><span>Me acosté</span><input name="acostar" type="time" value="${s.acostar || state.profile.dormir}"></label><label class="field"><span>Me levanté</span><input name="levantar" type="time" value="${s.levantar || state.profile.despertar}"></label></div>
  <div class="field"><span>Calidad</span><div class="btn-row">${[1, 2, 3, 4, 5].map(n => `<label class="chip ${s.calidad === n ? 'on' : ''}"><input type="radio" name="calidad" value="${n}" ${s.calidad === n ? 'checked' : ''} hidden>${'★'.repeat(n)}</label>`).join('')}</div></div>
  <button class="btn primary block" type="submit">Guardar</button></form>`;
}
export function estudioSheet(d) {
  return `<h2>📚 Tiempo de estudio</h2><form id="formEstudio" data-d="${d}"><div class="btn-row" style="margin:8px 0 12px">${[15, 30, 45, 60, 90, 120].map(m => `<button type="button" class="chip" data-act="setVal" data-target="minEstudio" data-v="${m}">${m}′</button>`).join('')}</div>
  <label class="field"><span>Minutos</span><input id="minEstudio" name="min" type="number" inputmode="numeric" value="60" min="5" max="600"></label>
  <label class="field"><span>Asignatura o tema (opcional)</span><input name="tema" placeholder="Derecho Civil III…"></label>
  <button class="btn primary block" type="submit">Guardar</button></form>`;
}
export function pasosSheet(d) {
  const v = (peekDay(d).habitos || {}).pasos;
  return `<h2>👣 Pasos</h2><p class="small muted">${isNative() && state.hc.conectado ? 'Se leen solos de Samsung Health a través de Health Connect. Puedes corregirlos aquí.' : 'Anótalos desde Samsung Health o conecta Health Connect en Ajustes.'}</p>
  <form id="formPasos" data-d="${d}"><label class="field"><span>Pasos del día</span><input name="pasos" type="number" inputmode="numeric" value="${v ?? ''}"></label><button class="btn primary block" type="submit">Guardar</button></form>`;
}

// ═════════════ PROGRESO ═════════════
export function progreso() {
  return `<h1 class="page-title">Progreso 📈</h1><p class="page-sub">Cada punto es un día. Lo que importa es la dirección.</p>
  ${seg('progreso', [['peso', 'Peso'], ['composicion', 'Composición'], ['logros', 'Logros'], ['historial', 'Historial']])}
  ${({ peso: progPeso, composicion: progComp, logros: progLogros, historial: progHist })[ui.tabs.progreso]()}`;
}
function progPeso() {
  const w = L.weighIns().map(x => ({ date: x.date, v: x.peso }));
  const sw = L.startWeight(), cw = L.currentWeight(), gw = L.goalWeight();
  const tr = L.trendPerWeek(14);
  const lw = L.lastMetric('peso'), li = L.lastMetric('imc');
  const imcNow = li && lw && li.date === lw.date ? li.v : L.bmi(cw);
  const refs = [{ v: gw, label: `Meta ${fNum(gw, 0)}` }, { v: 100, label: '🛹 100' }, { v: 90, label: '🏄 90' }].filter(r => w.length && r.v >= Math.min(...w.map(p => p.v)) - 3);
  let eta = '';
  if (tr && tr < -0.1 && cw > gw) { const weeks = (cw - gw) / Math.abs(tr); eta = fDateShort(addDays(today(), Math.round(weeks * 7))); }
  return `<div class="card">${lineChart({ series: [{ name: 'Peso', color: 'var(--s-weight)', points: w }], refs, unit: ' kg', height: 220 })}</div>
  <div class="grid2">
    <div class="kpi"><div class="label">Perdido</div><div class="value num">${fNum(sw && cw ? sw - cw : 0)}<small>kg</small></div><div class="sub">desde ${fNum(sw)} kg</div></div>
    <div class="kpi"><div class="label">Ritmo (2 semanas)</div><div class="value num">${tr == null ? '—' : fSigned(tr)}<small>kg/sem</small></div><div class="sub">Sano: −0,5 a −1</div></div>
    <div class="kpi"><div class="label">IMC</div><div class="value num">${fNum(imcNow)}</div><div class="sub">${imcNow >= 30 ? 'Obesidad' : imcNow >= 25 ? 'Sobrepeso' : 'Normal'}</div></div>
    <div class="kpi"><div class="label">Meta estimada</div><div class="value num" style="font-size:18px">${eta || '—'}</div><div class="sub">${eta ? 'al ritmo actual' : 'faltan datos'}</div></div>
  </div>`;
}
function progComp() {
  const days = Object.keys(state.days).sort();
  const fat = days.filter(d => state.days[d].peso && state.days[d].grasa).map(d => ({ date: d, v: L.fatKg(d) }));
  const mus = L.metricSeries('musculo').map(x => ({ date: x.date, v: x.v }));
  const vis = L.metricSeries('visceral').map(x => ({ date: x.date, v: x.v }));
  const ficha = [['agua', 'Agua', '%', 1], ['proteina', 'Proteína', '%', 1], ['osea', 'Masa ósea', 'kg', 2], ['bmr', 'Metabolismo basal', 'kcal', 0], ['puntuacion', 'Puntuación corporal', '', 0], ['imc', 'IMC', '', 1]];
  return `<div class="card"><h3>Grasa y músculo</h3><p class="small muted" style="margin:0 0 6px">En kilos. La grasa debe bajar y el músculo mantenerse: así sabes que lo que pierdes es grasa.</p>
  <div class="row between" style="margin-top:8px"><div class="eyebrow" style="color:var(--s-fat)">🔥 Grasa (kg)</div><span class="small num">${fat.length ? fNum(fat[fat.length - 1].v) + ' kg' : ''}</span></div>
  ${lineChart({ series: [{ name: 'Grasa', color: 'var(--s-fat)', points: fat }], unit: ' kg', height: 150, yPad: 0.8 })}
  <div class="row between" style="margin-top:12px"><div class="eyebrow" style="color:var(--s-muscle)">💪 Músculo (kg)</div><span class="small num">${mus.length ? fNum(mus[mus.length - 1].v) + ' kg' : ''}</span></div>
  ${lineChart({ series: [{ name: 'Músculo', color: 'var(--s-muscle)', points: mus }], unit: ' kg', height: 150, yPad: 0.8 })}</div>
  <div class="card"><h3>Grasa visceral</h3><p class="small muted" style="margin:0 0 6px">Rangos aproximados de Zepp Life: hasta 9 normal, 10–14 alto, 15 o más muy alto.</p>
  ${lineChart({ series: [{ name: 'Grasa visceral', color: 'var(--s-weight)', points: vis }], bands: [{ from: 0, to: 9.5, label: 'Normal', tone: 'good' }, { from: 9.5, to: 14.5, label: 'Alto', tone: 'warn' }, { from: 14.5, to: 60, label: 'Muy alto', tone: 'bad' }], height: 180, dec: 0, yPad: 1.5 })}</div>
  <div class="section-title"><h2>Ficha de la báscula</h2></div>
  <div class="table-wrap"><table><thead><tr><th>Dato</th><th class="n">Inicio</th><th class="n">Último</th><th class="n">Cambio</th></tr></thead><tbody>
  ${ficha.map(([k, n, u, dec]) => { const s = L.metricSeries(k); const a = s[0]?.v, b = s[s.length - 1]?.v; return `<tr><td>${n}</td><td class="n">${a != null ? fNum(a, dec) + (u ? ' ' + u : '') : '—'}</td><td class="n">${b != null ? fNum(b, dec) + (u ? ' ' + u : '') : '—'}</td><td class="n">${a != null && b != null ? fSigned(b - a, dec) : '—'}</td></tr>`; }).join('')}
  </tbody></table></div>`;
}
function progLogros() {
  const got = L.BADGES.filter(b => state.logros[b.id]).length;
  return `<p class="small muted" style="margin:0 2px 12px">${got} de ${L.BADGES.length} logros conseguidos. 🏆</p>
  <div class="badges">${L.BADGES.map(b => `<div class="badge ${state.logros[b.id] ? 'on' : ''}"><div class="e">${b.e}</div><div class="n">${esc(b.n)}</div><div class="d">${state.logros[b.id] ? fDateShort(state.logros[b.id]) : '—'}</div></div>`).join('')}</div>`;
}
function progHist() {
  const days = Object.keys(state.days).sort().reverse().filter(d => state.days[d].peso || state.days[d].grasa);
  return `<div class="btn-row" style="margin-bottom:12px"><button class="btn small" data-act="bascula">＋ Añadir medición</button><button class="btn small" data-act="exportar">💾 Copia de seguridad</button></div>
  ${days.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th class="n">Peso</th><th class="n">Grasa</th><th class="n">Músc.</th><th class="n">Visc.</th></tr></thead><tbody>${days.map(d => { const x = state.days[d]; return `<tr data-act="bascula" data-d="${d}" style="cursor:pointer"><td>${fDateShort(d)}${x.fuentePeso === 'hc' ? ' <span class="tiny muted">HC</span>' : x.fuentePeso === 'ocr' ? ' <span class="tiny muted">📷</span>' : ''}</td><td class="n">${fNum(x.peso)}</td><td class="n">${x.grasa != null ? fNum(x.grasa) + ' %' : '—'}</td><td class="n">${fNum(x.musculo)}</td><td class="n">${fInt(x.visceral)}</td></tr>`; }).join('')}</tbody></table></div>` : `<div class="card flat empty"><span class="e">⚖️</span>Aún no hay mediciones.</div>`}`;
}

// ═════════════ HOJAS COMUNES ═════════════
export function quickSheet() {
  const q = [['bascula', '⚖️', 'Báscula'], ['ocr', '📷', 'Leer captura'], ['picoteo', '🆘', 'Ganas de picar'], ['extra', '🏋️', 'Ejercicio'], ['estudioManual', '📚', 'Estudio'], ['lecturaSheet', '📖', 'Lectura'], ['sueno', '😴', 'Sueño'], ['incAgua', '💧', '+1 vaso de agua'], ['incPausa', '🧍', '+1 pausa activa']];
  return `<h2>Registrar</h2><div class="quick-grid">${q.map(([a, e, n]) => `<button class="quick" data-act="${a}"><span class="e">${e}</span>${n}</button>`).join('')}</div>`;
}
export function basculaSheet(d, v = {}, aviso = '') {
  const x = { ...peekDay(d), ...v };
  const f = (k, n, u, mode = 'decimal') => `<label class="field"><span>${n}${u ? ` (${u})` : ''}</span><input name="${k}" type="text" inputmode="${mode}" value="${x[k] ?? ''}"></label>`;
  return `<h2>⚖️ Báscula</h2><p class="small muted" style="margin:2px 0 12px">${v.peso ? 'Revisa los datos leídos de la captura y guarda.' : 'Peso en ayunas, por la mañana, después de ir al baño.'}</p>
  ${aviso ? `<div class="note" style="margin:0 0 12px">${aviso}</div>` : ''}
  <form id="formBascula"><label class="field"><span>Fecha</span><input name="fecha" type="date" value="${d}"></label>
  <div class="fields2">${f('peso', 'Peso', 'kg')}${f('grasa', 'Grasa corporal', '%')}</div>
  <div class="fields2">${f('musculo', 'Músculo', 'kg')}${f('visceral', 'Grasa visceral', '', 'numeric')}</div>
  <div class="fields2">${f('agua', 'Agua', '%')}${f('proteina', 'Proteína', '%')}</div>
  <div class="fields2">${f('osea', 'Masa ósea', 'kg')}${f('bmr', 'Metabolismo basal', 'kcal', 'numeric')}</div>
  <div class="fields2">${f('puntuacion', 'Puntuación corporal', '', 'numeric')}${f('imc', 'IMC', '')}</div>
  <input type="hidden" name="fuente" value="${v.peso ? 'ocr' : 'manual'}">
  <button class="btn primary block" type="submit">Guardar</button>
  ${peekDay(d).peso ? `<button class="btn ghost block" type="button" data-act="borrarMedicion" data-d="${d}" style="margin-top:6px;color:var(--bad)">Borrar medición de este día</button>` : ''}</form>`;
}
export function picoteoSheet(step = 1, motivo = '') {
  if (step === 1) return `<h2>🆘 Tengo ganas de picar</h2><p class="small muted" style="margin:2px 0 12px">Antes de nada: ¿qué lo provoca?</p>
    <div class="btn-row">${['Hambre', 'Aburrimiento', 'Estrés', 'Cansancio', 'Costumbre', 'Ansiedad'].map(m => `<button class="chip" data-act="picoteoMotivo" data-v="${m}">${m}</button>`).join('')}</div>`;
  const hambre = motivo === 'Hambre';
  return `<h2>${hambre ? '🍎 Hambre de verdad' : '⏳ Espera 10 minutos'}</h2>
  <p class="small" style="margin:6px 0 12px">${hambre ? 'Si es hambre real, come algo del plan. Estas opciones encajan:' : `Las ganas por ${esc(motivo.toLowerCase())} suelen pasar en 10 minutos. Bebe un vaso de agua o una infusión, levántate y cambia de actividad.`}</p>
  ${!hambre ? `<div class="card flat" style="text-align:center"><div class="timer num" id="picTimer">10:00</div><div class="tiny muted">El reloj corre aunque cierres esta hoja</div></div>` : ''}
  <div class="list">${D.picoteoOk.map(x => `<div class="shop-item"><span class="name">✅ ${esc(x)}</span></div>`).join('')}</div>
  <div class="btn-row"><button class="btn primary" data-act="picoteoFin" data-v="${esc(motivo)}" data-c="0">💪 Se me pasó</button><button class="btn" data-act="picoteoFin" data-v="${esc(motivo)}" data-c="1">${hambre ? '🍎 Comí algo del plan' : '🍪 He picado'}</button></div>`;
}
export function informeSheet() {
  const r = L.weeklyReport();
  const row = (e, n, v) => `<div class="item"><div class="emoji">${e}</div><div class="body"><div class="title">${n}</div></div><div class="num" style="font-weight:600">${v}</div></div>`;
  return `<h2>📋 Informe semanal</h2><p class="small muted" style="margin:2px 0 12px">Del ${fDateShort(r.start)} al ${fDateShort(r.end)}.</p>
  <div class="list">
  ${row('⚖️', 'Peso (primer y último pesaje)', r.pesoIni ? `${fNum(r.pesoIni)} → ${fNum(r.pesoFin)} kg` : '—')}
  ${row('📉', 'Media de la semana frente a la anterior', r.mediaPeso && r.mediaPrev ? fSigned(r.mediaPeso - r.mediaPrev) + ' kg' : '—')}
  ${row('🍽️', 'Comidas cumplidas', `${r.meals}/${r.mealsMax}`)}
  ${row('🚫', 'Picoteos', `${r.picoteosComidos} de ${r.picoteos} ganas`)}
  ${row('🏋️', 'Ejercicio', fHours(r.ex))}
  ${row('📚', 'Estudio', fHours(r.est))}
  ${row('📖', 'Lectura', `${r.pag} págs`)}
  ${row('😴', 'Sueño medio', r.sueno ? fHours(r.sueno * 60) : '—')}
  ${row('✅', 'Hábitos', `${r.hab} %`)}
  </div>
  ${r.topMotivo ? `<p class="small">🔎 Tus ganas de picar suelen llegar hacia las <b>${r.topHora}</b>, sobre todo por <b>${esc(r.topMotivo.toLowerCase())}</b>.</p>` : ''}
  <div class="card ${r.consejo.tipo === 'mantener' ? '' : 'accent'}"><div class="eyebrow">Calorías</div><p style="margin:6px 0 10px">${esc(r.consejo.texto)}</p>${r.consejo.kcal !== state.profile.kcal ? `<button class="btn small" data-act="aplicarKcal" data-v="${r.consejo.kcal}" style="background:var(--surface);color:var(--ink)">Aplicar ${r.consejo.kcal} kcal</button>` : ''}</div>
  ${r.foco ? `<div class="card"><div class="eyebrow">Objetivo para la próxima semana</div><p style="margin:6px 0 0">🎯 Mejorar ${esc(r.foco)}.</p></div>` : ''}
  <button class="btn block" data-act="copiarResumen">📤 Copiar resumen para Claude</button>`;
}

// ═════════════ AJUSTES ═════════════
export function ajustes(hcStatus = '') {
  const p = state.profile, r = p.recordatorios;
  const sw = (k, n) => `<div class="item"><div class="body"><div class="title" style="font-weight:500">${n}</div></div><label class="switch"><input type="checkbox" data-change="recordatorio" data-k="${k}" ${r[k] ? 'checked' : ''}><span></span></label></div>`;
  return `<h1 class="page-title">Ajustes ⚙️</h1><p class="page-sub">Tu perfil, objetivos, recordatorios y datos.</p>
  <form id="formPerfil" class="card"><div class="eyebrow">Perfil y objetivos</div>
    <label class="field" style="margin-top:10px"><span>Nombre</span><input name="nombre" value="${esc(p.nombre)}"></label>
    <div class="fields3"><label class="field"><span>Edad</span><input name="edad" type="number" value="${p.edad ?? ''}"></label><label class="field"><span>Altura</span><input name="altura" type="number" value="${p.altura ?? ''}"></label><label class="field"><span>Sexo</span><select name="sexo"><option value="h" ${p.sexo === 'h' ? 'selected' : ''}>H</option><option value="m" ${p.sexo === 'm' ? 'selected' : ''}>M</option></select></label></div>
    <div class="fields2"><label class="field"><span>Peso de partida (kg)</span><input name="pesoInicial" inputmode="decimal" value="${p.pesoInicial ?? ''}"></label><label class="field"><span>Objetivo (kg)</span><input name="objetivo" inputmode="decimal" value="${p.objetivo ?? ''}"></label></div>
    <div class="fields2"><label class="field"><span>Calorías al día</span><input name="kcal" type="number" value="${p.kcal}"></label><label class="field"><span>Proteína (g)</span><input name="proteina" type="number" value="${p.proteina}"></label></div>
    <label class="field"><span>Fecha de inicio</span><input name="inicio" type="date" value="${p.inicio}"></label>
    <div class="eyebrow" style="margin:6px 0 10px">Horarios</div>
    <div class="fields3">${SLOTS.map(s => `<label class="field"><span>${s.nombre}</span><input name="h_${s.id}" type="time" value="${p.horarios[s.id]}"></label>`).join('')}<label class="field"><span>Acostarte</span><input name="dormir" type="time" value="${p.dormir}"></label></div>
    <label class="field"><span>Levantarte</span><input name="despertar" type="time" value="${p.despertar}"></label>
    <div class="btn-row"><button class="btn primary" type="submit">Guardar</button><button class="btn" type="button" data-act="sugerirKcal">Recalcular calorías</button></div>
  </form>

  <div class="section-title"><h2>🔔 Recordatorios</h2></div>
  <div class="list">${sw('pesaje', '⚖️ Pesarte al levantarte')}${sw('comidas', '🍽️ Horas de las comidas')}${sw('pausas', '🧍 Pausas activas (lunes a viernes)')}${sw('agua', '💧 Agua')}${sw('picoteo', '🚫 Hora típica de picoteo')}${sw('dormir', '📵 Media hora antes de dormir')}${sw('semanal', '📋 Informe del viernes y compra del sábado')}</div>
  <button class="btn block primary" data-act="programar">Activar recordatorios</button>

  <div class="section-title"><h2>❤️ Health Connect</h2></div>
  <div class="card"><p class="small" style="margin:0 0 10px">Lee el peso, la grasa y el metabolismo basal que Zepp Life guarda en Health Connect, y los pasos de Samsung Health.</p>
  <p class="small muted" style="margin:0 0 10px">${esc(hcStatus || (state.hc.conectado ? `Conectado${state.hc.ultima ? ` · última lectura ${fDateShort(state.hc.ultima.slice(0, 10))} a las ${state.hc.ultima.slice(11, 16)}` : ''}` : 'Sin conectar'))}</p>
  <div class="btn-row"><button class="btn small primary" data-act="hcConectar">${state.hc.conectado ? 'Revisar permisos' : 'Conectar'}</button><button class="btn small" data-act="hcSync">Sincronizar ahora</button><button class="btn small" data-act="hcAjustes">Abrir Health Connect</button></div></div>

  <div class="section-title"><h2>🤖 Asesor con Claude</h2></div>
  <div class="card"><p class="small" style="margin:0 0 10px">Cada viernes Claude puede leer tu resumen y dejarte el menú de la semana siguiente. Mientras no esté el buzón configurado, puedes copiar el resumen y pegar aquí el menú que te dé Claude.</p>
  <label class="field"><span>Dirección del buzón (Apps Script)</span><input id="buzonUrl" value="${esc(p.buzonUrl)}" placeholder="https://script.google.com/macros/s/…/exec"></label>
  <div class="btn-row"><button class="btn small primary" data-act="buzonGuardar">Guardar y sincronizar</button><button class="btn small" data-act="copiarResumen">📤 Copiar resumen</button><button class="btn small" data-act="pegarMenu">📥 Pegar menú</button></div></div>

  <div class="section-title"><h2>💾 Tus datos</h2></div>
  <div class="card"><p class="small" style="margin:0 0 10px">Todo se guarda en este móvil. Haz una copia de vez en cuando por si cambias de teléfono.</p>
  <div class="btn-row"><button class="btn small" data-act="exportar">Exportar copia</button><button class="btn small" data-act="importar">Importar copia</button></div>
  <div class="field" style="margin-top:12px"><span>Tema</span><div class="btn-row">${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([v, l]) => `<button class="chip ${p.tema === v ? 'on' : ''}" data-act="tema" data-v="${v}">${l}</button>`).join('')}</div></div>
  <button class="btn ghost" data-act="borrarTodo" style="color:var(--bad);padding-left:0">Borrar todos los datos</button></div>
  <p class="tiny muted" style="text-align:center;margin:18px 0 4px">Hábitos Saludables · versión 1.0</p>`;
}
export function pegarMenuSheet() {
  return `<h2>📥 Menú de Claude</h2><p class="small muted" style="margin:2px 0 12px">Pega el JSON que te ha dado Claude con el menú de la semana.</p>
  <form id="formMenu"><label class="field"><span>Menú (JSON)</span><textarea name="json" placeholder='{"semana":"2026-10-24","dias":[...],"recetas":[...]}'></textarea></label><button class="btn primary block" type="submit">Cargar menú</button></form>`;
}
export function lecturaSheet(d) {
  const v = (peekDay(d).habitos || {}).lectura || 0;
  return `<h2>📖 Lectura</h2><form id="formLectura" data-d="${d}"><label class="field"><span>Páginas leídas hoy</span><input name="paginas" type="number" inputmode="numeric" value="${v}"></label>
  <label class="field"><span>Libro (opcional)</span><input name="libro" value="${esc(state.profile.libro || '')}"></label><button class="btn primary block" type="submit">Guardar</button></form>`;
}

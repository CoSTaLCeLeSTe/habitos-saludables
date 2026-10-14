// Gráficas SVG ligeras (sin librerías) con tooltip al tocar.
import { diffDays, addDays, fDateShort, fNum, esc } from './util.js';

const registry = new Map();
let uid = 0;

function niceTicks(min, max, count = 4) {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => span / s <= count) || mag * 10;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const out = []; for (let v = lo; v <= hi + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

/**
 * series: [{ name, color, points: [{date, v}] }]
 * refs: [{ v, label }] líneas de referencia; bands: [{ from, to, label, tone }]
 */
export function lineChart({ series, refs = [], bands = [], height = 190, unit = '', dec = 1, minSpanDays = 14, yPad = 0.6, legend = true }) {
  const all = series.flatMap(s => s.points);
  if (!all.length) return `<div class="empty"><span class="e">📈</span>Aún no hay datos para esta gráfica.</div>`;
  const id = `ch${++uid}`;
  const W = 340, H = height, L = 34, R = 12, T = 12, B = 24;
  const dates = all.map(p => p.date).sort();
  let d0 = dates[0], d1 = dates[dates.length - 1];
  if (diffDays(d0, d1) < minSpanDays) d1 = addDays(d0, minSpanDays);
  const span = Math.max(1, diffDays(d0, d1));
  const vals = all.map(p => p.v).concat(refs.map(r => r.v)).concat(bands.flatMap(b => [b.from, b.to]).filter(v => v != null && isFinite(v)));
  let vmin = Math.min(...all.map(p => p.v)), vmax = Math.max(...all.map(p => p.v));
  refs.forEach(r => { vmin = Math.min(vmin, r.v); vmax = Math.max(vmax, r.v); });
  vmin -= yPad; vmax += yPad;
  const ticks = niceTicks(vmin, vmax, 4);
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const X = d => L + (diffDays(d0, d) / span) * (W - L - R);
  const Y = v => T + (1 - (v - y0) / (y1 - y0 || 1)) * (H - T - B);
  let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(series.map(s => s.name).join(', '))}" data-chart="${id}">`;
  // bandas
  for (const b of bands) {
    const ya = Y(Math.min(y1, b.to ?? y1)), yb = Y(Math.max(y0, b.from ?? y0));
    if (yb <= ya) continue;
    svg += `<rect x="${L}" y="${ya}" width="${W - L - R}" height="${yb - ya}" fill="var(--${b.tone || 'good'}-tint)" opacity=".8"/>`;
    if (b.label) svg += `<text x="${W - R - 4}" y="${ya + 12}" text-anchor="end" style="fill:var(--${b.tone || 'good'})">${esc(b.label)}</text>`;
  }
  // rejilla y eje Y
  svg += `<g class="grid">`;
  for (const t of ticks) svg += `<line x1="${L}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${L - 6}" y="${Y(t) + 3.5}" text-anchor="end">${fNum(t, t % 1 ? 1 : 0)}</text>`;
  svg += `</g>`;
  // eje X: inicio, mitad y final
  const xt = [d0, addDays(d0, Math.round(span / 2)), d1];
  xt.forEach((d, i) => { svg += `<text x="${X(d)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}">${fDateShort(d)}</text>`; });
  // referencias
  for (const r of refs) {
    if (r.v < y0 || r.v > y1) continue;
    svg += `<line x1="${L}" x2="${W - R}" y1="${Y(r.v)}" y2="${Y(r.v)}" stroke="var(--gold)" stroke-width="1" stroke-dasharray="4 4"/>`;
    svg += `<text x="${L + 4}" y="${Y(r.v) - 4}" class="lbl" style="fill:var(--gold)">${esc(r.label)}</text>`;
  }
  // series
  for (const s of series) {
    const pts = s.points.slice().sort((a, b) => a.date < b.date ? -1 : 1);
    if (pts.length > 1) svg += `<path d="${pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.date).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(' ')}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    const r = pts.length > 40 ? 2.2 : 3.2;
    for (const p of pts) svg += `<circle cx="${X(p.date).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="${r}" fill="${s.color}" stroke="var(--surface)" stroke-width="1.5"/>`;
    const last = pts[pts.length - 1];
    if (series.length > 1 && last) svg += `<text x="${Math.min(W - R, X(last.date) + 6)}" y="${Y(last.v) - 7}" text-anchor="end" class="lbl">${esc(s.name)}</text>`;
  }
  svg += `<line class="cross" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="var(--line-strong)" stroke-width="1" visibility="hidden"/>`;
  svg += `<rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent" class="hit"/>`;
  svg += `</svg>`;
  registry.set(id, { series, X, Y, d0, span, L, R, W, unit, dec });
  const leg = legend && series.length > 1 ? `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
  return `${leg}<div class="chart-box">${svg}<div class="tip" hidden></div></div>`;
}

export function bindCharts(root) {
  root.querySelectorAll('svg[data-chart]').forEach(svg => {
    const info = registry.get(svg.dataset.chart);
    if (!info) return;
    const box = svg.parentElement, tip = box.querySelector('.tip'), cross = svg.querySelector('.cross');
    const show = (ev) => {
      const rect = svg.getBoundingClientRect();
      const sx = (ev.clientX - rect.left) * (info.W / rect.width);
      const frac = (sx - info.L) / (info.W - info.L - info.R);
      const target = addDays(info.d0, Math.round(frac * info.span));
      let best = null;
      for (const s of info.series) for (const p of s.points) {
        const dd = Math.abs(diffDays(p.date, target));
        if (!best || dd < best.dd) best = { dd, date: p.date };
      }
      if (!best) return;
      const rows = info.series.map(s => { const p = s.points.find(q => q.date === best.date); return p ? `${esc(s.name)}: <b>${fNum(p.v, info.dec)}${info.unit}</b>` : ''; }).filter(Boolean);
      const x = info.X(best.date);
      cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.setAttribute('visibility', 'visible');
      const firstVal = info.series.map(s => s.points.find(q => q.date === best.date)).find(Boolean);
      tip.innerHTML = `${fDateShort(best.date)}<br>${rows.join('<br>')}`;
      tip.hidden = false;
      tip.style.left = `${(x / info.W) * rect.width}px`;
      tip.style.top = `${(info.Y(firstVal.v) / (svg.viewBox.baseVal.height)) * rect.height}px`;
    };
    const hide = () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); };
    svg.addEventListener('pointermove', show);
    svg.addEventListener('pointerdown', show);
    svg.addEventListener('pointerleave', hide);
  });
}

export function sparkline(points, color = 'var(--s-weight)', w = 120, h = 34) {
  if (points.length < 2) return '';
  const vs = points.map(p => p.v), mn = Math.min(...vs), mx = Math.max(...vs);
  const X = i => 2 + i / (points.length - 1) * (w - 4), Y = v => 2 + (1 - (v - mn) / ((mx - mn) || 1)) * (h - 4);
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${points.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${X(points.length - 1)}" cy="${Y(points[points.length - 1].v)}" r="3" fill="${color}"/></svg>`;
}

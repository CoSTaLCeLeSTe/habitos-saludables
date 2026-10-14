// Puente con Android (Capacitor). En el navegador todo devuelve valores neutros.
const cache = {};
const Cap = () => window.Capacitor;

export function isNative() {
  try { return !!Cap()?.isNativePlatform?.(); } catch { return false; }
}

export function plugin(name) {
  if (name in cache) return cache[name];
  const C = Cap();
  let p = null;
  if (C) {
    p = C.Plugins?.[name] || null;
    if (!p && typeof C.registerPlugin === 'function') { try { p = C.registerPlugin(name); } catch { p = null; } }
    if (!p && window.capacitorExports?.registerPlugin) { try { p = window.capacitorExports.registerPlugin(name); } catch { p = null; } }
  }
  cache[name] = p;
  return p;
}

// ── Almacenamiento persistente (SharedPreferences) ──
export async function prefsGet(key) {
  const P = isNative() && plugin('Preferences');
  if (!P) return null;
  try { const r = await P.get({ key }); return r?.value ?? null; } catch { return null; }
}
export async function prefsSet(key, value) {
  const P = isNative() && plugin('Preferences');
  if (!P) return;
  try { await P.set({ key, value }); } catch { /* sin acción */ }
}

// ── Health Connect ──
export const HC_TYPES = ['Weight', 'BodyFat', 'BasalMetabolicRate', 'Steps'];

export async function hcAvailability() {
  const HC = isNative() && plugin('HealthConnect');
  if (!HC) return 'web';
  try { const r = await HC.checkAvailability(); return r?.availability || 'error'; } catch { return 'error'; }
}
export async function hcHasPermissions() {
  const HC = isNative() && plugin('HealthConnect');
  if (!HC) return false;
  try { const r = await HC.checkHealthPermissions({ read: HC_TYPES, write: [] }); return !!r?.hasAllPermissions || (r?.grantedPermissions?.length > 0); } catch { return false; }
}
export async function hcRequest() {
  const HC = isNative() && plugin('HealthConnect');
  if (!HC) throw new Error('Health Connect solo funciona en la app de Android.');
  return HC.requestHealthPermissions({ read: HC_TYPES, write: [] });
}
export async function hcOpenSettings() {
  const HC = isNative() && plugin('HealthConnect');
  if (HC?.openHealthConnectSetting) { try { await HC.openHealthConnectSetting(); } catch { /* */ } }
}
export async function hcRead(type, start, end) {
  const HC = isNative() && plugin('HealthConnect');
  if (!HC) return [];
  const out = [];
  let pageToken;
  for (let i = 0; i < 20; i++) {
    const opts = { type, timeRangeFilter: { type: 'between', startTime: start.toISOString(), endTime: end.toISOString() }, pageSize: 1000 };
    if (pageToken) opts.pageToken = pageToken;
    const r = await HC.readRecords(opts);
    out.push(...(r?.records || []));
    pageToken = r?.pageToken;
    if (!pageToken) break;
  }
  return out;
}

// ── Notificaciones locales ──
export async function notifPermission() {
  const N = isNative() && plugin('LocalNotifications');
  if (!N) return 'web';
  try {
    let st = await N.checkPermissions();
    if (st.display !== 'granted') st = await N.requestPermissions();
    return st.display;
  } catch { return 'error'; }
}
export async function notifReplace(list) {
  const N = isNative() && plugin('LocalNotifications');
  if (!N) return 0;
  try {
    const pending = await N.getPending();
    if (pending?.notifications?.length) await N.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
  } catch { /* */ }
  if (!list.length) return 0;
  try {
    await N.createChannel?.({ id: 'habitos', name: 'Recordatorios', description: 'Recordatorios de Hábitos Saludables', importance: 4, visibility: 1 });
  } catch { /* */ }
  const notifications = list.map(n => ({ ...n, channelId: 'habitos', smallIcon: 'ic_stat_hs', iconColor: '#1F4D40' }));
  await N.schedule({ notifications });
  return notifications.length;
}

// ── Compartir y archivos ──
export async function shareText(title, text) {
  const S = isNative() && plugin('Share');
  if (S) { await S.share({ title, text, dialogTitle: title }); return true; }
  if (navigator.share) { try { await navigator.share({ title, text }); return true; } catch { return false; } }
  try { await navigator.clipboard.writeText(text); return 'copied'; } catch { return false; }
}
export async function shareFile(filename, content) {
  const F = isNative() && plugin('Filesystem');
  const S = isNative() && plugin('Share');
  if (F && S) {
    const r = await F.writeFile({ path: filename, data: content, directory: 'CACHE', encoding: 'utf8' });
    await S.share({ title: filename, url: r.uri, dialogTitle: 'Guardar copia de seguridad' });
    return true;
  }
  const blob = new Blob([content], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return true;
}
export async function copyText(text) {
  const C = isNative() && plugin('Clipboard');
  if (C) { try { await C.write({ string: text }); return true; } catch { /* */ } }
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

export function onResume(fn) {
  const A = isNative() && plugin('App');
  if (A?.addListener) { try { A.addListener('resume', fn); } catch { /* */ } }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') fn(); });
}

export function onBack(fn) {
  const A = isNative() && plugin('App');
  if (A?.addListener) { try { A.addListener('backButton', fn); } catch { /* */ } }
}
export function exitApp() {
  const A = isNative() && plugin('App');
  try { A?.exitApp?.(); } catch { /* */ }
}

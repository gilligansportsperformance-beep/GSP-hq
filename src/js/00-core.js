'use strict';
/* =========================================================
   Core: utilities, dates, units, storage, state, router
   ========================================================= */
const APP_VERSION = '1.7.0';
const APP_NAME = 'GSP HQ';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 9); }
function num(v) {
  if (v === null || v === undefined) return null;
  let s = String(v).trim();
  if (s === '') return null;
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function round(v, d = 0) { const f = 10 ** d; return Math.round(v * f) / f; }
function fmtNum(v, d = 1, minD) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '–';
  return Number(v).toLocaleString(undefined, { minimumFractionDigits: minD ?? d, maximumFractionDigits: d });
}
function plural(n, w, p) { return `${n} ${n === 1 ? w : (p || w + 's')}`; }
function mean(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; }
function sd(a) { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); }
function byKey(k, dir = 1) { return (a, b) => (a[k] < b[k] ? -dir : a[k] > b[k] ? dir : 0); }
function initials(a) { return ((a.firstName || '?')[0] + (a.lastName || '')[0] || '').toUpperCase(); }
function debounce(fn, ms) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; }

/* ---------- Dates (local, YYYY-MM-DD strings) ---------- */
const pad = n => String(n).padStart(2, '0');
const toDS = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => toDS(new Date());
function parseDS(s) { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); }
function isDS(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
function addDays(s, n) { const d = parseDS(s); d.setDate(d.getDate() + n); return toDS(d); }
function addMonths(s, n) { const d = parseDS(s); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return toDS(d); }
function daysBetween(a, b) { return Math.round((parseDS(b) - parseDS(a)) / 86400000); }
function startOfWeek(s) { const d = parseDS(s); const wd = (d.getDay() - (S.settings.weekStart || 0) + 7) % 7; d.setDate(d.getDate() - wd); return toDS(d); }
function monthStart(s) { const d = parseDS(s); return toDS(new Date(d.getFullYear(), d.getMonth(), 1)); }
function fmtDate(s, o = { month: 'short', day: 'numeric' }) { return isDS(s) ? parseDS(s).toLocaleDateString(undefined, o) : '–'; }
function fmtDateLong(s) { return fmtDate(s, { weekday: 'long', month: 'long', day: 'numeric' }); }
function fmtDateFull(s) { return fmtDate(s, { month: 'short', day: 'numeric', year: 'numeric' }); }
function fmtDow(s) { return fmtDate(s, { weekday: 'short' }); }
function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
function addMin(t, min) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const tot = Math.max(0, Math.min(24 * 60 - 1, h * 60 + m + (min || 0)));
  return `${pad(Math.floor(tot / 60))}:${pad(tot % 60)}`;
}
function relDay(s) {
  const n = daysBetween(today(), s);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n > 1 && n < 7) return fmtDate(s, { weekday: 'long' });
  return fmtDate(s, { weekday: 'short', month: 'short', day: 'numeric' });
}
function ago(s) {
  const n = daysBetween(s, today());
  if (n <= 0) return n === 0 ? 'today' : 'in ' + plural(-n, 'day');
  if (n < 14) return plural(n, 'day') + ' ago';
  if (n < 70) return plural(Math.round(n / 7), 'week') + ' ago';
  return plural(Math.round(n / 30.4), 'month') + ' ago';
}
function ageFrom(dob) {
  if (!isDS(dob)) return null;
  const b = parseDS(dob), n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}

/* ---------- Units (stored metric: cm, kg) ---------- */
const U = {
  imp() { return S.settings.units === 'imperial'; },
  len() { return U.imp() ? 'in' : 'cm'; },
  mass() { return U.imp() ? 'lb' : 'kg'; },
  lenOut(cm) { return cm == null ? null : U.imp() ? cm / 2.54 : cm; },
  lenIn(v) { return v == null ? null : U.imp() ? v * 2.54 : v; },
  massOut(kg) { return kg == null ? null : U.imp() ? kg * 2.2046226218 : kg; },
  massIn(v) { return v == null ? null : U.imp() ? v / 2.2046226218 : v; },
};
function fmtMass(kg, withUnit = true) {
  if (kg == null) return '–';
  const v = U.massOut(kg);
  return fmtNum(v, 1, 0) + (withUnit ? ' ' + U.mass() : '');
}
function fmtHeightCm(cm) {
  if (cm == null) return '–';
  if (!U.imp()) return fmtNum(cm, 0) + ' cm';
  const tot = Math.round(cm / 2.54);
  return `${Math.floor(tot / 12)}′${tot % 12}″`;
}
/* round a value for a form input */
function inVal(v, d = 2) { return v == null ? '' : String(round(v, d)); }

/* ---------- Seeded random (demo data) ---------- */
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* =========================================================
   State
   ========================================================= */
const COLS = ['athletes', 'events', 'tests', 'exercises', 'workouts', 'vbt', 'maxes', 'notes', 'reports', 'readiness'];
const DEFAULT_SETTINGS = {
  businessName: '', coachName: '', units: 'imperial', weekStart: 0, theme: 'auto',
  lockEnabled: false, pinHash: null, pinSalt: null, pinLen: 4, autoLockMin: 5,
  lastBackup: null, onboarded: false, defaultDuration: 60, defaultStart: '09:00',
};
function emptyState() {
  const s = { v: 1, settings: { ...DEFAULT_SETTINGS }, deleted: {} };
  COLS.forEach(c => (s[c] = []));
  return s;
}
let S = emptyState();

function normalizeState(raw) {
  const s = emptyState();
  if (!raw || typeof raw !== 'object') return s;
  s.settings = { ...DEFAULT_SETTINGS, ...(raw.settings || {}) };
  s.deleted = raw.deleted && typeof raw.deleted === 'object' ? raw.deleted : {};
  COLS.forEach(c => { s[c] = Array.isArray(raw[c]) ? raw[c].map(r => cleanRecord(c, r)).filter(Boolean) : []; });
  s.deleted = Object.fromEntries(Object.entries(s.deleted).filter(([k, v]) => SAFE_ID.test(k) && Number.isFinite(v)));
  cleanSettings(s.settings);
  s.settingsAt = Number.isFinite(raw.settingsAt) ? raw.settingsAt : 0;
  return s;
}
/* ---------- Validation of all data entering the app (load, backup import, sync) ----------
   Text is always escaped when shown; these checks also keep structural fields (ids, colours,
   enum values) safe, so a crafted backup file can't inject code into the page. */
const SAFE_ID = /^[A-Za-z0-9_~.:-]{1,120}$/;
const HEX = /^#[0-9a-fA-F]{3,8}$/;
const oneOf = (v, list, d) => (list.includes(v) ? v : d);
function cleanRecord(c, r) {
  if (!r || typeof r !== 'object' || Array.isArray(r) || !SAFE_ID.test(String(r.id))) return null;
  for (const k of Object.keys(r)) {
    const v = r[k];
    if (k.endsWith('Id') && v != null && v !== '' && !SAFE_ID.test(String(v))) r[k] = '';
    else if (k.endsWith('Ids')) r[k] = Array.isArray(v) ? v.filter(x => SAFE_ID.test(String(x))) : [];
    else if (/^(date|from|to)$/.test(k) && v != null && !isDS(v)) r[k] = k === 'date' ? today() : null;
    else if (/^(start)$/.test(k) && v && !/^\d{2}:\d{2}$/.test(v)) r[k] = '';
  }
  if (c === 'athletes') {
    if (r.color && !HEX.test(r.color)) r.color = '';
    if (r.mvt && (typeof r.mvt !== 'object' || Array.isArray(r.mvt))) r.mvt = {};
    if (r.mvt) r.mvt = Object.fromEntries(Object.entries(r.mvt).filter(([k, v]) => SAFE_ID.test(k) && Number.isFinite(v)));
  }
  if (c === 'events') {
    r.type = oneOf(r.type, ['session', 'evaluation', 'consult', 'other'], 'other');
    r.status = oneOf(r.status, ['scheduled', 'completed', 'cancelled', 'noshow'], 'scheduled');
    if (r.attendance) r.attendance = Object.fromEntries(Object.entries(r.attendance).filter(([k, v]) => SAFE_ID.test(k) && (v === 'present' || v === 'noshow')));
    if (!Number.isFinite(r.duration)) r.duration = 60;
  }
  if (c === 'tests') {
    r.m = Object.fromEntries(Object.entries(r.m && typeof r.m === 'object' ? r.m : {}).filter(([k, v]) => /^[A-Za-z0-9_]{1,60}$/.test(k) && Number.isFinite(v)));
    if (r.sides) r.sides = Object.fromEntries(Object.entries(r.sides).filter(([k, v]) => /^[A-Za-z0-9_]+$/.test(k) && (v === 'Left' || v === 'Right')));
    r.isoType = oneOf(r.isoType, ['IMTP', 'ISQ', 'CALF', 'OTHER', undefined], 'IMTP');
    if (r.trials && typeof r.trials === 'object') r.trials = Object.fromEntries(Object.entries(r.trials).filter(([k, v]) => /^[A-Za-z0-9_]+$/.test(k) && Array.isArray(v)).map(([k, v]) => [k, v.filter(Number.isFinite)]));
  }
  if (c === 'workouts') {
    r.items = (Array.isArray(r.items) ? r.items : []).filter(it => it && SAFE_ID.test(String(it.id))).map(it => ({
      ...it, exerciseId: SAFE_ID.test(String(it.exerciseId)) ? it.exerciseId : '',
      intensity: oneOf(it.intensity, ['load', 'pct', 'rir', 'zone', 'vel', 'rpe', 'bw'], 'load'), zone: oneOf(it.zone, ['abs', 'acc', 'ss', 'sps', 'st'], 'acc'),
      rir: Number.isFinite(it.rir) && it.rir >= 0 && it.rir <= 5 ? it.rir : null,
      loads: Array.isArray(it.loads) ? it.loads.filter(x => Number.isFinite(x) && x > 0).slice(0, 20) : null,
    }));
    if (r.log) r.log = Object.fromEntries(Object.entries(r.log).filter(([k, v]) => SAFE_ID.test(k) && Array.isArray(v)));
    if (r.logMode) r.logMode = Object.fromEntries(Object.entries(r.logMode).filter(([k, v]) => SAFE_ID.test(k) && (v === 'avg' || v === 'reps')));
  }
  if (c === 'vbt') { r.reps = Array.isArray(r.reps) ? r.reps.filter(Number.isFinite) : []; if (r.entry) r.entry = oneOf(r.entry, ['avg', 'reps', 'profile'], 'reps'); }
  if (c === 'readiness') {
    r.mode = oneOf(r.mode, ['cmj', 'iso'], 'cmj');
    r.isoType = r.mode === 'iso' ? oneOf(r.isoType, ['IMTP', 'ISQ', 'OTHER'], 'IMTP') : null;
    r.trials = Object.fromEntries(Object.entries(r.trials && typeof r.trials === 'object' ? r.trials : {}).filter(([k, v]) => ['cmj', 'rsiMod', 'imtpPF'].includes(k) && Array.isArray(v)).map(([k, v]) => [k, v.filter(Number.isFinite).slice(0, 6)]));
    r.m = Object.fromEntries(Object.entries(r.m && typeof r.m === 'object' ? r.m : {}).filter(([k, v]) => ['cmj', 'rsiMod', 'imtpPF'].includes(k) && Number.isFinite(v)));
  }
  if (c === 'exercises' && r.e1rmLift) r.e1rmLift = oneOf(r.e1rmLift, ['squat', 'fsquat', 'bench', 'tbdl', 'none'], null);
  return r;
}
function cleanSettings(st) {
  st.units = oneOf(st.units, ['imperial', 'metric'], 'imperial');
  st.theme = oneOf(st.theme, ['auto', 'light', 'dark', 'brand'], 'auto');
  st.weekStart = st.weekStart === 1 ? 1 : 0;
  if (st.vbtEntry) st.vbtEntry = oneOf(st.vbtEntry, ['avg', 'reps'], 'avg');
  if (st.defaultStart && !/^\d{2}:\d{2}$/.test(st.defaultStart)) st.defaultStart = '09:00';
  if (st.brand && typeof st.brand === 'object') {
    ['primary', 'accent'].forEach(k => { if (st.brand[k] && !HEX.test(st.brand[k])) delete st.brand[k]; });
    if (st.brand.logo && !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(st.brand.logo)) st.brand.logo = null;
  } else delete st.brand;
  if (st.customMetrics) st.customMetrics = (Array.isArray(st.customMetrics) ? st.customMetrics : []).filter(c => c && /^c_[A-Za-z0-9]{4,40}$/.test(c.key) && typeof c.label === 'string')
    .map(c => ({ ...c, kind: oneOf(c.kind, ['number', 'time', 'len', 'mass'], 'number'), dir: [1, -1, 0].includes(c.dir) ? c.dir : 1, dec: [0, 1, 2, 3].includes(c.dec) ? c.dec : 2, cat: oneOf(c.cat, ['sprint', 'jump', 'rsi', 'cmjfp', 'iso', 'custom'], 'custom'), te: Number.isFinite(c.te) ? c.te : null }));
  if (st.rirTables) {
    const v = x => Number.isFinite(x) && x > 0 && x < 3;
    st.rirTables = typeof st.rirTables === 'object' && !Array.isArray(st.rirTables) ? Object.fromEntries(Object.entries(st.rirTables)
      .filter(([k, t]) => ['squat', 'fsquat', 'bench', 'tbdl'].includes(k) && t && Array.isArray(t.rir) && t.rir.length === 6 && t.rir.every(b => Array.isArray(b) && v(b[0]) && v(b[1])))
      .map(([k, t]) => [k, { rir: t.rir.map(b => [b[0], b[1]]), pct: Array.isArray(t.pct) ? t.pct.filter(p => Array.isArray(p) && Number.isFinite(p[0]) && p[0] > 0 && p[0] <= 100 && v(p[1])).map(p => [p[0], p[1]]) : null, source: String(t.source || '').slice(0, 200) }])) : {};
  }
  if (st.normTables) st.normTables = (Array.isArray(st.normTables) ? st.normTables : []).filter(t => t && SAFE_ID.test(String(t.id)) && /^[A-Za-z0-9_:~.-]{1,130}$/.test(String(t.metric)) && Array.isArray(t.points))
    .map(t => ({ id: t.id, metric: t.metric, sex: oneOf(t.sex, ['M', 'F', 'all'], 'all'), ageMin: Number.isFinite(t.ageMin) ? t.ageMin : null, ageMax: Number.isFinite(t.ageMax) ? t.ageMax : null,
      sport: String(t.sport || '').slice(0, 60), level: String(t.level || '').slice(0, 80), source: String(t.source || '').slice(0, 400), at: Number.isFinite(t.at) ? t.at : 0,
      points: t.points.filter(p => Array.isArray(p) && Number.isFinite(p[0]) && p[0] > 0 && p[0] < 100 && Number.isFinite(p[1])).map(p => [p[0], p[1]]).slice(0, 25) }))
    .filter(t => t.points.length >= 2).slice(0, 1000);
}
/* Settings that follow the coach across devices, including the passcode (theme and backup dates stay per device) */
const SHARED_SETTINGS = ['businessName', 'coachName', 'units', 'weekStart', 'defaultDuration', 'defaultStart', 'brand', 'philosophy', 'starterOffered', 'importMap', 'customMetrics', 'rirTables', 'normTables', 'lockEnabled', 'pinHash', 'pinSalt', 'pinLen', 'autoLockMin'];
let lastSharedSig = null;
function sharedSettingsSig() { return JSON.stringify(SHARED_SETTINGS.map(k => S.settings[k] ?? null)); }
function athleteStatus(e, aid) {
  const a = e.attendance?.[aid];
  return a === 'present' ? 'completed' : a === 'noshow' ? 'noshow' : e.status;
}

/* ---------- Storage: IndexedDB with localStorage fallback ---------- */
const Store = {
  mode: 'none', db: null,
  async init() {
    try {
      if (!('indexedDB' in window)) throw new Error('no idb');
      this.db = await new Promise((res, rej) => {
        const r = indexedDB.open('performance-hq', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
        r.onblocked = () => rej(new Error('blocked'));
        setTimeout(() => rej(new Error('timeout')), 4000);
      });
      this.mode = 'idb';
    } catch (e) {
      try { localStorage.setItem('__phq_t', '1'); localStorage.removeItem('__phq_t'); this.mode = 'ls'; }
      catch (e2) { this.mode = 'none'; }
    }
    return this.mode;
  },
  async get(key) {
    if (this.mode === 'idb') {
      return new Promise((res, rej) => {
        const tx = this.db.transaction('kv', 'readonly');
        const r = tx.objectStore('kv').get(key);
        r.onsuccess = () => res(r.result ?? null);
        r.onerror = () => rej(r.error);
      });
    }
    if (this.mode === 'ls') { const v = localStorage.getItem('phq_' + key); return v ? JSON.parse(v) : null; }
    return null;
  },
  async set(key, val) {
    if (this.mode === 'idb') {
      return new Promise((res, rej) => {
        const tx = this.db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(val, key);
        tx.oncomplete = () => res(true);
        tx.onerror = () => rej(tx.error);
        tx.onabort = () => rej(tx.error || new Error('aborted'));
      });
    }
    if (this.mode === 'ls') { localStorage.setItem('phq_' + key, JSON.stringify(val)); return true; }
    return false;
  },
};

let saveTimer = null, saveFailed = false;
function persist() { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 200); }
async function flush() {
  clearTimeout(saveTimer); saveTimer = null;
  try {
    const sig = sharedSettingsSig();
    if (lastSharedSig !== null && sig !== lastSharedSig) S.settingsAt = Date.now();
    lastSharedSig = sig;
    const ok = await Store.set('state', JSON.parse(JSON.stringify(S)));
    Sync.schedule();
    checkNewRecords();
    if (!ok) throw new Error('Storage unavailable');
    if (saveFailed) { saveFailed = false; toast('Saved'); }
  } catch (e) {
    console.error(e);
    if (!saveFailed) toast('Could not save — check device storage', 'err');
    saveFailed = true;
  }
}

/* ---------- Collection helpers ---------- */
function upsert(col, rec) {
  if (!rec.id) rec.id = uid();
  rec.updatedAt = Date.now();
  if (!rec.createdAt) rec.createdAt = rec.updatedAt;
  const arr = S[col];
  const i = arr.findIndex(r => r.id === rec.id);
  if (i >= 0) arr[i] = rec; else arr.push(rec);
  persist();
  return rec;
}
function removeRec(col, id) {
  const before = S[col].length;
  S[col] = S[col].filter(r => r.id !== id);
  if (S[col].length !== before) { S.deleted[id] = Date.now(); persist(); }
}
function getRec(col, id) { return S[col].find(r => r.id === id) || null; }
const getAthlete = id => getRec('athletes', id);
const getExercise = id => getRec('exercises', id);
function athleteName(a, short) { if (!a) return 'Unknown athlete'; return short ? `${a.firstName} ${(a.lastName || '')[0] ? a.lastName[0] + '.' : ''}`.trim() : `${a.firstName} ${a.lastName || ''}`.trim(); }
function activeAthletes() { return S.athletes.filter(a => !a.archived).sort((a, b) => athleteName(a).localeCompare(athleteName(b))); }
function sortedAthletes() { return [...S.athletes].sort((a, b) => (a.archived - b.archived) || athleteName(a).localeCompare(athleteName(b))); }
function testsFor(aid) { return S.tests.filter(t => t.athleteId === aid).sort(byKey('date')); }
function eventsOn(ds) { return S.events.filter(e => e.date === ds).sort(byKey('start')); }
function eventsFor(aid) { return S.events.filter(e => (e.athleteIds || []).includes(aid)); }
const ATH_COLORS = ['#2f5bff', '#8b4ef3', '#0e9384', '#e0661b', '#d92d7a', '#1f8fd6', '#5a9b18', '#c2410c', '#7c3aed', '#0f766e', '#b45309', '#be123c'];
function athColor(a) { return a?.color || ATH_COLORS[Math.abs([...(a?.id || 'x')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % ATH_COLORS.length]; }
function avatar(a, cls = '') { return `<div class="avatar ${cls}" style="background:${athColor(a)}">${esc(initials(a || {}))}</div>`; }

/* =========================================================
   View state & router
   ========================================================= */
const UI = {
  cal: { mode: 'month', cursor: null, sel: null, filter: 'all', programs: true },
  athletes: { q: '', filter: 'active', sort: 'name' },
  prog: {},          // per-athlete { cursor, sel }
  lib: { q: '', cat: 'all' },
  vbt: { athleteId: '', exerciseId: '', window: '42' },
  athVbt: {},        // per-athlete { exerciseId, window }
  testCat: {},       // per-athlete testing category filter
  insights: { level: 'all' },
  fp: { athleteId: '', chatAthlete: '' },
  rep: null,
};

const ROUTES = {};
function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = h.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  return { name: parts[0] || 'dashboard', parts: parts.slice(1), q: Object.fromEntries(new URLSearchParams(query)) };
}
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

let lastRouteKey = '';
function render() {
  const r = parseHash();
  const view = ROUTES[r.name] || ROUTES.dashboard;
  const key = location.hash;
  const sameRoute = key === lastRouteKey;
  const scrollY = window.scrollY;
  CHARTS.clear();
  let out;
  try { out = view(r); }
  catch (e) {
    console.error(e);
    out = { title: 'Something went wrong', body: `<div class="card"><p>This page hit an error: <code>${esc(e.message)}</code></p><button class="btn" data-act="goHome">Back to dashboard</button></div>` };
  }
  const nav = out.nav || r.name;
  $('#topbar').innerHTML = `
    ${out.back ? `<a class="btn icon ghost back" href="${out.back}" aria-label="Back">${icon('chevL', 'lg')}</a>` : ''}
    <h1>${esc(out.title)}</h1>
    <span id="syncPill" class="sync-pill-host"></span>
    <div class="top-actions">${out.actions || ''}<a class="btn icon ghost top-gear" href="#/settings" aria-label="Settings">${icon('settings')}</a></div>`;
  if (typeof syncIndicator === 'function') syncIndicator();
  $('#view').innerHTML = out.body;
  $$('[data-nav]').forEach(el => el.classList.toggle('active', el.dataset.nav === nav));
  document.title = `${out.title} · ${S.settings.businessName || APP_NAME}`;
  drawCharts();
  out.mount?.();
  if (sameRoute) window.scrollTo(0, scrollY); else window.scrollTo(0, 0);
  lastRouteKey = key;
}
const refresh = () => render();

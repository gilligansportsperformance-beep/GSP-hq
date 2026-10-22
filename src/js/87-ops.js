/* =========================================================
   Operations: encrypted iPhone ↔ Mac sync (private GitHub repo),
   weekly backup routine, CSV import (OVR Connect etc.), gym-floor mode
   ========================================================= */

/* ---------- Byte helpers ---------- */
function bytesToB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function b64ToBytes(b64) {
  const s = atob(String(b64).replace(/\s+/g, ''));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
async function gzip(bytes, inflate) {
  const cs = inflate ? new DecompressionStream('gzip') : new CompressionStream('gzip');
  const buf = await new Response(new Blob([bytes]).stream().pipeThrough(cs)).arrayBuffer();
  return new Uint8Array(buf);
}

/* ---------- End-to-end encryption (AES-GCM, key from passphrase via PBKDF2) ---------- */
const Crypt = {
  ITER: 310000,
  async key(pass, salt) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: this.ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  },
  async seal(obj, key, salt) {
    let bytes = new TextEncoder().encode(JSON.stringify(obj));
    const gz = typeof CompressionStream !== 'undefined';
    if (gz) bytes = await gzip(bytes);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
    return { app: 'performance-hq', v: 1, kdf: 'PBKDF2-SHA256', iter: this.ITER, salt: bytesToB64(salt), iv: bytesToB64(iv), gz, ct: bytesToB64(ct), at: Date.now() };
  },
  async open(env, key) {
    let bytes;
    try { bytes = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(env.iv) }, key, b64ToBytes(env.ct))); }
    catch { throw new Error('Wrong sync passphrase — use the same passphrase on every device.'); }
    if (env.gz) {
      if (typeof DecompressionStream === 'undefined') throw new Error('This browser is too old to read the sync file — update iOS/macOS.');
      bytes = await gzip(bytes, true);
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  },
};

/* ---------- GitHub contents API ---------- */
const GH = {
  url(cfg) { return `https://api.github.com/repos/${cfg.repo}/contents/${encodeURIComponent(cfg.path)}`; },
  headers(cfg, accept = 'application/vnd.github+json') { return { Authorization: `Bearer ${cfg.token}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28' }; },
  async err(res) {
    let m = ''; try { m = (await res.json()).message || ''; } catch { }
    if (res.status === 401) return new Error('GitHub rejected the token — it may have expired. Create a new one and reconnect.');
    if (res.status === 403) return new Error('The token can’t access that repository. Give it “Contents: Read and write” on the data repository.');
    if (res.status === 404) return new Error('Repository not found — check the name (owner/repo) and that the token can access it.');
    return new Error(`GitHub error ${res.status}${m ? ': ' + m : ''}`);
  },
  async checkRepo(cfg) {
    const res = await fetch(`https://api.github.com/repos/${cfg.repo}`, { headers: this.headers(cfg), cache: 'no-store' });
    if (!res.ok) throw await this.err(res);
    return res.json();
  },
  async get(cfg) {
    const res = await fetch(this.url(cfg) + `?t=${Date.now()}`, { headers: this.headers(cfg), cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw await this.err(res);
    const meta = await res.json();
    let text;
    if (meta.content) text = new TextDecoder().decode(b64ToBytes(meta.content));
    else {
      const raw = await fetch(this.url(cfg) + `?t=${Date.now()}`, { headers: this.headers(cfg, 'application/vnd.github.raw+json'), cache: 'no-store' });
      if (!raw.ok) throw await this.err(raw);
      text = await raw.text();
    }
    return { sha: meta.sha, env: JSON.parse(text) };
  },
  async put(cfg, env, sha) {
    const body = { message: `Sync from ${deviceName()} · ${new Date().toISOString()}`, content: bytesToB64(new TextEncoder().encode(JSON.stringify(env))) };
    if (sha) body.sha = sha;
    const res = await fetch(this.url(cfg), { method: 'PUT', headers: { ...this.headers(cfg), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.status === 409 || res.status === 422) return null;   // changed on another device — pull & merge again
    if (!res.ok) throw await this.err(res);
    return (await res.json()).content.sha;
  },
};
/* Order-independent fingerprint of the synced content, used to skip uploads when both copies already match */
function canonical(d) {
  const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return quickHash(JSON.stringify({ c: COLS.map(c => [...(d[c] || [])].sort(byId)), d: Object.keys(d.deleted || {}).sort().map(k => [k, d.deleted[k]]), s: SHARED_SETTINGS.map(k => d.settings?.[k] ?? null), t: d.settingsAt || 0 }));
}
function quickHash(str) { let h1 = 0x811c9dc5, h2 = 0x01000193; for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 ^ c, 2246822519) >>> 0; } return h1.toString(16) + h2.toString(16) + ':' + str.length; }
function deviceName() { return /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'iPhone' : /Mac/.test(navigator.platform || navigator.userAgent) ? 'Mac' : 'device'; }

/* ---------- Sync engine ---------- */
const LOCAL_ONLY = ['lockEnabled', 'pinHash', 'pinSalt', 'pinLen', 'autoLockMin', 'lastBackup', 'theme', 'backupFreq'];
const Sync = {
  cfg: null, meta: { last: null, error: null }, key: null, keySalt: null, timer: null, busy: false, again: false,
  enabled() { return !!this.cfg; },
  async load() {
    try { this.cfg = (await Store.get('syncCfg')) || null; this.meta = (await Store.get('syncMeta')) || { last: null, error: null }; } catch { this.cfg = null; }
  },
  async saveMeta() { try { await Store.set('syncMeta', this.meta); } catch { } },
  schedule(ms = 6000) {
    if (!this.enabled()) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.run(), ms);
  },
  async keyFor(saltB64) {
    if (this.key && this.keySalt === saltB64) return this.key;
    this.key = await Crypt.key(this.cfg.pass, b64ToBytes(saltB64));
    this.keySalt = saltB64;
    return this.key;
  },
  payload() {
    const data = JSON.parse(JSON.stringify(S));
    LOCAL_ONLY.forEach(k => delete data.settings[k]);
    return data;
  },
  async run({ manual = false } = {}) {
    if (!this.enabled()) return false;
    if (this.busy) { this.again = true; return false; }
    if (!navigator.onLine) { this.meta.error = 'Offline — will sync when you reconnect'; syncIndicator(); return false; }
    this.busy = true; syncIndicator();
    let changed = false;
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        const remote = await GH.get(this.cfg);
        let remoteCanon = null;
        if (remote) {
          if (remote.env?.app !== 'performance-hq') throw new Error('The sync file in that repository isn’t a Performance HQ file.');
          const data = normalizeState(await Crypt.open(remote.env, await this.keyFor(remote.env.salt)));
          remoteCanon = canonical(data);
          const res = mergeState(data);
          if (res.added || res.updated || res.removed || res.settings) { changed = true; recordBaseline(); }
        }
        if (changed) await Store.set('state', JSON.parse(JSON.stringify(S)));
        const payload = this.payload();
        const sig = quickHash(JSON.stringify(payload));
        if (remote && ((remote.sha === this.meta.sha && sig === this.meta.sig) || remoteCanon === canonical(S))) { this.meta = { last: Date.now(), error: null, sha: remote.sha, sig }; break; }
        const salt = remote?.env?.salt || bytesToB64(crypto.getRandomValues(new Uint8Array(16)));
        const env = await Crypt.seal(payload, await this.keyFor(salt), b64ToBytes(salt));
        const sha = await GH.put(this.cfg, env, remote?.sha);
        if (sha) { this.meta = { last: Date.now(), error: null, sha, sig }; break; }
        if (attempt === 3) throw new Error('Another device kept changing the data — try again in a moment.');
      }
      if (manual) toast(changed ? 'Synced — updates from your other device added' : 'Synced');
    } catch (e) {
      console.error(e);
      this.meta.error = e.message;
      if (manual) toast('Sync failed: ' + e.message, 'err');
    }
    this.busy = false;
    await this.saveMeta();
    syncIndicator();
    if (changed) { applyTheme(); updateBrand(); if (!modalStack.length && !document.activeElement?.matches?.('input,textarea,select')) refresh(); }
    if (this.again) { this.again = false; this.schedule(1500); }
    return !this.meta.error;
  },
};
function syncIndicator() {
  const el = $('#syncState');
  if (!el) return;
  if (!Sync.enabled()) { el.innerHTML = ''; return; }
  const m = Sync.meta;
  el.innerHTML = Sync.busy ? `<span class="sync-dot busy"></span>Syncing…` : m.error ? `<span class="sync-dot err"></span>Sync issue` : `<span class="sync-dot"></span>Synced${m.last ? ' ' + timeAgoShort(m.last) : ''}`;
  el.title = m.error || (m.last ? 'Last synced ' + new Date(m.last).toLocaleString() : '');
}
function timeAgoShort(t) { const s = (Date.now() - t) / 1000; return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' d ago'; }
setInterval(syncIndicator, 30000);
window.addEventListener('online', () => Sync.schedule(1000));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') Sync.schedule(800); });

A.syncNow = () => Sync.run({ manual: true }).then(() => { if (parseHash().name === 'settings') refresh(); });
A.syncSetup = () => {
  const c = Sync.cfg || { repo: '', token: '', pass: '', path: 'performance-hq-data.json' };
  openModal({
    title: 'Sync iPhone ↔ Mac', size: 'wide', submit: Sync.enabled() ? 'Save' : 'Connect',
    body: `<div class="prose small" style="margin-bottom:14px">
      <p>Your data is <b>encrypted on this device</b> with a passphrase only you know, then stored in a <b>private GitHub repository</b> you own. GitHub only ever sees scrambled data. Do this once on each device using the <b>same</b> repository, token and passphrase.</p>
      <ol>
        <li>Create a <b>private</b> repository, e.g. <code>gsp-hq-data</code>: <a href="https://github.com/new" target="_blank" rel="noopener">github.com/new</a> → Private → Create.</li>
        <li>Create a token: <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → Settings → Developer settings → Fine-grained tokens</a>. Repository access: <b>Only select repositories → gsp-hq-data</b>. Permissions → Repository → <b>Contents: Read and write</b>. Pick a long expiry and copy the token.</li>
        <li>Choose a sync passphrase (8+ characters) and keep it somewhere safe. <b>It can’t be recovered</b> — without it the synced copy can’t be read (your device data is unaffected).</li>
      </ol></div>
      <div class="fields">
        ${field('Data repository', inp('repo', c.repo, 'placeholder="gilligansportsperformance-beep/gsp-hq-data" autocapitalize="off" autocorrect="off"'), { cls: 'full', hint: 'owner/repository — must be private' })}
        ${field('GitHub token', `<input type="password" name="token" value="${esc(c.token)}" placeholder="github_pat_…" autocomplete="off" autocapitalize="off">`, { cls: 'full' })}
        ${field('Sync passphrase', `<input type="password" name="pass" value="${esc(c.pass)}" autocomplete="new-password">`)}
        ${field('Confirm passphrase', `<input type="password" name="pass2" value="${esc(c.pass)}" autocomplete="new-password">`)}
      </div>`,
    footer: Sync.enabled() ? '<button type="button" class="btn danger-ghost" data-sync-off>Turn off sync</button>' : '',
    onSubmit: async (v, form, m) => {
      const repo = v.repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
      if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return 'Enter the repository as owner/name, e.g. gilligansportsperformance-beep/gsp-hq-data';
      if (!v.token.trim()) return 'Paste your GitHub token.';
      if (v.pass.length < 8) return 'Use a passphrase of at least 8 characters.';
      if (v.pass !== v.pass2) return 'The passphrases don’t match.';
      if (!navigator.onLine) return 'You’re offline — connect to the internet to set up sync.';
      if (!window.crypto?.subtle) return 'Encryption isn’t available here. Open the app from its https:// address.';
      const cfg = { repo, token: v.token.trim(), pass: v.pass, path: c.path || 'performance-hq-data.json' };
      const btn = $('.modal-head button[type=submit]', m.wrap); btn.textContent = 'Checking…'; btn.disabled = true;
      try {
        const info = await GH.checkRepo(cfg);
        if (!info.private) { btn.textContent = 'Connect'; btn.disabled = false; return 'That repository is public. Sync needs a PRIVATE repository so even the encrypted file isn’t visible to others.'; }
        const remote = await GH.get(cfg);
        if (remote) await Crypt.open(remote.env, await Crypt.key(cfg.pass, b64ToBytes(remote.env.salt)));
      } catch (e) { btn.textContent = 'Connect'; btn.disabled = false; return e.message; }
      Sync.cfg = cfg; Sync.key = null; Sync.keySalt = null;
      await Store.set('syncCfg', cfg);
      const ok = await Sync.run({ manual: true });
      if (ok) toast('Sync is on for this device');
      refresh();
    },
    onMount: m => {
      $('[data-sync-off]', m.wrap)?.addEventListener('click', async () => {
        if (!(await confirmBox('Turn off sync on this device?', 'Data on this device stays. The encrypted copy in GitHub is not deleted.', { ok: 'Turn off' }))) return;
        Sync.cfg = null; Sync.meta = { last: null, error: null };
        await Store.set('syncCfg', null); await Sync.saveMeta();
        m.close(); syncIndicator(); refresh();
      });
    },
  });
};

/* ---------- Weekly backup routine ---------- */
function backupDue() {
  const f = S.settings.backupFreq || 'weekly';
  if (f === 'off' || !S.athletes.length) return false;
  if (!S.settings.lastBackup) return true;
  const days = { weekly: 7, biweekly: 14, monthly: 30 }[f] || 7;
  return daysBetween(S.settings.lastBackup.slice(0, 10), today()) >= days;
}
A.setBackupFreq = el => { S.settings.backupFreq = el.value; persist(); toast('Saved'); refresh(); };

/* ---------- CSV import (OVR Connect or any spreadsheet export) ---------- */
function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/).find(l => l.trim()) || '';
  const delim = [',', ';', '\t'].map(d => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const clean = rows.filter(r => r.some(c => c.trim() !== ''));
  if (clean.length < 2) return null;
  const headers = clean[0].map((h, i) => h.trim() || `Column ${i + 1}`);
  return { headers, rows: clean.slice(1).map(r => headers.map((_, i) => (r[i] ?? '').trim())) };
}
const IMPORT_GUESS = [
  [/take.?off velocity/, 'takeoffVel'], [/\bm?rsi.?mod|\bmrsi\b|rsi.?modified/, 'rsiMod'], [/time to take.?off|\bttt\b|contraction time/, 'ttt'],
  [/counter.?movement depth|\bcm depth|\bdepth\b/, 'cmDepth'], [/braking (phase )?(time|duration)|eccentric duration|braking phase/, 'brakeTime'],
  [/peak braking force|braking peak force/, 'peakBrakeF'], [/braking rfd|decel.*rfd|eccentric.*rfd/, 'brakeRfd'], [/braking impulse|eccentric impulse/, 'brakeImp'],
  [/propulsive (phase )?(time|duration)|concentric duration/, 'propTime'], [/peak propulsive force|concentric peak force/, 'cmjPF'],
  [/propulsive impulse|concentric impulse/, 'propImp'], [/relative (peak )?power|power.*\/.*kg|w\/kg/, 'cmjRelPP'], [/peak power/, 'cmjPP'],
  [/landing asym/, 'landAsym'], [/braking asym|eccentric asym/, 'brakeAsym'], [/propulsive asym|concentric asym/, 'propAsym'],
  [/peak landing force|landing force/, 'peakLandF'], [/force (at|@) ?100|\bf100\b|100 ?ms force/, 'imtpF100'], [/time to peak force/, 'imtpTtpf'],
  [/relative peak force|peak force.*\/.*kg|n\/kg/, 'imtpRel'], [/average force|mean force/, 'imtpAvgF'], [/\brfd\b|rate of force/, 'imtpRfd'],
  [/contact time|\bgct\b/, 'djGct'], [/\brsi\b/, 'djRsi'], [/jump height|\bjh\b/, 'cmj'], [/peak force/, 'cmjPF'],
  [/body ?(weight|mass)|\bweight\b|\bmass\b|\bbw\b/, '_bm'], [/sprint.*10|10 ?m\b/, 'sprint10'], [/40 ?y/, 'sprint40yd'],
];
function guessColumn(h) {
  const l = h.toLowerCase();
  if (/^(athlete|name|full name|player|athlete name|user)$/.test(l) || /athlete name|full name/.test(l)) return '_name';
  if (/^first( name)?$/.test(l)) return '_first';
  if (/^last( name)?$/.test(l)) return '_last';
  if (/date|time ?stamp|recorded|tested|^time$|session/.test(l) && !/time to|contact time|braking time|propulsive time/.test(l)) return '_date';
  if (/^(test|test type|type|mode|jump type|exercise|protocol)$/.test(l)) return '_type';
  const g = IMPORT_GUESS.find(([re]) => re.test(l));
  return g ? g[1] : '';
}
function guessUnit(h, key) {
  const l = h.toLowerCase();
  if (key === '_bm') return /lb/.test(l) ? 'lb' : /\bn\b|\(n\)/.test(l) ? 'N' : 'kg';
  const d = M[key];
  if (!d) return '';
  if (d.kind === 'len') return /\(in|inch|"/.test(l) ? 'in' : /\(m\)|\bm\b(?!s)/.test(l) && !/cm/.test(l) ? 'm' : 'cm';
  if (d.unit === 's') return /\bms\b|\(ms\)|millisec/.test(l) ? 'ms' : 's';
  return '';
}
function parseDateAny(s) {
  s = String(s || '').trim();
  let m;
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/))) { const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; return `${y}-${pad(+m[1])}-${pad(+m[2])}`; }
  const t = Date.parse(s);
  return Number.isFinite(t) ? toDS(new Date(t)) : null;
}
function convertImport(key, unit, v) {
  if (key === '_bm') return unit === 'lb' ? v / 2.2046226218 : unit === 'N' ? v / 9.81 : v;
  const d = M[key];
  if (d.kind === 'len') return unit === 'in' ? v * 2.54 : unit === 'm' ? v * 100 : v;
  if (d.unit === 's' && unit === 'ms') return v / 1000;
  return v;
}
A.importCsv = () => {
  const st = { step: 1, csv: null, map: [], units: [], filterCol: '', filterText: '', agg: 'best', names: {}, fileName: '' };
  const metricOpts = [['', '— ignore —'], ['_name', 'Athlete name'], ['_first', 'First name'], ['_last', 'Last name'], ['_date', 'Date'], ['_type', 'Test type (info)'], ['_bm', 'Body mass'],
    ...TEST_CATS.filter(c => !['derived', 'body'].includes(c.key)).flatMap(c => METRICS.filter(m => m.cat === c.key && !m.calc).map(m => [m.key, `${c.label.replace('OVR Force · ', '')} · ${m.label}`]))];
  const nameOf = row => {
    const i = st.map.indexOf('_name'), f = st.map.indexOf('_first'), l = st.map.indexOf('_last');
    if (i >= 0) { const n = row[i]; const mm = n.match(/^\s*([^,]+),\s*(.+)$/); return (mm ? `${mm[2]} ${mm[1]}` : n).replace(/\s+/g, ' ').trim(); }
    return [f >= 0 ? row[f] : '', l >= 0 ? row[l] : ''].join(' ').replace(/\s+/g, ' ').trim();
  };
  const filtered = () => st.csv.rows.filter(r => !st.filterCol || String(r[+st.filterCol] || '').toLowerCase().includes(st.filterText.trim().toLowerCase()));
  const matchAthlete = n => {
    const l = n.toLowerCase();
    return S.athletes.find(a => athleteName(a).toLowerCase() === l) || S.athletes.find(a => `${a.lastName} ${a.firstName}`.toLowerCase() === l) || null;
  };
  const build = () => {
    const groups = new Map();
    const di = st.map.indexOf('_date');
    filtered().forEach(r => {
      const name = nameOf(r);
      const target = st.names[name];
      if (!name || !target || target === '_skip') return;
      const date = di >= 0 ? parseDateAny(r[di]) : today();
      if (!date) return;
      const key = target + '|' + date;
      const g = groups.get(key) || { target, name, date, vals: {}, bm: [] };
      st.map.forEach((k, i) => {
        if (!k || k.startsWith('_') && k !== '_bm') return;
        const v = num(r[i]);
        if (v == null || !Number.isFinite(v)) return;
        const cv = convertImport(k, st.units[i], v);
        if (k === '_bm') { if (cv > 0) g.bm.push(cv); return; }
        (g.vals[k] ||= []).push(cv);
      });
      groups.set(key, g);
    });
    return [...groups.values()].map(g => {
      const m = {};
      Object.entries(g.vals).forEach(([k, arr]) => {
        const d = M[k];
        m[k] = st.agg === 'mean' || d.dir === 0 ? mean(arr) : st.agg === 'last' ? arr[arr.length - 1] : d.dir === -1 ? Math.min(...arr) : Math.max(...arr);
      });
      return { ...g, m, bmKg: g.bm.length ? mean(g.bm) : null };
    }).filter(g => Object.keys(g.m).length);
  };
  const stepHtml = () => {
    if (st.step === 1) return `<p class="muted">Export your results as a <b>CSV</b> (from OVR Connect, Excel, Numbers or Google Sheets), then choose the file — or paste rows copied from a spreadsheet. The first row must be column headers.</p>
      <div class="chips" style="margin-bottom:12px"><button type="button" class="btn primary" data-pick>${icon('upload', 'sm')}Choose CSV file</button><input type="file" class="hidden" accept=".csv,.tsv,.txt,text/csv,text/plain" data-file></div>
      ${field('…or paste here', '<textarea rows="6" data-paste placeholder="Name, Date, Jump Height (cm), mRSI, …"></textarea>')}
      <button type="button" class="btn" data-parse-paste>Use pasted data</button>`;
    if (st.step === 2) {
      const sample = st.csv.rows.slice(0, 3);
      return `<p class="muted small">${esc(st.fileName)} · ${plural(st.csv.rows.length, 'row')}. Match each column to a metric (we’ve guessed from the headers). Check the units for heights, times and body mass.</p>
        <div class="table-wrap"><table class="t map-table"><thead><tr><th>Column</th><th>Example</th><th>Import as</th><th>Unit</th></tr></thead><tbody>
        ${st.csv.headers.map((h, i) => { const k = st.map[i], d = M[k]; const uo = k === '_bm' ? [['kg', 'kg'], ['lb', 'lb'], ['N', 'N (weight)']] : d?.kind === 'len' ? [['cm', 'cm'], ['in', 'in'], ['m', 'm']] : d?.unit === 's' ? [['s', 's'], ['ms', 'ms']] : null;
          return `<tr><td><b>${esc(h)}</b></td><td class="small muted">${esc(sample.map(r => r[i]).filter(Boolean).slice(0, 2).join(' · ').slice(0, 40))}</td>
          <td><select data-map="${i}">${metricOpts.map(([v, l]) => `<option value="${v}" ${v === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></td>
          <td>${uo ? `<select data-unit="${i}">${uo.map(([v, l]) => `<option value="${v}" ${v === st.units[i] ? 'selected' : ''}>${l}</option>`).join('')}</select>` : '<span class="faint small">—</span>'}</td></tr>`; }).join('')}
        </tbody></table></div>
        <div class="fields" style="margin-top:14px">
          ${field('Only rows where column…', `<select data-fcol><option value="">(all rows)</option>${st.csv.headers.map((h, i) => `<option value="${i}" ${String(i) === st.filterCol ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select>`, { hint: 'e.g. Test type contains “CMJ” — import CMJ rows, then run again for squat jumps.' })}
          ${field('…contains', `<input type="text" data-ftext value="${esc(st.filterText)}" placeholder="CMJ">`)}
          ${field('Several trials on the same day', `<select data-agg>${[['best', 'Keep the best'], ['mean', 'Average them'], ['last', 'Keep the last']].map(([v, l]) => `<option value="${v}" ${v === st.agg ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
        </div>`;
    }
    if (st.step === 3) {
      const names = [...new Set(filtered().map(nameOf).filter(Boolean))].sort();
      names.forEach(n => { if (!(n in st.names)) { const a = matchAthlete(n); st.names[n] = a ? a.id : '_new'; } });
      return `<p class="muted small">Match the names in the file to your athletes.</p>
        <div class="table-wrap"><table class="t"><thead><tr><th>Name in file</th><th>Athlete</th></tr></thead><tbody>
        ${names.map(n => `<tr><td><b>${esc(n)}</b></td><td><select data-name="${esc(n)}">${[['_new', '+ Create new athlete'], ['_skip', 'Skip'], ...sortedAthletes().map(a => [a.id, athleteName(a)])].map(([v, l]) => `<option value="${v}" ${v === st.names[n] ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></td></tr>`).join('') || '<tr><td colspan="2" class="muted">No athlete names found — go back and map a name column.</td></tr>'}
        </tbody></table></div>`;
    }
    const groups = build();
    const newN = new Set(groups.filter(g => g.target === '_new').map(g => g.name)).size;
    const keys = [...new Set(groups.flatMap(g => Object.keys(g.m)))];
    return `<div class="computed" style="margin:0 0 12px">Ready to import <b>${plural(groups.length, 'test session')}</b> for <b>${plural(new Set(groups.map(g => g.target === '_new' ? 'n:' + g.name : g.target)).size, 'athlete')}</b>${newN ? ` (${newN} new)` : ''}: ${keys.map(k => esc(M[k].label)).join(', ') || 'no metrics'}.</div>
      <div class="table-wrap"><table class="t"><thead><tr><th>Athlete</th><th>Date</th><th>Results</th></tr></thead><tbody>
      ${groups.slice(0, 12).map(g => `<tr><td>${esc(g.target === '_new' ? g.name + ' (new)' : athleteName(getAthlete(g.target)))}</td><td class="nowrap">${esc(fmtDateFull(g.date))}</td><td class="small">${Object.entries(g.m).slice(0, 4).map(([k, v]) => `${esc(M[k].label)} <b>${esc(fmtMetric(M[k], v))}</b>`).join(' · ')}${Object.keys(g.m).length > 4 ? ' …' : ''}</td></tr>`).join('')}
      </tbody></table></div>${groups.length > 12 ? `<p class="faint small">…and ${groups.length - 12} more.</p>` : ''}
      <p class="faint small">Results merge into any existing test on the same date (imported values replace matching metrics).</p>`;
  };
  const m = openModal({
    title: 'Import test results', size: 'wide', submit: 'Next',
    body: '<div id="impStep"></div>',
    footer: '<button type="button" class="btn" data-back>Back</button>',
    onSubmit: (v, form, mm) => {
      if (st.step === 1) return 'Choose a file or paste data first.';
      if (st.step === 2) {
        if (!st.map.includes('_name') && !st.map.includes('_first') && !st.map.includes('_last')) return 'Map a column to “Athlete name” (or first/last name).';
        if (!st.map.some(k => k && (!k.startsWith('_') || k === '_bm'))) return 'Map at least one metric column.';
        if (!filtered().length) return 'No rows match the filter.';
        S.settings.importMap = Object.fromEntries(st.csv.headers.map((h, i) => [h.toLowerCase(), [st.map[i], st.units[i]]]));
        persist();
        st.step = 3; draw(); return false;
      }
      if (st.step === 3) { st.step = 4; draw(); return false; }
      const groups = build();
      if (!groups.length) return 'Nothing to import — check the mapping and athlete matches.';
      const created = {};
      groups.forEach(g => {
        let aid = g.target;
        if (aid === '_new') {
          if (!created[g.name]) { const parts = g.name.split(' '); created[g.name] = upsert('athletes', { firstName: parts[0], lastName: parts.slice(1).join(' '), sport: '', position: '', team: '', dob: '', sex: '', heightCm: null, massKg: g.bmKg, email: '', phone: '', goals: '', injuries: '', archived: false, color: '' }).id; }
          aid = created[g.name];
        }
        const ex = S.tests.find(t => t.athleteId === aid && t.date === g.date);
        if (ex) upsert('tests', { ...ex, m: { ...ex.m, ...g.m }, bodyMassKg: ex.bodyMassKg ?? g.bmKg });
        else upsert('tests', { athleteId: aid, date: g.date, m: g.m, sides: {}, isoType: 'IMTP', bodyMassKg: g.bmKg ?? getAthlete(aid)?.massKg ?? null, notes: `Imported from ${st.fileName}` });
      });
      toast(`Imported ${plural(groups.length, 'test session')}`); refresh();
    },
  });
  const draw = () => {
    $('#impStep', m.wrap).innerHTML = stepHtml();
    $('.modal-head button[type=submit]', m.wrap).textContent = st.step === 4 ? 'Import' : 'Next';
    $('[data-back]', m.wrap).classList.toggle('hidden', st.step === 1);
    m.error('');
  };
  const load = (text, name) => {
    const csv = parseCsv(text);
    if (!csv) return m.error('Couldn’t read any rows — the file needs a header row and at least one data row.');
    st.csv = csv; st.fileName = name;
    const saved = S.settings.importMap || {};
    st.map = csv.headers.map(h => saved[h.toLowerCase()]?.[0] ?? guessColumn(h));
    st.units = csv.headers.map((h, i) => saved[h.toLowerCase()]?.[1] ?? guessUnit(h, st.map[i]));
    st.step = 2; draw();
  };
  draw();
  m.wrap.addEventListener('click', e => {
    if (e.target.closest('[data-pick]')) $('[data-file]', m.wrap).click();
    if (e.target.closest('[data-parse-paste]')) { const t = $('[data-paste]', m.wrap).value; if (t.trim()) load(t, 'pasted data'); else m.error('Paste some rows first.'); }
    if (e.target.closest('[data-back]')) { st.step = Math.max(1, st.step - 1); draw(); }
  });
  m.wrap.addEventListener('change', async e => {
    const t = e.target;
    if (t.matches('[data-file]')) { const f = t.files?.[0]; t.value = ''; if (f) load(await f.text(), f.name); }
    if (t.dataset.map != null) { const i = +t.dataset.map; st.map[i] = t.value; st.units[i] = guessUnit(st.csv.headers[i], t.value); draw(); }
    if (t.dataset.unit != null) st.units[+t.dataset.unit] = t.value;
    if (t.matches('[data-fcol]')) st.filterCol = t.value;
    if (t.matches('[data-agg]')) st.agg = t.value;
    if (t.dataset.name != null) st.names[t.dataset.name] = t.value;
  });
  m.wrap.addEventListener('input', e => { if (e.target.matches('[data-ftext]')) st.filterText = e.target.value; });
};

/* ---------- Gym-floor mode ---------- */
let wakeLock = null;
async function setWakeLock(on) {
  try {
    if (on && 'wakeLock' in navigator) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { wakeLock = null; }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && UI.floorAwake && parseHash().name === 'floor') setWakeLock(true); });
ROUTES.floor = () => {
  const T = today();
  const now = new Date(), nowT = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const evs = eventsOn(T).filter(e => e.status !== 'cancelled');
  const current = evs.find(e => e.start && e.start <= nowT && addMin(e.start, e.duration) > nowT);
  const next = evs.find(e => e.start && e.start > nowT);
  const inEvents = new Set(evs.flatMap(e => e.athleteIds || []));
  const extra = S.workouts.filter(w => w.date === T && !inEvents.has(w.athleteId));
  const athRow = (a, e) => {
    const att = e ? e.attendance?.[a.id] || (e.status === 'completed' && (e.athleteIds || []).length === 1 ? 'present' : e.status === 'noshow' && (e.athleteIds || []).length === 1 ? 'noshow' : '') : '';
    const wo = S.workouts.find(w => w.athleteId === a.id && w.date === T);
    const sets = S.vbt.filter(l => l.athleteId === a.id && l.date === T).length;
    return `<div class="floor-ath ${att}">
      <div class="floor-who">${avatar(a)}<div><b>${esc(athleteName(a))}</b><div class="small muted">${wo ? `${esc(wo.title || 'Workout')} · ${plural((wo.items || []).length, 'exercise')}${wo.completed ? ' · ✓ done' : ''}` : 'No workout programmed'}${sets ? ` · ${plural(sets, 'set')} logged` : ''}</div></div></div>
      <div class="floor-btns">
        ${e ? `<button class="fbtn ${att === 'present' ? 'on good' : ''}" data-act="floorAtt" data-e="${e.id}" data-a="${a.id}" data-v="present">${icon('check')}Here</button>
        <button class="fbtn ${att === 'noshow' ? 'on bad' : ''}" data-act="floorAtt" data-e="${e.id}" data-a="${a.id}" data-v="noshow">${icon('x')}No-show</button>` : ''}
        <button class="fbtn primary" data-act="${wo ? 'logSession' : 'logSessionFor'}" data-id="${wo?.id || ''}" data-athlete="${a.id}">${icon('clipboard')}Log</button>
        <button class="fbtn" data-act="floorTest" data-a="${a.id}">${icon('zap')}Test</button>
        <button class="fbtn" data-act="floorNote" data-a="${a.id}">${icon('note')}Note</button>
      </div></div>`;
  };
  const card = e => {
    const ath = eventAthletes(e);
    const live = e === current, up = e === next;
    return `<div class="floor-card ${live ? 'live' : ''} ${e.status === 'completed' ? 'done' : ''}" id="ev-${e.id}">
      <div class="floor-head"><div><div class="floor-time">${e.start ? esc(fmtTime(e.start)) + ' – ' + esc(fmtTime(addMin(e.start, e.duration))) : 'All day'}</div><div class="floor-title">${esc(eventTitle(e))} <span class="badge t-${e.type}">${esc(typeLabel(e.type))}</span>${live ? ' <span class="badge good">Now</span>' : up ? ' <span class="badge info">Next</span>' : ''}${e.status === 'completed' ? ' <span class="badge good">Done</span>' : ''}</div>${e.location ? `<div class="small muted">${icon('pin', 'sm')} ${esc(e.location)}</div>` : ''}</div>
        ${e.status !== 'completed' && ath.length ? `<button class="btn sm" data-act="floorDone" data-e="${e.id}">${icon('check', 'sm')}Finish</button>` : ''}</div>
      ${e.notes ? `<div class="small muted" style="margin:4px 0 8px">${esc(e.notes)}</div>` : ''}
      ${ath.map(a => athRow(a, e)).join('') || '<div class="muted small">No athletes on this event.</div>'}
    </div>`;
  };
  const body = `
    <div class="floor-top"><div><div class="floor-clock" id="floorClock">${esc(fmtTime(nowT))}</div><div class="muted">${esc(fmtDateLong(T))} · ${plural(evs.length, 'session')}</div></div>
      <div class="chips"><button class="btn ${UI.floorAwake ? 'primary' : ''}" data-act="floorAwake">${icon('zap', 'sm')}${UI.floorAwake ? 'Screen stays on' : 'Keep screen on'}</button><button class="btn" data-act="groupTest">${icon('clipboard', 'sm')}Group test</button></div></div>
    ${evs.length ? evs.map(card).join('') : `<div class="card">${emptyState_('calendar', 'No sessions today', 'Scheduled sessions appear here with one-tap attendance, logging and quick tests.', `<button class="btn primary" data-act="newEvent" data-date="${T}">${icon('plus', 'sm')}Add session</button>`)}</div>`}
    ${extra.length ? `<div class="section-title">Programmed today, not scheduled</div><div class="floor-card">${extra.map(w => athRow(getAthlete(w.athleteId), null)).join('')}</div>` : ''}`;
  return {
    title: 'Gym Floor', body, nav: 'floor',
    mount() {
      const tick = () => { const el = $('#floorClock'); if (!el) return clearInterval(UI._floorTick); const d = new Date(); el.textContent = fmtTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`); };
      clearInterval(UI._floorTick); UI._floorTick = setInterval(tick, 15000);
      if (UI.floorAwake) setWakeLock(true);
      if (current && !UI._floorScrolled) { UI._floorScrolled = true; setTimeout(() => $('#ev-' + current.id)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 100); }
    },
  };
};
A.floorAwake = async () => {
  UI.floorAwake = !UI.floorAwake;
  await setWakeLock(UI.floorAwake);
  if (UI.floorAwake && !('wakeLock' in navigator)) toast('This device doesn’t support keeping the screen on — use Settings → Display → Auto-Lock instead');
  refresh();
};
A.floorAtt = el => {
  const e = getRec('events', el.dataset.e);
  if (!e) return;
  const att = { ...(e.attendance || {}) };
  att[el.dataset.a] = att[el.dataset.a] === el.dataset.v ? undefined : el.dataset.v;
  Object.keys(att).forEach(k => att[k] === undefined && delete att[k]);
  const ids = e.athleteIds || [];
  let status = e.status;
  if (ids.length && ids.every(id => att[id])) status = ids.some(id => att[id] === 'present') ? 'completed' : 'noshow';
  else if (status !== 'cancelled') status = 'scheduled';
  upsert('events', { ...e, attendance: att, status });
  refresh();
};
A.floorDone = el => {
  const e = getRec('events', el.dataset.e);
  if (!e) return;
  const att = { ...(e.attendance || {}) };
  (e.athleteIds || []).forEach(id => { if (!att[id]) att[id] = 'present'; });
  upsert('events', { ...e, attendance: att, status: Object.values(att).some(v => v === 'present') ? 'completed' : 'noshow' });
  toast('Session finished'); refresh();
};
A.floorNote = el => openNoteModal({ athleteId: el.dataset.a, date: today(), text: '' });
A.floorTest = el => {
  const a = getAthlete(el.dataset.a);
  let key = UI.floorTestKey || 'sprint10';
  openModal({
    title: `Quick test — ${athleteName(a, true)}`, size: 'narrow', center: true, submit: 'Save',
    body: `<div class="chips" style="margin-bottom:14px" id="ftKeys">${GROUP_METRICS.map(k => `<button type="button" class="chip ${k === key ? 'on' : ''}" data-k="${k}">${esc(M[k].label)}</button>`).join('')}</div>
      ${field('Result', `<input type="text" inputmode="decimal" name="val" autofocus style="font-size:28px;text-align:center">`, { unit: `<span id="ftUnit">${esc(metricUnit(M[key]) || '')}</span>` })}
      <p class="faint small" id="ftPrev"></p>`,
    onSubmit: v => {
      const x = num(v.val);
      if (x == null || x <= 0) return 'Enter a result.';
      const val = M[key].kind === 'len' ? U.lenIn(x) : x;
      const ex = S.tests.find(t => t.athleteId === a.id && t.date === today());
      if (ex) upsert('tests', { ...ex, m: { ...ex.m, [key]: val } });
      else upsert('tests', { athleteId: a.id, date: today(), m: { [key]: val }, sides: {}, isoType: 'IMTP', bodyMassKg: a.massKg ?? null, notes: 'Gym floor' });
      UI.floorTestKey = key;
      const s = metricSeries(a.id, key), prev = s.length > 1 ? s[s.length - 2] : null;
      toast(`${M[key].label}: ${fmtMetric(M[key], val)}${prev ? ` (prev ${fmtMetric(M[key], prev.v)})` : ''}`);
      refresh();
    },
    onMount: m => {
      const showPrev = () => { const s = metricSeries(a.id, key); $('#ftPrev', m.wrap).textContent = s.length ? `Last: ${fmtMetric(M[key], s[s.length - 1].v)} on ${fmtDate(s[s.length - 1].date)}` : 'No previous result.'; $('#ftUnit', m.wrap).textContent = metricUnit(M[key]) || ''; };
      showPrev();
      $('#ftKeys', m.wrap).addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (!b) return; key = b.dataset.k; $$('#ftKeys .chip', m.wrap).forEach(c => c.classList.toggle('on', c === b)); showPrev(); m.form.val.focus(); });
    },
  });
};

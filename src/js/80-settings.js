/* =========================================================
   Settings, backup/restore, lock, insights & references
   ========================================================= */
ROUTES.settings = () => {
  const s = S.settings;
  const counts = COLS.map(c => [c, S[c].length]);
  const standalone = isStandalone();
  const body = `
  <div class="grid halves">
    <div class="col">
      <div class="card"><div class="card-head"><h3>Business</h3></div>
        <form id="setBiz" autocomplete="off">
          ${field('Business name', inp('businessName', s.businessName, 'placeholder="e.g. Apex Performance"'))}
          ${field('Your name', inp('coachName', s.coachName, 'placeholder="Shown in the dashboard greeting"'))}
          <div class="fields">
            ${field('Units', sel('units', [['imperial', 'Imperial (lb, in)'], ['metric', 'Metric (kg, cm)']], s.units))}
            ${field('Week starts on', sel('weekStart', [['0', 'Sunday'], ['1', 'Monday']], String(s.weekStart)))}
            ${field('Default session start', inp('defaultStart', s.defaultStart, 'type="time"'))}
            ${field('Default length', numInp('defaultDuration', s.defaultDuration, 'inputmode="numeric"'), { unit: 'min' })}
          </div>
          ${field('Appearance', segmented('theme', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark'], ['brand', 'Brand']], s.theme), { hint: '“Brand” uses your colours (black & gold) throughout the app.' })}
          <button class="btn primary" type="submit">Save settings</button>
        </form>
      </div>
      <div class="card"><div class="card-head"><h3>Branding & philosophy</h3></div>
        <div class="brand-preview" style="--bp:${esc(brand().primary)};--ba:${esc(brand().accent)};margin-bottom:12px">${brandMark()}</div>
        <div class="settings-row"><div class="grow"><div style="font-weight:600">Logo, colours & contact details</div><div class="muted">Used on progress reports and the “Brand” appearance.</div></div><button class="btn sm" data-act="editBranding">${icon('edit', 'sm')}Edit</button></div>
        <div class="settings-row"><div class="grow"><div style="font-weight:600">Custom tests</div><div class="muted">${customMetricDefs().length ? plural(customMetricDefs().length, 'custom test') : 'Add your own tests — no code needed.'}</div></div><button class="btn sm" data-act="customTests">${icon('plus', 'sm')}Manage</button></div>
        <div class="settings-row"><div class="grow"><div style="font-weight:600">Training philosophy</div><div class="muted">Shown in reports and used by the Force Plate AI.</div></div><a class="btn sm" href="#/philosophy">Open</a></div>
      </div>
      <div class="card"><div class="card-head"><h3>Privacy & lock</h3></div>
        <div class="settings-row"><div class="grow"><div style="font-weight:600">Passcode lock</div><div class="muted">${s.lockEnabled ? `On: a passcode is needed to open the app${Sync.enabled() ? ' on all your synced devices' : ''}.` : `Off: anyone with this device unlocked can open the app.${Sync.enabled() ? ' Setting one here also sets it on your other devices.' : ''}`}</div></div>
          ${s.lockEnabled ? `<button class="btn sm" data-act="changePin">Change</button><button class="btn sm danger-ghost" data-act="disablePin">Turn off</button>` : `<button class="btn sm primary" data-act="setPin">${icon('lock', 'sm')}Set passcode</button>`}</div>
        ${s.lockEnabled ? `<div class="settings-row"><div class="grow"><div style="font-weight:600">Auto-lock</div><div class="muted">Lock after the app has been in the background for</div></div>
          ${sel('autoLockMin', [['0', 'Immediately'], ['1', '1 minute'], ['5', '5 minutes'], ['15', '15 minutes'], ['60', '1 hour']], String(s.autoLockMin), 'data-change="setAutoLock" style="width:auto"')}</div>
          <div class="settings-row"><div class="grow"><div style="font-weight:600">Lock now</div></div><button class="btn sm" data-act="lockNow">${icon('lock', 'sm')}Lock</button></div>` : ''}
        <p class="faint small" style="margin-top:10px">All data stays on this device — nothing is sent to any server. The passcode stops anyone who picks up your phone or Mac from opening the app.</p>
      </div>
      ${securityCard()}
      <div class="card"><div class="card-head"><h3>Install on your devices</h3></div>
        <div class="settings-row">${icon('smartphone', 'lg')}<div class="grow"><div style="font-weight:600">iPhone / iPad</div><div class="muted">Open this page in <b>Safari</b> → tap <b>Share</b> → <b>Add to Home Screen</b>. It then opens full-screen and works offline.</div></div></div>
        <div class="settings-row">${icon('monitor', 'lg')}<div class="grow"><div style="font-weight:600">Mac</div><div class="muted">In <b>Safari</b>: <b>File → Add to Dock</b> (macOS Sonoma or later). In Chrome: the install icon in the address bar.</div></div></div>
        <p class="small" style="margin-top:8px"><span class="status-dot ${standalone ? '' : 'off'}"></span> ${standalone ? 'Running as an installed app.' : 'Running in a browser tab.'} ${'serviceWorker' in navigator && navigator.serviceWorker.controller ? '· Offline ready' : ''}</p>
      </div>
    </div>
    <div class="col">
      <div class="card"><div class="card-head"><h3>Sync iPhone ↔ Mac</h3><span class="sub" id="syncState2"></span></div>
        ${Sync.enabled() ? `<p class="small muted">On. Everything you enter is saved on this device straight away and synced automatically (end-to-end encrypted) through your private repository <b>${esc(Sync.cfg.repo)}</b>. This device is remembered: you won’t be asked for the setup code or passphrase again here. ${Sync.meta.last ? `Last sync ${esc(new Date(Sync.meta.last).toLocaleString())}.` : ''}</p>
          ${Sync.meta.error ? `<div class="banner bad" style="margin:0 0 10px">${icon('alert')}<div class="grow small">${esc(Sync.meta.error)}</div></div>` : ''}
          <div class="chips"><button class="btn primary" data-act="syncNow">${icon('upload', 'sm')}Sync now</button><button class="btn" data-act="syncCode">${icon('smartphone', 'sm')}Add another device</button><button class="btn" data-act="cloudBackups">${icon('clock', 'sm')}Cloud backups</button><button class="btn" data-act="syncSetup">Settings</button></div>` :
          `<p class="small muted">Keep your iPhone and Mac in step automatically. Set it up once on the device that has your data, then connect the other one with a setup code. Data is encrypted on your device before it leaves.</p>
          <div class="chips"><button class="btn primary" data-act="syncSetup">${icon('lock', 'sm')}Set up sync</button><button class="btn" data-act="syncJoin">${icon('smartphone', 'sm')}Connect with setup code</button></div>`}
      </div>
      <div class="card"><div class="card-head"><h3>Backups</h3></div>
        <div class="settings-row"><div class="grow"><div style="font-weight:600">Backup reminder</div><div class="muted">The dashboard reminds you when a backup is due.</div></div>
          ${sel('backupFreq', [['weekly', 'Weekly'], ['biweekly', 'Every 2 weeks'], ['monthly', 'Monthly'], ['off', 'Off']], s.backupFreq || 'weekly', 'data-change="setBackupFreq" style="width:auto"')}</div>
        <p class="muted small" style="margin-top:10px"><b>One-tap to iCloud Drive:</b> on iPhone, tap <b>Export backup → Save to Files → iCloud Drive</b> (it remembers the folder next time). On Mac, set Safari → Settings → General → <b>File download location</b> to an iCloud Drive folder once — then every backup lands there automatically.</p>
        <div class="chips" style="margin:12px 0">
          <button class="btn primary" data-act="exportBackup">${icon('download', 'sm')}Export backup</button>
          <button class="btn" data-act="importBackup">${icon('upload', 'sm')}Import backup</button>
          <button class="btn" data-act="exportCsv">${icon('file', 'sm')}Test results (CSV)</button>
          <button class="btn" data-act="importCsv">${icon('upload', 'sm')}Import results (OVR / CSV)</button>
        </div>
        <div class="small muted">Last backup: <b>${s.lastBackup ? esc(fmtDateFull(s.lastBackup.slice(0, 10))) : 'never'}</b></div>
        <input type="file" id="importFile" accept=".json,application/json" class="hidden">
      </div>
      <div class="card"><div class="card-head"><h3>Data on this device</h3></div>
        <div class="table-wrap"><table class="t"><tbody>
          ${[['athletes', 'Athletes'], ['events', 'Calendar events'], ['tests', 'Test sessions'], ['workouts', 'Workouts'], ['exercises', 'Exercises'], ['vbt', 'VBT sets'], ['maxes', 'Tested 1RMs'], ['notes', 'Notes'], ['reports', 'Saved reports'], ['readiness', 'Readiness checks'], ['teams', 'Teams'], ['teamtests', 'Team test days']].map(([k, l]) => `<tr><td>${l}</td><td class="n"><b>${counts.find(c => c[0] === k)[1]}</b></td></tr>`).join('')}
        </tbody></table></div>
        <p class="small muted" style="margin-top:10px" id="storageInfo">Storage: ${Store.mode === 'idb' ? 'IndexedDB (on-device database)' : Store.mode === 'ls' ? 'Local storage' : '<b style="color:var(--bad)">unavailable</b>'}</p>
        <hr class="sep">
        <div class="chips">
          ${S.athletes.some(a => a.demo) ? `<button class="btn" data-act="removeDemo">Remove sample data</button>` : `<button class="btn" data-act="loadDemo">Load sample data</button>`}
          <button class="btn" data-act="loadStarter">Add starter exercises</button>
          <button class="btn danger-ghost" data-act="eraseAll">${icon('trash', 'sm')}Erase everything</button>
        </div>
      </div>
      <div class="card"><div class="card-head"><h3>About</h3></div>
        <p class="small muted">${APP_NAME} v${APP_VERSION}. Suggestions are rule-based and transparent — every one links to the peer-reviewed research behind it. They support, not replace, your professional judgement.</p>
        <a class="btn sm" href="#/references">${icon('ref', 'sm')}Methods & references</a>
      </div>
    </div>
  </div>`;
  return {
    title: 'Settings', body,
    mount() {
      $('#setBiz').addEventListener('submit', e => {
        e.preventDefault();
        const v = formData(e.target);
        const dur = Math.round(num(v.defaultDuration) || 60);
        Object.assign(S.settings, { businessName: v.businessName.trim(), coachName: v.coachName.trim(), units: v.units, weekStart: +v.weekStart, defaultStart: v.defaultStart || '09:00', defaultDuration: dur > 0 && dur <= 600 ? dur : 60, theme: v.theme || 'auto' });
        persist(); applyTheme(); updateBrand(); toast('Settings saved'); refresh();
      });
      $('#importFile').addEventListener('change', onImportFile);
      navigator.storage?.estimate?.().then(est => {
        const el = $('#storageInfo');
        if (el && est?.usage != null) el.innerHTML += ` · ${fmtNum(est.usage / 1048576, 1)} MB used`;
      }).catch(() => {});
    },
  };
};
A.setAutoLock = el => { S.settings.autoLockMin = +el.value; persist(); toast('Saved'); };

/* ---------- Backup ---------- */
function isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }
A.exportBackup = async () => {
  await flush();
  const stamp = new Date().toISOString();
  const data = JSON.stringify({ app: 'performance-hq', version: APP_VERSION, exportedAt: stamp, data: S });
  const name = `performance-hq-backup-${today()}.json`;
  const blob = new Blob([data], { type: 'application/json' });
  let shared = false;
  try {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] }) && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
      await navigator.share({ files: [file], title: 'Performance HQ backup' });
      shared = true;
    }
  } catch (e) { if (e.name === 'AbortError') return; }
  if (!shared) downloadBlob(blob, name);
  S.settings.lastBackup = stamp; persist();
  toast('Backup created'); refresh();
};
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1500);
}
A.importBackup = () => $('#importFile')?.click();
async function onImportFile(e) {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (!f) return;
  let parsed;
  try { parsed = JSON.parse(await f.text()); } catch { return toast('That file isn’t a valid backup', 'err'); }
  const inc = parsed?.data && parsed.app === 'performance-hq' ? parsed.data : null;
  if (!inc || !COLS.some(c => Array.isArray(inc[c]))) return toast('That file isn’t a Performance HQ backup', 'err');
  const n = COLS.reduce((s, c) => s + (inc[c]?.length || 0), 0);
  const mode = await choose('Import backup', `${esc(f.name)} contains ${plural(n, 'record')}${parsed.exportedAt ? ` (exported ${esc(new Date(parsed.exportedAt).toLocaleString())})` : ''}.<br><br><b>Merge</b> combines it with this device, keeping the newest version of each record. <b>Replace</b> discards everything on this device first.`, [
    { label: 'Merge (recommended)', value: 'merge', style: 'primary' }, { label: 'Replace all data', value: 'replace', style: 'danger-ghost' }, { label: 'Cancel', value: null }]);
  if (!mode) return;
  if (mode === 'replace' && !(await confirmBox('Replace all data on this device?', 'Everything currently on this device will be overwritten by the backup.', { ok: 'Replace' }))) return;
  if (mode === 'replace') {
    const keep = { lockEnabled: S.settings.lockEnabled, pinHash: S.settings.pinHash, pinSalt: S.settings.pinSalt, pinLen: S.settings.pinLen, autoLockMin: S.settings.autoLockMin };
    S = normalizeState(inc);
    Object.assign(S.settings, keep, { onboarded: true });
  } else {
    const res = mergeState(normalizeState(inc));
    toast(`Merged: ${res.added} added, ${res.updated} updated${res.removed ? `, ${res.removed} removed` : ''}`);
  }
  registerCustomMetrics(); lastSharedSig = sharedSettingsSig(); recordBaseline();
  await flush(); applyTheme(); updateBrand();
  if (mode === 'replace') toast('Backup restored');
  refresh();
}
function mergeState(inc) {
  let added = 0, updated = 0, removed = 0;
  Object.entries(inc.deleted || {}).forEach(([id, t]) => { S.deleted[id] = Math.max(S.deleted[id] || 0, t); });
  COLS.forEach(c => {
    const map = new Map(S[c].map(r => [r.id, r]));
    inc[c].forEach(r => {
      if (S.deleted[r.id] && S.deleted[r.id] >= (r.updatedAt || 0)) return;
      const cur = map.get(r.id);
      if (!cur) { map.set(r.id, r); added++; }
      else if ((r.updatedAt || 0) > (cur.updatedAt || 0)) { map.set(r.id, r); updated++; }
    });
    const before = map.size;
    S[c] = [...map.values()].filter(r => !(S.deleted[r.id] && S.deleted[r.id] >= (r.updatedAt || 0)));
    removed += before - S[c].length;
  });
  let settings = false;
  if ((inc.settingsAt || 0) > (S.settingsAt || 0)) {
    SHARED_SETTINGS.forEach(k => { if (inc.settings && k in inc.settings) S.settings[k] = inc.settings[k]; });
    S.settingsAt = inc.settingsAt; lastSharedSig = sharedSettingsSig(); settings = true;
  } else ['businessName', 'coachName'].forEach(k => { if (!S.settings[k] && inc.settings?.[k]) S.settings[k] = inc.settings[k]; });
  if (!S.settings.onboarded) { S.settings.onboarded = true; settings = true; }
  if (added || updated || removed || settings) persist();
  return { added, updated, removed, settings };
}
A.exportCsv = () => {
  if (!S.tests.length) return toast('No test results to export');
  const defs = METRICS;
  const used = defs.filter(d => S.tests.some(t => testMetrics(t)[d.key] != null));
  const head = ['Date', 'Athlete', 'Sport', ...used.map(d => `${d.label}${metricUnit(d) ? ` (${metricUnit(d)})` : ''}`), 'Asymmetry sides', 'Notes'];
  const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const rows = [...S.tests].sort((a, b) => a.date.localeCompare(b.date)).map(t => {
    const a = getAthlete(t.athleteId), m = testMetrics(t);
    return [t.date, athleteName(a), a?.sport || '', ...used.map(d => m[d.key] != null ? round(metricDisp(d, m[d.key]), d.kind === 'len' ? 1 : Math.max(d.dec, 2)) : ''), Object.entries(t.sides || (t.asymSide ? { asym: t.asymSide } : {})).map(([k, v]) => `${M[k]?.label || k}: ${v}`).join('; '), t.notes || ''].map(q).join(',');
  });
  downloadBlob(new Blob(['﻿' + [head.map(q).join(','), ...rows].join('\n')], { type: 'text/csv' }), `test-results-${today()}.csv`);
  toast('CSV exported');
};
A.eraseAll = async () => {
  const ok = await confirmBox('Erase everything?', 'All athletes, calendar events, tests, programs, VBT data and settings on this device will be permanently deleted. Export a backup first if you might need it.', { ok: 'Erase everything' });
  if (!ok) return;
  S = emptyState(); S.settings.onboarded = true;
  await flush(); applyTheme(); updateBrand(); unlockUI(); toast('All data erased'); go('#/dashboard');
};

/* ---------- Passcode lock ---------- */
async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(salt + ':' + pin);
  if (window.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (const b of data) { h1 = Math.imul(h1 ^ b, 16777619) >>> 0; h2 = Math.imul(h2 ^ b, 2246822519) >>> 0; }
  return 'f' + h1.toString(16) + h2.toString(16);
}
function pinPrompt(title, sub = '') {
  return new Promise(resolve => {
    openModal({
      title, size: 'narrow', center: true, submit: 'Next',
      body: `${sub ? `<p class="muted">${sub}</p>` : ''}${field('Passcode', `<input type="password" name="pin" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" autofocus style="font-size:24px;letter-spacing:.4em;text-align:center">`, { hint: '4–6 digits' })}`,
      onSubmit: v => { if (!/^\d{4,6}$/.test(v.pin)) return 'Use 4 to 6 digits.'; resolve(v.pin); },
    });
    const wrap = modalStack[modalStack.length - 1].wrap;
    const obs = new MutationObserver(() => { if (!document.body.contains(wrap)) { obs.disconnect(); resolve(null); } });
    obs.observe(document.body, { childList: true });
  });
}
A.setPin = async () => {
  const p1 = await pinPrompt('Set security code', `Choose a 4–6 digit code. You’ll enter it each time you open the app${Sync.enabled() ? ', on every synced device' : ''}. ${Sync.enabled() ? 'If you forget it, you can reset it with your sync passphrase.' : 'If you forget it you’ll need to erase this device’s data, so keep a backup (or turn on sync, which lets you reset it with your passphrase).'}`);
  if (!p1) return;
  const p2 = await pinPrompt('Confirm passcode', 'Enter it again.');
  if (!p2) return;
  if (p1 !== p2) return toast('Passcodes didn’t match — try again', 'err');
  const salt = uid();
  const first = !S.settings.lockEnabled;
  Object.assign(S.settings, { pinSalt: salt, pinHash: await hashPin(p1, salt), pinLen: p1.length, lockEnabled: true }, first ? { autoLockMin: 0 } : {});
  persist(); toast(Sync.enabled() ? 'Security code set on all your devices' : 'Security code set'); refresh();
};
A.changePin = async () => {
  const cur = await pinPrompt('Current passcode');
  if (!cur) return;
  if (await hashPin(cur, S.settings.pinSalt) !== S.settings.pinHash) return toast('Incorrect passcode', 'err');
  A.setPin();
};
A.disablePin = async () => {
  const cur = await pinPrompt('Enter passcode to turn off lock');
  if (!cur) return;
  if (await hashPin(cur, S.settings.pinSalt) !== S.settings.pinHash) return toast('Incorrect passcode', 'err');
  Object.assign(S.settings, { lockEnabled: false, pinHash: null, pinSalt: null });
  persist(); toast('Passcode lock turned off'); refresh();
};
A.lockNow = () => showLock();

let lockEntry = '', lockBusy = false, hiddenAt = null;
function showLock() {
  if (!S.settings.lockEnabled || !S.settings.pinHash) return;
  modalStack.slice().forEach(m => m.close());
  $$('.modal-wrap').forEach(w => w.remove());
  document.body.style.overflow = '';
  lockEntry = '';
  let el = $('#lock');
  if (!el) {
    el = document.createElement('div');
    el.id = 'lock'; el.className = 'lock';
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div class="brand-mark">${appMark()}</div>
    <h2>${esc(S.settings.businessName || APP_NAME)}</h2>
    <div class="muted" id="lockMsg">Enter passcode</div>
    <div class="pin-dots" id="pinDots">${'<span></span>'.repeat(S.settings.pinLen || 4)}</div>
    <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button type="button" data-k="${n}">${n}</button>`).join('')}<button type="button" class="txt" data-k="forgot">Forgot?</button><button type="button" data-k="0">0</button><button type="button" class="txt" data-k="del">Delete</button></div>`;
  document.body.classList.add('locked');
  el.onclick = e => { const b = e.target.closest('[data-k]'); if (b) lockKey(b.dataset.k); };
}
/* Wrong-passcode throttling: after 5 misses, wait 30 s, doubling each time (max 15 min). Survives reloads. */
let lockFails = { n: 0, until: 0 };
async function loadLockFails() { try { lockFails = (await Store.get('lockFails')) || { n: 0, until: 0 }; } catch { } }
function lockWaitMsg() {
  const s = Math.ceil((lockFails.until - Date.now()) / 1000);
  const el = $('#lockMsg');
  if (el) el.textContent = s > 0 ? `Too many attempts — try again in ${s >= 60 ? Math.ceil(s / 60) + ' min' : s + ' s'}` : 'Enter passcode';
  return s > 0;
}
setInterval(() => { if (document.body.classList.contains('locked')) lockWaitMsg(); }, 1000);
function lockKey(k) {
  if (lockBusy) return;
  if (k !== 'forgot' && lockWaitMsg()) return;
  if (k === 'del') lockEntry = lockEntry.slice(0, -1);
  else if (k === 'forgot') return forgotPin();
  else if (/^\d$/.test(k) && lockEntry.length < (S.settings.pinLen || 4)) lockEntry += k;
  $$('#pinDots span').forEach((s, i) => s.classList.toggle('on', i < lockEntry.length));
  if (lockEntry.length === (S.settings.pinLen || 4)) {
    lockBusy = true;
    hashPin(lockEntry, S.settings.pinSalt).then(h => {
      lockBusy = false;
      if (h === S.settings.pinHash) { lockFails = { n: 0, until: 0 }; Store.set('lockFails', lockFails); unlockUI(); }
      else {
        lockFails.n++;
        if (lockFails.n >= 5) lockFails.until = Date.now() + Math.min(15 * 60, 30 * 2 ** (lockFails.n - 5)) * 1000;
        Store.set('lockFails', lockFails); lockWaitMsg();
        lockEntry = '';
        const d = $('#pinDots'); d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake');
        setTimeout(() => $$('#pinDots span').forEach(s => s.classList.remove('on')), 250);
      }
    });
  }
}
document.addEventListener('keydown', e => {
  if (!document.body.classList.contains('locked')) return;
  if (/^\d$/.test(e.key)) lockKey(e.key);
  else if (e.key === 'Backspace') lockKey('del');
});
function unlockUI() { $('#lock')?.remove(); document.body.classList.remove('locked'); lockEntry = ''; }
async function forgotPin() {
  if (Sync.enabled() && Sync.cfg?.pass) {
    const ok = await new Promise(res => {
      let done = false;
      const m = openModal({
        title: 'Reset security code', size: 'narrow', center: true, submit: 'Reset',
        body: `<p class="small muted" style="margin-top:0">Type your sync passphrase to prove it’s you. Your data stays; you can then choose a new code.</p>${field('Sync passphrase', '<input type="password" name="pass" autofocus autocomplete="current-password">')}`,
        onSubmit: v => { if (v.pass !== Sync.cfg.pass) return 'That isn’t your sync passphrase.'; done = true; res(true); },
      });
      const obs = new MutationObserver(() => { if (!document.body.contains(m.wrap)) { obs.disconnect(); if (!done) res(false); } });
      obs.observe(document.body, { childList: true });
    });
    if (!ok) return;
    Object.assign(S.settings, { lockEnabled: false, pinHash: null, pinSalt: null });
    lockFails = { n: 0, until: 0 }; Store.set('lockFails', lockFails);
    persist(); unlockUI(); toast('Security code removed. Choose a new one.');
    setTimeout(() => A.setPin(), 350);
    return;
  }
  const ok = await confirmBox('Forgot your passcode?', 'For privacy the passcode can’t be recovered. The only option is to erase all data on this device, then restore from your latest backup.', { ok: 'Erase data on this device' });
  if (!ok) return;
  const sure = await confirmBox('Are you absolutely sure?', 'This permanently deletes every athlete, test, program and event on this device.', { ok: 'Yes, erase everything' });
  if (!sure) return;
  S = emptyState(); S.settings.onboarded = true;
  await flush(); applyTheme(); updateBrand(); unlockUI(); go('#/settings');
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); flush(); }
  else if (hiddenAt && S.settings.lockEnabled && Date.now() - hiddenAt >= (S.settings.autoLockMin || 0) * 60000) showLock();
});
window.addEventListener('pagehide', () => flush());

/* ---------- Insights page ---------- */
ROUTES.insights = () => {
  const lvl = UI.insights.level;
  const all = allInsights();
  const list = all.filter(i => lvl === 'all' || i.level === lvl || (lvl === 'flags' && (i.level === 'alert' || i.level === 'warn')));
  const n = k => all.filter(i => i.level === k).length;
  const body = `
    <div class="chips scroll" style="margin-bottom:14px">
      ${[['all', `All (${all.length})`], ['flags', `Flags (${n('alert') + n('warn')})`], ['good', `Positive (${n('good')})`], ['info', `Suggestions (${n('info')})`]].map(([v, l]) => `<button class="chip ${lvl === v ? 'on' : ''}" data-act="insLevel" data-v="${v}">${l}</button>`).join('')}
    </div>
    <div class="card">${list.length ? list.map(i => insightHtml(i, true)).join('') : emptyState_('bulb', 'Nothing here yet', 'Insights are generated from testing results, VBT sets and completed-session RPE for active athletes.')}</div>
    <p class="faint small" style="margin-top:12px">How this works: each insight comes from a transparent rule applied to your own data (e.g. a change larger than a test's typical error, DSI thresholds, velocity loss limits). See <a href="#/references">methods & references</a>.</p>`;
  return { title: 'Insights', body, nav: 'dashboard', back: '#/dashboard' };
};
A.insLevel = el => { UI.insights.level = el.dataset.v; refresh(); };

/* ---------- References page ---------- */
ROUTES.references = r => {
  const hl = r.q.r;
  const body = `
    <div class="card prose">
      <h3 style="color:var(--text);margin-bottom:8px">How suggestions are generated</h3>
      <ul>
        <li><b>Meaningful change.</b> A change between tests is highlighted only if it exceeds the approximate typical error (coefficient of variation) of that test — 10 m sprint ~2%, 20–40 m ~1.5%, 5 m ~3%, CMJ/SJ ~4%, broad jump ~3%, RSI ~6%, peak force/power ~5%, RFD ~12%. Smaller changes are shown in grey as “within noise”. Using the same equipment, surface, warm-up and time of day keeps the error low.</li>
        <li><b>Readiness.</b> CMJ height vs the athlete's recent average, and bar velocity at a familiar load vs their norm (±0.06 m/s), flag possible fatigue or high readiness.</li>
        <li><b>Strength qualities.</b> Dynamic Strength Index (CMJ ÷ IMTP peak force) &lt;0.60 suggests ballistic emphasis, &gt;0.80 maximal-strength emphasis. EUR (CMJ ÷ SJ height) &lt;1.0 suggests limited stretch-shortening use. Drop-jump contact &gt;250 ms indicates slow SSC.</li>
        <li><b>Sprint profile.</b> Relative progress in 10 m (acceleration) vs flying 10 m (maximal velocity) guides emphasis.</li>
        <li><b>VBT.</b> Load–velocity regression extrapolated to the exercise's minimum velocity threshold gives an estimated 1RM. Within-set velocity loss &gt;40% is flagged.</li>
        <li><b>Training load.</b> Session-RPE × minutes; a 7-day load ≥1.5× the 4-week weekly average is flagged as a spike (with the known limitations of this ratio).</li>
        <li><b>Asymmetry.</b> ≥10% is flagged, ≥15% prioritised.</li>
      </ul>
      <p>These rules support — they don't replace — your judgement, the athlete's context and conversations with them.</p>
    </div>
    <div class="section-title">References</div>
    <div class="card"><ol class="ref-list">${Object.keys(REFS).map(k => `<li id="ref-${k}" style="${hl === k ? 'background:var(--accent-soft);border-radius:8px;padding:6px 8px;margin-left:-8px' : ''}">${esc(REFS[k].cite)}<span class="what">${esc(REFS[k].what)}</span></li>`).join('')}</ol></div>`;
  return { title: 'Methods & References', body, nav: 'settings', back: '#/settings', mount: () => { if (hl) setTimeout(() => $('#ref-' + hl)?.scrollIntoView({ block: 'center' }), 50); } };
};

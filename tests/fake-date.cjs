// Preload for date audits (npm test with FAKE_NOW / FAKE_TZ): FAKE_NOW (ISO time) shifts the clock in Node and in every browser page;
// FAKE_TZ sets the browser time zone (also set TZ for Node). Example: FAKE_NOW=2026-12-31T22:15:00-08:00 FAKE_TZ=America/Los_Angeles TZ=America/Los_Angeles npm test
const target = process.env.FAKE_NOW ? Date.parse(process.env.FAKE_NOW) : NaN;
const off = Number.isFinite(target) ? target - Date.now() : 0;
const shift = o => {
  const _D = Date;
  function D(...a) { if (!new.target) return new _D(_D.now() + o).toString(); return a.length ? new _D(...a) : new _D(_D.now() + o); }
  D.prototype = _D.prototype; D.now = () => _D.now() + o; D.parse = _D.parse; D.UTC = _D.UTC;
  globalThis.Date = D;
};
if (off) shift(off);
const pw = require('playwright');
const tz = process.env.FAKE_TZ;
const wrapCtx = async ctx => { if (off) await ctx.addInitScript(`(${shift})(${off})`); return ctx; };
const launch = pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch = async (...a) => {
  const b = await launch(...a);
  const nc = b.newContext.bind(b), np = b.newPage.bind(b);
  b.newContext = async (o = {}) => wrapCtx(await nc({ ...(tz ? { timezoneId: tz } : {}), ...o }));
  b.newPage = async (o = {}) => { const ctx = await b.newContext(o); const pg = await ctx.newPage(); return pg; };
  return b;
};

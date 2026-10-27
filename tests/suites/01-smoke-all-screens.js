// Performance HQ end-to-end tests — smoke all screens
// Run all suites with:  npm test   (see CLAUDE.md)
const { chromium, devices } = require('playwright');
const SP = process.env.OUT_DIR || '.';
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const [label, ctxOpts] of [['iphone', { ...devices['iPhone 13'] }], ['mac', { viewport: { width: 1440, height: 900 } }]]) {
    const ctx = await browser.newContext(ctxOpts);
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`[${label}] pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`[${label}] console: ${m.text()}`); });
    await page.goto((process.env.BASE_URL || 'http://localhost:8080/'));
    await page.waitForSelector('.modal');
    await page.screenshot({ path: `${SP}/${label}-00-onboarding.png` });
    await page.fill('input[name=businessName]', 'Apex Performance');
    await page.fill('input[name=coachName]', 'Coach J');
    await page.check('input[name=demo]');
    await page.click('.modal-head button[type=submit]');
    await page.waitForTimeout(600);
    // Phone layout must never be wider than the screen (390 px on iPhone 13)
    const fits = async where => {
      if (label !== 'iphone') return;
      const r = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, wide: [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > 391).slice(0, 3).map(e => e.tagName + '.' + e.className) }));
      if (r.w > 391) errors.push(`[${label}] ${where} is ${r.w}px wide (wider than the phone): ${r.wide.join(', ')}`);
    };
    const routes = ['dashboard', 'floor', 'calendar', 'athletes', 'leaderboard', 'leaderboard/records', 'percentiles', 'vbt', 'library', 'reports', 'fpai', 'fpai/guide', 'fpai/ask', 'insights', 'philosophy', 'settings', 'references', 'more'];
    for (const r of routes) {
      await page.goto(`${(process.env.BASE_URL || 'http://localhost:8080/')}#/${r}`);
      await page.waitForTimeout(300);
      if ((await page.innerText('#app')).includes('went wrong')) errors.push(`[${label}] error screen on ${r}`);
      await fits(r);
      await page.screenshot({ path: `${SP}/${label}-${r.replace('/', '-')}.png`, fullPage: true });
      console.log(`  ✓ ${label} · ${r}`);
    }
    // athlete tabs
    const ids = await page.evaluate(() => S.athletes.map(a => a.id));
    for (const tab of ['overview', 'evaluation', 'testing', 'program', 'vbt', 'history']) {
      await page.goto(`${(process.env.BASE_URL || 'http://localhost:8080/')}#/athlete/${ids[1]}/${tab}`);
      await page.waitForTimeout(300);
      await fits('athlete ' + tab);
      await page.screenshot({ path: `${SP}/${label}-ath-${tab}.png`, fullPage: true });
      console.log(`  ✓ ${label} · athlete ${tab}`);
    }
    // calendar modes
    await page.goto((process.env.BASE_URL || 'http://localhost:8080/') + '#/calendar');
    for (const m of ['week', 'list']) {
      await page.click(`[data-act=calMode][data-v=${m}]`); await page.waitForTimeout(200);
      await page.screenshot({ path: `${SP}/${label}-cal-${m}.png`, fullPage: true });
    }
    const errText = await page.evaluate(() => document.body.innerText.includes('Something went wrong'));
    if (errText) errors.push(`[${label}] error view shown`);
    await ctx.close();
  }
  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})();

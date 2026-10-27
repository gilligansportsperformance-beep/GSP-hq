# GSP HQ (Performance HQ): maintenance guide

Private coaching app for **Gilligan Sports Performance**, used only by the coach on an iPhone and a Mac. It is an offline-first web app (PWA) hosted on GitHub Pages from `docs/` on `main`. Live: https://gilligansportsperformance-beep.github.io/gsp-hq/

## Golden rules
1. **Never break existing data.** Coach data lives in each device's IndexedDB and in an encrypted sync file. New fields must be optional. Old records must keep loading through `normalizeState()` / `cleanRecord()` in `src/js/00-core.js`.
2. **No third-party runtime code.** Don't add CDNs, npm runtime libraries or external fonts. Everything is self-contained so it works offline and can't break when someone else's library changes. The Content Security Policy (`build.mjs`) only allows the app's own script.
3. **Escape all user text** with `esc()` when building HTML. Structural fields (ids, colours, enums) are validated on load and import in `cleanRecord()` / `cleanSettings()`. Extend those when you add new enum or id fields.
4. **Run `npm test` before every push.** All suites must pass.
5. **Write for the coach.** Plain language in the UI, iPhone-friendly layouts (check 390 px wide), and research citations for any sports-science claim (add them to `REFS`).

## Layout
- `src/index.html`: HTML shell. `build.mjs` inlines `src/styles.css` and every `src/js/*.js` (in filename order) into `docs/index.html`, computes the CSP script hash and versions the service worker cache.
- `src/sw.js`: offline service worker. Pages open from the saved copy immediately and refresh it in the background (so a hung gym connection can't block start-up); assets are cache-first. A new worker takes over and the page shows an **Update** bar (`showUpdateBar` in `90-main.js`).
- `src/fonts`: Bebas Neue, DM Sans, DM Serif Display (OFL).
- `docs/`: **build output; never edit by hand.** Run `node build.mjs`.
- `src/js/`:
  - `00-core.js`: utilities, dates, units (stored metric: cm and kg), state `S`, storage, `upsert` / `removeRec` (set `updatedAt` and tombstones for sync), validation, router.
  - `10-ui.js`: icons, modals (`openModal`), `choose` / `confirmBox`, form helpers, delegated actions (`A.name` ↔ `data-act="name"`).
  - `20-charts.js`: SVG line, scatter and bar charts.
  - `30-science.js`: test metrics (`METRICS`, `M`, `TEST_CATS`), trends and typical error, VBT maths, the insight engine and `REFS`.
  - `40-schedule.js`: dashboard and calendar. `50-athletes.js`: athletes, profile tabs, test entry, group testing. `60-program.js`: workouts, session logger, athlete VBT tab.
  - `70-library-vbt.js`: exercise library (`STARTER`, `EX_CATS`) and the VBT page. `75-fpai.js`: Force Plate AI (OVR guide, analyzer, Claude chat). `80-settings.js`: settings, backup, import, passcode lock.
  - `85-reports.js`: branding, philosophy, printable reports. `86-custom.js`: coach-defined custom tests. `87-ops.js`: encrypted GitHub sync, cloud backups, CSV import, gym floor, security checklist.
  - `88-leaderboard.js`: leaderboard and GSP records. `89-eval.js`: estimated 1RM engine (4 lifts) and the Evaluation tab profile quadrant.
  - `89r-rir.js`: RIR ↔ bar-speed charts, per-rep targets, set RIR estimates. `89s-pct.js`: percentiles (GSP peers and coach-loaded norm tables). `89t-ready.js`: readiness check. `89u-stim.js`: training-stimulus analysis. `89v-research.js`: Research AI (web search + fetch, streamed block reconstruction for `pause_turn`, reference check).
  - `90-main.js`: sample data, onboarding, shell, `boot()`.

## Data model (collections in `COLS`)
`athletes, events, tests, exercises, workouts, vbt, maxes, notes, reports, readiness`. Every record has `id`, `createdAt` and `updatedAt`. Sync merges by `updatedAt`; deletions are tombstones in `S.deleted`. Settings listed in `SHARED_SETTINGS` sync between devices (newest `settingsAt` wins), including the security code (`LOCK_KEYS`). Theme and backup settings stay on each device (`LOCAL_ONLY`). A device joining with a setup code resets its `settingsAt` to 0 so it takes the existing settings. Setup codes (`GSPHQ1-…`) are the sync config encrypted with the passphrase (`makeSetupCode` / `readSetupCode` in `87-ops.js`). Unsaved session-log drafts are kept per device in the IndexedDB key `logDrafts` (not synced). Secrets (Anthropic key, GitHub token, sync passphrase) are stored separately in IndexedDB keys `aiKey` / `syncCfg`. **Never put them in `S`.**

## Making a change
1. Edit `src/…` (never `docs/`).
2. Bump `APP_VERSION` in `src/js/00-core.js` (and `package.json`) for user-visible releases, and add a line to the README "New in" list.
3. `npm test`: builds, syntax-checks and runs all suites in `tests/suites` against a local server (Chromium via Playwright). Run one suite with `npm test -- 08`. Screenshots and files go to `tests/output/` (git-ignored). On a new machine: `npm install && npx playwright install chromium`.
4. Add or extend a suite for any new feature. Suites are plain Node scripts that print `✓ …` lines and end with `ALL PASSED, NO CONSOLE ERRORS`. Any console error fails the suite.
5. Commit and push to `main`. GitHub Pages redeploys in about 1–2 minutes. Devices update the next time the app is opened online.
6. To undo a release: `git revert <commit>` and push. Coach data is unaffected.

## Accuracy notes
- Typical-error (`te`) values in `METRICS` decide whether a change counts as "meaningful". Keep them literature-based.
- Estimated 1RM (`89-eval.js`) covers back squat, front squat, bench press and trap bar deadlift only. It combines a load–velocity profile (an athlete-specific velocity threshold when possible) with reps × RPE (Epley/Brzycki mean, RIR ≤3, ≤10 reps to failure). A tested max from the last 4 weeks is used directly.
- Profile quadrant: DSI (CMJ PF ÷ IMTP PF; 0.60 / 0.80) and EUR (CMJ ÷ SJ height; 1.00 / 1.20).
- RIR ↔ velocity (`89r-rir.js`): back squat bands are the coach's GSP chart. Other lifts have no default; they must be entered with a source.
  - A rep's speed maps to reps left by interpolating band midpoints.
  - Planned reps within 5 of the end follow the chart. Earlier reps are interpolated from rep 1 (athlete load–velocity profile, else the chart's %1RM table), and no rep is faster than rep 1.
  - Athletes are personalised by the mean offset of their last-rep speed vs the chart, from ≥3 each-rep sets with RPE 5–10.
  - The RIR starting load = 1RM × Epley/Brzycki %1RM for reps + RIR.
- Percentiles (`89s-pct.js`):
  - GSP percentile = (worse + ½ ties) ÷ n among one value per athlete.
  - "Best match" = same sex and age group, plus sport only if 5+ share it. Age groups are never mixed. Groups under 5 are hidden.
  - Published norms only come from tables the coach loads (`S.settings.normTables`, source required) or `NORMS_BUILTIN`. **Never type norms from memory.**
- Readiness (`89t-ready.js`):
  - Compares the mean of today's trials with the mean of up to 8 previous checks of the same test (last 90 days, ≥3 needed).
  - Noise = the test's typical error, or the athlete's own CV with 5+ checks (never below half the typical error). Beyond −1 noise = slightly down; beyond −2 = fatigued.
- Research AI (`89v-research.js`):
  - Uses `claude-opus-5-5`, adaptive thinking at high effort, `web_search_20260209` / `web_fetch_20260209` and server-side fallbacks.
  - Paused turns are resumed by sending the reconstructed assistant blocks back unchanged.
  - Follow-ups send the last two answers as plain context text, never as replayed assistant turns.
  - Reference links in the answer are marked ✓ only if their URL or DOI was among the pages found or opened in that research.
- Training stimulus (`89u-stim.js`): sets are classified by NSCA load–rep goals (Haff & Triplett 2016).
  - %1RM comes from the prescription, or from load ÷ 1RM, or from reps + RIR.
  - If RIR is missing it is estimated from reps possible at that %1RM.
  - Category overrides: Olympic lifts = power; jumps, sprints and plyometrics = speed; core, mobility and conditioning are excluded.

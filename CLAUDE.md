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
  - `35-standards.js`: the coach's high-school force-plate standards (`HS_STD`, `HS_TARGETS`), grading (`stdEval`), meters, the full chart, the report section (`stdReportHtml`) and the IMTP net/gross question (`imtpBasisPrompt`, `A.setImtpBasis`).
  - `36-priorities.js`: trends (`metricTrend`, `trendShort`, `athTrendLines`), training priorities (`athPriorities`, `athPrioCard`), the dashboard's Needs attention card (`needsAttention`) and Quick Find (`A.quickFind`, ⌘K / Ctrl+K or /).
  - `40-schedule.js`: dashboard and calendar. `50-athletes.js`: athletes, profile tabs, test entry, group testing. `60-program.js`: workouts, session logger, athlete VBT tab.
  - `62-fptests.js`: force plate tests as exercises (`FP_TESTS`, fixed exercise ids `fpt-*`, `ensureFpTests` at boot), the test blocks in the session logger (`fpBlockHtml`, `fpSave`), personal records (`prBests`, `newPrs`, `athPrCard`), lift rep PRs (`liftPrs`) and RPE-10 singles → tested 1RM (`liftMaxesFromLog`).
  - `70-library-vbt.js`: exercise library (`STARTER`, `EX_CATS`) and the VBT page. `75-fpai.js`: Force Plate AI (OVR guide, analyzer, Claude chat). `80-settings.js`: settings, backup, import, passcode lock.
  - `85-reports.js`: branding, philosophy, printable reports. `86-custom.js`: coach-defined custom tests. `87-ops.js`: encrypted GitHub sync, cloud backups, CSV import, gym floor, security checklist.
  - `88-leaderboard.js`: leaderboard and GSP records. `89-eval.js`: estimated 1RM engine (4 lifts) and the Evaluation tab profile quadrant.
  - `89r-rir.js`: RIR ↔ bar-speed charts, per-rep targets, set RIR estimates. `89s-pct.js`: percentiles (GSP peers and coach-loaded norm tables). `89t-ready.js`: readiness check. `89u-stim.js`: training-stimulus analysis. `89v-research.js`: Research AI (web search + fetch, streamed block reconstruction for `pause_turn`, reference check). `89w-team.js`: Team Testing (teams, quick add, test days, entry by athlete / by test, results). `89x-team-report.js`: branded team report (settings in `teamtests.report`; printing and sharing use `printReport` / `shareReport` in `85-reports.js`, styles in `REPORT_CSS`).
  - `90-main.js`: sample data, onboarding, shell, `boot()`.

## Data model (collections in `COLS`)
`athletes, events, tests, exercises, workouts, vbt, maxes, notes, reports, readiness, teams, teamtests`. Every record has `id`, `createdAt` and `updatedAt`. Evaluation tests carry `evaluation: true` and may carry `screen` (`{ohs|latLunge|fwdLunge|cars: {score 1–5, notes}}`); movement scores are deliberately not metrics, so they never reach leaderboards or percentiles. Team testing: `teams` are rosters (`athleteIds`, `sex` F/M/"" which pre-fills new athletes, plus the last tests used: `keys`, trials `n`, `score` best/avg). A `teamtests` record is one test day (`teamId`, `keys`, `n`, `score`, `athleteIds`, `absentIds`, `done`). Each athlete's results are an ordinary `tests` record with `teamTestId`, so they reach profiles, leaderboards and percentiles. Entries save on `change`; `UI.leave` (called at the start of `render()` and when the app is hidden) saves anything typed but not confirmed. `S.settings.evalExtra` lists the extra force-plate metrics the coach added to the evaluation form. `S.settings.imtpBasis` ('net' | 'gross', synced) says which IMTP force the coach types; unanswered = gross. Force plate tests logged in a session are ordinary `tests` records with `workoutId` and ids `${workoutId}~fp` (then `~fp2`, … for a repeated test or an isometric squat next to an IMTP), with `trials`; deleting the workout keeps them. Exercises may carry `fpTest` (a key of `FP_TESTS`). A tested 1RM made from a logged single at RPE 10 is a `maxes` record with `workoutId` and id `${workoutId}~max~${exerciseId}`. Reports may carry `baseline` ('first' | 'period'). Sync merges by `updatedAt`; deletions are tombstones in `S.deleted`. Settings listed in `SHARED_SETTINGS` sync between devices (newest `settingsAt` wins), including the security code (`LOCK_KEYS`). Theme and backup settings stay on each device (`LOCAL_ONLY`). A device joining with a setup code resets its `settingsAt` to 0 so it takes the existing settings. Setup codes (`GSPHQ1-…`) are the sync config encrypted with the passphrase (`makeSetupCode` / `readSetupCode` in `87-ops.js`). Unsaved session-log drafts are kept per device in the IndexedDB key `logDrafts` (not synced). Secrets (Anthropic key, GitHub token, sync passphrase) are stored separately in IndexedDB keys `aiKey` / `syncCfg`. **Never put them in `S`.**

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
- Single-leg tests: asymmetry = (stronger − weaker) ÷ stronger × 100 (Bishop et al. 2018); relative = leg average ÷ body mass (IMTP, N/kg) or ÷ body weight (calf, × BW). Typical errors (5% IMTP, 7% calf) are conservative estimates for isometric peak force; replace them with device-specific values if you measure them.
- Team testing (`89w-team.js`): timed and field tests keep the best trial, force-plate trials (CMJ/SJ height, OVR CMJ and isometric metrics) are averaged, matching the evaluation so results stay comparable. The typo warning fires when a result is >25% (timed) or >40% (other) from the athlete's last result, or from the team's middle result on a first test. Team change between test days = mean of each athlete's own % change, same athletes only.
- High-school standards (`35-standards.js`): the coach's own chart (boys/girls, ages 14–18), not published norms; keep the numbers exactly as the coach gave them.
  - A result reaches a level at the number where the chart starts it (lower-is-better: Average/Good include their number, Elite is "under"). Results in a gap count as the lower level. Grading uses the value rounded to the shown decimals (heights to 0.1 in).
  - Heights are graded in inches (the chart's primary unit); metric display shows the converted numbers.
  - IMTP net/gross (`imtpBasis()` / `imtpGrossOf()` in `30-science.js`): OVR Force mode shows Net Peak Force (above body weight), Free mode Gross. DSI always uses gross ÷ gross (CMJ peak force is taken as gross). Relative IMTP forces are force above body weight ÷ body weight; that is the only reading the chart's relative numbers fit (force at 100 ms can't be below 1 × BW standing on the plate). IMTP peak force in newtons (`gross: true`) is graded as total force: only then do the chart's newton and relative bands agree at high-school body masses (boys' Good: 2,300 N and 2.3 × BW match at 71 kg; as net force only at 102 kg). A net value needs the test's body mass, else `stdEval` returns `need: 'bm'`. The leaderboard cache (`TM_CACHE`) is kept per setting.
  - Evidence flags on `HS_STD`: `prov` (mRSI, time to takeoff: the bands don't fit published data; mRSI bands are about half of jump height ÷ time to takeoff for the chart's own height and TTT bands) and `lowRel` (IMTP impulse and RFD; Keogh et al. 2020). Flagged results show with a tag but `stdGraded()` excludes them from counts, priorities, needs attention and reports. `ev` / `refs` hold the evidence text and sources.
  - Training priorities (`36-priorities.js`) are rule-based and cite `REFS`; only graded results (14–18, sex known, not flagged) trigger them. Keep each rule's research link when changing it. `focus` is the plain line used in parent reports.
  - Outside ages 14–18 the levels are shown as reference only; no sex → no grade.
  - The IMTP standards (`iso: 'IMTP'`) grade IMTP tests only (`stdIsoOk`); a test with no type saved counts as IMTP.
- Force plate tests in sessions (`62-fptests.js`): trial metrics are averaged (as in the evaluation and team testing), the rest are typed once. Tests that don't share a metric (or a different isometric type) go in one record so DSI, EUR and arm swing work.
- PRs: the best result ever, judged on the value as shown (rounded), for metrics with a direction that the leaderboard ranks (`LB_EXCLUDE` left out). Isometric forces are kept apart by isometric type. A PR needs an earlier result. Lift rep PR = heavier than any earlier set with at least as many reps (session logs, VBT sets, tested maxes).
- Trends (`metricTrend`): the latest result vs the mean of up to 3 earlier results from the 6 months before it; meaningful only when the change is at least the test's typical error (`te`, Hopkins 2000). 3+ tests over 6+ weeks with no meaningful change = plateau. Priorities: a declining weak result ranks higher, an improving one lower, a plateau suggests changing the stimulus. A drop with a load spike (acute:chronic ≥ 1.5), a low readiness check or a slower take-off is read as fatigue first (Claudino 2017, Gathercole 2015, Gabbett 2016).
- Reports: change is measured from each test's first result by default (`baseline: 'first'`), or from the last result before the period.
- Training stimulus (`89u-stim.js`): sets are classified by NSCA load–rep goals (Haff & Triplett 2016).
  - %1RM comes from the prescription, or from load ÷ 1RM, or from reps + RIR.
  - If RIR is missing it is estimated from reps possible at that %1RM.
  - Category overrides: Olympic lifts = power; jumps, sprints and plyometrics = speed; core, mobility and conditioning are excluded.

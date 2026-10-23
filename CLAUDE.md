# Performance HQ: maintenance guide

Private coaching app for **Gilligan Sports Performance**, used only by the coach on an iPhone and a Mac. It is an offline-first web app (PWA) hosted on GitHub Pages from `docs/` on `main`. Live: https://gilligansportsperformance-beep.github.io/gsp-hq/

## Golden rules
1. **Never break existing data.** Coach data lives in each device's IndexedDB and in an encrypted sync file. New fields must be optional. Old records must keep loading through `normalizeState()` / `cleanRecord()` in `src/js/00-core.js`.
2. **No third-party runtime code.** Don't add CDNs, npm runtime libraries or external fonts. Everything is self-contained so it works offline and can't break when someone else's library changes. The Content Security Policy (`build.mjs`) only allows the app's own script.
3. **Escape all user text** with `esc()` when building HTML. Structural fields (ids, colours, enums) are validated on load and import in `cleanRecord()` / `cleanSettings()`. Extend those when you add new enum or id fields.
4. **Run `npm test` before every push.** All suites must pass.
5. **Write for the coach.** Plain language in the UI, iPhone-friendly layouts (check 390 px wide), and research citations for any sports-science claim (add them to `REFS`).

## Layout
- `src/index.html`: HTML shell. `build.mjs` inlines `src/styles.css` and every `src/js/*.js` (in filename order) into `docs/index.html`, computes the CSP script hash and versions the service worker cache.
- `src/sw.js`: offline service worker (network-first for the page, cache-first for assets).
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
  - `88-leaderboard.js`: leaderboard and GSP records. `89-eval.js`: estimated 1RM engine (4 lifts) and the Evaluation tab profile quadrant. `90-main.js`: sample data, onboarding, shell, `boot()`.

## Data model (collections in `COLS`)
`athletes, events, tests, exercises, workouts, vbt, maxes, notes, reports`. Every record has `id`, `createdAt` and `updatedAt`. Sync merges by `updatedAt`; deletions are tombstones in `S.deleted`. Settings listed in `SHARED_SETTINGS` sync between devices (newest `settingsAt` wins). Lock, theme and backup settings stay on each device (`LOCAL_ONLY`). Secrets (Anthropic key, GitHub token, sync passphrase) are stored separately in IndexedDB keys `aiKey` / `syncCfg`. **Never put them in `S`.**

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

# Performance HQ

A private sports-performance app for iPhone and Mac. It installs like a normal app, works fully offline, and keeps all data on your device.

## What's in it
- **Dashboard**: today's sessions, programmed workouts, upcoming evaluations, flags, recent testing, backup reminder.
- **Calendar**: month, week and list views. Sessions, evaluations, consults and other events, with weekly repeats, statuses and filters.
- **Athletes**: profiles with an overview, testing (sprint, jumps, RSI, force plate), a program calendar, VBT, sessions and notes.
- **Testing**: trend charts for every metric. Changes count as "meaningful" only when they exceed that test's typical error. DSI, EUR, RSI, RSI-mod, max velocity and relative force/power are calculated automatically.
- **Programming**: workouts on a calendar per athlete. Intensity can be a load, %1RM, a velocity zone, a target velocity or RPE, plus a velocity-loss cut-off. Workouts can be repeated weekly, duplicated, copied a week at a time, and completed with session-RPE.
- **Exercise library**: your own exercises, with cues, equipment, video link, VBT on/off and minimum velocity threshold. An optional starter set of 60 is included.
- **VBT**: set logging (rep-by-rep velocities give velocity loss automatically), load–velocity profiles, estimated 1RM, %1RM ↔ velocity tables, velocity zones and a velocity-loss calculator.
- **Insights**: rule-based suggestions, each linked to its peer-reviewed source (Settings → Methods & references).
- **Privacy**: optional passcode lock with auto-lock. Data never leaves the device.

### New in v1.1
- **Progress reports**: branded (logo, black & gold, your fonts) and customizable: sections, period, charts, coach's assessment and next focus. Drafts are generated from the data. Print / Save PDF or share as a file.
- **Force Plate AI**: an OVR Force metric guide, an athlete analyzer (output vs strategy, braking, propulsion, isometric, DSI, asymmetry, and "what may be missing"), and an optional chat. The chat answers from a built-in knowledge base offline, or uses Claude when you add your own Anthropic API key (stored on the device only; athlete names are never sent).
- **OVR Force fields** in testing: takeoff velocity, mRSI, time to takeoff, countermovement depth, braking and propulsive force/impulse/RFD, asymmetries with side, and Force-mode isometric metrics.
- **Session logger**: log every set (load, reps, rep velocities, RPE) during training. Velocity sets save to the athlete's VBT section, which shows session history, the L–V profile and an estimated-1RM trend.
- **Group testing grid** for weekly speed testing.
- **Training philosophy** page, used in reports and by the AI.
- **Exercise library** expanded to 226 exercises.
- **Brand appearance** option (black & gold).

### New in v1.2
- **Sync iPhone ↔ Mac** (Settings → Sync): automatic and end-to-end encrypted with your passphrase, stored in a private GitHub repository you own. Works offline and catches up when you reconnect. Edits from both devices merge, and deletions carry across.
- **Weekly backup routine**: a reminder schedule (weekly, every 2 weeks or monthly), plus steps for saving straight to iCloud Drive.
- **Import results** (Athletes → Import): reads any CSV/spreadsheet export, such as OVR Connect. Columns and units are detected automatically, you can filter rows by test type, multiple trials are combined, names are matched, and your mapping is remembered.
- **Gym Floor mode**: today's sessions with a live clock, per-athlete attendance, one-tap Log / Quick test / Note, and a keep-screen-on option.
- **Leaderboard & all-time GSP records**: rankings for every test and tested 1RM, filtered by period, sex, age group and sport, with a podium. Records update instantly, including record history and a "new record" alert on the dashboard.

## Putting it on your iPhone and Mac (one-time, ~10 minutes, free)
The app needs to be served once from a secure (https) web address. After that it runs offline.

**GitHub Pages (free):**
1. Create a free account at github.com and click **New repository**. Name it something like `phq`.
2. Click **uploading an existing file**, drag in **everything inside the `docs` folder** (index.html, sw.js, manifest.webmanifest, the icons folder), then **Commit**.
3. Go to **Settings → Pages**, set Source to **Deploy from a branch**, pick `main` and `/ (root)`, then **Save**.
4. After about a minute your app is at `https://YOUR-USERNAME.github.io/phq/`.

Note: free GitHub Pages needs a public repository. That makes only the app's code public. Your athletes' data is never uploaded anywhere; it lives only on your devices.

**Install:**
- **iPhone:** open the link in **Safari** → **Share** → **Add to Home Screen**.
- **Mac:** open the link in **Safari** → **File → Add to Dock** (macOS Sonoma or later).

## Moving data between iPhone and Mac
The easiest way is **Settings → Sync** (v1.2). Without sync, each device keeps its own copy. In **Settings → Backup & sync**, tap **Export backup** on one device. Send the file with AirDrop or iCloud Drive, then use **Import backup → Merge** on the other device. Merging keeps the newest version of every record and carries deletions across.
Export a backup regularly; the dashboard reminds you every 14 days.

## Developing
See **CLAUDE.md** for the full maintenance guide. Run `npm test` before every push (it builds the app and runs all end-to-end suites).

Source lives in `src/` (fonts in `src/fonts`, all SIL Open Font License). Run `node build.mjs` to rebuild `docs/`, which contains a single self-contained `index.html` plus the offline service worker.

### New in v1.3
- **Estimated 1RM** for back squat, front squat, bench press and trap bar deadlift, calculated only from your data:
  - **Load–velocity method**: the fastest rep (or a set average of 1–2 reps) at 3+ loads from the last 6 weeks, extrapolated to the athlete's velocity threshold. The threshold comes from, in order: the measured velocity of their tested 1RM rep, a calibration from their tested max, or the research value.
  - **Reps × RPE method**: sets with RPE ≥7 and ≤10 reps to failure, using the mean of the Epley and Brzycki equations.
  - Both methods are combined by confidence, and the app warns when they disagree by more than 8%. A tested max from the last 4 weeks is used as-is.
  - A **1RM profile test** entry is included, and the same numbers feed %1RM prescriptions and reports.
- **Evaluation tab** on each athlete: CMJ, squat jump and IMTP entered trial by trial, with trial-quality checks (CV, the IMTP 250 N rule). It places the athlete as **Elastic, Strength, Eccentric, Concentric** or Balanced using DSI (Sheppard 2011) and EUR (McGuigan 2006), with history, training priorities and supporting OVR data. The profile also appears in progress reports.

### New in v1.4
- **Cloud backups** (Settings → Sync → Cloud backups): every sync is kept as an encrypted version. You can preview any version and restore it on all devices, and a restore can be undone.
- **Custom tests** (Settings → Custom tests): add your own tests with a name, type of result, unit and whether higher or lower is better. They appear in test entry, group testing, gym floor, charts, the leaderboard and records, reports, and CSV import/export.
- **Security hardening**:
  - A strict browser security policy: only the app's own code can run, and it can only connect to Anthropic and GitHub.
  - All imported or synced data is validated.
  - Passcode lock-out after 5 wrong tries.
  - Sync token expiry reminders and a Security checklist in Settings.
- **Automated tests in the repository** (`npm test`, 8 suites) and a maintenance guide (`CLAUDE.md`).

### New in v1.5
- **RIR ↔ bar speed.** "Reps in reserve" is now an intensity option, and any load or %1RM prescription can have an RIR stop. For each exercise the app shows the expected speed of every rep, the speed at which to stop the set, and the expected set average.
  - Back squat uses the GSP reference chart. Other lifts take your own chart (VBT page → RIR ↔ bar speed → Edit chart).
  - Each athlete's chart personalises itself after 3 sets logged with each rep's speed and an RPE.
  - While logging, each set shows its estimated RIR and flags when the stop speed was reached early. Based on Morán-Navarro et al. 2019.
- **Weight for every set.**
  - Prescribe one load or a load per set (e.g. `185, 205, 225`).
  - In the session log, changing a weight fills the sets below it until you edit those, and each exercise shows "Last time".
  - Unsaved entries are kept on the device, so you can switch between athletes mid-session.
  - One-tap **Log** buttons on the dashboard and the athlete header.
- **Readiness check every visit**: CMJ (jump height, optional mRSI) or an overcoming isometric (mid-thigh pull, isometric squat, other).
  - It's built into the session log and Gym Floor. Each check is compared with the athlete's own recent normal and rated Ready, Slightly down or Fatigued, with what to change today.
  - Checks are kept separate from test results.
- **Training stimulus** on each athlete's Overview: what the last 4 weeks of programming target (strength, power, hypertrophy, speed & reactive, endurance), the trend vs the previous block, sets per week and average RIR. An optional AI summary is available when Claude is connected.
- **Percentiles**:
  - Each athlete is ranked against GSP athletes of the same sex and age group (and sport when 5+ share it), showing group size and reliability.
  - Each athlete is also placed against published norm tables you load, with the source required. Tables can be added one at a time or pasted in bulk.
  - Also shown on the Evaluation tab.
- **10 yd sprint** and **flying 10 yd** tests (max velocity is calculated from the flying 10 yd). The CSV import now recognises these, 5-10-5, broad, vertical, depth jump and RSI columns, keeps every trial, and matches athletes by first name when that's unique.
- Fixed: some two-column pages could be wider than an iPhone screen.

## Security & privacy summary
- **No servers or logins to hack.** Data lives on your devices. The optional cloud copy is encrypted on the device (AES-256-GCM, with the key derived from your passphrase) before it reaches your private GitHub repository.
- **No third-party code** runs in the app. A hash-pinned Content Security Policy blocks injected scripts and stops data being sent anywhere except Anthropic (only if you use the AI) and GitHub (sync).
- **Secrets stay on the device**: the API key, token and passphrase are never included in backups or synced data. Athlete names are never sent to the AI.
- **Your part**: turn on the passcode lock and your device passcode/Face ID, enable two-factor authentication on GitHub, set a spending limit on your Anthropic key, and keep your sync passphrase in a password manager.


# GSP HQ

Gilligan Sports Performance's private coaching app for iPhone and Mac. It installs like a normal app, works fully offline, and keeps all data on your device.

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
**Sync (recommended, v1.6 setup):**
1. On the device that has your data (usually the Mac), go to **Settings → Sync → Set up sync** and follow the 3 steps: create a private GitHub repository, create an access key, choose a sync passphrase.
2. The app then shows a **setup code**. Send it to your other device (AirDrop, Messages or Universal Clipboard).
3. On the other device, open the app and tap **Connect to my other device** (on the welcome screen or the empty dashboard), or go to **Settings → Sync → Connect with setup code**. Paste the code and type your passphrase. Everything downloads, and from then on changes sync both ways automatically.
4. Set a **security code** (Settings → Privacy). It applies on all synced devices and is asked for every time the app opens. If you forget it, **Forgot?** on the lock screen resets it with your sync passphrase.

**Without sync**, each device keeps its own copy. Without sync, each device keeps its own copy. In **Settings → Backup & sync**, tap **Export backup** on one device. Send the file with AirDrop or iCloud Drive, then use **Import backup → Merge** on the other device. Merging keeps the newest version of every record and carries deletions across.
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

### New in v1.6
- **Easy device pairing.** Set up sync once, then connect the other device with an encrypted setup code; no GitHub details to retype. A device joining never overwrites your settings, and sample data is left out.
- **One security code for all devices.** It syncs, is asked for each time the app opens, and can be reset with the sync passphrase.
- **New GSP look**:
  - Black, warm white and gold, with DM Sans and Bebas Neue type.
  - A dark sidebar, a branded dashboard header and new GSP app icons.
  - Now called **GSP HQ**.
- Fixed: the lock screen's **Forgot?** dialog opened behind the lock screen.

### New in v1.7
- **Research AI** (menu → Research AI): ask any strength & conditioning question.
  - Before answering, it searches the research (meta-analyses and position statements first), opens and reads the key papers, cross-checks them and rates the certainty.
  - Answers come as a bottom line, what the research shows, how to apply it, certainty and references.
  - Every reference link is checked against the pages it actually found (✓ or ⚠), and ↗ links quoted passages to their source.
  - Answers are kept on the device. It needs the internet and your Anthropic key; no athlete data is sent.
- **Force Plate AI** stays focused on force plates and points other questions to Research AI.
- **Opens instantly, even offline or on a weak signal.** The app starts from the copy saved on the device and downloads updates in the background, with an **Update** button when a new version is ready.
- **Save status on the phone**: the top bar shows Synced / Saved / Offline · saved. Leaving the app uploads changes straight away.
- **Remembers the device**: the setup code and passphrase are asked for once per device, then only the security code. The phone is asked to keep the app's data permanently, and the app warns when it's open in a Safari tab instead of the Home Screen app.

### New in v1.8
- **Evaluation form**:
  - The most useful force-plate metrics are shown by default: jump height, peak propulsive force, mRSI, time to takeoff, braking RFD, countermovement depth, braking/propulsive asymmetry, and IMTP force at 100 ms.
  - Any other OVR metric can be added with **+ Add metric**, and stays in the form until you remove it.
  - Tap any past evaluation to edit it.
- **Single-leg IMTP** and **isometric calf push** for each leg, with asymmetry (stronger − weaker ÷ stronger), the stronger side and relative strength. A **Single-leg strength** card is on the Evaluation tab, and asymmetry over 10% is flagged in insights.
- **Movement screen**: overhead squat, lateral lunge, forward lunge with PVC and FRC CARs series. Each is scored 1–5 with notes, totalled and compared with the previous screen.
- **Age bands** for the leaderboard and percentiles: 11 & under, 12–13, 14–15 … 28–29, 30+.
- v1.8.1:
  - The movement screen comes first in the evaluation (form and Evaluation tab).
  - New **Speed & agility** section: 0–10 yd, 5 yd build + 10 yd fly and pro agility, 2 trials each. The fastest trial counts, and the 10-yard tests accept the timer's split or its MPH.
  - Speed & agility card on the Evaluation tab.

### New in v1.9
- **Team Testing** (its own section in the menu):
  - **Teams**: save a roster once. Pick existing athletes or paste new ones, one per line ("Jane Smith, F, 4/12/2010"; spreadsheet columns work too). Teams can also be made from the Team / school field.
  - **Test days**: pick the tests (or a quick pick such as Speed & agility), the number of trials, and whether the best or the average trial counts. Speed tests keep the best trial and force-plate trials are averaged by default, the same as the evaluation.
  - **By athlete**: one athlete at a time with every test, then **Next**. **By test**: one station with the whole team in a list. Results save as you go (offline too), absent athletes are marked, and a progress bar shows who is left.
  - While entering, each result shows the athlete's last result and PB, flags a new PB, and warns about likely typos. The 10-yard tests accept seconds or the timer's MPH.
  - **Results**: rankings per test, team average, personal bests, who improved or dropped beyond normal test noise, a full table, CSV export and print. The team page shows the team's progress between test days (same athletes only).
  - Every result is saved as that athlete's own test, so it appears on their profile, charts, leaderboard and percentiles.
- Fix: custom tests measured in weight now save correctly in lb.
- v1.9.1: **Faster adding of new athletes**:
  - A new team asks for Girls / Boys / Mixed, then goes straight to **Add athletes**: type a first and last name, tap **Add** (or press return), repeat. Each athlete is saved as soon as you add them.
  - Sex is filled in from the team, the birth date is optional and formats itself as you type (04122010 → 04/12/2010), names are capitalised, and names already in GSP HQ are added without making a duplicate. × undoes a mistake.
  - **Paste a list** from a spreadsheet, or tick athletes who are already in GSP HQ.
  - During a test day, the **+** button adds a walk-up to the team and the test day and jumps straight to them. Missing sex or birth date can be filled in from the test screen.

## Security & privacy summary
- **No servers or logins to hack.** Data lives on your devices. The optional cloud copy is encrypted on the device (AES-256-GCM, with the key derived from your passphrase) before it reaches your private GitHub repository.
- **No third-party code** runs in the app. A hash-pinned Content Security Policy blocks injected scripts and stops data being sent anywhere except Anthropic (only if you use the AI) and GitHub (sync).
- **Secrets stay on the device**: the API key, token and passphrase are never included in backups or synced data. Athlete names are never sent to the AI.
- **Your part**: turn on the passcode lock and your device passcode/Face ID, enable two-factor authentication on GitHub, set a spending limit on your Anthropic key, and keep your sync passphrase in a password manager.


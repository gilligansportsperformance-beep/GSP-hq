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
Each device keeps its own copy. In **Settings → Backup & sync**, tap **Export backup** on one device. Send the file with AirDrop or iCloud Drive, then use **Import backup → Merge** on the other device. Merging keeps the newest version of every record and carries deletions across.
Export a backup regularly; the dashboard reminds you every 14 days.

## Developing
Source lives in `src/`. Run `node build.mjs` to rebuild `docs/`, which contains a single self-contained `index.html` plus the offline service worker.

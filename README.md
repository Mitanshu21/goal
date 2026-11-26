# Goals

A personal tasks and goals app. It has two screens and runs entirely in the browser: no server and no database to pay for. It installs on your phone like a normal app, and your data is backed up to **your own Google Drive** automatically.

- **Today**: tasks with deadlines. Type them naturally, like `Call mom tomorrow 6pm` or `Call dad every sunday` (see [What you can type](#what-you-can-type)). Late tasks turn red and have a one-tap **Tomorrow** button. Repeating tasks add the next one when you tick them. Tap a task to edit it.
- **Goals**: four kinds of goal, and each one tells you whether you're on track.
  - **Save money**: target amount + month. It shows how far ahead or behind you are and how much to save each month.
  - **Stay under**: e.g. smoke at most 10 a month. One tap logs one, and it shows how many you have left and how many days since the last one.
  - **Do it often**: e.g. gym 4× a week. One tap logs today, and you see the week and the last 8 weeks.
  - **Finish by a date**: progress comes from the tasks linked to the goal.
- Shows the goals you've finished this year and this quarter.

The design files are in `design/` (`v3-simple.html` is the one this app follows).

---

## Run it on your computer

```bash
npm install
cp .env.example .env.local     # then paste your Google client ID (next section)
npm run dev                    # opens http://localhost:5180
```

The app works without a client ID too, but then it only saves on that device.

## Google Drive setup (one time, about 5 minutes)

1. Go to <https://console.cloud.google.com/> and create a project, e.g. "Goals app".
2. **APIs & Services → Library** → search **Google Drive API** → **Enable**.
3. **APIs & Services → OAuth consent screen** (now called **Google Auth Platform**):
   - User type **External**, app name "Goals", your email as the support and developer contact.
   - **Data access / Scopes**: add `.../auth/drive.file`. This lets the app see only the files it creates, nothing else in your Drive.
   - **Audience / Test users**: add your own Google account.
   - You can leave the app in **Testing** mode, because it's only for you. (In Testing mode Google may ask you to sign in again about once a week. To stop that, press **Publish app**. For the `drive.file` scope this doesn't need Google's review, but you'll see an "unverified app" notice once.)
4. **Credentials → Create credentials → OAuth client ID** → type **Web application**.
   - **Authorized JavaScript origins**: add
     - `http://localhost:5180`
     - your Vercel URL, e.g. `https://goals-yourname.vercel.app` (add it after the first deploy)
   - You don't need any redirect URIs.
5. Copy the **Client ID** into `.env.local` as `VITE_GOOGLE_CLIENT_ID=...` and restart `npm run dev`.
6. In the app, tap the **cloud icon** (top right) → **Connect Google Drive**.

The app creates this in your Drive:

```
My Drive / Goal App / goal-app-data.json         ← live data
My Drive / Goal App / Backups / backup-YYYY-MM-DD.json   ← one copy per day, last 30 kept
```

## Deploy free on Vercel

1. Push this folder to a GitHub repo (private is fine).
2. On <https://vercel.com> → **Add New → Project** → import the repo. Vercel detects Vite by itself (build: `npm run build`, output: `dist`).
3. Under **Environment Variables**, add `VITE_GOOGLE_CLIENT_ID` with your client ID, then **Deploy**.
4. Add the Vercel URL to **Authorized JavaScript origins** in Google Cloud (step 4 above).

Or from the terminal: `npx vercel` and then `npx vercel --prod`.

## Install on your phone

- **Android (Chrome)**: open your Vercel URL → menu ⋮ → **Install app**.
- **iPhone (Safari)**: open the URL → Share → **Add to Home Screen**.

It opens full-screen like a normal app and works offline. Changes sync the next time you're online.

> iPhone note: an app added to the home screen keeps its own storage, separate from Safari. Connect Google Drive once **inside the installed app**. If Google's sign-in window doesn't come back to the app, use the app in Safari for that one sign-in, then reopen the home-screen app.

## How sync works

- Every change is saved instantly on the device (IndexedDB). The app never waits for the network.
- About 2.5 seconds after a change, and whenever you open the app, it merges with the file in Drive. Every task, goal and log has its own id and "last edited" time. If you edit on your phone and your laptop, both edits are kept, and when the same item was changed in both places, the newer edit wins. Deletes sync too.
- Google gives a browser-only app a sign-in token that lasts about **1 hour**, and it can't be renewed silently in the background. When it runs out, the next time you tap anywhere the app quietly asks Google for a new one, and a small window may flash. If that doesn't work, the cloud icon turns orange: tap it → **Continue syncing**. Your data is always safe on the device in the meantime.
- **Export file / Import file** in the cloud sheet give you a manual JSON backup. Importing merges, it doesn't overwrite.

## What you can type

| You type | Result |
|---|---|
| `Call mom tomorrow 6pm` | Call mom · Tomorrow · 6 pm |
| `Text Sam friday at 7:30pm` | Text Sam · next Friday · 7:30 pm |
| `Pay rent next week` | Pay rent · in 7 days |
| `Buy milk tonight` | Buy milk · Today · 8 pm |
| `Take vitamins daily` | repeats every day |
| `Call dad every sunday` | repeats every Sunday |
| `Gym 18:30` | Today · 6:30 pm |

## Tech

- Vite + React + TypeScript, built as a PWA with `vite-plugin-pwa` (installable, works offline).
- Data: IndexedDB through `idb-keyval`. Sync: Google Identity Services token client + Drive REST API v3, called straight from the browser.
- Code layout:
  - `src/lib/`: data model, store, date parsing, goal math, Drive and sync
  - `src/components/`: screens and sheets

# StudyOffline

An offline-first learning companion for ALU students. Read lessons and take
notes with **no internet**. Everything syncs to your account when you are
back online.


- **Live app:** https://studyoffline-9fgo.netlify.app/
- **Live app:** https://studyoffline-9fgo.netlify.app
- **Demo video:** PASTE_VIDEO_LINK_HERE
- **SRS document:** PASTE_SRS_LINK_HERE

Built with plain HTML, CSS and JavaScript (no build step) and a
[Supabase](https://supabase.com) backend (accounts + database).

---

## 1. Use the live app (no setup)

1. Open the live app link above in Chrome, Edge, Firefox or Safari.
2. Click **Register**, create an account, and wait until the lessons appear marked "Stored".
3. Turn off your internet (or open **Demo tools → Simulate offline**) and keep working.

On a phone: open the link, then use the browser menu "Install app" (Android, Chrome) or Share → "Add to Home Screen" (iPhone, Safari).

---

## 2. Run it on your own computer (every step)

### 2.1 What you need
- A web browser (Chrome, Edge or Firefox).
- [VS Code](https://code.visualstudio.com) with the **Live Server** extension (or Python 3).
- A free [Supabase](https://supabase.com) account.
- Git (to download the code), or use the green **Code → Download ZIP** button on GitHub.

### 2.2 Get the code
```bash
git clone https://github.com/aurore017/studyoffline.git
cd studyoffline
```

### 2.3 Create the Supabase backend
1. Go to <https://supabase.com>, sign up, and click **New project**. Name it `studyoffline`, choose a database password, and wait until the project is ready.
2. Open **SQL Editor → New query**. Copy the whole file `database/supabase_setup.sql` from this repository, paste it in, and click **Run**. It creates the `lessons` and `notes` tables, the permissions (GRANT lines), the Row Level Security rules, and the six lessons.
3. Open **Authentication → Sign In / Providers → Email** and switch **Confirm email** **off**, then **Save** (so new accounts can log in straight away).
4. Open **Project Settings → Data API** and copy the **Project URL** (it looks like `https://xxxx.supabase.co`, with nothing after `.supabase.co`).
5. Open **Project Settings → API Keys** and copy the **Publishable key** (`sb_publishable_...`, or the legacy `anon` key).
   Never use the `secret` or `service_role` key in this app.

### 2.4 Connect the app to your Supabase project
Open `js/config.js` and replace the two placeholder values:
```js
SUPABASE_URL: 'https://xxxx.supabase.co',
SUPABASE_KEY: 'sb_publishable_...'
```
(If you leave the `PASTE_...` text in place, the app runs with a simulated server inside the browser, so you can still try it without Supabase.)

### 2.5 Start the app
- **VS Code:** right-click `index.html` → **Open with Live Server**.
- **Or Python:** run `python -m http.server 8000` in the project folder (on Mac/Linux: `python3 ...`), then open <http://localhost:8000>.

(The service worker, which lets the app open with no internet, needs `http://` or `https://`. Opening `index.html` by double-click works for the basics but not for offline opening.)

### 2.6 Check that it works
1. Click **Register**, create an account, and wait for the lessons to show "Stored ✓".
2. Write a note. After a few seconds it shows **Synced**.
3. In Supabase, open **Authentication → Users** (your account) and **Table Editor → notes** (your note).

---

## 3. Deploy it (public URL)

1. Create a free account on [Netlify](https://www.netlify.com).
2. **Add new site → Import an existing project → GitHub**, choose this repository.
3. Leave the build command empty and set the publish directory to `.`
4. Deploy. Netlify gives you a public `https://....netlify.app` address, and every push to `main` redeploys it.

When you change app files, also change `CACHE_VERSION` in `sw.js`, so devices download the new files.

---

## 4. Demo script (2 minutes)

1. Register an account (needs internet). Lessons appear marked "Stored".
2. Open **Demo tools** (top right) and tick **Simulate offline**. The pill turns orange.
3. Write a note. The status goes "Typing…" then "Saved on this device · not yet synced". The bar shows "1 note waiting to sync".
4. Reload the page. The app and your note are still there.
5. Untick **Simulate offline**. The note syncs by itself, "Last synced" updates, and the note shows "Synced · time".
6. Tick **Simulate server failure**, write another note: it stays safe on the device and the app retries. Untick it and press **Sync now**.
7. Use the search box over the notes, and the **A− / A+** buttons to change text size.
8. Click **Sync history** to show the audit report (and download it as CSV).

---

## 5. Where each part of the design lives

| Diagram component / class | File | Requirements |
|---|---|---|
| User Interface | `index.html`, `css/style.css`, `js/ui.js` | FR 2.2, 3, 4.2, 4.3, NFR 3, NFR 7 |
| Authentication, Session | `js/auth.js` | FR 1, NFR 1 |
| Content Manager (Lesson, Note, NoteStatus) | `js/content.js` | FR 2, FR 3, NFR 2 |
| Sync Manager | `js/sync.js` | FR 4.2, FR 5 |
| ConnectivityMonitor | `js/network.js` | FR 4.1 |
| Local Store (LocalStore) | `js/store.js` | FR 2, FR 3.1, NFR 6 |
| Audit Logger (AuditLog) | `js/audit.js` | NFR 4 |
| Account Server (external): Supabase | `js/server.js`, `js/config.js`, `database/supabase_setup.sql` | FR 1, FR 2.1, FR 5.1 |
| Simulated server (fallback without keys) | `js/server-sim.js` | testing |
| Opening the app with no internet | `sw.js`, `manifest.webmanifest` | NFR 2, NFR 6 |

Load order of the scripts is in `index.html` (each file uses the ones above it).

## 6. Requirements checklist

- FR 1 Login: register and log in with Supabase accounts; the session stays on the device; offline login works after the first online login.
- FR 2 Lessons: downloaded once while online, stored, shown with no network call.
- FR 3 Notes: new, edit, delete, search; auto-saved 0.5 s after you stop typing.
- FR 4 Connection status: online/offline pill, number of notes waiting, "Last synced" time, per-note "Synced · time".
- FR 5 Sync: automatic on reconnect, **Sync now** button, retry after a server failure.
- NFR 1: the password is never stored on the device as plain text (SHA-256 fingerprint for offline login); Supabase handles passwords over HTTPS.
- NFR 2: stored lessons open in a few milliseconds.
- NFR 3: English text; the offline/online status changes straight away.
- NFR 4: every save, edit, delete and sync is timestamped; **Sync history** + CSV download.
- NFR 5: tested in Chromium; tested on iPhone (Safari).
- NFR 6: works on PC and phone; notes are kept on the device and never lost when the connection drops.
- NFR 7: **A−** / **A+** buttons change the text size; the layout fits small screens.

## 7. The four note states (state machine B.4)

`UNSAVED` (typing) → `SAVED_LOCALLY` (0.5 s pause) → `SYNCED` (database accepted).
Editing goes back to `UNSAVED`. Deleting makes it `PENDING_DELETION` until the
deletion reaches the account, then it is removed (see `js/store.js`, `markSynced`).

## 8. Known limits (honest list)

- Sync sends notes **to** the account. Downloading your notes onto a second device is not built yet.
- Facilitator and System Administrator screens are not built (they are "later release" in the SRS).
- Logging out keeps the Supabase login on the device, so notes written offline can still sync later. On a shared computer, clear the site data after use.
- Supabase free projects pause after about 7 days without activity; open the dashboard and click **Restore** if that happens.
- Row Level Security keeps each student's notes private, but the app has not had a full security review.

## 9. Challenges we met

- Offline status: the first connectivity check treated a slow answer as "offline"; it now counts any answer from the server as online.
- Accounts on iPhone: the Safari tab and the Home Screen app keep separate storage, so an account made in one is not visible in the other.
- Supabase changed its 2026 defaults: new tables are no longer open to the app until GRANT permissions are added (included in `database/supabase_setup.sql`).
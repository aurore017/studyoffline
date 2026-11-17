# StudyOffline (Sprint 2 prototype)

An offline-first learning companion for ALU students. Read lessons and take
notes with **no internet**. Everything syncs to your account when you are
back online.

Built with plain HTML, CSS and JavaScript. No installs, no build step.

## How to run it

**Option 1: quickest (no server).** Double-click `index.html`.
Everything works, except the "install on phone" feature and the offline
opening of the app itself (those need a web server).

**Option 2: full offline support (recommended).**
1. Open a terminal in this folder.
2. Run: `python3 -m http.server 8000` (on Windows: `python -m http.server 8000`)
3. Open <http://localhost:8000> in Chrome, Edge or Firefox.
4. Register, wait until you see the lessons, then reload once. Now the app
   files are saved on your device and the app opens even with the wifi off.

**Option 3: on your phone.** Put this folder on free hosting such as
Netlify Drop (drag and drop the folder on app.netlify.com/drop) or GitHub
Pages. Open the link on Android in Chrome, then use the browser menu
"Install app" / "Add to Home screen".

## Showing it to your facilitator (2 minutes)

1. Register an account (needs internet). Lessons appear marked "Stored".
2. Open **Demo tools** (top right) and tick **Simulate offline**. The pill turns orange.
3. Write a note. Watch the status go "Typing…" then "Saved on this device · not yet synced". The bar shows "1 note waiting to sync".
4. Reload the page. The app and your note are still there.
5. Untick **Simulate offline**. The note syncs by itself and shows "Synced · time".
6. Tick **Simulate server failure**, write another note: it stays safe on the device and the app tells you it will retry. Untick it and press **Sync now**.
7. Click **Sync history** to show the audit report (and download it as CSV).

## Where each part of the design lives

| Diagram component / class | File | Requirements |
|---|---|---|
| User Interface | `index.html`, `css/style.css`, `js/ui.js` | FR 2.2, 3, 4.2, 4.3, NFR 3, NFR 7 |
| Authentication, Session | `js/auth.js` | FR 1, NFR 1 |
| Content Manager (Lesson, Note, NoteStatus) | `js/content.js` | FR 2, FR 3, NFR 2 |
| Sync Manager | `js/sync.js` | FR 4.2, FR 5 |
| ConnectivityMonitor | `js/network.js` | FR 4.1 |
| Local Store (LocalStore) | `js/store.js` | FR 2, FR 3.1, NFR 6 |
| Audit Logger (AuditLog) | `js/audit.js` | NFR 4 |
| Account Server (external, **simulated**) | `js/server.js` | FR 1, FR 2.1, FR 5.1 |
| Opening the app with no internet | `sw.js`, `manifest.webmanifest` | NFR 2, NFR 6 |

Load order of the scripts is in `index.html` (each file uses the ones above it).

## Requirements checklist

- FR 1 Login: register and log in; the session stays on the device; offline login works after the first online login.
- FR 2 Lessons: downloaded once while online, stored, shown with no network call.
- FR 3 Notes: new, edit, delete; auto-saved 0.5 s after you stop typing.
- FR 4 Connection status: online/offline pill, number of notes waiting, per-note "Synced · time".
- FR 5 Sync: automatic on reconnect, **Sync now** button, retry after a server failure.
- NFR 1: the password is never stored or sent as plain text (SHA-256 fingerprint).
- NFR 2: stored lessons open in a few milliseconds (measured about 30 ms).
- NFR 3: English text; the offline/online status changes straight away.
- NFR 4: every save, edit, delete and sync is timestamped; **Sync history** + CSV download.
- NFR 5: tested in Chromium; the code uses nothing that Edge or Firefox lack.
- NFR 6: works on PC and Android; notes are kept on the device and never lost when the connection drops.
- NFR 7: **A-** / **A+** buttons change the text size; the layout fits small screens.

## The four note states (state machine B.4)

`UNSAVED` (typing) -> `SAVED_LOCALLY` (0.5 s pause) -> `SYNCED` (server accepted).
Editing goes back to `UNSAVED`. Deleting makes it `PENDING_DELETION` until the
deletion reaches the account, then it is removed (see `js/store.js`, `markSynced`).

## Honest limits (good to mention in your review)

- The **Account Server is simulated** in the browser (`js/server.js`), as the SRS says. Two different browsers do not share an "account". Replacing it with a real backend means rewriting only the functions in that one file.
- Password handling is prototype quality. A real server must use HTTPS and a slow password hash (bcrypt or argon2).
- Sync only sends notes **to** the account. Pulling notes onto a second device is a later sprint.
- If you change any file, change `CACHE_VERSION` in `sw.js` so devices fetch the new files.
- Facilitator and System Administrator screens are not built (they are "later release" in the SRS).

## Next sprints

1. Real backend (Supabase or Firebase) in place of `js/server.js`.
2. Pull notes onto a new device, and conflict handling.
3. Facilitator upload screen and administrator report.
4. Test on Edge, Firefox and a low-end Android phone.

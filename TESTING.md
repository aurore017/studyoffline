# StudyOffline: testing notes

Live app: https://studyoffline-9fgo.netlify.app

This file records what was tested by hand, on which devices, what worked, and the problems found along the way. Anything not listed here was not tested.

## 1. Test environments

| # | Device | Browser | How the app was opened |
|---|---|---|---|
| 1 | HP laptop (Windows 10) | Google Chrome | VS Code Live Server, `http://localhost:5500` |
| 2 | HP laptop (Windows 10) | Google Chrome | Live site on Netlify (HTTPS) |
| 3 | iPhone 14 [iOS 27.2.1] | Safari | Live site on Netlify

Backend: a Supabase project (accounts, `lessons` table, `notes` table, Row Level Security).

## 2. Manual test results

| # | What was tested | Expected result | Result |
|---|---|---|---|
| T1 | Register a new account (online) | Account created, lessons appear marked "Stored ✓" | Pass (laptop, localhost and live site) |
| T2 | Check the account in Supabase | The user appears under Authentication → Users | Pass |
| T3 | Log in with the new account (online) | Lessons and notes screen opens | Pass |
| T4 | Write a note (online) | Note shows "Saved on this device", then "Synced" | Pass |
| T5 | Check the note in Supabase | The note appears in the `notes` table | Pass |
| T6 | Wrong password at login | Message "Wrong email or password." | [FILL: Pass / not tested] |
| T7 | Register with an email already used | Message that the account already exists | [FILL: Pass / not tested] |
| T8 | Go offline, reopen the installed app | The app opens and lessons are readable with no internet | Pass (iPhone, airplane mode) [FILL: confirm] |
| T9 | Log in while offline (after one online login on that device) | Login works from the saved account | [FILL: Pass / not tested] |
| T10 | Write notes while offline | Notes show "Saved on this device · not yet synced"; the status bar counts them | [FILL: Pass / not tested] |
| T11 | Reconnect to the internet | Notes sync by themselves; "Last synced" time updates | [FILL: Pass / not tested] |
| T12 | Search box over notes | Only matching notes stay visible | [FILL: Pass / not tested] |
| T13 | Text size buttons (A− / A+) | Text becomes smaller or larger | [FILL: Pass / not tested] |
| T14 | Sync history report and CSV download | Report lists saves, edits, deletes and syncs | [FILL: Pass / not tested] |
| T15 | Live site opened in a private window (not signed in to Netlify) | The login screen opens | Pass |
| T16 | Delete a note, then sync | The note disappears from the app and from the `notes` table | [FILL: Pass / not tested] |

Edit the `[FILL ...]` cells to match what you really saw, then delete this note.

## 3. Problems found and how they were fixed

| Problem | Cause | Fix |
|---|---|---|
| The app showed "Offline" even with internet | The connection check treated a slow or odd answer from `ping.txt` as offline | Any answer from the server now counts as online; waiting time raised to 8 seconds |
| "Wrong email or password" on iPhone | The Safari tab and the Home Screen app keep separate storage, so an account created in one was not visible in the other | Register and test in one place only; documented in the README |
| "Invalid path specified in request URL" at registration | The Supabase address in `js/config.js` had extra text after `.supabase.co` | The app now keeps only the clean address; the config shows the correct format |
| "Your session has expired" when saving notes | Not a real expired session: new Supabase projects do not give tables to the app by default (permission denied) | Added GRANT statements to `database/supabase_setup.sql`; the app now shows the real database message |
| The live link asked for a Netlify sign-in | New Netlify projects are private by default | Changed the project visibility to Public |

## 4. Known limits (not tested or not built)

- Notes are uploaded to the account, but not yet downloaded to a second device.
- The Facilitator and System Administrator screens from the design are not built.
- Edge, Firefox and Android were not tested [FILL: edit if you tested any of them].
- No security review or load testing was done.

## 5. Automated checks during development

While the app was being built, automated browser checks (Playwright, Chromium) were run against the app with the help of an AI assistant (Claude). They covered registration, login, lessons, notes, offline queueing, sync and delete. They are not a replacement for the manual tests above. [Delete this section if you prefer to list manual tests only.]

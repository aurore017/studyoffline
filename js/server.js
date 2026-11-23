/* ==========================================================================
   ACCOUNT SERVER  (external system "Account Server" in the diagrams)
   --------------------------------------------------------------------------
   The real backend: Supabase (accounts + a Postgres database).

   This file keeps the SAME four functions the rest of the app already uses,
   so no other component had to change:
     IAccount  -> register(), login()
     ILessons  -> fetchLessons()
     ISync     -> pushNotes()

   If js/config.js has no Supabase keys yet (or the Supabase library did not
   load), the app falls back to the simulated server in js/server-sim.js.

   Where things live:
     - Accounts:  Supabase Auth (passwords are handled by Supabase over HTTPS).
     - Lessons:   table "lessons"  (read-only for signed-in students).
     - Notes:     table "notes"    (each student can only touch their own rows,
                                    enforced by Row Level Security).
   The Supabase library keeps its own login session on the device and renews
   it by itself while online, so the old 30-day token is only a placeholder.
   ========================================================================== */
window.SO = window.SO || {};

(function (SO) {
  'use strict';

  var cfg = SO.config || {};
  var DAY = 24 * 60 * 60 * 1000;
  var TOKEN_DAYS = 30;
  var failing = false;

  function isSet(v) { return typeof v === 'string' && v.length > 10 && v.indexOf('PASTE_') === -1; }
  var configured = isSet(cfg.SUPABASE_URL) && isSet(cfg.SUPABASE_KEY) &&
                   window.supabase && typeof window.supabase.createClient === 'function';

  /* ---------- fallback: the simulated server ---------- */
  if (!configured) {
    var sim = SO.ServerSim;
    SO.Server = {
      mode: 'simulated',
      setFailing: sim.setFailing,
      isFailing: sim.isFailing,
      register: function (name, email, password, hash) { return sim.register(name, email, hash); },
      login: function (email, password, hash) { return sim.login(email, hash); },
      fetchLessons: sim.fetchLessons,
      pushNotes: sim.pushNotes,
      peek: sim.peek
    };
    return;
  }

  /* ---------- real backend ---------- */
  // Keep only "https://xxxx.supabase.co": remove spaces and anything after it
  // (for example a copied "/rest/v1/" ending, which causes "Invalid path specified in request URL").
  var baseUrl = String(cfg.SUPABASE_URL).trim();
  try { baseUrl = new URL(baseUrl).origin; } catch (e) { /* keep as typed */ }

  var sb = window.supabase.createClient(baseUrl, String(cfg.SUPABASE_KEY).trim(), {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });

  // Our own error type. code: 'NETWORK' | 'SERVER' | 'AUTH' | 'BAD_CREDENTIALS' | 'EMAIL_TAKEN' | 'CONFIRM_EMAIL' | 'INVALID'
  function makeError(code, message) {
    var e = new Error(message);
    e.code = code;
    e.so = true;
    return e;
  }

  // Turn whatever Supabase (or the browser) reports into one of our error codes.
  function mapError(err) {
    if (err && err.so) return err;
    err = err || {};
    var msg = String(err.message || '');
    var low = msg.toLowerCase();
    var status = err.status;

    if (err.name === 'AuthRetryableFetchError' || status === 0 ||
        /failed to fetch|networkerror|load failed|network request failed/.test(low)) {
      return makeError('NETWORK', 'No internet connection');
    }
    if (err.code === 'user_already_exists' || /already registered|already been registered/.test(low)) {
      return makeError('EMAIL_TAKEN', 'An account with this email already exists. Try logging in.');
    }
    if (err.code === 'invalid_credentials' || /invalid login credentials/.test(low)) {
      return makeError('BAD_CREDENTIALS', 'Wrong email or password.');
    }
    if (err.code === 'weak_password') {
      return makeError('INVALID', msg || 'Please choose a stronger password.');
    }
    if (err.code === '42501') {
      // Postgres "permission denied" or a Row Level Security refusal: a database setup problem, not an expired login.
      return makeError('SERVER', 'The database refused this request (' + msg + '). Run the GRANT lines of supabase_setup.sql in the Supabase SQL Editor.');
    }
    if (status === 401 || status === 403 || err.code === 'PGRST301' || /jwt/.test(low)) {
      return makeError('AUTH', 'Your session has expired. Please log out and log in again while online.');
    }
    return makeError('SERVER', msg || 'The account server is not responding');
  }

  // Every call starts here: fail fast when offline, or when "Simulate server failure" is on.
  function guard() {
    if (!SO.Network.isOnline()) return Promise.reject(makeError('NETWORK', 'No internet connection'));
    if (failing) return Promise.reject(makeError('SERVER', 'The account server is not responding'));
    return Promise.resolve();
  }

  function check(result) {
    if (result && result.error) throw mapError(result.error);
    return result;
  }

  function sessionInfo(user) {
    var meta = user.user_metadata || {};
    return {
      user: { id: user.id, name: meta.name || user.email, email: user.email },
      token: 'supabase',                                  // placeholder: the library holds the real token
      expiresAt: Date.now() + TOKEN_DAYS * DAY
    };
  }

  SO.Server = {
    mode: 'supabase',
    setFailing: function (v) { failing = !!v; },
    isFailing: function () { return failing; },

    /* IAccount */
    register: function (name, email, password) {
      return guard().then(function () {
        return sb.auth.signUp({ email: email, password: password, options: { data: { name: name } } });
      }).then(check).then(function (r) {
        if (!r.data || !r.data.session) {
          // "Confirm email" is switched on in Supabase: no session until the link is clicked.
          throw makeError('CONFIRM_EMAIL', 'Account created. Check your email and click the confirmation link, then log in.');
        }
        return sessionInfo(r.data.user);
      }).catch(function (e) { throw mapError(e); });
    },

    login: function (email, password) {
      return guard().then(function () {
        return sb.auth.signInWithPassword({ email: email, password: password });
      }).then(check).then(function (r) {
        return sessionInfo(r.data.user);
      }).catch(function (e) { throw mapError(e); });
    },

    /* ILessons */
    fetchLessons: function () {
      return guard().then(function () {
        return sb.from('lessons').select('id, position, title, body, version').order('position');
      }).then(check).then(function (r) {
        return (r.data || []).map(function (l) {
          return { id: l.id, order: l.position, version: l.version, title: l.title, body: l.body };
        });
      }).catch(function (e) { throw mapError(e); });
    },

    /* ISync: notes marked PENDING_DELETION are deleted from the account,
       all others are saved (insert or update). Returns what it accepted. */
    pushNotes: function (token, notes) {
      return guard().then(function () {
        return sb.auth.getSession();         // renews the login by itself when it has expired
      }).then(function (r) {
        var session = r && r.data && r.data.session;
        if ((r && r.error) || !session) {
          throw makeError('AUTH', 'Please log out and log in again while online, so your notes can sync.');
        }
        var uid = session.user.id;
        var other = notes.some(function (n) { return n.userId !== uid; });
        if (other) {
          throw makeError('AUTH', 'This device is signed in online to a different account. Log out and log in again while online.');
        }

        var toDelete = notes.filter(function (n) { return n.status === SO.NoteStatus.PENDING_DELETION; })
                            .map(function (n) { return n.id; });
        var toSave = notes.filter(function (n) { return n.status !== SO.NoteStatus.PENDING_DELETION; })
                          .map(function (n) {
                            return { id: n.id, user_id: uid, lesson_id: n.lessonId, text: n.text,
                                     updated_at: n.updatedAt, synced_at: Date.now() };
                          });

        var steps = Promise.resolve();
        if (toSave.length) {
          steps = steps.then(function () { return sb.from('notes').upsert(toSave, { onConflict: 'id' }); }).then(check);
        }
        if (toDelete.length) {
          steps = steps.then(function () { return sb.from('notes').delete().in('id', toDelete); }).then(check);
        }
        return steps.then(function () {
          return { accepted: notes.map(function (n) { return { id: n.id, updatedAt: n.updatedAt }; }) };
        });
      }).catch(function (e) { throw mapError(e); });
    }
  };
})(window.SO);

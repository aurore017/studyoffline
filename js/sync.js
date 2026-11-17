/* ==========================================================================
   SYNC MANAGER  (class "SyncManager", requirements FR 4.2, FR 5)
   --------------------------------------------------------------------------
   Keeps the queue of notes waiting to reach the account, and sends them:
     - automatically when the internet returns,
     - when the student presses "Sync now",
     - and again later if the server failed (retry).

   If anything goes wrong, notes stay in the queue and stay on the device,
   so nothing is ever lost.

   Messages it sends on SO.bus:
     'queue'  - the queue changed
     'sync'   - { state: 'syncing' | 'done' | 'error', count, code, message }
   ========================================================================== */
window.SO = window.SO || {};

(function (SO) {
  'use strict';

  var syncing = false;
  var autoTimer = null;
  var retryTimer = null;
  var RETRY_MS = 8000;

  function currentUserId() {
    var u = SO.Auth.currentUser();
    return u ? u.id : null;
  }

  // The notes in the queue that belong to the person signed in now.
  function queuedNotes() {
    var uid = currentUserId();
    if (!uid) return [];
    return SO.Store.getQueue()
      .map(function (id) { return SO.Store.getNote(id); })
      .filter(function (n) { return n && n.userId === uid; });
  }

  function scheduleAuto(delay) {
    clearTimeout(autoTimer);
    if (!currentUserId() || syncing || !SO.Network.isOnline()) return;
    if (queuedNotes().length === 0) return;
    autoTimer = setTimeout(function () { Sync.syncAll(); }, delay == null ? 900 : delay);
  }

  function fail(code, message) {
    syncing = false;
    SO.bus.emit('sync', { state: 'error', code: code, message: message });
    return { ok: false, reason: code };
  }

  var Sync = {
    isSyncing: function () { return syncing; },
    pendingCount: function () { return queuedNotes().length; },
    getQueue: queuedNotes,

    // Add a note to the queue (called when a note is saved, edited or deleted).
    enqueue: function (noteId) {
      var q = SO.Store.getQueue();
      if (q.indexOf(noteId) === -1) { q.push(noteId); SO.Store.setQueue(q); }
      SO.bus.emit('queue');
      scheduleAuto(900);
    },

    // Send everything in the queue to the account server.
    syncAll: function () {
      if (syncing) return Promise.resolve({ ok: false, reason: 'busy' });
      var session = SO.Auth.getSession();
      if (!session) return Promise.resolve({ ok: false, reason: 'auth' });

      var notes = queuedNotes();
      if (notes.length === 0) return Promise.resolve({ ok: true, count: 0 });

      if (!SO.Network.isOnline()) {
        SO.bus.emit('sync', { state: 'error', code: 'NETWORK', message: 'You are offline. Your notes are safe on this device.' });
        return Promise.resolve({ ok: false, reason: 'NETWORK' });
      }
      if (!session.token || session.tokenExpiresAt < Date.now()) {
        return Promise.resolve(fail('AUTH', 'Please log out and log in again while online, so your notes can sync.'));
      }

      syncing = true;
      clearTimeout(retryTimer);
      SO.bus.emit('sync', { state: 'syncing' });

      var snapshot = notes.map(function (n) { return Object.assign({}, n); });   // what we send
      return SO.Server.pushNotes(session.token, snapshot).then(function (res) {
        var versions = {};
        res.accepted.forEach(function (a) { versions[a.id] = a.updatedAt; });
        var marked = SO.Store.markSynced(Object.keys(versions), Date.now(), versions);

        snapshot.forEach(function (n) {
          if (marked.indexOf(n.id) !== -1) SO.Audit.record('synced', n);
        });
        SO.Store.setQueue(SO.Store.getQueue().filter(function (id) { return marked.indexOf(id) === -1; }));

        syncing = false;
        SO.bus.emit('sync', { state: 'done', count: marked.length });
        SO.bus.emit('queue');
        SO.bus.emit('notes');
        scheduleAuto(900);              // in case the student typed during the sync
        return { ok: true, count: marked.length };
      }).catch(function (err) {
        if (err.code === 'SERVER') {
          retryTimer = setTimeout(function () { Sync.syncAll(); }, RETRY_MS);
          return fail('SERVER', 'Could not reach the account server. Your notes are safe on this device. Trying again soon.');
        }
        if (err.code === 'AUTH') return fail('AUTH', err.message);
        return fail('NETWORK', 'The connection was lost. Your notes are safe on this device and will sync when it returns.');
      });
    },

    start: function () {
      // internet came back -> sync automatically
      SO.bus.on('network', function (online) {
        if (online) scheduleAuto(800);
        else clearTimeout(retryTimer);
      });
      // someone signed in -> sync anything waiting
      SO.bus.on('auth', function (s) { if (s) scheduleAuto(1200); });
    }
  };

  SO.Sync = Sync;
})(window.SO);

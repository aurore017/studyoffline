/* ==========================================================================
   LOCAL STORE  (component: "Local Store" in the component diagram)
   --------------------------------------------------------------------------
   Everything the app needs to work with no internet lives here, in the
   browser's localStorage: stored lessons, saved notes, the sync queue,
   the login session and the audit log.

   Every other file talks to the device storage ONLY through this file
   (the "IStorage" interface in the diagram).

   This file also holds two tiny helpers used everywhere:
     SO.bus         - a message board: one file says "something changed",
                      other files listen and react.
     SO.NoteStatus  - the four states a note can be in (state machine B.4).
   ========================================================================== */
window.SO = window.SO || {};

(function (SO) {
  'use strict';

  /* ---------- message board (events) ---------- */
  var handlers = {};
  SO.bus = {
    on: function (name, fn) {
      (handlers[name] = handlers[name] || []).push(fn);
    },
    emit: function (name, data) {
      (handlers[name] || []).slice().forEach(function (fn) {
        try { fn(data); } catch (e) { console.error('Event handler failed:', name, e); }
      });
    }
  };

  /* ---------- the four note states (state machine diagram) ---------- */
  SO.NoteStatus = Object.freeze({
    UNSAVED: 'UNSAVED',                 // student is typing (only in the editor)
    SAVED_LOCALLY: 'SAVED_LOCALLY',     // saved on the device, waiting to sync
    SYNCED: 'SYNCED',                   // confirmed on the student's account
    PENDING_DELETION: 'PENDING_DELETION' // deleted on device, deletion waiting to sync
  });

  /* ---------- low-level read / write ---------- */
  var PREFIX = 'studyoffline:';
  var storage = null;
  var memory = {};   // used only if the browser blocks localStorage (e.g. private mode)

  try {
    storage = window.localStorage;
    storage.setItem(PREFIX + '_test', '1');
    storage.removeItem(PREFIX + '_test');
  } catch (e) {
    storage = null;
  }

  function get(key, fallback) {
    try {
      var raw = storage ? storage.getItem(PREFIX + key) : (key in memory ? memory[key] : null);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function set(key, value) {
    var raw = JSON.stringify(value);
    if (!storage) { memory[key] = raw; return true; }
    try {
      storage.setItem(PREFIX + key, raw);
      return true;
    } catch (e) {
      SO.bus.emit('storage-error', e);   // e.g. storage is full
      return false;
    }
  }

  function remove(key) {
    if (storage) storage.removeItem(PREFIX + key);
    else delete memory[key];
  }

  /* ---------- the Store itself ---------- */
  var Store = {
    get: get,
    set: set,
    remove: remove,
    isPersistent: function () { return !!storage; },

    /* ----- lessons ----- */
    // Keep lessons on the device and mark them as stored.
    storeLessons: function (list) {
      var now = Date.now();
      var byId = {};
      get('lessons', []).forEach(function (l) { byId[l.id] = l; });
      list.forEach(function (l) {
        var before = byId[l.id];
        byId[l.id] = Object.assign({}, l, {
          isStored: true,
          storedAt: before && before.storedAt ? before.storedAt : now
        });
      });
      var all = Object.keys(byId).map(function (k) { return byId[k]; })
        .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      set('lessons', all);
      return all;
    },
    getLessons: function () { return get('lessons', []); },
    getLesson: function (id) {
      return Store.getLessons().find(function (l) { return l.id === id; }) || null;
    },

    /* ----- notes ----- */
    getAllNotes: function () { return get('notes', {}); },   // { noteId: note }
    getNote: function (id) { return Store.getAllNotes()[id] || null; },
    saveNote: function (note) {
      var all = Store.getAllNotes();
      all[note.id] = note;
      return set('notes', all);
    },
    getNotesFor: function (userId) {
      var all = Store.getAllNotes();
      return Object.keys(all).map(function (k) { return all[k]; })
        .filter(function (n) { return n.userId === userId; });
    },

    // The server accepted these notes. Mark them Synced (or remove them if
    // they were waiting for deletion). If the student kept typing while the
    // sync was running, the note changed, so it stays in the queue.
    // versions = { noteId: updatedAt that was sent }
    markSynced: function (ids, time, versions) {
      var all = Store.getAllNotes();
      var done = [];
      ids.forEach(function (id) {
        var n = all[id];
        if (!n) { done.push(id); return; }
        if (versions && versions[id] !== n.updatedAt) return;   // changed meanwhile
        if (n.status === SO.NoteStatus.PENDING_DELETION) {
          delete all[id];
        } else {
          n.status = SO.NoteStatus.SYNCED;
          n.syncedAt = time;
        }
        done.push(id);
      });
      set('notes', all);
      return done;
    },

    /* ----- sync queue (ids of notes waiting to reach the server) ----- */
    getQueue: function () { return get('queue', []); },
    setQueue: function (ids) { set('queue', ids); },

    /* ----- login session ----- */
    getSession: function () { return get('session', null); },
    setSession: function (s) { set('session', s); },
    clearSession: function () { remove('session'); },

    /* ----- accounts known on this device (lets the student log in offline) ----- */
    getAccounts: function () { return get('accounts', []); },
    saveAccount: function (acc) {
      var list = Store.getAccounts().filter(function (a) { return a.email !== acc.email; });
      list.push(acc);
      set('accounts', list);
    },

    /* ----- audit log ----- */
    getAudit: function () { return get('audit', []); },
    addAudit: function (entry) {
      var list = Store.getAudit();
      list.push(entry);
      if (list.length > 2000) list = list.slice(-2000);   // keep the log a sensible size
      set('audit', list);
    }
  };

  SO.Store = Store;
})(window.SO);

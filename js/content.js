/* ==========================================================================
   CONTENT MANAGER  (component "Content Manager": classes Lesson and Note)
   --------------------------------------------------------------------------
   Lessons:  load from the server while online, store on the device, show
             from the device (FR 2.1, FR 2.2).
   Notes:    save on the device (online or offline), edit, delete (FR 3).
             Every change is written to the audit log (NFR 4) and added to
             the sync queue (FR 5).

   Interface from the diagram:  IContent
   ========================================================================== */
window.SO = window.SO || {};

(function (SO) {
  'use strict';

  var S = SO.NoteStatus;

  function newId() {
    return 'n_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  SO.Content = {
    /* ----- lessons ----- */

    // Lessons currently stored on the device (no network call).
    getLessons: function () { return SO.Store.getLessons(); },
    getLesson: function (id) { return SO.Store.getLesson(id); },

    // While online, download the lessons and keep them on the device.
    // Offline, this simply returns what is already stored.
    loadLessons: function () {
      var session = SO.Auth.getSession();
      if (!session || !session.token || !SO.Network.isOnline()) {
        return Promise.resolve(SO.Store.getLessons());
      }
      return SO.Server.fetchLessons(session.token)
        .then(function (list) {
          SO.Store.storeLessons(list);
          SO.bus.emit('lessons');
          return SO.Store.getLessons();
        })
        .catch(function () { return SO.Store.getLessons(); });   // keep what we have
    },

    /* ----- notes ----- */

    // Notes the student can see for a lesson (notes waiting for deletion are hidden).
    getNotes: function (lessonId) {
      var user = SO.Auth.currentUser();
      if (!user) return [];
      return SO.Store.getNotesFor(user.id)
        .filter(function (n) { return n.lessonId === lessonId && n.status !== S.PENDING_DELETION; })
        .sort(function (a, b) { return b.createdAt - a.createdAt; });
    },

    // Save the text of a note on the device. noteId = null creates a new note.
    // Returns the saved note, or null if there was nothing to save.
    saveNote: function (lessonId, noteId, text) {
      var user = SO.Auth.currentUser();
      if (!user) return null;
      var now = Date.now();
      var note = noteId ? SO.Store.getNote(noteId) : null;

      if (!note) {
        if (!text.trim()) return null;                       // do not save empty new notes
        note = {
          id: newId(), userId: user.id, lessonId: lessonId, text: text,
          createdAt: now, updatedAt: now, savedAt: now, syncedAt: null,
          status: S.SAVED_LOCALLY
        };
        SO.Store.saveNote(note);
        SO.Audit.record('saved', note);
      } else {
        if (note.text === text) return note;                 // nothing changed
        note.text = text;
        note.updatedAt = now;
        note.savedAt = now;
        note.status = S.SAVED_LOCALLY;                       // edited notes need syncing again
        SO.Store.saveNote(note);
        SO.Audit.record('edited', note);
      }
      SO.Sync.enqueue(note.id);
      SO.bus.emit('notes');
      return note;
    },

    // Delete: the note disappears from view at once, and the deletion waits
    // in the queue until it can reach the account (state: Pending Deletion).
    deleteNote: function (noteId) {
      var note = SO.Store.getNote(noteId);
      if (!note) return;
      note.status = S.PENDING_DELETION;
      note.updatedAt = Date.now();
      SO.Store.saveNote(note);
      SO.Audit.record('deleted', note);
      SO.Sync.enqueue(note.id);
      SO.bus.emit('notes');
    }
  };
})(window.SO);

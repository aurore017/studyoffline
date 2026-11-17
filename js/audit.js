/* ==========================================================================
   AUDIT LOGGER  (component: "Audit Logger", requirement NFR 4)
   --------------------------------------------------------------------------
   Writes down WHEN each note was saved, edited, deleted and synced, and can
   produce a sync history report.
   ========================================================================== */
window.SO = window.SO || {};

(function (SO) {
  'use strict';

  var ACTIONS = ['saved', 'edited', 'deleted', 'synced'];

  function csvCell(v) {
    return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  }

  SO.Audit = {
    ACTIONS: ACTIONS,

    // action: 'saved' | 'edited' | 'deleted' | 'synced'
    record: function (action, note) {
      SO.Store.addAudit({
        id: 'a_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        userId: note.userId,
        noteId: note.id,
        snippet: (note.text || '').replace(/\s+/g, ' ').slice(0, 40),
        action: action,
        at: Date.now()
      });
    },

    // newest first
    getEntries: function (userId) {
      return SO.Store.getAudit()
        .filter(function (e) { return e.userId === userId; })
        .sort(function (a, b) { return b.at - a.at; });
    },

    // The "sync history report": returns the rows and a CSV text for download.
    generateReport: function (userId) {
      var rows = SO.Audit.getEntries(userId);
      var lines = ['Time,Action,Note,Note ID'];
      rows.forEach(function (e) {
        lines.push([
          csvCell(new Date(e.at).toISOString()),
          csvCell(e.action),
          csvCell(e.snippet),
          csvCell(e.noteId)
        ].join(','));
      });
      return { rows: rows, csv: lines.join('\r\n') };
    }
  };
})(window.SO);

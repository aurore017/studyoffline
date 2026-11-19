/* ==========================================================================
   USER INTERFACE  (component "User Interface")
   --------------------------------------------------------------------------
   Draws the screens and passes what the student does to the right component:
     login / register     -> Authentication   (IAuth)
     lessons and notes    -> Content Manager  (IContent)
     status bar, Sync now -> Sync Manager     (IStatus)

   Screens: a login screen, and the main screen with the lesson list on the
   left, the lesson and notes in the middle, and the status bar on top.
   ========================================================================== */
window.SO = window.SO || {};

(function (SO) {
  'use strict';

  var S = SO.NoteStatus;
  var $ = function (id) { return document.getElementById(id); };

  var currentLessonId = null;
  var showingEmpty = false;     // true while the "no lessons stored yet" message is shown
  var authMode = 'login';
  var toastTimer = null;
  var FONT_MIN = 14, FONT_MAX = 24;

  /* ---------- tiny helper to build elements safely ----------
     Text is always added with textContent, never as HTML, so nothing a
     student types can break the page. */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') el.className = attrs[k];
        else if (k === 'text') el.textContent = attrs[k];
        else el.setAttribute(k, attrs[k]);
      });
    }
    function add(c) {
      if (c == null) return;
      if (Array.isArray(c)) { c.forEach(add); return; }
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    for (var i = 2; i < arguments.length; i++) add(arguments[i]);
    return el;
  }

  function timeLabel(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /* ---------- messages ---------- */
  function toast(message, kind) {
    var t = $('toast');
    t.textContent = message;
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 4500);
  }

  /* ---------- status bar (FR 4.2) ---------- */
  function updateStatusBar() {
    var online = SO.Network.isOnline();
    var syncing = SO.Sync.isSyncing();
    var signedIn = SO.Auth.isSignedIn();
    var pending = signedIn ? SO.Sync.pendingCount() : 0;

    var pill = $('connPill');
    pill.className = 'pill ' + (online ? 'online' : 'offline') + (syncing ? ' syncing' : '');
    $('connText').textContent = syncing ? 'Syncing your notes…'
      : online ? 'Online'
      : 'Offline — working from stored content';

    var chip = $('pendingChip');
    chip.hidden = !(signedIn && pending > 0);
    chip.textContent = pending + (pending === 1 ? ' note' : ' notes') + ' waiting to sync';

    var lastSync = SO.Store.get('lastSync', null);
    var syncEl = $('lastSync');
    syncEl.hidden = !(signedIn && lastSync);
    if (lastSync) syncEl.textContent = 'Last synced: ' + timeLabel(lastSync);

    var btn = $('syncNowBtn');
    btn.hidden = !signedIn;
    btn.disabled = !online || syncing || pending === 0;
    btn.textContent = syncing ? 'Syncing…' : 'Sync now';

    $('userBox').hidden = !signedIn;
    if (signedIn) $('userName').textContent = SO.Auth.currentUser().name;
  }

  /* ---------- text size (accessibility, NFR 7) ---------- */
  function applyFontSize(px) {
    px = Math.max(FONT_MIN, Math.min(FONT_MAX, px));
    document.documentElement.style.setProperty('--base', px + 'px');
    SO.Store.set('fontSize', px);
    return px;
  }

  /* ======================================================================
     LOGIN / REGISTER SCREEN
     ====================================================================== */
  function renderAuth() {
    var isRegister = authMode === 'register';
    var error = h('div', { class: 'form-error', role: 'alert', hidden: '' });

    var nameInput = h('input', { id: 'f-name', type: 'text', autocomplete: 'name' });
    var emailInput = h('input', { id: 'f-email', type: 'email', autocomplete: 'email', required: '' });
    var passInput = h('input', { id: 'f-pass', type: 'password', autocomplete: isRegister ? 'new-password' : 'current-password', required: '' });
    var submit = h('button', { class: 'btn btn-primary', type: 'submit', text: isRegister ? 'Create account' : 'Log in' });

    var form = h('form', { novalidate: '' },
      isRegister ? h('div', { class: 'field' }, h('label', { for: 'f-name', text: 'Name' }), nameInput) : null,
      h('div', { class: 'field' }, h('label', { for: 'f-email', text: 'Email' }), emailInput),
      h('div', { class: 'field' }, h('label', { for: 'f-pass', text: 'Password' }), passInput),
      error,
      submit
    );

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      error.hidden = true;
      submit.disabled = true;
      var work = isRegister
        ? SO.Auth.register(nameInput.value, emailInput.value, passInput.value)
        : SO.Auth.login(emailInput.value, passInput.value);
      work.catch(function (err) {
        error.textContent = err.message || 'Something went wrong. Please try again.';
        error.hidden = false;
      }).then(function () { submit.disabled = false; });
    });

    function tab(mode, label) {
      var b = h('button', { class: 'tab', type: 'button', role: 'tab', 'aria-selected': String(authMode === mode), text: label });
      b.addEventListener('click', function () { authMode = mode; renderAuth(); });
      return b;
    }

    var card = h('div', { class: 'auth-card' },
      h('h1', { text: 'StudyOffline' }),
      h('p', { class: 'tagline', text: 'Read your lessons and take notes with no internet. Everything syncs when you are back online.' }),
      h('div', { class: 'tabs', role: 'tablist' }, tab('login', 'Log in'), tab('register', 'Register')),
      form,
      h('p', { class: 'auth-note', text: isRegister
        ? 'Registering needs an internet connection. After that, the app works offline on this device.'
        : 'The first login on a device needs internet. After that you can log in offline.' })
    );

    $('screen').replaceChildren(h('div', { class: 'auth-wrap' }, card));
    (isRegister ? nameInput : emailInput).focus();
  }

  /* ======================================================================
     MAIN SCREEN
     ====================================================================== */
  function renderApp() {
    var lessons = SO.Content.getLessons();
    if (!currentLessonId || !SO.Content.getLesson(currentLessonId)) {
      currentLessonId = lessons.length ? lessons[0].id : null;
    }

    var sidebar = h('aside', { class: 'sidebar', 'aria-label': 'Lessons' },
      h('h2', { text: 'YOUR LESSONS' }),
      h('div', { id: 'lessonList' })
    );
    var main = h('main', { id: 'lessonView' });
    $('screen').replaceChildren(h('div', { class: 'app' }, sidebar, main));

    renderLessonList();
    renderLesson();
  }

  function renderLessonList() {
    var list = $('lessonList');
    if (!list) return;
    var items = SO.Content.getLessons().map(function (lesson) {
      var count = SO.Content.getNotes(lesson.id).length;
      var b = h('button', { class: 'lesson-item' + (lesson.id === currentLessonId ? ' active' : ''), type: 'button' },
        h('span', { text: lesson.title }),
        h('span', { class: 'lesson-tags' },
          h('span', { class: 'stored-mark', text: 'Stored ✓' }),
          h('span', { class: 'note-count', text: count + (count === 1 ? ' note' : ' notes') })));
      b.addEventListener('click', function () {
        flushNotes();
        currentLessonId = lesson.id;
        SO.Store.set('lastLesson', lesson.id);
        renderLessonList();
        renderLesson();
      });
      return b;
    });
    list.replaceChildren.apply(list, items);
  }

  function renderLesson() {
    var view = $('lessonView');
    if (!view) return;
    var lesson = currentLessonId ? SO.Content.getLesson(currentLessonId) : null;

    showingEmpty = !lesson;
    if (!lesson) {
      var online = SO.Network.isOnline();
      var retry = h('button', { class: 'btn btn-primary', type: 'button', text: 'Load lessons' });
      retry.disabled = !online;
      retry.addEventListener('click', function () {
        retry.disabled = true;
        SO.Content.loadLessons().then(function () { renderApp(); });
      });
      view.replaceChildren(h('div', { class: 'notice' },
        online
          ? 'No lessons are stored on this device yet. Load them now, and they will stay available offline.'
          : 'No lessons are stored on this device yet. Connect to the internet once to load them. After that they work offline.',
        h('div', null, retry)));
      return;
    }

    var paragraphs = lesson.body.split(/\n\s*\n/).map(function (p) { return h('p', { text: p }); });

    var notesList = h('div', { id: 'notesList' });

    // Search box: hides the notes that do not contain the typed words.
    var search = h('input', { class: 'note-search', type: 'search', placeholder: 'Search my notes…', 'aria-label': 'Search my notes' });
    var noMatch = h('p', { class: 'empty', hidden: '', text: 'No notes match your search.' });
    search.addEventListener('input', function () {
      var q = search.value.trim().toLowerCase();
      var shown = 0;
      Array.prototype.forEach.call(notesList.querySelectorAll('.note'), function (card) {
        var text = card.querySelector('textarea').value.toLowerCase();
        var match = text.indexOf(q) !== -1;
        card.hidden = !match;
        if (match) shown++;
      });
      noMatch.hidden = !(q && shown === 0);
    });

    var newBtn = h('button', { class: 'btn btn-small', type: 'button', text: '+ New note' });
    newBtn.addEventListener('click', function () {
      search.value = '';                                  // show every note again
      search.dispatchEvent(new Event('input'));
      var empty = notesList.querySelector('.empty');
      if (empty) empty.remove();
      var card = noteCard(null, lesson.id);
      notesList.insertBefore(card, notesList.firstChild);
      card.querySelector('textarea').focus();
    });

    view.replaceChildren(
      h('h1', { class: 'lesson-title', text: lesson.title }),
      h('p', { class: 'lesson-meta', text: 'Stored on this device — readable with no connection' }),
      h('div', { class: 'lesson-body' }, paragraphs),
      h('section', { class: 'notes-block', 'aria-labelledby': 'notesTitle' },
        h('div', { class: 'notes-head' }, h('h2', { id: 'notesTitle', text: 'My notes' }), newBtn),
        h('p', { class: 'notes-hint', text: 'Notes save to this device as soon as you pause typing, online or offline. They sync to your account when you are online.' }),
        search,
        noMatch,
        notesList)
    );

    var notes = SO.Content.getNotes(lesson.id);
    if (notes.length === 0) {
      notesList.appendChild(h('p', { class: 'empty', text: 'No notes yet for this lesson. Press "+ New note" to start.' }));
    } else {
      notes.forEach(function (n) { notesList.appendChild(noteCard(n, lesson.id)); });
    }
  }

  /* ---------- one note (states: Unsaved -> Saved Locally -> Synced) ---------- */
  function noteCard(note, lessonId) {
    var ta = h('textarea', { 'aria-label': 'Note text', placeholder: 'Write your note…' });
    ta.value = note ? note.text : '';
    var dot = h('span', { class: 'dot' });
    var label = h('span', { class: 'label' });
    var status = h('div', { class: 'note-status' }, dot, label);
    var del = h('button', { class: 'link-btn danger', type: 'button', text: 'Delete' });
    var card = h('div', { class: 'note' }, ta, h('div', { class: 'note-foot' }, status, del));

    card._noteId = note ? note.id : null;
    card._typing = false;
    card._timer = null;
    card._confirm = null;

    // Show the right wording and colour for the note's current state.
    card._paint = function () {
      var cls = 'note-status unsaved', text;
      var n = card._noteId ? SO.Store.getNote(card._noteId) : null;
      if (card._typing) {
        text = 'Typing… not saved yet';
      } else if (!n) {
        text = 'Not started';
      } else if (n.status === S.SYNCED) {
        cls = 'note-status synced';
        text = 'Synced · ' + timeLabel(n.syncedAt);
      } else if (SO.Sync.isSyncing()) {
        cls = 'note-status syncing';
        text = 'Syncing…';
      } else {
        cls = 'note-status local';
        text = 'Saved on this device · not yet synced';
      }
      status.className = cls;
      label.textContent = text;
    };

    function commit() {
      card._typing = false;
      var saved = SO.Content.saveNote(lessonId, card._noteId, ta.value);
      if (saved) card._noteId = saved.id;
      card._paint();
    }

    // Save when the student pauses typing for half a second (FR 3.1).
    ta.addEventListener('input', function () {
      card._typing = true;
      card._paint();
      clearTimeout(card._timer);
      card._timer = setTimeout(commit, 500);
    });
    card._flush = function () {
      if (card._typing) { clearTimeout(card._timer); commit(); }
    };
    ta.addEventListener('blur', card._flush);

    // Delete takes two clicks, so it cannot happen by accident (FR 3.2).
    del.addEventListener('click', function () {
      if (!card._noteId) { card.remove(); return; }
      if (card._confirm) {
        clearTimeout(card._confirm);
        SO.Content.deleteNote(card._noteId);
        card.remove();
        var list = $('notesList');
        if (list && !list.querySelector('.note')) {
          list.appendChild(h('p', { class: 'empty', text: 'No notes yet for this lesson. Press "+ New note" to start.' }));
        }
        return;
      }
      del.textContent = 'Click again to delete';
      card._confirm = setTimeout(function () { card._confirm = null; del.textContent = 'Delete'; }, 3000);
    });

    card._paint();
    return card;
  }

  function flushNotes() {
    Array.prototype.forEach.call(document.querySelectorAll('.note'), function (c) {
      if (c._flush) c._flush();
    });
  }

  function paintNotes() {
    Array.prototype.forEach.call(document.querySelectorAll('.note'), function (c) {
      if (c._paint) c._paint();
    });
  }

  /* ======================================================================
     SYNC HISTORY REPORT (NFR 4)
     ====================================================================== */
  function openHistory() {
    var user = SO.Auth.currentUser();
    if (!user) return;
    var report = SO.Audit.generateReport(user.id);

    var body = $('historyBody');
    if (report.rows.length === 0) {
      body.replaceChildren(h('p', { class: 'empty', style: 'padding:12px', text: 'Nothing recorded yet. Save a note and it will appear here.' }));
    } else {
      var rows = report.rows.slice(0, 300).map(function (e) {
        return h('tr', null,
          h('td', { text: new Date(e.at).toLocaleString() }),
          h('td', { text: e.action }),
          h('td', { text: e.snippet || '(empty note)' }));
      });
      body.replaceChildren(h('table', null,
        h('thead', null, h('tr', null, h('th', { text: 'Time' }), h('th', { text: 'Action' }), h('th', { text: 'Note' }))),
        h.apply(null, ['tbody', null].concat(rows))));
    }
    $('historyDownload').onclick = function () {
      var blob = new Blob([report.csv], { type: 'text/csv' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'studyoffline-sync-history.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    };
    var dlg = $('historyDialog');
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  }

  /* ======================================================================
     START-UP: connect buttons and listen for changes
     ====================================================================== */
  function showScreenForSession() {
    if (SO.Auth.isSignedIn()) {
      var remembered = SO.Store.get('lastLesson', null);
      if (remembered) currentLessonId = remembered;
      renderApp();
    } else {
      renderAuth();
    }
    updateStatusBar();
  }

  SO.UI = {
    toast: toast,

    init: function () {
      applyFontSize(SO.Store.get('fontSize', 16));
      $('fontSmaller').addEventListener('click', function () { applyFontSize(SO.Store.get('fontSize', 16) - 2); });
      $('fontLarger').addEventListener('click', function () { applyFontSize(SO.Store.get('fontSize', 16) + 2); });

      $('syncNowBtn').addEventListener('click', function () {
        flushNotes();
        SO.Sync.syncAll();
      });
      $('logoutBtn').addEventListener('click', function () {
        flushNotes();
        var waiting = SO.Sync.pendingCount();
        SO.Auth.logout();
        if (waiting > 0) toast(waiting + (waiting === 1 ? ' note is' : ' notes are') + ' still on this device and will sync after you log in again.');
      });
      $('historyBtn').addEventListener('click', openHistory);
      $('historyClose').addEventListener('click', function () { $('historyDialog').close(); });

      $('simOffline').addEventListener('change', function (e) { SO.Network.setSimulatedOffline(e.target.checked); });
      $('simFail').addEventListener('change', function (e) { SO.Server.setFailing(e.target.checked); });

      // Never lose typing: save immediately when the page is hidden or closed.
      window.addEventListener('pagehide', flushNotes);
      document.addEventListener('visibilitychange', function () { if (document.hidden) flushNotes(); });

      /* ----- react to messages from the other components ----- */
      SO.bus.on('network', function (online) {
        updateStatusBar();
        paintNotes();
        if (SO.Auth.isSignedIn()) {
          toast(online ? 'Back online.' : 'You are offline. Everything you write is saved on this device.', online ? 'good' : null);
          if (online) SO.Content.loadLessons();
          var view = $('lessonView');
          if (view && !SO.Content.getLessons().length) renderLesson();
        }
      });
      SO.bus.on('queue', function () { updateStatusBar(); paintNotes(); });
      SO.bus.on('notes', function () { updateStatusBar(); paintNotes(); renderLessonList(); });
      SO.bus.on('lessons', function () {
        if (!SO.Auth.isSignedIn()) return;
        if (!$('lessonList') || showingEmpty) renderApp();   // first lessons just arrived
        else renderLessonList();
      });
      SO.bus.on('sync', function (e) {
        if (e.state === 'done') SO.Store.set('lastSync', Date.now());
        updateStatusBar();
        paintNotes();
        if (e.state === 'done' && e.count > 0) toast('Synced ' + e.count + (e.count === 1 ? ' note.' : ' notes.'), 'good');
        if (e.state === 'error') toast(e.message, e.code === 'NETWORK' ? null : 'error');
      });
      SO.bus.on('auth', function (session) {
        flushNotes();
        if (!session) authMode = 'login';        // after logging out, show the login form
        currentLessonId = SO.Store.get('lastLesson', null);
        showScreenForSession();
        if (session) SO.Content.loadLessons();   // a 'lessons' message redraws the screen
      });
      SO.bus.on('storage-error', function () {
        toast('This device is out of storage space. Free some space so your notes can be saved.', 'error');
      });

      showScreenForSession();
      if (SO.Auth.isSignedIn()) SO.Content.loadLessons();
    }
  };
})(window.SO);

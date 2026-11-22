/* ==========================================================================
   SIMULATED ACCOUNT SERVER (fallback, used only when js/config.js has no Supabase keys)
   --------------------------------------------------------------------------
   The SRS says a real account server is a later release. For now this file
   pretends to be that server, so the rest of the app is written exactly as
   it will be with a real one. Later you replace the inside of these
   functions with real fetch() calls to a backend and NOTHING else changes.

   How the simulation works:
   - The "server database" is kept in localStorage under its own key
     (so it survives page reloads, like a real server would).
   - Every call takes a short time (latency) like a real network call.
   - Every call FAILS if the device is offline, or if "Simulate server
     failure" is switched on in Demo tools.

   Interfaces from the component diagram:
     IAccount  -> register(), login()
     ILessons  -> fetchLessons()
     ISync     -> pushNotes()
   ========================================================================== */
window.SO = window.SO || {};

(function (SO) {
  'use strict';

  var LATENCY_MS = 700;
  var TOKEN_DAYS = 30;
  var failing = false;

  /* Course content that "lives on the server". Paragraphs are separated by
     a blank line. Students download these once, while online. */
  var LESSONS = [
    {
      id: 'l1', order: 1, version: 1,
      title: 'What Is Software Engineering?',
      body:
        'Software engineering is the disciplined process of designing, building, testing, and maintaining software systems. It is not just writing code, but doing so in a way that is reliable, maintainable, and fit for the people who will use it.\n\n' +
        'Unlike a quick script written to solve a one-off problem, engineered software is expected to survive changing requirements, multiple contributors, and years of real-world use. This is why the field borrows practices from other engineering disciplines: specification, planning, testing, and iteration.\n\n' +
        'At ALU, this course frames every concept around a core question: how do we build solutions that solve real problems for real communities, responsibly and sustainably?'
    },
    {
      id: 'l2', order: 2, version: 1,
      title: 'The Software Development Lifecycle',
      body:
        'Every software project, regardless of size, tends to move through the same broad phases: understanding the problem, planning a solution, building it, testing it, releasing it, and maintaining it afterward.\n\n' +
        'Different development models organize these phases differently. Waterfall treats them as strict, sequential steps. Agile treats them as a repeating cycle, revisited in short iterations so the team can adapt as they learn.\n\n' +
        'Choosing a model is not about picking the "correct" one. It is about matching the model to how well-understood your requirements are, and how much your solution is likely to change as you test it with real users.'
    },
    {
      id: 'l3', order: 3, version: 1,
      title: 'Agile and Scrum Fundamentals',
      body:
        'Agile is a philosophy: build in small increments, gather feedback constantly, and treat change as expected rather than exceptional.\n\n' +
        'Scrum is one concrete way of practising Agile. Work is organized into short sprints, usually one to two weeks long. Each sprint ends with a working, demoable piece of the product. It is not a finished product, but a real, testable slice of it.\n\n' +
        'This matters most when a team does not yet know exactly what users need. Instead of guessing everything upfront, Scrum lets the team build a small piece, learn from it, and adjust the next sprint accordingly.'
    },
    {
      id: 'l4', order: 4, version: 1,
      title: 'Writing a Strong Problem Statement',
      body:
        'A problem statement should describe who is affected, what the problem actually is, and why it matters, grounded in something observable and not assumed.\n\n' +
        'Weak problem statements are vague ("students struggle with access to learning"). Strong ones are specific: who, how often, under what conditions, and with what consequence.\n\n' +
        'A good test: could someone who has never met you read your problem statement and picture the exact situation you are describing? If not, it needs another pass.'
    },
    {
      id: 'l5', order: 5, version: 1,
      title: 'Functional and Non-Functional Requirements',
      body:
        'A functional requirement (FR) says what the system must do, for example "allow the user to save a note on the device". A non-functional requirement (NFR) says how well it must do it, for example "stored lessons must load in under one second".\n\n' +
        'Every requirement should have a unique ID and a priority. High priority means the product cannot solve its problem without it; medium means it is expected but the product still works without it; low means it is useful but can wait.\n\n' +
        'A good requirement is specific enough to be tested. If you cannot describe how you would check it, it needs rewriting.'
    },
    {
      id: 'l6', order: 6, version: 1,
      title: 'Modelling with UML',
      body:
        'The Unified Modeling Language (UML) gives teams a shared way to draw how a system is built and how it behaves, before and while it is coded.\n\n' +
        'A use case diagram shows who uses the system and what they can do. A class diagram shows the building blocks and how they relate. A sequence diagram shows the order of messages in one scenario. A state machine diagram shows the states one object moves through.\n\n' +
        'No single diagram tells the whole story. Each one answers a different question, so a good analysis uses several together.'
    }
  ];

  /* ---------- the fake "database" ---------- */
  function db() { return SO.Store.get('server_db', { users: [], tokens: {}, notes: {} }); }
  function save(d) { SO.Store.set('server_db', d); }

  function makeError(code, message) {
    var e = new Error(message);
    e.code = code;     // 'NETWORK' | 'SERVER' | 'AUTH' | 'BAD_CREDENTIALS' | 'EMAIL_TAKEN'
    return e;
  }

  function rand(prefix) {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* Wraps every call: fails if offline, waits like a real network, then does the work. */
  function request(work) {
    return new Promise(function (resolve, reject) {
      if (!SO.Network.isOnline()) {
        reject(makeError('NETWORK', 'No internet connection'));
        return;
      }
      setTimeout(function () {
        if (!SO.Network.isOnline()) {            // connection dropped during the call
          reject(makeError('NETWORK', 'The connection was lost'));
          return;
        }
        if (failing) {
          reject(makeError('SERVER', 'The account server is not responding'));
          return;
        }
        try { resolve(work()); } catch (e) { reject(e); }
      }, LATENCY_MS);
    });
  }

  function newToken(d, userId) {
    var token = rand('t_');
    var expiresAt = Date.now() + TOKEN_DAYS * 24 * 60 * 60 * 1000;
    d.tokens[token] = { userId: userId, expiresAt: expiresAt };
    return { token: token, expiresAt: expiresAt };
  }

  function userFromToken(d, token) {
    var t = d.tokens[token];
    if (!t || t.expiresAt < Date.now()) throw makeError('AUTH', 'Your session has expired. Please log in again.');
    return t.userId;
  }

  function publicUser(u) { return { id: u.id, name: u.name, email: u.email }; }

  SO.ServerSim = {
    setFailing: function (v) { failing = !!v; },
    isFailing: function () { return failing; },

    /* IAccount */
    register: function (name, email, passwordHash) {
      return request(function () {
        var d = db();
        if (d.users.some(function (u) { return u.email === email; })) {
          throw makeError('EMAIL_TAKEN', 'An account with this email already exists. Try logging in.');
        }
        var user = { id: rand('u_'), name: name, email: email, passwordHash: passwordHash };
        d.users.push(user);
        var t = newToken(d, user.id);
        save(d);
        return { user: publicUser(user), token: t.token, expiresAt: t.expiresAt };
      });
    },

    login: function (email, passwordHash) {
      return request(function () {
        var d = db();
        var user = d.users.find(function (u) { return u.email === email && u.passwordHash === passwordHash; });
        if (!user) throw makeError('BAD_CREDENTIALS', 'Wrong email or password.');
        var t = newToken(d, user.id);
        save(d);
        return { user: publicUser(user), token: t.token, expiresAt: t.expiresAt };
      });
    },

    /* ILessons */
    fetchLessons: function (token) {
      return request(function () {
        userFromToken(db(), token);
        return JSON.parse(JSON.stringify(LESSONS));
      });
    },

    /* ISync: receives queued notes. Notes marked PENDING_DELETION are deleted
       from the account, all others are saved. Returns what it accepted. */
    pushNotes: function (token, notes) {
      return request(function () {
        var d = db();
        var userId = userFromToken(d, token);
        d.notes[userId] = d.notes[userId] || {};
        var accepted = [];
        notes.forEach(function (n) {
          if (n.userId !== userId) return;
          if (n.status === SO.NoteStatus.PENDING_DELETION) {
            delete d.notes[userId][n.id];
          } else {
            d.notes[userId][n.id] = {
              id: n.id, lessonId: n.lessonId, text: n.text,
              updatedAt: n.updatedAt, syncedAt: Date.now()
            };
          }
          accepted.push({ id: n.id, updatedAt: n.updatedAt });
        });
        save(d);
        return { accepted: accepted };
      });
    },

    /* Not used by the app. Handy in the browser console to check the "account":
       SO.Server.peek()  */
    peek: function () { return db(); }
  };
})(window.SO);

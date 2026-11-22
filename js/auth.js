/* ==========================================================================
   AUTHENTICATION  (component "Authentication", requirements FR 1 and NFR 1)
   --------------------------------------------------------------------------
   - Register and log in with email + password.
   - The password is turned into a SHA-256 fingerprint ("hash") on the
     device. The plain password is never stored and never sent (NFR 1).
   - The session is kept on the device, so the app opens straight away
     even with no internet (FR 1.2).
   - After the first online login, the student can also log in OFFLINE on
     the same device, because a fingerprint of the account is kept locally.
   ========================================================================== */
window.SO = window.SO || {};

(function (SO) {
  'use strict';

  var DAY = 24 * 60 * 60 * 1000;
  var SESSION_DAYS = 30;

  function toHex(bytes) {
    return Array.prototype.map.call(bytes, function (b) {
      return ('0' + b.toString(16)).slice(-2);
    }).join('');
  }

  // Fallback only for very old browsers without crypto.subtle (prototype quality).
  function weakHash(str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16);
  }

  function hashPassword(email, password) {
    var text = email.trim().toLowerCase() + ':' + password + ':studyoffline-v1';
    if (window.crypto && window.crypto.subtle && window.TextEncoder) {
      return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
        .then(function (buf) { return toHex(new Uint8Array(buf)); });
    }
    return Promise.resolve(weakHash(text));
  }

  function validate(email, password, name) {
    if (name !== undefined && !name.trim()) return 'Please enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Please enter a valid email address.';
    if (password.length < 6) return 'The password must have at least 6 characters.';
    return null;
  }

  function startSession(user, token, tokenExpiresAt, passwordHash) {
    var session = {
      userId: user.id,
      name: user.name,
      email: user.email,
      token: token,                       // used to talk to the server; may be null/expired offline
      tokenExpiresAt: tokenExpiresAt || 0,
      expiresAt: Date.now() + SESSION_DAYS * DAY   // how long the device stays signed in
    };
    SO.Store.setSession(session);
    if (passwordHash) {
      SO.Store.saveAccount({
        id: user.id, name: user.name, email: user.email,
        passwordHash: passwordHash, token: token, tokenExpiresAt: tokenExpiresAt || 0
      });
    }
    SO.bus.emit('auth', session);
    return session;
  }

  function loginLocally(email, hash) {
    var acc = SO.Store.getAccounts().find(function (a) { return a.email === email; });
    if (!acc) {
      var e = new Error('You need an internet connection the first time you log in on this device.');
      e.code = 'NEEDS_ONLINE';
      throw e;
    }
    if (acc.passwordHash !== hash) {
      var bad = new Error('Wrong email or password.');
      bad.code = 'BAD_CREDENTIALS';
      throw bad;
    }
    return startSession({ id: acc.id, name: acc.name, email: acc.email }, acc.token, acc.tokenExpiresAt, null);
  }

  SO.Auth = {
    validate: validate,
    hashPassword: hashPassword,

    getSession: function () {
      var s = SO.Store.getSession();
      if (!s) return null;
      if (s.expiresAt < Date.now()) { SO.Store.clearSession(); return null; }
      return s;
    },
    isSignedIn: function () { return !!SO.Auth.getSession(); },
    currentUser: function () {
      var s = SO.Auth.getSession();
      return s ? { id: s.userId, name: s.name, email: s.email } : null;
    },

    // Registering needs the server, so it needs internet.
    register: function (name, email, password) {
      var problem = validate(email, password, name);
      if (problem) return Promise.reject(Object.assign(new Error(problem), { code: 'INVALID' }));
      if (!SO.Network.isOnline()) {
        return Promise.reject(Object.assign(
          new Error('Registering needs an internet connection. After that you can use the app offline.'),
          { code: 'NEEDS_ONLINE' }));
      }
      email = email.trim().toLowerCase();
      return SO.Auth.hashPassword(email, password).then(function (hash) {
        return SO.Server.register(name.trim(), email, password, hash).then(function (res) {
          return startSession(res.user, res.token, res.expiresAt, hash);
        });
      });
    },

    // Online: ask the server. Offline (or server down): use the account kept on this device.
    login: function (email, password) {
      var problem = validate(email, password);
      if (problem) return Promise.reject(Object.assign(new Error(problem), { code: 'INVALID' }));
      email = email.trim().toLowerCase();
      return SO.Auth.hashPassword(email, password).then(function (hash) {
        if (!SO.Network.isOnline()) return loginLocally(email, hash);
        return SO.Server.login(email, password, hash).then(function (res) {
          return startSession(res.user, res.token, res.expiresAt, hash);
        }).catch(function (err) {
          if (err.code === 'NETWORK' || err.code === 'SERVER') return loginLocally(email, hash);
          throw err;
        });
      });
    },

    logout: function () {
      SO.Store.clearSession();
      SO.bus.emit('auth', null);
    }
  };
})(window.SO);

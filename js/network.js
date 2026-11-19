/* ==========================================================================
   CONNECTIVITY MONITOR  (class "ConnectivityMonitor", requirement FR 4.1)
   --------------------------------------------------------------------------
   Works out whether the device is really online and tells everyone when that
   changes (message "network" on SO.bus).

   Why not just use navigator.onLine? Because a phone connected to wifi with
   no internet still says "online". So when the app is served over http(s) we
   also ask our own server for a tiny file (ping.txt). If that fails, we are
   offline.

   "Simulate offline" (in Demo tools) lets you show the offline behaviour to
   your facilitator without touching your real wifi.
   ========================================================================== */
window.SO = window.SO || {};

(function (SO) {
  'use strict';

  var simulatedOffline = false;
  var probeOk = true;
  var last = null;
  var canProbe = /^https?:$/.test(window.location.protocol);

  function compute() {
    return navigator.onLine && !simulatedOffline && probeOk;
  }

  function update() {
    var now = compute();
    if (now !== last) {
      last = now;
      SO.bus.emit('network', now);
    }
  }

  function check() {
    if (!navigator.onLine) { probeOk = false; update(); return Promise.resolve(); }
    if (!canProbe) { probeOk = true; update(); return Promise.resolve(); }   // opened as a file
    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, 8000);
    // Any answer from our server (even an error page) proves the internet works.
    // Only a failed request (no answer at all) means we are offline.
    return fetch('ping.txt?t=' + Date.now(), { cache: 'no-store', signal: ctl.signal })
      .then(function () { probeOk = true; })
      .catch(function () { probeOk = false; })
      .then(function () { clearTimeout(timer); update(); });
  }

  SO.Network = {
    isOnline: compute,
    isSimulatedOffline: function () { return simulatedOffline; },

    setSimulatedOffline: function (value) {
      simulatedOffline = !!value;
      if (simulatedOffline) update(); else check();
    },

    start: function () {
      last = compute();
      window.addEventListener('online', check);
      window.addEventListener('offline', function () { probeOk = false; update(); });
      setInterval(check, 15000);
      check();
    }
  };
})(window.SO);

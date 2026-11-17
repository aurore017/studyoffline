/* ==========================================================================
   START-UP  -  runs last, starts everything
   ========================================================================== */
(function (SO) {
  'use strict';

  SO.Network.start();   // watch the connection
  SO.Sync.start();      // sync automatically when the internet returns
  SO.UI.init();         // draw the screen

  /* Service worker: keeps the app files on the device so the app itself opens
     with no internet (needs the app to be served over http/https). */
  if ('serviceWorker' in navigator && /^https?:$/.test(window.location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (err) {
        console.warn('Offline support could not start:', err);
      });
    });
  }
})(window.SO);

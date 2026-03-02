/**
 * Navigation Blocker — runs in the MAIN world (page context).
 * Intercepts location.assign() and location.replace() to prevent
 * the Atlassian authorize page from redirecting away during the interstitial.
 *
 * Loaded as a file (not inline) so it is not blocked by CSP.
 */
(function () {
  window.__jliNavigationBlocked = true;

  const origAssign = location.assign.bind(location);
  const origReplace = location.replace.bind(location);

  location.assign = function (url) {
    if (window.__jliNavigationBlocked) {
      console.log('[JLI] Blocked location.assign:', url);
      return;
    }
    origAssign(url);
  };

  location.replace = function (url) {
    if (window.__jliNavigationBlocked) {
      console.log('[JLI] Blocked location.replace:', url);
      return;
    }
    origReplace(url);
  };

  // Listen for unblock event dispatched by the content script
  window.addEventListener('jli-unblock-navigation', () => {
    window.__jliNavigationBlocked = false;
  });
})();

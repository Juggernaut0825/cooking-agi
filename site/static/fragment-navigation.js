(function (scope) {
  'use strict';

  function createNavigation(window, document) {
    const initialURL = new URL(window.location.href);
    const navigation = window.performance?.getEntriesByType('navigation')[0];
    let identifier;
    try { identifier = decodeURIComponent(initialURL.hash.slice(1)); } catch {}
    let active = Boolean(identifier) && !initialURL.hash.includes(':~:text=') &&
      !['back_forward', 'reload'].includes(navigation?.type);
    let started = false;
    const gestures = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    const departures = ['hashchange', 'popstate', 'pagehide'];

    function cancel() {
      active = false;
      gestures.forEach(name => document.removeEventListener(name, cancel, true));
      departures.forEach(name => window.removeEventListener(name, cancel));
    }

    if (active) {
      gestures.forEach(name => document.addEventListener(name, cancel, {capture: true, passive: true}));
      departures.forEach(name => window.addEventListener(name, cancel));
    }

    async function settle(layout) {
      if (started || !active) return;
      started = true;
      try {
        await layout;
        if (!active) return;
        await new Promise(resolve => window.requestAnimationFrame(resolve));
        if (!active) return;
        if (document.fonts) await document.fonts.ready;
        if (!active) return;
        await new Promise(resolve => window.requestAnimationFrame(resolve));
        if (!active || window.location.href !== initialURL.href) return;
        const target = document.getElementById(identifier);
        if (!target || !target.closest('.article-body') || target.closest('[data-chronicle]') ||
            !target.getClientRects().length) return;
        target.scrollIntoView({block: 'start', inline: 'nearest', behavior: 'instant'});
      } catch {} finally { cancel(); }
    }

    return {settle};
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = {createNavigation};
  else scope.NoteFragments = createNavigation(scope, scope.document);
})(typeof window === 'undefined' ? null : window);

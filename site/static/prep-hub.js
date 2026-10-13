(() => {
  'use strict';
  const root = document.querySelector('[data-prep-hub]');
  if (!root) return;
  const tabs = [...root.querySelectorAll('[data-prep-tab]')];
  const panels = [...root.querySelectorAll('[data-prep-panel]')];
  const modeList = root.querySelector('[data-prep-modes]');
  if (!modeList || tabs.length !== 2 || panels.length !== 2) return;
  let active = 'review';

  function syncLanguageLinks() {
    const sharedAnchors = {
      '#_2': '#plan', '#how-to-review': '#plan',
      '#ml': '#prep-routes', '#ml-questions-implementations': '#prep-routes',
      '#python': '#prep-routes', '#python-algorithms': '#prep-routes',
      '#_1': '#prep-routes', '#system-design': '#prep-routes',
      '#code-exercises-turn-understanding-into-practice': '#review'
    };
    document.querySelectorAll('.topbar a[data-language-switch]').forEach(link => {
      const target = new URL(link.href, location.href);
      target.hash = sharedAnchors[location.hash] || location.hash;
      link.href = target.href;
    });
  }

  function selectMode(identifier) {
    if (!panels.some(panel => panel.id === identifier)) return;
    active = identifier;
    panels.forEach(panel => { panel.hidden = panel.id !== active; });
    tabs.forEach(tab => {
      const selected = tab.dataset.prepTab === active;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    syncLanguageLinks();
  }

  function restore() {
    let identifier;
    try { identifier = decodeURIComponent(location.hash.slice(1)); } catch { identifier = ''; }
    const target = document.getElementById(identifier);
    const panel = target?.closest('[data-prep-panel]');
    selectMode(panel ? panel.id : window.PreparationProgress?.getMode() || 'review');
  }

  function activate(tab) {
    const identifier = tab.dataset.prepTab;
    if (location.hash !== '#' + identifier) {
      const next = new URL(location.href);
      next.hash = identifier;
      history.pushState(null, '', next.href);
    }
    selectMode(identifier);
    window.PreparationProgress?.setMode(identifier);
  }

  modeList.setAttribute('role', 'tablist');
  tabs.forEach((tab, index) => {
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', tab.dataset.prepTab);
    tab.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      activate(tab);
    });
    tab.addEventListener('keydown', event => {
      let nextIndex;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') nextIndex = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = tabs.length - 1;
      else if (event.key === ' ' || event.key === 'Enter') nextIndex = index;
      else return;
      event.preventDefault();
      activate(tabs[nextIndex]);
      tabs[nextIndex].focus();
    });
  });
  panels.forEach(panel => {
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', 'prep-tab-' + panel.id);
    panel.tabIndex = 0;
  });
  window.addEventListener('popstate', restore);
  window.addEventListener('hashchange', restore);
  window.addEventListener('notes:prep-storage', restore);
  window.addEventListener('notes:prep-restored', () => {
    const identifier = window.PreparationProgress?.getMode() || 'review';
    if (['#plan', '#review'].includes(location.hash)) {
      const next = new URL(location.href);
      next.hash = identifier;
      history.replaceState(null, '', next.href);
    }
    selectMode(identifier);
  });
  restore();
})();

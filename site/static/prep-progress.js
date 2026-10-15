/* The reader's own records in this browser: saved notes, reading history and
   reading positions. Everything lives in one envelope (prep-progress-store.js);
   this file opens it and gives the sidebar, the reading drawer, note positions
   and the study buddy one small API, plus a whole-envelope backup.

   Earlier versions also kept study plans, per-note status, memos and the
   interview page's last-opened tab. Their data
   stays inside existing envelopes and backups, untouched and still exported, but
   nothing on the site shows or edits it any more. */
(() => {
  'use strict';
  const api = window.PrepProgressStore;
  if (!api) return;
  let storage;
  try { storage = window.localStorage; } catch {
    storage = {getItem() { throw Error('storage'); }, setItem() { throw Error('storage'); }};
  }
  const store = api.createStore(storage);
  const bookmarks = state => Object.entries(state.workspace?.records || {})
    .filter(([key, record]) => key.startsWith('bookmark-') && record?.saved).length;

  window.PreparationProgress = {
    library: window.PrepLibraryState?.create(store, storage),
    storageKey: api.KEY,
    getState() { return store.read(); },
    getCatalog() { return null; },
    getHealth() { return store.health(); },
    updateWorkspace(records, action) { return store.updateWorkspace(records, action); },
    // the whole envelope, so a backup carries saved notes, reading history and positions
    exportBackup() { return store.serialize(); },
    // merge a backup in; for each record the newer copy wins, nothing local is dropped
    importBackup(text) {
      const before = bookmarks(store.read());
      const result = store.applyImport(api.parse(text), 'newer');
      window.dispatchEvent(new Event('notes:prep-restored'));
      return {bookmarks: bookmarks(store.read()), addedBookmarks: Math.max(0, bookmarks(store.read()) - before), persisted: result.persisted !== false};
    }
  };

  window.addEventListener('storage', event => {
    if (event.key === api.KEY || event.key === null) {
      store.read();
      window.dispatchEvent(new Event('notes:prep-storage'));
    }
  });
})();

(function (scope) {
  'use strict';
  function create(store, storage) {
    const now = () => new Date().toISOString();
    const readLegacy = key => {
      try { return JSON.parse(storage.getItem(key) || 'null'); } catch { return null; }
    };
    function migrate(mapping) {
      const records = store.read().workspace?.records || {};
      if (records['library-migrated'] || store.health().blocked) return;
      const legacy = readLegacy('cooking-agi:reading:v1') || {};
      const positions = readLegacy('cooking-agi:positions:v1');
      const changes = {};
      const at = now();
      for (const source of Array.isArray(legacy.saved) ? legacy.saved : []) {
        const identifier = mapping[source];
        if (identifier) changes['bookmark-' + identifier] = {saved: true, updatedAt: at};
      }
      const recent = Array.isArray(legacy.recent) ? legacy.recent.slice(0, 8) : [];
      recent.forEach((source, index) => {
        const identifier = mapping[source];
        if (identifier) changes['visit-' + identifier] = {visitedAt: new Date(Date.parse(at) - index).toISOString(), updatedAt: at};
      });
      for (const position of Array.isArray(positions) ? positions.slice(0, 100) : []) {
        const identifier = mapping[position?.note];
        if (identifier && ['zh', 'en'].includes(position.lang) && typeof position.anchor === 'string' && /^[\p{L}\p{N}_:.-]{1,180}$/u.test(position.anchor)) {
          changes['position-' + position.lang + '-' + identifier] = {anchor: position.anchor, updatedAt: at};
        }
      }
      changes['library-migrated'] = {updatedAt: at};
      if (Array.isArray(legacy.saved) || Array.isArray(positions)) changes['legacy-library'] = {reading: legacy, positions: positions || [], updatedAt: at};
      for (const key of Object.keys(changes)) if (records[key]) delete changes[key];
      if (Object.keys(changes).length) store.updateWorkspace(changes);
    }
    function read(mapping) {
      migrate(mapping);
      const records = store.read().workspace?.records || {};
      const known = Object.entries(mapping);
      return {
        saved: known.filter(([, identifier]) => records['bookmark-' + identifier]?.saved).slice(0, 100).map(([source]) => source),
        recent: known.filter(([, identifier]) => records['visit-' + identifier]?.visitedAt)
          .sort((left, right) => records['visit-' + right[1]].visitedAt.localeCompare(records['visit-' + left[1]].visitedAt))
          .slice(0, 8).map(([source]) => source)
      };
    }
    function write(value, mapping) {
      const records = store.read().workspace?.records || {};
      const changes = {};
      const at = now();
      const existing = read(mapping);
      const visibleSaved = new Set([...existing.saved, ...value.saved]);
      const recentChanged = JSON.stringify(existing.recent) !== JSON.stringify(value.recent);
      for (const [source, identifier] of Object.entries(mapping)) {
        const saved = value.saved.includes(source);
        if (visibleSaved.has(source) && saved !== Boolean(records['bookmark-' + identifier]?.saved)) changes['bookmark-' + identifier] = {saved, updatedAt: at};
        if (recentChanged) {
          const index = value.recent.indexOf(source);
          const visitedAt = index === -1 ? null : new Date(Date.parse(at) - index).toISOString();
          if (index !== -1 || records['visit-' + identifier]?.visitedAt) changes['visit-' + identifier] = {visitedAt, updatedAt: at};
        }
      }
      return Object.keys(changes).length ? store.updateWorkspace(changes).persisted : !store.health().unavailable && !store.health().blocked;
    }
    function positions(mapping) {
      migrate(mapping);
      const records = store.read().workspace?.records || {};
      return Object.entries(mapping).flatMap(([source, identifier]) => ['zh', 'en'].flatMap(lang => {
        const record = records['position-' + lang + '-' + identifier];
        return record?.anchor ? [{note: source, lang, anchor: record.anchor}] : [];
      }));
    }
    function remember(identifier, language, anchor) {
      return store.updateWorkspace({['position-' + language + '-' + identifier]: {anchor, updatedAt: now()}}).persisted;
    }
    function clearPositions() {
      const records = store.read().workspace?.records || {};
      const changes = Object.fromEntries(Object.keys(records).filter(key => key.startsWith('position-'))
        .map(key => [key, {anchor: '', updatedAt: now()}]));
      if (Object.keys(changes).length) return store.updateWorkspace(changes).persisted;
      return true;
    }
    return {read, write, positions, remember, clearPositions};
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = {create};
  else scope.PrepLibraryState = {create};
})(typeof window === 'undefined' ? globalThis : window);

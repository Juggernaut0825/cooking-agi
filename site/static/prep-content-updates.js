(function (scope) {
  'use strict';
  const topics = ['ml', 'llm', 'post', 'systems', 'algorithms'];

  function reconcile(state, catalog, at) {
    if (catalog?.updatesVersion !== 1 || !Number.isSafeInteger(catalog.edition) || catalog.edition < 1) return {};
    const records = state.workspace?.records || {};
    const changes = {};
    const baseline = records.baseline?.edition || catalog.edition;
    if (!records.baseline) changes.baseline = {edition: catalog.edition, updatedAt: at};
    if (!records.preferences) changes.preferences = {autoAdd: true, updatedAt: at};
    const tracked = new Set(Object.keys(state.entries || {}));
    const scheduled = new Set();
    for (const session of Object.values(state.schedule?.sessions || {})) {
      if (session.noteId && session.status !== 'cancelled') tracked.add(session.noteId);
      if (session.noteId && session.status === 'planned') scheduled.add(session.noteId);
    }
    for (const identifier of tracked) {
      for (const topic of catalog.notes?.[identifier]?.topics || []) {
        if (topics.includes(topic) && !records['follow-' + topic] && !changes['follow-' + topic]) {
          changes['follow-' + topic] = {enabled: true, edition: catalog.edition, updatedAt: at};
        }
      }
    }
    const effective = {...records, ...changes};
    for (const [identifier, note] of Object.entries(catalog.notes || {})) {
      if (!note.update || !Array.isArray(note.topics)) continue;
      const {introduced, revision} = note.update;
      if (!Number.isSafeInteger(introduced) || !Number.isSafeInteger(revision) || introduced < 1 || revision < introduced || revision > catalog.edition) continue;
      const key = 'notice-' + identifier;
      const previous = records[key];
      if (previous?.revision > revision) continue;
      if (scheduled.has(identifier) && previous?.status === 'queued') {
        changes[key] = {...previous, status: 'scheduled', updatedAt: at};
        continue;
      }
      if (previous?.revision === revision) continue;
      const relevantNew = !tracked.has(identifier) && note.topics.some(topic => {
        const follow = effective['follow-' + topic];
        return follow?.enabled && introduced > follow.edition;
      });
      const changed = tracked.has(identifier) && revision > Math.max(baseline, records['seen-' + identifier]?.revision || 0);
      if (!relevantNew && !changed) continue;
      changes[key] = {kind: changed ? 'updated' : 'new', revision,
        status: changed || !effective.preferences.autoAdd ? 'available' : 'queued', updatedAt: at};
    }
    return changes;
  }

  const api = {topics, reconcile};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else scope.PrepContentUpdates = api;
})(typeof window === 'undefined' ? globalThis : window);

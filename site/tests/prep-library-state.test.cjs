// The shared envelope behind saved notes, reading history and positions: backups,
// merges, recovery copies and the migration from the old sidebar keys.
const assert = require('node:assert/strict');
const {test} = require('node:test');
const store = require('../static/prep-progress-store.js');
const libraryState = require('../static/prep-library-state.js');
const first = 'note-0123456789abcdef';
const second = 'note-fedcba9876543210';
const early = '2026-10-10T12:00:00.000Z';
const later = '2026-10-12T12:00:00.000Z';

function state(records = {}) {
  return {...store.empty(), workspace: {version: 1, records: {
    baseline: {edition: 1, updatedAt: early}, preferences: {autoAdd: true, updatedAt: early},
    'follow-llm': {enabled: true, edition: 1, updatedAt: early}, ...records
  }, history: []}};
}
function tracked(original = state()) {
  original.entries[first] = {title: 'Attention', note: 'My private note', status: 'practiced', updatedAt: early};
  return original;
}

test('new backups and old backups retain workspace data under every conflict policy', () => {
  const local = state();
  const incoming = state({preferences: {autoAdd: false, updatedAt: later}});
  assert.equal(store.merge(local, incoming).state.workspace.records.preferences.autoAdd, true);
  assert.equal(store.merge(local, incoming, 'newer').state.workspace.records.preferences.autoAdd, false);
  assert.equal(store.merge(incoming, local, 'prefer-backup').state.workspace.records.preferences.autoAdd, true);
  assert.deepEqual(store.merge(incoming, store.empty()).state.workspace, incoming.workspace);
  assert.deepEqual(store.parse(store.encode(incoming)), incoming);
});
test('unknown optional workspace fields survive, future workspace schemas do not write', () => {
  const original = state();
  original.workspace.extension = {example: 'keep me'};
  assert.deepEqual(store.validate(original), original);
  original.workspace.version = 2;
  assert.throws(() => store.validate(original), /version/);
});
test('malformed update settings and notices are rejected', () => {
  for (const records of [{preferences: {autoAdd: 'true', updatedAt: early}},
    {'follow-llm': {enabled: true, edition: 0, updatedAt: early}},
    {['notice-' + first]: {kind: 'new', status: 'evil', revision: 2, updatedAt: early}}]) {
    assert.throws(() => store.validate(state(records)), /invalid/);
  }
});
test('recovery copies preserve the original before an import and survive missing main storage', () => {
  const data = new Map([[store.KEY, store.encode(tracked())]]);
  const storage = {getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value)};
  const current = store.createStore(storage);
  current.updateEntry(first, {note: 'Edited', updatedAt: later});
  assert.equal(current.snapshots()[0].state.entries[first].note, 'My private note');
  data.delete(store.KEY);
  current.read();
  assert.equal(current.health().fault, 'missing');
  assert.throws(() => current.updateEntry(first, {note: 'Do not overwrite'}), /blocked/);
  current.restoreMissing(current.snapshots()[0].state);
  assert.equal(current.read().entries[first].note, 'My private note');
  assert.equal(current.health().blocked, false);
});
test('snapshot quota failure does not lose a successful primary save', () => {
  const data = new Map([[store.KEY, store.encode(tracked())]]);
  const storage = {getItem: key => data.get(key) ?? null, setItem(key, value) {
    if (key === store.SNAPSHOTS_KEY) throw Error('quota');
    data.set(key, value);
  }};
  const current = store.createStore(storage);
  assert.equal(current.updateEntry(first, {note: 'Still saved', updatedAt: later}).persisted, true);
  assert.equal(current.health().snapshotFault, true);
  assert.equal(store.parse(data.get(store.KEY)).entries[first].note, 'Still saved');
});
test('invalid or future primary storage is preserved, not silently recovered over', () => {
  const original = {...tracked(), version: 99};
  const data = new Map([[store.KEY, JSON.stringify(original)], [store.SNAPSHOTS_KEY, JSON.stringify([{at: early, state: tracked()}])]]);
  const current = store.createStore({getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value)});
  assert.throws(() => current.restoreMissing(tracked()), /blocked/);
  assert.equal(current.serialize(), JSON.stringify(original));
  assert.equal(current.snapshots().length, 1);
});

test('sidebar migration joins the backup once and preserves unmapped legacy paths', () => {
  const data = new Map([
    ['cooking-agi:reading:v1', JSON.stringify({saved: ['a.md', 'removed.md'], recent: ['a.md']})],
    ['cooking-agi:positions:v1', JSON.stringify([{note: 'a.md', lang: 'zh', anchor: '例子'}])]
  ]);
  const storage = {getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value)};
  const current = store.createStore(storage);
  const library = libraryState.create(current, storage);
  assert.deepEqual(library.read({'a.md': first}), {saved: ['a.md'], recent: ['a.md']});
  assert.equal(current.read().workspace.records['legacy-library'].reading.saved[1], 'removed.md');
  library.write({saved: [], recent: []}, {'a.md': first});
  assert.deepEqual(library.read({'a.md': first}), {saved: [], recent: []});
  assert.deepEqual(library.positions({'renamed.md': first}), [{note: 'renamed.md', lang: 'zh', anchor: '例子'}]);
  library.clearPositions();
  assert.deepEqual(library.positions({'renamed.md': first}), []);
  const exported = store.parse(current.serialize());
  assert.equal(exported.workspace.records['bookmark-' + first].saved, false);
  assert.equal(data.has('cooking-agi:reading:v1'), true);
});
test('library records survive export, merge and renamed content in another browser', () => {
  const create = () => {
    const data = new Map();
    const storage = {getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value)};
    const current = store.createStore(storage);
    return {current, library: libraryState.create(current, storage)};
  };
  const firstBrowser = create();
  firstBrowser.library.read({'old.md': first});
  firstBrowser.library.write({saved: ['old.md'], recent: ['old.md']}, {'old.md': first});
  firstBrowser.library.remember(first, 'en', 'worked-example');
  const secondBrowser = create();
  secondBrowser.current.applyImport(store.parse(firstBrowser.current.serialize()));
  assert.deepEqual(secondBrowser.library.read({'new.md': first}), {saved: ['new.md'], recent: ['new.md']});
  assert.equal(secondBrowser.library.positions({'new.md': first})[0].anchor, 'worked-example');
  assert.equal(secondBrowser.current.read().entries[first], undefined);
});
test('legacy migration never overwrites a future primary schema', () => {
  const original = JSON.stringify({...store.empty(), version: 42});
  const data = new Map([[store.KEY, original], ['cooking-agi:reading:v1', JSON.stringify({saved: ['a.md']})]]);
  const storage = {getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value)};
  libraryState.create(store.createStore(storage), storage).read({'a.md': first});
  assert.equal(data.get(store.KEY), original);
});

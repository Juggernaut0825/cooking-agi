const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const hub = require(path.join(__dirname, '../static/reader-hub.js'));
const store = require(path.join(__dirname, '../static/prep-progress-store.js'));

const NOTE_A = 'note-0123456789abcdef';
const NOTE_B = 'note-fedcba9876543210';
const AT = '2026-10-12T08:00:00.000Z';
const day = (y, m, d) => new Date(y, m - 1, d);

function memoryStorage() {
  const values = new Map();
  return {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)};
}

function readingState(notes, updatedAt = AT) {
  return {...store.empty(), workspace: {version: 1, records: {
    'reads-20261012': {notes, updatedAt}
  }, history: []}};
}

test('clear survives the real store, reload and export without clearing unrelated work', () => {
  const disk = memoryStorage();
  const progress = store.createStore(disk);
  progress.updateEntry(NOTE_A, {title: 'A note', note: 'Try a different mask', status: 'learning', updatedAt: AT});
  progress.updateWorkspace({
    'reads-20261012': {notes: {[NOTE_A]: 2, [NOTE_B]: 1}, updatedAt: AT, future: {keep: true}},
    'reads-20261011': {notes: {[NOTE_B]: 1}, updatedAt: AT},
    ['bookmark-' + NOTE_A]: {saved: true, updatedAt: AT},
    'reader-settings': {history: true, updatedAt: AT}
  });
  const before = progress.read();
  const result = progress.updateWorkspace(hub.clear(before.workspace.records, '2026-10-12T09:00:00.000Z'));
  assert.equal(result.persisted, true);
  const reloaded = store.createStore(disk);
  const after = store.parse(reloaded.serialize());
  assert.deepEqual(after.workspace.records['reads-20261012'].notes, {});
  assert.deepEqual(after.workspace.records['reads-20261011'].notes, {});
  assert.deepEqual(after.workspace.records['reads-20261012'].future, {keep: true});
  assert.deepEqual(after.entries, before.entries);
  assert.deepEqual(after.workspace.records['bookmark-' + NOTE_A], before.workspace.records['bookmark-' + NOTE_A]);
  assert.deepEqual(after.workspace.records['reader-settings'], before.workspace.records['reader-settings']);
  assert.equal(hub.summarize(after.workspace.records, day(2026, 10, 12)).window, 0);
  reloaded.updateWorkspace(hub.increment(after.workspace.records, NOTE_A, day(2026, 10, 12), AT));
  assert.deepEqual(reloaded.read().workspace.records['reads-20261012'].notes, {[NOTE_A]: 1});
});

test('90-day retention clears persisted counts rather than only hiding them', () => {
  const disk = memoryStorage();
  const progress = store.createStore(disk);
  progress.updateWorkspace({
    'reads-20260601': {notes: {[NOTE_A]: 3}, updatedAt: AT},
    'reads-20261011': {notes: {[NOTE_B]: 1}, updatedAt: AT}
  });
  progress.updateWorkspace(hub.increment(progress.read().workspace.records, NOTE_A, day(2026, 10, 12), AT));
  const records = store.createStore(disk).read().workspace.records;
  assert.deepEqual(records['reads-20260601'].notes, {});
  assert.deepEqual(records['reads-20261011'].notes, {[NOTE_B]: 1});
});

test('backup merge chooses a whole reading snapshot, including an empty one', () => {
  const earlier = readingState({[NOTE_A]: 3});
  const cleared = readingState({}, '2026-10-12T09:00:00.000Z');
  for (const policy of ['keep-local', 'newer']) {
    assert.deepEqual(store.merge(cleared, earlier, policy).state.workspace.records['reads-20261012'].notes, {});
  }
  for (const policy of ['newer', 'prefer-backup']) {
    assert.deepEqual(store.merge(earlier, cleared, policy).state.workspace.records['reads-20261012'].notes, {});
  }
  assert.deepEqual(store.merge(earlier, cleared, 'keep-local').state.workspace.records['reads-20261012'].notes, {[NOTE_A]: 3});
  assert.deepEqual(store.merge(cleared, earlier, 'prefer-backup').state.workspace.records['reads-20261012'].notes, {[NOTE_A]: 3});
  const replacement = readingState({[NOTE_B]: 1}, '2026-10-12T10:00:00.000Z');
  assert.deepEqual(store.merge(earlier, replacement, 'newer').state.workspace.records['reads-20261012'].notes, {[NOTE_B]: 1});
  const progress = store.createStore(memoryStorage());
  progress.applyImport(earlier, 'newer');
  progress.applyImport(cleared, 'newer');
  assert.deepEqual(store.parse(progress.serialize()).workspace.records['reads-20261012'].notes, {});
});

test('a failed clear stays cleared in memory and persists when storage recovers', () => {
  const disk = memoryStorage();
  const progress = store.createStore(disk);
  progress.applyImport(readingState({[NOTE_A]: 3}), 'newer');
  const persist = disk.setItem;
  disk.setItem = () => { throw Error('quota'); };
  const cleared = progress.updateWorkspace(hub.clear(progress.read().workspace.records, '2026-10-12T09:00:00.000Z'));
  assert.equal(cleared.persisted, false);
  assert.deepEqual(progress.read().workspace.records['reads-20261012'].notes, {});
  assert.deepEqual(store.parse(progress.serialize()).workspace.records['reads-20261012'].notes, {});
  assert.deepEqual(store.parse(disk.getItem(store.KEY)).workspace.records['reads-20261012'].notes, {[NOTE_A]: 3});
  disk.setItem = persist;
  const anotherTab = store.createStore(disk);
  anotherTab.updateWorkspace({['bookmark-' + NOTE_B]: {saved: true, updatedAt: AT}});
  progress.updateWorkspace({'reader-settings': {history: false, updatedAt: AT}});
  const reloaded = store.createStore(disk).read().workspace.records;
  assert.deepEqual(reloaded['reads-20261012'].notes, {});
  assert.equal(reloaded['bookmark-' + NOTE_B].saved, true);
});

test('new offline reading days keep complete snapshots when writes are retried', () => {
  const disk = memoryStorage();
  const persist = disk.setItem;
  disk.setItem = () => { throw Error('quota'); };
  const progress = store.createStore(disk);
  progress.updateWorkspace(hub.increment({}, NOTE_A, day(2026, 10, 12), AT));
  progress.updateWorkspace(hub.clear(progress.read().workspace.records, '2026-10-12T09:00:00.000Z'));
  assert.deepEqual(progress.read().workspace.records['reads-20261012'].notes, {});
  disk.setItem = persist;
  progress.updateWorkspace({'reader-settings': {history: false, updatedAt: AT}});
  assert.deepEqual(store.createStore(disk).read().workspace.records['reads-20261012'].notes, {});
});

test('a read lands in the local day record and counts up', () => {
  let records = {};
  for (let i = 0; i < 3; i++) Object.assign(records, hub.increment(records, NOTE_A, day(2026, 10, 12), AT));
  Object.assign(records, hub.increment(records, NOTE_B, day(2026, 10, 12), AT));
  assert.deepEqual(records['reads-20261012'].notes, {[NOTE_A]: 3, [NOTE_B]: 1});
  assert.equal(records['reads-20261012'].updatedAt, AT);
});

test('invalid note IDs are ignored', () => {
  assert.deepEqual(hub.increment({}, 'https://example.com', day(2026, 10, 12), AT), {});
});

test('days past the 90-day window are emptied, not deleted', () => {
  const records = {'reads-20260601': {notes: {[NOTE_A]: 2}, updatedAt: AT}, 'reads-20261001': {notes: {[NOTE_B]: 1}, updatedAt: AT}};
  const changes = hub.increment(records, NOTE_A, day(2026, 10, 12), AT);
  assert.deepEqual(changes['reads-20260601'], {notes: {}, updatedAt: AT});
  assert.equal(changes['reads-20261001'], undefined);
});

test('summary covers today, the last 14 days, and recent notes', () => {
  const records = {
    'reads-20261012': {notes: {[NOTE_A]: 2}, updatedAt: AT},
    'reads-20261011': {notes: {[NOTE_B]: 1, [NOTE_A]: 1}, updatedAt: AT},
    'reads-20260901': {notes: {[NOTE_B]: 5}, updatedAt: AT},
    'reader-settings': {history: true, updatedAt: AT}
  };
  const summary = hub.summarize(records, day(2026, 10, 12));
  assert.equal(summary.today.total, 2);
  assert.deepEqual(summary.today.notes, [[NOTE_A, 2]]);
  assert.equal(summary.series.length, 14);
  assert.equal(summary.series[13].total, 2);
  assert.equal(summary.series[12].total, 2);
  assert.equal(summary.window, 4);
  const b = summary.recent.find(item => item.id === NOTE_B);
  assert.equal(b.lastAge, 1);
  assert.equal(b.total, 6);
});

test('clearing empties every reading day and leaves other records alone', () => {
  const records = {'reads-20261012': {notes: {[NOTE_A]: 2}, updatedAt: AT}, 'bookmark-x': {saved: true, updatedAt: AT}};
  assert.deepEqual(hub.clear(records, AT), {'reads-20261012': {notes: {}, updatedAt: AT}});
});

test('settings default to counting on and a tucked-away crow', () => {
  assert.deepEqual(hub.settings({}), {history: true, mascot: 'collapsed', starAskedOn: '', starDone: false, snoozedUntil: ''});
  assert.equal(hub.settings({'reader-settings': {history: false, mascot: 'hidden', updatedAt: AT}}).mascot, 'hidden');
  assert.equal(hub.settings({'reader-settings': {mascot: 'dancing', updatedAt: AT}}).mascot, 'collapsed');
});

test('the shared store accepts these records and rejects malformed ones', () => {
  const base = {format: 'cooking-agi-prep-progress', version: 1, site: 'cooking-agi', entries: {}, mode: {value: 'review', updatedAt: AT}};
  const ok = Object.assign({}, base, {workspace: {version: 1, records: {
    'reads-20261012': {notes: {[NOTE_A]: 2}, updatedAt: AT},
    'reader-settings': {history: false, mascot: 'open', starAskedOn: '2026-10-12', starDone: true, snoozedUntil: AT, updatedAt: AT}}, history: []}});
  assert.doesNotThrow(() => store.parse(JSON.stringify(ok)));
  for (const bad of [
    {'reads-2026-10-12': {notes: {}, updatedAt: AT}},
    {'reads-20261012': {notes: {[NOTE_A]: -1}, updatedAt: AT}},
    {'reads-20261012': {notes: {'not-a-note': 1}, updatedAt: AT}},
    {'reader-settings': {mascot: 'dancing', updatedAt: AT}},
    {'reader-settings': {starAskedOn: 'tomorrow', updatedAt: AT}},
    {'reader-settings': {starDone: 'yes', updatedAt: AT}},
    {'reader-settings': {snoozedUntil: 'later', updatedAt: AT}}
  ]) {
    const value = Object.assign({}, base, {workspace: {version: 1, records: bad, history: []}});
    assert.throws(() => store.parse(JSON.stringify(value)));
  }
});

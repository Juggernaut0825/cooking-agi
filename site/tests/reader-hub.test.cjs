const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const hub = require(path.join(__dirname, '../static/reader-hub.js'));
const store = require(path.join(__dirname, '../static/prep-progress-store.js'));

const NOTE_A = 'note-0123456789abcdef';
const NOTE_B = 'note-fedcba9876543210';
const AT = '2026-10-12T08:00:00.000Z';
const day = (y, m, d) => new Date(y, m - 1, d);

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
  assert.deepEqual(hub.settings({}), {history: true, mascot: 'collapsed', starAskedOn: ''});
  assert.equal(hub.settings({'reader-settings': {history: false, mascot: 'hidden', updatedAt: AT}}).mascot, 'hidden');
  assert.equal(hub.settings({'reader-settings': {mascot: 'dancing', updatedAt: AT}}).mascot, 'collapsed');
});

test('the shared store accepts these records and rejects malformed ones', () => {
  const base = {format: 'cooking-agi-prep-progress', version: 1, site: 'cooking-agi', entries: {}, mode: {value: 'review', updatedAt: AT}};
  const ok = Object.assign({}, base, {workspace: {version: 1, records: {
    'reads-20261012': {notes: {[NOTE_A]: 2}, updatedAt: AT},
    'reader-settings': {history: false, mascot: 'open', starAskedOn: '2026-10-12', updatedAt: AT}}, history: []}});
  assert.doesNotThrow(() => store.parse(JSON.stringify(ok)));
  for (const bad of [
    {'reads-2026-10-12': {notes: {}, updatedAt: AT}},
    {'reads-20261012': {notes: {[NOTE_A]: -1}, updatedAt: AT}},
    {'reads-20261012': {notes: {'not-a-note': 1}, updatedAt: AT}},
    {'reader-settings': {mascot: 'dancing', updatedAt: AT}},
    {'reader-settings': {starAskedOn: 'tomorrow', updatedAt: AT}}
  ]) {
    const value = Object.assign({}, base, {workspace: {version: 1, records: bad, history: []}});
    assert.throws(() => store.parse(JSON.stringify(value)));
  }
});

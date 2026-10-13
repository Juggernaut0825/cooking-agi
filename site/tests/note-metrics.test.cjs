const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto').webcrypto;
const metrics = require('../static/note-metrics.js');
const note = 'note-78153ce088c6824e';
const other = 'note-0123456789abcdef';
const good = {version: 1, noteId: note, month: '2026-10', mode: 'local', reads: 4, monthReads: 2, saves: 1, monthSaves: 1};

test('blank configuration stays disabled and unsafe endpoints are rejected', () => {
  assert.equal(metrics.endpointURL('', 'https://example.com/notes/'), null);
  assert.equal(metrics.endpointURL('/api/counts', 'https://example.com/notes/').href, 'https://example.com/api/counts/');
  assert.equal(metrics.endpointURL('/api/counts', 'http://127.0.0.1:18992/').href, 'http://127.0.0.1:18992/api/counts/');
  for (const endpoint of ['http://elsewhere.test/api', 'javascript:alert(1)', 'https://user:secret@example.com/api', 'https://example.com/api?secret=1'])
    assert.throws(() => metrics.endpointURL(endpoint, 'https://example.com/'));
});

test('counts must be a valid snapshot for this note, including real zero values', () => {
  assert.deepEqual(metrics.snapshot(good, note), good);
  assert.equal(metrics.snapshot({...good, reads: 0, monthReads: 0}, note).reads, 0);
  for (const patch of [{reads: -1}, {reads: '4'}, {reads: Infinity}, {monthReads: 8}, {monthSaves: 3}, {noteId: other}, {month: '2026-99'}, {mode: 'fake'}, {version: 2}])
    assert.throws(() => metrics.snapshot({...good, ...patch}, note));
});

test('identifiers are stable per note, separate between notes, and require working storage', () => {
  const values = new Map();
  const storage = {getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value)};
  const first = metrics.identity(storage, crypto, 'test', note);
  assert.match(first, /^[a-f0-9]{32}$/);
  assert.equal(metrics.identity(storage, crypto, 'test', note), first);
  assert.notEqual(metrics.identity(storage, crypto, 'test', other), first);
  assert.equal(metrics.identity({getItem() { throw Error('blocked'); }}, crypto, 'test', note), null);
  assert.equal(metrics.identity(storage, crypto, 'test', 'bad-note'), null);
});

test('opted-out events and malformed bookmark payloads never submit', async () => {
  const actions = [];
  let allowed = false;
  const queue = metrics.createQueue({allowed: () => allowed, send: async action => actions.push(action), onResult() {}, onError() {}});
  queue.enqueue({kind: 'view', noteId: note});
  queue.enqueue({kind: 'bookmark', noteId: note, saved: true});
  allowed = true;
  queue.enqueue({kind: 'bookmark', noteId: note, saved: 'yes'});
  queue.enqueue({kind: 'bookmark', noteId: 'bad', saved: true});
  await queue.flush();
  assert.equal(actions.length, 0);
});

test('rapid save and unsave are serialized and end in the latest state', async () => {
  const actions = [];
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  const queue = metrics.createQueue({allowed: () => true, send: async action => {
    actions.push(action);
    if (actions.length === 1) await waiting;
    return good;
  }, onResult() {}, onError(error) { throw error; }});
  queue.enqueue({kind: 'bookmark', noteId: note, saved: true});
  queue.enqueue({kind: 'bookmark', noteId: note, saved: false});
  release();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(actions.map(action => action.saved), [true, false]);
  assert.equal(queue.size(), 0);
});

test('failed requests retry without changing payload, and opt-out discards pending work', async () => {
  let fail = true;
  let failures = 0;
  const actions = [];
  const queue = metrics.createQueue({allowed: () => true, send: async action => {
    actions.push(action);
    if (fail) throw Error('offline');
    return good;
  }, onResult() {}, onError() { failures += 1; }});
  queue.enqueue({kind: 'view', noteId: note});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(failures, 1);
  assert.equal(queue.size(), 1);
  fail = false;
  await queue.flush();
  assert.deepEqual(actions[0], actions[1]);
  assert.equal(queue.size(), 0);
  fail = true;
  queue.enqueue({kind: 'bookmark', noteId: note, saved: true});
  await new Promise(resolve => setImmediate(resolve));
  queue.clear();
  assert.equal(queue.size(), 0);
});

test('repeat view ticks do not grow the queue during a slow request', async () => {
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  let sent = 0;
  const queue = metrics.createQueue({allowed: () => true, send: async () => { sent += 1; await waiting; return good; }, onResult() {}, onError() {}});
  for (let index = 0; index < 30; index++) queue.enqueue({kind: 'view', noteId: note});
  assert.equal(queue.size(), 1);
  release();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sent, 1);
});

const assert = require('node:assert/strict');
const {test} = require('node:test');
const api = require('../static/prep-progress-store.js');
const identifier = 'note-0123456789abcdef';
const another = 'note-fedcba9876543210';
const sessionId = 'session-0123456789abcdef0123456789abcdef';
const anotherSession = 'session-fedcba9876543210fedcba9876543210';
const early = '2026-10-10T12:00:00.000Z';
const later = '2026-10-11T12:00:00.000Z';

function record(note = 'next step', updatedAt = early) {
  return {status: 'learning', note, title: 'A note', updatedAt,
    position: {language: 'en', anchor: 'example'}};
}
function backup(entries = {}) { return {...api.empty(), entries}; }
function session(changes = {}) {
  return {title: 'Review when ready', date: '2026-10-11', minutes: 25, noteId: '',
    status: 'planned', completedOn: '', actualMinutes: null, updatedAt: early, ...changes};
}
function scheduled(sessions = {}) { return {...backup(), schedule: {version: 1, sessions}}; }
function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values};
}

test('route sessions save together, preserve old data and round-trip through the same backup', () => {
  const original = {...backup({[identifier]: record()}), futureOption: 'preserved'};
  const backing = storage({[api.KEY]: api.encode(original)});
  const store = api.createStore(backing);
  const result = store.addSessions({[sessionId]: session({noteId: identifier}), [anotherSession]: session({noteId: another})});
  assert.equal(result.persisted, true);
  const restored = api.parse(store.serialize());
  assert.deepEqual(restored.entries, original.entries);
  assert.equal(restored.futureOption, 'preserved');
  assert.equal(Object.keys(restored.schedule.sessions).length, 2);
});

test('an invalid batch does not partially add its valid first session', () => {
  const backing = storage();
  const store = api.createStore(backing);
  const before = store.read();
  assert.throws(() => store.addSessions({[sessionId]: session(), [anotherSession]: session({minutes: 0})}), /invalid/);
  assert.deepEqual(store.read(), before);
  assert.equal(backing.getItem(api.KEY), null);
});

test('route insertion cannot overwrite a session or duplicate a recently scheduled note', () => {
  const backing = storage();
  const first = api.createStore(backing);
  const second = api.createStore(backing);
  first.addSessions({[sessionId]: session({noteId: identifier})});
  assert.throws(() => second.addSessions({[anotherSession]: session({noteId: identifier})}), /conflict/);
  assert.throws(() => first.addSessions({[sessionId]: session({title: 'overwrite'})}), /conflict/);
  assert.equal(Object.keys(first.read().schedule.sessions).length, 1);
  assert.equal(first.read().schedule.sessions[sessionId].title, 'Review when ready');
});

test('stable exercise IDs permit distinct practice on one note without repeat insertion', () => {
  const store = api.createStore(storage());
  store.addSessions({[sessionId]: session({noteId: identifier, exerciseId: 'exercise-systems-engines'}),
    [anotherSession]: session({noteId: identifier, exerciseId: 'exercise-systems-load-test'})});
  const saved = api.parse(store.serialize()).schedule.sessions;
  assert.equal(Object.keys(saved).length, 2);
  assert.equal(saved[sessionId].exerciseId, 'exercise-systems-engines');
  assert.throws(() => store.addSessions({'session-11111111111111111111111111111111': session({noteId: identifier, exerciseId: 'exercise-systems-engines', title: '另一个语言版本'})}), /conflict/);
});

test('capacity failure keeps the entire old schedule intact', () => {
  const sessions = Object.fromEntries(Array.from({length: 299}, (_, index) => ['session-' + index.toString(16).padStart(32, '0'), session()]));
  const backing = storage({[api.KEY]: api.encode(scheduled(sessions))});
  const store = api.createStore(backing);
  const before = backing.getItem(api.KEY);
  assert.throws(() => store.addSessions({[sessionId]: session(), [anotherSession]: session()}), /limits/);
  assert.equal(backing.getItem(api.KEY), before);
  assert.equal(Object.keys(store.read().schedule.sessions).length, 299);
});

test('unavailable storage keeps the whole route exportable and reports nonpersistence', () => {
  const store = api.createStore({getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }});
  const result = store.addSessions({[sessionId]: session(), [anotherSession]: session()});
  assert.equal(result.persisted, false);
  assert.equal(Object.keys(api.parse(store.serialize()).schedule.sessions).length, 2);
});

test('future-format records block route insertion without touching the original', () => {
  const raw = JSON.stringify({...backup(), version: 99});
  const backing = storage({[api.KEY]: raw});
  const store = api.createStore(backing);
  assert.throws(() => store.addSessions({[sessionId]: session()}), /blocked/);
  assert.equal(backing.getItem(api.KEY), raw);
});

test('round trip preserves bilingual notes, positions and future optional fields', () => {
  const original = {...backup({[identifier]: {...record('下次测 padding'), extra: {sample: 2}}}),
    extra: {language: 'zh'}};
  assert.deepEqual(api.parse(JSON.stringify(original)), original);
});
test('old backups merge without overwriting current work by default', () => {
  const local = backup({[identifier]: record('local', early)});
  const remote = backup({[identifier]: record('backup', later), [another]: record()});
  const result = api.merge(local, remote);
  assert.equal(result.added, 1);
  assert.equal(result.conflicts, 1);
  assert.equal(result.replaced, 0);
  assert.equal(result.state.entries[identifier].note, 'local');
  assert.equal(Object.keys(result.state.entries).length, 2);
  assert.equal(api.merge(result.state, remote).added, 0);
});
test('newer policy preserves recent work and ties; backup policy can recover older data', () => {
  const local = backup({[identifier]: record('local', later)});
  const old = backup({[identifier]: record('old', early)});
  assert.equal(api.merge(local, old, 'newer').state.entries[identifier].note, 'local');
  assert.equal(api.merge(local, old, 'prefer-backup').state.entries[identifier].note, 'old');
  assert.equal(api.merge(old, local, 'newer').replaced, 1);
  assert.equal(api.merge(old, backup({[identifier]: record('tie', early)}), 'newer').replaced, 0);
});
test('a fresh browser restores the selected mode, existing preferences survive by default', () => {
  const incoming = {...backup(), mode: {value: 'plan', updatedAt: later}};
  assert.equal(api.merge(api.empty(), incoming).state.mode.value, 'plan');
  const local = {...backup(), mode: {value: 'review', updatedAt: early}};
  assert.equal(api.merge(local, incoming).state.mode.value, 'review');
  assert.equal(api.merge(local, incoming, 'newer').state.mode.value, 'plan');
});
test('unknown chapter IDs are never filtered out by a release catalog', () => {
  const state = api.merge(api.empty(), backup({[identifier]: record(), [another]: record()})).state;
  assert.deepEqual(Object.keys(api.parse(JSON.stringify(state)).entries), [identifier, another]);
});
test('invalid, oversized, unsafe and unsupported backups fail before mutation', () => {
  const original = backup({[identifier]: record()});
  const invalid = [
    {...original, version: 99}, {...original, site: 'another-site'},
    {...original, entries: {[identifier]: {...record(), status: 'passed'}}},
    {...original, entries: {[identifier]: {...record(), updatedAt: 'yesterday'}}},
    {...original, entries: {[identifier]: {...record(), note: 'x'.repeat(2001)}}},
    {...original, entries: {[identifier]: {...record(), position: {language: 'en', anchor: 'javascript:alert(1)'}}}},
    {...original, payload: '漢'.repeat(api.MAX_BYTES)},
    JSON.parse(JSON.stringify(original).replace('"entries":', '"__proto__":{"polluted":true},"entries":'))
  ];
  for (const item of invalid) assert.throws(() => api.parse(JSON.stringify(item)));
  assert.throws(() => api.parse('{'));
  assert.equal({}.polluted, undefined);
  assert.deepEqual(original.entries[identifier], record());
});
test('storage survives a new store instance and keeps optional fields', () => {
  const disk = storage();
  api.createStore(disk).updateEntry(identifier, {...record(), extra: 'kept'});
  const nextRelease = api.createStore(disk);
  assert.equal(nextRelease.read().entries[identifier].note, 'next step');
  nextRelease.updateEntry(identifier, {status: 'revisit', updatedAt: later});
  assert.equal(api.createStore(disk).read().entries[identifier].extra, 'kept');
});
test('sequential edits in two tabs read the latest disk state', () => {
  const disk = storage();
  const first = api.createStore(disk);
  const second = api.createStore(disk);
  first.updateEntry(identifier, record());
  second.updateEntry(another, record());
  assert.equal(Object.keys(first.read().entries).length, 2);
  second.applyImport(backup({[identifier]: record('older')}), 'prefer-backup');
  assert.equal(first.read().entries[identifier].note, 'older');
});
test('import saves recovery and never removes entries absent from the backup', () => {
  const disk = storage();
  const store = api.createStore(disk);
  store.updateEntry(identifier, record('before', early));
  store.updateEntry(another, record());
  const result = store.applyImport(backup({[identifier]: record('after', later)}), 'newer');
  assert.equal(result.persisted, true);
  assert.equal(store.recovery().entries[identifier].note, 'before');
  assert.equal(store.read().entries[identifier].note, 'after');
  assert.equal(store.read().entries[another].note, 'next step');
  store.applyImport(result.previous, 'prefer-backup');
  assert.equal(store.read().entries[identifier].note, 'before');
});
test('unsupported or damaged local data is not replaced even by a user edit', () => {
  for (const raw of [JSON.stringify({...backup(), version: 99}), '{broken']) {
    const disk = storage({[api.KEY]: raw});
    const store = api.createStore(disk);
    assert.equal(store.health().blocked, true);
    assert.throws(() => store.updateEntry(identifier, record()));
    assert.throws(() => store.applyImport(backup(), 'keep-local'));
    assert.equal(store.serialize(), raw);
    assert.equal(disk.getItem(api.KEY), raw);
  }
});
test('quota failure preserves in-memory work for export', () => {
  const disk = storage();
  const store = api.createStore(disk);
  store.updateEntry(identifier, record('persisted', early));
  disk.setItem = () => { throw Error('quota'); };
  assert.equal(store.updateEntry(identifier, record('in memory', later)).persisted, false);
  assert.equal(api.parse(store.serialize()).entries[identifier].note, 'in memory');
  assert.equal(api.parse(disk.getItem(api.KEY)).entries[identifier].note, 'persisted');
});
test('unavailable storage still supports editing, merging, and exporting during this page', () => {
  const disk = {getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); }};
  const store = api.createStore(disk);
  assert.equal(store.updateEntry(identifier, record()).persisted, false);
  const result = store.applyImport(backup({[another]: record()}), 'keep-local');
  assert.equal(result.recoverySaved, false);
  assert.equal(Object.keys(api.parse(store.serialize()).entries).length, 2);
});

test('failed writes retain older and equal-timestamp entry and mode changes', () => {
  for (const updatedAt of [early, later]) {
    const initial = {...backup({[identifier]: record('committed', later)}),
      mode: {value: 'review', updatedAt: later}};
    const disk = storage({[api.KEY]: JSON.stringify(initial)});
    const store = api.createStore(disk);
    disk.setItem = () => { throw Error('quota'); };
    assert.equal(store.updateEntry(identifier, {note: 'dirty', updatedAt}).persisted, false);
    assert.equal(store.setMode('plan', updatedAt).persisted, false);
    for (let attempt = 0; attempt < 2; attempt++) {
      const state = store.read();
      assert.equal(state.entries[identifier].note, 'dirty');
      assert.deepEqual(state.mode, {value: 'plan', updatedAt});
      const exported = api.parse(store.serialize());
      assert.equal(exported.entries[identifier].note, 'dirty');
      assert.deepEqual(exported.mode, state.mode);
    }
    assert.deepEqual(api.parse(disk.getItem(api.KEY)), initial);
  }
});

test('an explicit older restore remains exportable when persistence fails', () => {
  const initial = {...backup({[identifier]: record('committed', later), [another]: record('keep me')}),
    mode: {value: 'review', updatedAt: later}};
  const incoming = {...backup({[identifier]: record('restored', early)}),
    mode: {value: 'plan', updatedAt: early}};
  const disk = storage({[api.KEY]: JSON.stringify(initial)});
  const store = api.createStore(disk);
  disk.setItem = () => { throw Error('quota'); };
  const result = store.applyImport(incoming, 'prefer-backup');
  assert.equal(result.persisted, false);
  assert.equal(result.recoverySaved, false);
  assert.deepEqual(api.parse(api.encode(result.previous)), initial);
  assert.deepEqual(store.read(), result.state);
  const exported = api.parse(store.serialize());
  assert.equal(exported.entries[identifier].note, 'restored');
  assert.equal(exported.entries[another].note, 'keep me');
  assert.deepEqual(exported.mode, incoming.mode);
  assert.deepEqual(api.parse(disk.getItem(api.KEY)), initial);
});

test('dirty fields rebase onto sequential disk updates and clear after a successful write', () => {
  const initial = backup({[identifier]: record('committed', later), [another]: record('untouched', later)});
  const disk = storage({[api.KEY]: JSON.stringify(initial)});
  let denied = true;
  const store = api.createStore({getItem: disk.getItem, setItem(key, value) {
    if (denied) throw Error('quota');
    disk.setItem(key, value);
  }});
  const otherTab = api.createStore(disk);
  store.updateEntry(identifier, {note: 'dirty', updatedAt: early});
  otherTab.updateEntry(identifier, {status: 'revisit', position: {language: 'zh', anchor: 'remote-section'}});
  otherTab.updateEntry(another, {note: 'sequential older restore', updatedAt: early});
  otherTab.setMode('plan', early);
  const rebased = store.read();
  assert.equal(rebased.entries[identifier].note, 'dirty');
  assert.equal(rebased.entries[identifier].status, 'revisit');
  assert.deepEqual(rebased.entries[identifier].position, {language: 'zh', anchor: 'remote-section'});
  assert.equal(rebased.entries[another].note, 'sequential older restore');
  assert.equal(rebased.mode.value, 'plan');
  denied = false;
  assert.equal(store.updateEntry(identifier, {title: 'Persist all changes'}).persisted, true);
  assert.deepEqual(api.parse(disk.getItem(api.KEY)), store.read());
  otherTab.updateEntry(identifier, {note: 'after commit', updatedAt: early});
  assert.equal(store.read().entries[identifier].note, 'after commit');
  assert.equal(store.health().unavailable, false);
});

test('a denied read cannot replace an unseen committed snapshot', () => {
  const initial = backup({[another]: record('unseen')});
  const disk = storage({[api.KEY]: JSON.stringify(initial)});
  let denied = true;
  const store = api.createStore({getItem(key) {
    if (denied) throw Error('denied');
    return disk.getItem(key);
  }, setItem: disk.setItem});
  assert.equal(store.updateEntry(identifier, record('dirty')).persisted, false);
  assert.deepEqual(api.parse(disk.getItem(api.KEY)), initial);
  denied = false;
  assert.equal(store.read().entries[another].note, 'unseen');
  assert.equal(store.read().entries[identifier].note, 'dirty');
  assert.equal(store.setMode('plan', later).persisted, true);
  assert.equal(Object.keys(api.parse(disk.getItem(api.KEY)).entries).length, 2);
});

test('storage clearing retains complete dirty records but does not resurrect untouched ones', () => {
  const initial = backup({[identifier]: record('committed'), [another]: record('untouched')});
  const disk = storage({[api.KEY]: JSON.stringify(initial)});
  let denied = true;
  const store = api.createStore({getItem: disk.getItem, setItem(key, value) {
    if (denied) throw Error('quota');
    disk.setItem(key, value);
  }});
  store.updateEntry(identifier, {note: 'dirty', updatedAt: later});
  disk.values.delete(api.KEY);
  const state = store.read();
  assert.deepEqual(state.entries[identifier], record('dirty', later));
  assert.equal(state.entries[another], undefined);
  assert.equal(store.health().fault, '');
  denied = false;
  assert.equal(store.setMode('plan', later).persisted, true);
  assert.deepEqual(api.parse(disk.getItem(api.KEY)).entries, state.entries);
});

test('an over-limit rebase preserves both snapshots instead of overwriting or dropping records', () => {
  const initial = backup();
  for (let index = 0; index < 999; index++) {
    initial.entries['note-' + index.toString(16).padStart(16, '0')] = record();
  }
  const disk = storage({[api.KEY]: JSON.stringify(initial)});
  const store = api.createStore({getItem: disk.getItem, setItem() { throw Error('quota'); }});
  store.updateEntry(identifier, record('dirty'));
  api.createStore(disk).updateEntry(another, record('remote'));
  const remote = disk.getItem(api.KEY);
  const exported = api.parse(store.serialize());
  assert.equal(exported.entries[identifier].note, 'dirty');
  assert.equal(Object.keys(exported.entries).length, 1000);
  assert.equal(store.health().blocked, false);
  assert.equal(store.health().unavailable, true);
  assert.equal(store.health().fault, 'limits');
  assert.throws(() => store.setMode('plan', later), /limits/);
  assert.equal(disk.getItem(api.KEY), remote);
  assert.equal(api.parse(remote).entries[another].note, 'remote');
  disk.setItem(api.KEY, JSON.stringify(initial));
  assert.equal(store.read().entries[identifier].note, 'dirty');
  assert.equal(store.health().fault, '');
});

test('future-format disk changes remain raw-exportable without erasing dirty work', () => {
  const initial = backup({[identifier]: record()});
  const disk = storage({[api.KEY]: JSON.stringify(initial)});
  const store = api.createStore({getItem: disk.getItem, setItem() { throw Error('quota'); }});
  store.updateEntry(identifier, {note: 'dirty', updatedAt: early});
  const future = JSON.stringify({...initial, version: 99}, null, 2);
  disk.setItem(api.KEY, future);
  assert.equal(store.serialize(), future);
  assert.throws(() => store.updateEntry(identifier, {note: 'must not overwrite'}), /blocked/);
  assert.equal(disk.getItem(api.KEY), future);
  disk.setItem(api.KEY, JSON.stringify(initial));
  assert.equal(api.parse(store.serialize()).entries[identifier].note, 'dirty');
});

test('compact normal and recovery exports round-trip a large valid collection', () => {
  const initial = backup();
  for (let index = 0; index < 975; index++) {
    const entry = record('x'.repeat(2000));
    delete entry.position;
    initial.entries['note-' + index.toString(16).padStart(16, '0')] = entry;
  }
  assert.ok(Buffer.byteLength(JSON.stringify(initial, null, 2)) > api.MAX_BYTES);
  const disk = storage({[api.KEY]: JSON.stringify(initial)});
  const store = api.createStore(disk);
  const exported = store.serialize();
  assert.ok(Buffer.byteLength(exported) <= api.MAX_BYTES);
  assert.deepEqual(api.parse(exported).entries, initial.entries);
  const result = store.applyImport(backup(), 'keep-local');
  const recovery = api.encode(result.previous);
  assert.ok(Buffer.byteLength(recovery) <= api.MAX_BYTES);
  assert.deepEqual(api.parse(recovery), initial);
  assert.equal(disk.getItem(api.RECOVERY_KEY), recovery);
});

test('exports at the exact UTF-8 limit do not lose data to make room for metadata', () => {
  const initial = {...backup({[identifier]: record('汉字 🥘')}), extra: {padding: ''}};
  initial.extra.padding = 'x'.repeat(api.MAX_BYTES - Buffer.byteLength(JSON.stringify(initial)));
  const encoded = api.encode(initial);
  assert.equal(Buffer.byteLength(encoded), api.MAX_BYTES);
  assert.deepEqual(api.parse(encoded), initial);
  const store = api.createStore(storage({[api.KEY]: encoded}));
  const exported = store.serialize();
  assert.equal(Buffer.byteLength(exported), api.MAX_BYTES);
  assert.deepEqual(api.parse(exported), initial);
  const recovery = store.applyImport(backup(), 'keep-local');
  assert.deepEqual(api.parse(api.encode(recovery.previous)), initial);
  assert.throws(() => api.encode({...initial, extra: {padding: initial.extra.padding + '汉'}}), /limits/);
  assert.throws(() => api.encode({...initial, version: 99}), /version/);
});

test('nested optional fields survive all merge policies without mutating inputs', () => {
  const local = {...backup({[identifier]: {...record('local', early),
    extra: {nested: {localOnly: true, shared: 'local'}, list: ['local']},
    position: {language: 'en', anchor: 'local', extra: {localOnly: true, shared: 'local'}}}}),
    extra: {nested: {localOnly: true, shared: 'local'}},
    mode: {value: 'review', updatedAt: early, extra: {localOnly: true, shared: 'local'}}};
  const incoming = {...backup({[identifier]: {...record('backup', later),
    extra: {nested: {backupOnly: true, shared: 'backup'}, list: ['backup']},
    position: {language: 'zh', anchor: 'backup', extra: {backupOnly: true, shared: 'backup'}}}}),
    extra: {nested: {backupOnly: true, shared: 'backup'}},
    mode: {value: 'plan', updatedAt: later, extra: {backupOnly: true, shared: 'backup'}}};
  const originals = JSON.stringify([local, incoming]);
  for (const policy of ['keep-local', 'newer', 'prefer-backup']) {
    const state = api.merge(local, incoming, policy).state;
    const preferred = policy === 'keep-local' ? 'local' : 'backup';
    const expected = {localOnly: true, backupOnly: true, shared: preferred};
    assert.deepEqual(state.entries[identifier].extra.nested, expected);
    assert.deepEqual(state.entries[identifier].extra.list, [preferred]);
    assert.deepEqual(state.entries[identifier].position.extra, expected);
    assert.equal(state.entries[identifier].position.anchor, preferred);
    assert.deepEqual(state.mode.extra, expected);
    assert.deepEqual(state.extra.nested, {...expected, shared: 'local'});
    assert.deepEqual(api.parse(api.encode(state)), state);
  }
  assert.equal(JSON.stringify([local, incoming]), originals);
});

test('partial edits preserve nested optional fields and allow explicit optional-field removal', () => {
  const initial = {...backup({[identifier]: {...record(),
    extra: {nested: {kept: true}},
    position: {language: 'en', anchor: 'old', extra: {kept: true}}}}),
    mode: {value: 'review', updatedAt: early, extra: {nested: {kept: true}}}};
  const disk = storage({[api.KEY]: JSON.stringify(initial)});
  const store = api.createStore(disk);
  store.updateEntry(identifier, {position: {language: 'zh', anchor: 'next'}, extra: {nested: {added: true}}});
  store.setMode('plan', later);
  const reloaded = api.createStore(disk).read();
  assert.deepEqual(reloaded.entries[identifier].position, {language: 'zh', anchor: 'next', extra: {kept: true}});
  assert.deepEqual(reloaded.entries[identifier].extra, {nested: {kept: true, added: true}});
  assert.deepEqual(reloaded.mode.extra, initial.mode.extra);
  disk.setItem = () => { throw Error('quota'); };
  store.updateEntry(identifier, {position: undefined});
  assert.equal(store.read().entries[identifier].position, undefined);
  assert.equal(api.parse(store.serialize()).entries[identifier].position, undefined);
});

test('nested update payloads cannot introduce prototype-related keys', () => {
  const initial = backup({[identifier]: {...record(), extra: {nested: {kept: true}}}});
  const disk = storage({[api.KEY]: JSON.stringify(initial)});
  const store = api.createStore(disk);
  const before = disk.getItem(api.KEY);
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const changes = JSON.parse('{"extra":{"nested":{"' + key + '":{"polluted":true}}}}');
    assert.throws(() => store.updateEntry(identifier, changes), /invalid/);
  }
  assert.equal({}.polluted, undefined);
  assert.equal(disk.getItem(api.KEY), before);
  assert.deepEqual(store.read(), initial);
});

test('old envelopes stay schedule-free until a session is created', () => {
  const initial = backup({[identifier]: record()});
  const disk = storage({[api.KEY]: api.encode(initial)});
  const store = api.createStore(disk);
  store.updateEntry(identifier, {status: 'revisit'});
  store.setMode('plan', later);
  assert.equal(Object.hasOwn(store.read(), 'schedule'), false);
  assert.equal(Object.hasOwn(api.parse(store.serialize()), 'schedule'), false);
  const result = api.merge(initial, backup());
  assert.equal(Object.hasOwn(result.state, 'schedule'), false);
  assert.equal(result.addedSessions, 0);
  assert.equal(result.conflictingSessions, 0);
  assert.equal(result.replacedSessions, 0);
  const saved = store.updateSession(sessionId, session());
  assert.equal(saved.persisted, true);
  assert.deepEqual(saved.state.schedule, {version: 1, sessions: {[sessionId]: session()}});
  assert.deepEqual(api.createStore(disk).read().schedule, saved.state.schedule);
});

test('legacy stores import schedules and unrelated new sessions merge across tabs', () => {
  const disk = storage({[api.KEY]: api.encode(backup())});
  let denied = true;
  const first = api.createStore({getItem: disk.getItem, setItem(key, value) {
    if (denied) throw Error('quota');
    disk.setItem(key, value);
  }});
  const imported = first.applyImport(scheduled({[sessionId]: session({title: 'Imported plan'})}), 'keep-local');
  assert.equal(imported.addedSessions, 1);
  assert.equal(imported.conflictingSessions, 0);
  assert.equal(imported.replacedSessions, 0);
  assert.equal(imported.persisted, false);
  assert.equal(Object.hasOwn(imported.previous, 'schedule'), false);
  const second = api.createStore(disk);
  second.updateSession(anotherSession, session({title: 'Other tab', minutes: 10}));
  assert.equal(Object.keys(first.read().schedule.sessions).length, 2);
  denied = false;
  assert.equal(first.updateSession(sessionId, {date: '2026-11-01'}).persisted, true);
  assert.equal(second.read().schedule.sessions[sessionId].title, 'Imported plan');
  const restored = second.applyImport(backup({[identifier]: record('Old-format import')}), 'prefer-backup');
  assert.equal(restored.added, 1);
  assert.equal(restored.addedSessions, 0);
  assert.equal(Object.keys(restored.state.schedule.sessions).length, 2);
});

test('session dates use civil calendar validation including century leap years', () => {
  for (const date of ['1900-01-01', '1900-02-28', '2000-02-29', '2024-02-29', '2100-02-28', '2200-12-31']) {
    const original = scheduled({[sessionId]: session({date, status: 'done', completedOn: date})});
    assert.deepEqual(api.parse(api.encode(original)), original);
  }
  for (const date of ['1899-12-31', '2201-01-01', '1900-02-29', '2100-02-29', '2200-02-29',
    '2025-02-29', '2026-04-31', '2026-00-10', '2026-13-01', '2026-01-00', '2026-01-32',
    '2026-1-01', '2026-01-1', '2026-01-01T00:00:00.000Z', ' 2026-01-01', '', null, 20260101]) {
    assert.throws(() => api.validate(scheduled({[sessionId]: session({date})})), /invalid/);
    assert.throws(() => api.validate(scheduled({[sessionId]: session({status: 'done', completedOn: date})})), /invalid/);
  }
});

test('sessions allow flexible durations and gaps but enforce required fields and check-in consistency', () => {
  const valid = [session({minutes: 1}), session({minutes: 1440, date: '2200-12-31', noteId: identifier}),
    session({status: 'cancelled'}), session({status: 'done', completedOn: '1900-01-01', actualMinutes: null}),
    session({status: 'done', completedOn: '2026-10-11', actualMinutes: 0}),
    session({status: 'done', completedOn: '2026-10-11', actualMinutes: 1440, title: 'x'.repeat(160)})];
  for (const entry of valid) assert.deepEqual(api.validate(scheduled({[sessionId]: entry})).schedule.sessions[sessionId], entry);
  const invalid = [{title: ''}, {title: ' \n '}, {title: 'x'.repeat(161)}, {title: null},
    {minutes: 0}, {minutes: 1441}, {minutes: 1.5}, {minutes: '25'}, {minutes: true},
    {noteId: 'note-ABCDEF0123456789'}, {noteId: sessionId}, {noteId: null},
    {status: 'learning'}, {status: 'done'}, {completedOn: '2026-10-11'},
    {status: 'cancelled', completedOn: '2026-10-11'}, {actualMinutes: 0}, {status: 'cancelled', actualMinutes: 1},
    {status: 'done', completedOn: '2026-10-11', actualMinutes: -1},
    {status: 'done', completedOn: '2026-10-11', actualMinutes: 1441},
    {status: 'done', completedOn: '2026-10-11', actualMinutes: 0.5},
    {status: 'done', completedOn: '2026-10-11', actualMinutes: '1'},
    {updatedAt: '2026-10-11'}, {updatedAt: '2026-10-11T12:00:00Z'}];
  for (const changes of invalid) assert.throws(() => api.validate(scheduled({[sessionId]: session(changes)})), /invalid/);
  for (const field of Object.keys(session())) {
    const incomplete = session();
    delete incomplete[field];
    assert.throws(() => api.validate(scheduled({[sessionId]: incomplete})), /invalid/);
  }
});

test('invalid session IDs, unsafe changes and malformed schedules never mutate storage', () => {
  const initial = scheduled({[sessionId]: session()});
  const disk = storage({[api.KEY]: api.encode(initial)});
  const store = api.createStore(disk);
  for (const invalidId of [identifier, 'session-0123', sessionId.toUpperCase(), '__proto__', 'constructor', null]) {
    assert.throws(() => store.updateSession(invalidId, session()), /invalid/);
    assert.throws(() => api.validate(scheduled({[invalidId]: session()})), /invalid/);
  }
  for (const changes of [null, [], JSON.parse('{"extra":{"__proto__":{"polluted":true}}}')]) {
    assert.throws(() => store.updateSession(sessionId, changes), /invalid/);
  }
  for (const schedule of [null, [], {version: 1}, {version: 1, sessions: []}, {version: 1, sessions: null}]) {
    assert.throws(() => api.validate({...backup(), schedule}), /invalid/);
  }
  assert.equal({}.polluted, undefined);
  assert.deepEqual(store.read(), initial);
  assert.equal(disk.getItem(api.KEY), api.encode(initial));
});

test('session conflicts use the selected policy without changing entry counts', () => {
  const tiedSession = 'session-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const addedSession = 'session-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const local = {...scheduled({
    [sessionId]: session({title: 'Local', updatedAt: early}),
    [anotherSession]: session({status: 'cancelled', updatedAt: later}),
    [tiedSession]: session({title: 'Tie local', updatedAt: early})
  }), entries: {[identifier]: record('Local', early)}};
  const incoming = {...scheduled({
    [sessionId]: session({title: 'Done', status: 'done', completedOn: '2026-10-11', actualMinutes: 10, updatedAt: later}),
    [anotherSession]: session({title: 'Old plan', updatedAt: early}),
    [tiedSession]: session({title: 'Tie backup', updatedAt: early}),
    [addedSession]: session({title: 'New session'})
  }), entries: {[identifier]: record('Backup', later), [another]: record()}};
  const originals = JSON.stringify([local, incoming]);
  for (const [policy, replacedSessions, replaced] of [['keep-local', 0, 0], ['newer', 1, 1], ['prefer-backup', 3, 1]]) {
    const result = api.merge(local, incoming, policy);
    assert.equal(result.added, 1);
    assert.equal(result.conflicts, 1);
    assert.equal(result.replaced, replaced);
    assert.equal(result.addedSessions, 1);
    assert.equal(result.conflictingSessions, 3);
    assert.equal(result.replacedSessions, replacedSessions);
    assert.equal(result.state.schedule.sessions[sessionId].status, policy === 'keep-local' ? 'planned' : 'done');
    assert.equal(result.state.schedule.sessions[anotherSession].status, policy === 'prefer-backup' ? 'planned' : 'cancelled');
    assert.equal(result.state.schedule.sessions[tiedSession].title, policy === 'prefer-backup' ? 'Tie backup' : 'Tie local');
  }
  assert.equal(JSON.stringify([local, incoming]), originals);
});

test('cancelled sessions survive old and repeated imports, with explicit restoration available', () => {
  const cancelled = scheduled({[sessionId]: session({status: 'cancelled', updatedAt: later})});
  const oldPlan = scheduled({[sessionId]: session()});
  for (const policy of ['keep-local', 'newer', 'prefer-backup']) {
    assert.deepEqual(api.merge(cancelled, backup(), policy).state.schedule, cancelled.schedule);
    assert.deepEqual(api.merge(cancelled, scheduled(), policy).state.schedule, cancelled.schedule);
  }
  const disk = storage({[api.KEY]: api.encode(cancelled)});
  const store = api.createStore(disk);
  const kept = store.applyImport(oldPlan, 'keep-local');
  assert.equal(kept.replacedSessions, 0);
  assert.equal(kept.state.schedule.sessions[sessionId].status, 'cancelled');
  assert.deepEqual(store.recovery().schedule, cancelled.schedule);
  assert.equal(store.applyImport(oldPlan, 'newer').state.schedule.sessions[sessionId].status, 'cancelled');
  const restored = store.applyImport(oldPlan, 'prefer-backup');
  assert.equal(restored.replacedSessions, 1);
  assert.equal(restored.state.schedule.sessions[sessionId].status, 'planned');
  const repeated = store.applyImport(oldPlan, 'keep-local');
  assert.equal(repeated.addedSessions, 0);
  assert.equal(repeated.conflictingSessions, 0);
  assert.equal(api.merge(oldPlan, cancelled, 'newer').state.schedule.sessions[sessionId].status, 'cancelled');
  const newerPlan = scheduled({[sessionId]: session({updatedAt: '2026-10-12T00:00:00.000Z'})});
  assert.equal(api.merge(cancelled, newerPlan, 'newer').state.schedule.sessions[sessionId].status, 'planned');
});

test('unknown schedule versions reject imports and disable local writes while preserving raw export', () => {
  const supported = scheduled({[sessionId]: session()});
  for (const version of [0, 2, '1']) {
    const future = {...supported, schedule: {version, future: {sessions: 'different schema'}}};
    const raw = JSON.stringify(future, null, 2);
    assert.throws(() => api.parse(raw), /version/);
    assert.throws(() => api.merge(supported, future), /version/);
    assert.throws(() => api.merge(future, supported), /version/);
    const disk = storage({[api.KEY]: raw});
    const store = api.createStore(disk);
    assert.equal(store.health().blocked, true);
    assert.equal(store.health().fault, 'version');
    assert.throws(() => store.updateEntry(identifier, record()));
    assert.throws(() => store.updateSession(sessionId, session()));
    assert.throws(() => store.setMode('plan', later));
    assert.throws(() => store.applyImport(backup(), 'prefer-backup'));
    assert.equal(store.serialize(), raw);
    assert.equal(disk.getItem(api.KEY), raw);
    const validDisk = storage({[api.KEY]: api.encode(supported)});
    assert.throws(() => api.createStore(validDisk).applyImport(future, 'prefer-backup'), /version/);
    assert.equal(validDisk.getItem(api.KEY), api.encode(supported));
    assert.equal(validDisk.getItem(api.RECOVERY_KEY), null);
  }
});

test('nested session and schedule optional fields survive partial edits, imports and recovery', () => {
  const initial = scheduled({[sessionId]: session({extra: {nested: {local: true, shared: 'local'}}})});
  initial.schedule.extra = {nested: {local: true}};
  const incoming = scheduled({[sessionId]: session({updatedAt: later, extra: {nested: {backup: true, shared: 'backup'}}})});
  incoming.schedule.extra = {nested: {backup: true}};
  const originals = JSON.stringify([initial, incoming]);
  for (const policy of ['keep-local', 'newer', 'prefer-backup']) {
    const result = api.merge(initial, incoming, policy);
    assert.deepEqual(result.state.schedule.extra, {nested: {local: true, backup: true}});
    assert.deepEqual(result.state.schedule.sessions[sessionId].extra.nested,
      {local: true, backup: true, shared: policy === 'keep-local' ? 'local' : 'backup'});
  }
  const disk = storage({[api.KEY]: api.encode(initial)});
  const store = api.createStore(disk);
  store.updateSession(sessionId, {date: '2026-12-01', minutes: 90, extra: {nested: {edited: true}}, updatedAt: later});
  const before = store.read();
  const result = store.applyImport(incoming, 'prefer-backup');
  assert.deepEqual(store.recovery(), before);
  assert.deepEqual(api.parse(api.encode(result.previous)), before);
  assert.deepEqual(api.parse(store.serialize()).schedule.sessions[sessionId].extra.nested,
    {local: true, backup: true, edited: true, shared: 'backup'});
  assert.equal(JSON.stringify([initial, incoming]), originals);
});

test('dirty sessions retain older restores and equal timestamps while unrelated disk edits merge', () => {
  for (const updatedAt of [early, later]) {
    const initial = scheduled({[sessionId]: session({status: 'cancelled', updatedAt: later}),
      [anotherSession]: session({title: 'Untouched', updatedAt: later})});
    const disk = storage({[api.KEY]: api.encode(initial)});
    let denied = true;
    const store = api.createStore({getItem: disk.getItem, setItem(key, value) {
      if (denied) throw Error('quota');
      disk.setItem(key, value);
    }});
    const restored = store.applyImport(scheduled({[sessionId]: session({title: 'Restored', updatedAt})}), 'prefer-backup');
    assert.equal(restored.persisted, false);
    const otherTab = api.createStore(disk);
    otherTab.updateSession(sessionId, {minutes: 100, noteId: identifier});
    otherTab.updateSession(anotherSession, {title: 'Disk edit', updatedAt: early});
    otherTab.updateEntry(identifier, record('Separate article'));
    const exported = api.parse(store.serialize());
    assert.equal(exported.schedule.sessions[sessionId].title, 'Restored');
    assert.equal(exported.schedule.sessions[sessionId].status, 'planned');
    assert.equal(exported.schedule.sessions[sessionId].minutes, 100);
    assert.equal(exported.schedule.sessions[sessionId].noteId, identifier);
    assert.equal(exported.schedule.sessions[anotherSession].title, 'Disk edit');
    assert.equal(exported.entries[identifier].note, 'Separate article');
    denied = false;
    assert.equal(store.updateSession(sessionId, {date: '2026-12-01'}).persisted, true);
    otherTab.updateSession(sessionId, {title: 'After commit', updatedAt: early});
    assert.equal(store.read().schedule.sessions[sessionId].title, 'After commit');
  }
});

test('dirty session status transitions rebase completion fields as one consistent check-in', () => {
  const initial = scheduled({[sessionId]: session({status: 'done', completedOn: '2026-10-11'})});
  for (const status of ['planned', 'cancelled']) {
    const disk = storage({[api.KEY]: api.encode(initial)});
    const store = api.createStore({getItem: disk.getItem, setItem() { throw Error('quota'); }});
    store.updateSession(sessionId, {status, completedOn: '', actualMinutes: null, updatedAt: later});
    api.createStore(disk).updateSession(sessionId, {actualMinutes: 40, title: 'Remote title'});
    const result = api.parse(store.serialize()).schedule.sessions[sessionId];
    assert.equal(result.status, status);
    assert.equal(result.completedOn, '');
    assert.equal(result.actualMinutes, null);
    assert.equal(result.title, 'Remote title');
    assert.equal(store.health().fault, '');
  }
});

test('session edits work with denied storage and survive a missing schedule on disk', () => {
  const deniedStore = api.createStore({getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); }});
  assert.equal(deniedStore.updateSession(sessionId, session()).persisted, false);
  deniedStore.updateSession(sessionId, {minutes: 5});
  deniedStore.applyImport(scheduled({[anotherSession]: session({title: 'Later'})}), 'keep-local');
  assert.equal(Object.keys(api.parse(deniedStore.serialize()).schedule.sessions).length, 2);
  const initial = scheduled({[sessionId]: session(), [anotherSession]: session()});
  initial.schedule.extra = {kept: true};
  for (const snapshot of [backup(), scheduled(), null]) {
    const disk = storage({[api.KEY]: api.encode(initial)});
    const store = api.createStore({getItem: disk.getItem, setItem() { throw Error('quota'); }});
    store.updateSession(sessionId, {title: 'Dirty', updatedAt: later});
    if (snapshot === null) disk.values.delete(api.KEY);
    else disk.setItem(api.KEY, api.encode(snapshot));
    const result = store.read();
    assert.deepEqual(result.schedule.sessions[sessionId], session({title: 'Dirty', updatedAt: later}));
    assert.equal(result.schedule.sessions[anotherSession], undefined);
    if (!snapshot?.schedule) assert.deepEqual(result.schedule.extra, initial.schedule.extra);
    assert.equal(store.health().fault, '');
  }
});

test('session capacity includes tombstones and rejects oversized merges without mutation', () => {
  const initial = scheduled();
  for (let index = 0; index < 300; index++) {
    initial.schedule.sessions['session-' + index.toString(16).padStart(32, '0')] = session({status: 'cancelled'});
  }
  const disk = storage({[api.KEY]: api.encode(initial)});
  const store = api.createStore(disk);
  assert.equal(Object.keys(store.read().schedule.sessions).length, 300);
  assert.throws(() => store.updateSession(sessionId, session()), /limits/);
  assert.throws(() => store.applyImport(scheduled({[sessionId]: session()}), 'prefer-backup'), /limits/);
  assert.equal(disk.getItem(api.KEY), api.encode(initial));
  assert.equal(disk.getItem(api.RECOVERY_KEY), null);
  delete initial.schedule.sessions['session-' + (299).toString(16).padStart(32, '0')];
  disk.setItem(api.KEY, api.encode(initial));
  const dirtyStore = api.createStore({getItem: disk.getItem, setItem() { throw Error('quota'); }});
  dirtyStore.updateSession(sessionId, session({title: 'Dirty'}));
  store.updateSession(anotherSession, session({title: 'Remote'}));
  const remote = disk.getItem(api.KEY);
  assert.equal(api.parse(dirtyStore.serialize()).schedule.sessions[sessionId].title, 'Dirty');
  assert.equal(dirtyStore.health().fault, 'limits');
  assert.throws(() => dirtyStore.updateSession(sessionId, {minutes: 10}), /limits/);
  assert.equal(disk.getItem(api.KEY), remote);
  assert.equal(api.parse(remote).schedule.sessions[anotherSession].title, 'Remote');
});

test('schedule exports and recovery remain compact and valid at the UTF-8 size limit', () => {
  const initial = scheduled({[sessionId]: session({title: '慢慢来 🥘'})});
  initial.schedule.extra = {padding: ''};
  initial.schedule.extra.padding = 'x'.repeat(api.MAX_BYTES - Buffer.byteLength(JSON.stringify(initial)));
  const disk = storage({[api.KEY]: api.encode(initial)});
  const store = api.createStore(disk);
  const exported = store.serialize();
  assert.equal(Buffer.byteLength(exported), api.MAX_BYTES);
  assert.deepEqual(api.parse(exported), initial);
  const imported = store.applyImport(backup(), 'keep-local');
  assert.deepEqual(api.parse(api.encode(imported.previous)), initial);
  assert.deepEqual(store.recovery(), initial);
  assert.throws(() => store.updateSession(sessionId, {title: 'x'.repeat(160)}), /limits/);
  assert.equal(disk.getItem(api.KEY), api.encode(initial));
});

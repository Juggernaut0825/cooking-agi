const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const api = require('../static/prep-progress-store.js');
const source = fs.readFileSync(path.join(__dirname, '../static/prep-progress.js'), 'utf8');
const identifier = 'note-0123456789abcdef';
const unknown = 'note-aaaaaaaaaaaaaaaa';
const tick = () => new Promise(resolve => setImmediate(resolve));

class Element {
  constructor() {
    this.children = [];
    this.elements = new Map();
    this.events = {};
    this.dataset = {};
    this.hidden = true;
    this.value = '';
    this.textContent = '';
    this.classList = {add() {}, remove() {}};
  }
  querySelector(selector) {
    if (!this.elements.has(selector)) this.elements.set(selector, new Element());
    return this.elements.get(selector);
  }
  append(...children) { this.children.push(...children); }
  replaceChildren() { this.children = []; }
  addEventListener(name, callback) { this.events[name] = callback; }
  click() { this.events.click?.(); }
  focus() { this.focused = true; }
  remove() {}
}

async function environment({article = false, denied = false, initial = null, catalogValue = null, updatesEnabled = false} = {}) {
  const data = new Map(initial ? [[api.KEY, initial]] : []);
  const storage = {
    getItem(key) { if (denied) throw Error('denied'); return data.get(key) ?? null; },
    setItem(key, value) { if (denied) throw Error('denied'); data.set(key, value); }
  };
  const dashboard = article ? null : new Element();
  const editor = article ? new Element() : null;
  const banner = article ? new Element() : null;
  if (dashboard) dashboard.querySelector('[data-prep-policy]').value = 'keep-local';
  if (editor) {
    editor.dataset = {prepNote: identifier, prepTitle: 'Example note'};
    editor.querySelector('[data-prep-status]').value = 'planned';
  }
  const events = {};
  const blobs = [];
  const timers = new Map();
  const headings = [];
  const requests = [];
  const location = new URL('https://example.test/cooking-agi/interview/index.en.html#progress');
  const document = {
    documentElement: {lang: 'en'}, activeElement: null, body: new Element(),
    querySelector: selector => selector === '[data-prep-dashboard]' ? dashboard : selector === '[data-prep-update-note]' ? banner : editor,
    querySelectorAll: () => headings,
    getElementById: anchor => headings.find(heading => heading.id === anchor),
    createElement: () => new Element()
  };
  const window = {
    PrepProgressStore: api, localStorage: storage, SITE: {prefix: '../'},
    PrepContentUpdates: updatesEnabled ? require('../static/prep-content-updates.js') : undefined,
    addEventListener(name, callback) { events[name] = callback; },
    dispatchEvent(event) { events[event.type]?.(event); }
  };
  class Downloads extends URL {
    static createObjectURL(blob) { blobs.push(blob); return 'blob:local-test'; }
    static revokeObjectURL() {}
  }
  vm.runInNewContext(source, {window, document, location, URL: Downloads, Blob, Event,
    setTimeout(callback) { timers.set(callback, callback); return callback; },
    clearTimeout(callback) { timers.delete(callback); },
    fetch(url) {
      requests.push(url.href);
      return Promise.resolve({ok: true, json: async () => catalogValue || ({notes: {
        [identifier]: {pages: {en: {url: 'interview/example.en.html', title: 'Current title'}}}
      }})});
    }
  });
  await tick();
  return {data, storage, dashboard, editor, banner, events, blobs, timers, headings, requests, window, document,
    control(name) { return (dashboard || editor).querySelector('[data-prep-' + name + ']'); },
    state() { return api.parse(data.get(api.KEY)); }};
}

function backup(note = 'A backup note') {
  const state = api.empty();
  state.entries[identifier] = {status: 'learning', title: 'Old title', note, updatedAt: '2026-01-01T00:00:00.000Z'};
  return state;
}

async function drop(context, state) {
  const text = JSON.stringify(state);
  context.control('drop').events.drop({preventDefault() {}, dataTransfer: {
    files: [{size: Buffer.byteLength(text), text: async () => text}]
  }});
  await tick();
}

test('drop previews and cancellation never writes; explicit merge preserves unknown records', async () => {
  const context = await environment();
  const incoming = backup('<img src=x onerror=alert(1)>');
  incoming.entries[unknown] = {...incoming.entries[identifier], note: 'A moved chapter'};
  await drop(context, incoming);
  assert.equal(context.control('preview').hidden, false);
  assert.match(context.control('preview-text').textContent, /Add 2 records/);
  assert.equal(context.data.has(api.KEY), false);
  context.control('cancel').click();
  assert.equal(context.control('preview').hidden, true);
  assert.equal(context.data.has(api.KEY), false);
  await drop(context, incoming);
  context.control('confirm').click();
  assert.equal(Object.keys(context.state().entries).length, 2);
  assert.equal(context.control('recovery').hidden, false);
  assert.match(context.control('unknown').textContent, /1 records/);
  const row = context.control('records').children[0];
  assert.equal(row.children[0].href, 'https://example.test/cooking-agi/interview/example.en.html');
  assert.equal(row.children[0].textContent, 'Current title');
  assert.equal(row.children[2].textContent, '<img src=x onerror=alert(1)>');
  assert.deepEqual(context.requests, ['https://example.test/cooking-agi/static/prep-progress-catalog.json']);
});

test('confirm reads newer disk state and default conflicts keep it; explicit backup restore works', async () => {
  const context = await environment({initial: JSON.stringify(backup('Original'))});
  await drop(context, backup('Imported'));
  const otherTab = api.createStore(context.storage);
  otherTab.updateEntry(identifier, {note: 'Changed while preview was open', updatedAt: '2026-02-01T00:00:00.000Z'});
  context.control('confirm').click();
  assert.equal(context.state().entries[identifier].note, 'Changed while preview was open');
  await drop(context, backup('Imported'));
  context.control('policy').value = 'prefer-backup';
  context.control('policy').events.change();
  assert.match(context.control('preview-text').textContent, /1 replacements/);
  context.control('confirm').click();
  assert.equal(context.state().entries[identifier].note, 'Imported');
  assert.equal(api.parse(context.data.get(api.RECOVERY_KEY)).entries[identifier].note, 'Changed while preview was open');
});

test('unsupported file versions leave records unchanged and asynchronous cancellation stays cancelled', async () => {
  const original = JSON.stringify(backup());
  const context = await environment({initial: original});
  await drop(context, {...backup(), version: 99});
  assert.match(context.control('message').textContent, /not supported/);
  assert.equal(context.data.get(api.KEY), original);
  let finish;
  context.control('drop').events.drop({preventDefault() {}, dataTransfer: {
    files: [{size: 100, text: () => new Promise(resolve => { finish = resolve; })}]
  }});
  context.control('cancel').click();
  finish(JSON.stringify(backup()));
  await tick();
  assert.equal(context.control('preview').hidden, true);
  assert.equal(context.data.get(api.KEY), original);
});

test('denied storage offers an export on the article itself', async () => {
  const context = await environment({article: true, denied: true});
  context.control('memo').value = 'Keep this unsaved note';
  context.control('status').value = 'learning';
  context.control('memo').events.input();
  assert.equal(context.control('note-export').hidden, false);
  assert.match(context.control('note-message').textContent, /before leaving/);
  context.control('note-export').click();
  const exported = api.parse(await context.blobs[0].text());
  assert.equal(exported.entries[identifier].note, 'Keep this unsaved note');
});

test('scroll recording never overwrites another tab’s newer note with stale input values', async () => {
  const context = await environment({article: true, initial: JSON.stringify(backup('First note'))});
  const otherTab = api.createStore(context.storage);
  otherTab.updateEntry(identifier, {note: 'New note', status: 'revisit', updatedAt: '2026-02-01T00:00:00.000Z'});
  context.headings.push({id: 'some-section', getClientRects: () => [1], getBoundingClientRect: () => ({top: 120})});
  context.events.pagehide();
  assert.equal(context.state().entries[identifier].note, 'New note');
  assert.equal(context.state().entries[identifier].status, 'revisit');
  assert.equal(context.state().entries[identifier].position.anchor, 'some-section');
});

test('unreadable local data is disabled and raw-exportable from an article', async () => {
  const original = JSON.stringify({...backup(), version: 99});
  const context = await environment({article: true, initial: original});
  assert.equal(context.control('memo').disabled, true);
  assert.equal(context.control('status').disabled, true);
  assert.equal(context.control('note-export').hidden, false);
  context.control('note-export').click();
  assert.equal(await context.blobs[0].text(), original);
  assert.equal(context.data.get(api.KEY), original);
});

test('status-only edits preserve a newer memo even when stale memo input keeps focus', async () => {
  const context = await environment({article: true, initial: JSON.stringify(backup('First note'))});
  context.document.activeElement = context.control('memo');
  const otherTab = api.createStore(context.storage);
  otherTab.updateEntry(identifier, {note: 'Other tab edit', updatedAt: '2026-02-01T00:00:00.000Z'});
  context.events.storage({key: api.KEY});
  assert.equal(context.control('memo').value, 'First note');
  context.control('status').value = 'revisit';
  context.control('status').events.change();
  assert.equal(context.state().entries[identifier].note, 'Other tab edit');
  assert.equal(context.state().entries[identifier].status, 'revisit');
});

test('capacity failures are visible and unsaved input can be exported as a draft', async () => {
  const full = api.empty();
  for (let index = 0; index < 1000; index++) {
    full.entries['note-' + index.toString(16).padStart(16, '0')] = {...backup().entries[identifier]};
  }
  const context = await environment({article: true, initial: JSON.stringify(full)});
  context.control('memo').value = 'The 1001st note must not silently disappear';
  context.control('memo').events.input();
  assert.match(context.control('note-message').textContent, /not saved/);
  assert.equal(context.control('note-export').hidden, false);
  assert.match(context.control('note-export').textContent, /TXT/);
  context.events.storage({key: api.KEY});
  assert.equal(context.control('memo').value, 'The 1001st note must not silently disappear');
  context.control('note-export').click();
  assert.match(await context.blobs[0].text(), /1001st note/);
  assert.equal(context.state().entries[identifier], undefined);
});

test('storage changes notify the mode controller without writing a mode themselves', async () => {
  const context = await environment({initial: JSON.stringify(backup())});
  let notified = 0;
  context.window.addEventListener('notes:prep-storage', () => { notified++; });
  const updated = backup();
  updated.mode = {value: 'plan', updatedAt: '2026-02-01T00:00:00.000Z'};
  context.data.set(api.KEY, JSON.stringify(updated));
  context.events.storage({key: api.KEY});
  assert.equal(notified, 1);
  assert.equal(context.window.PreparationProgress.getMode(), 'plan');
});

test('shared session API is included in exports, import previews, and pre-import recovery', async () => {
  const context = await environment();
  const sessionId = 'session-0123456789abcdef0123456789abcdef';
  const session = {title: 'Practice attention', date: '2026-10-12', minutes: 25, noteId: identifier,
    status: 'planned', completedOn: '', actualMinutes: null, updatedAt: '2026-10-01T00:00:00.000Z'};
  context.window.PreparationProgress.updateSession(sessionId, session);
  assert.equal(context.window.PreparationProgress.getState().schedule.sessions[sessionId].minutes, 25);
  assert.equal(context.window.PreparationProgress.getCatalog().notes[identifier].pages.en.title, 'Current title');
  context.control('export').click();
  assert.equal(api.parse(await context.blobs.at(-1).text()).schedule.sessions[sessionId].date, '2026-10-12');
  const incoming = backup();
  incoming.schedule = {version: 1, sessions: {[sessionId]: {...session, minutes: 45}}};
  await drop(context, incoming);
  assert.match(context.control('preview-text').textContent, /Sessions: 0 added; 1 differ, with 0 replacements/);
  context.control('policy').value = 'prefer-backup';
  context.control('policy').events.change();
  assert.match(context.control('preview-text').textContent, /with 1 replacements/);
  context.control('confirm').click();
  assert.equal(context.state().schedule.sessions[sessionId].minutes, 45);
  context.control('recovery').click();
  assert.equal(api.parse(await context.blobs.at(-1).text()).schedule.sessions[sessionId].minutes, 25);
  await drop(context, backup('Older file without schedule'));
  context.control('confirm').click();
  assert.equal(context.state().schedule.sessions[sessionId].minutes, 45);
});

test('an over-limit pending import cannot turn a successful session save into a reported failure', async () => {
  const context = await environment();
  const session = {title: 'Practice', date: '2026-10-12', minutes: 25, noteId: '',
    status: 'planned', completedOn: '', actualMinutes: null, updatedAt: '2026-10-01T00:00:00.000Z'};
  const incoming = api.empty();
  incoming.schedule = {version: 1, sessions: {}};
  for (let index = 0; index < 300; index++) incoming.schedule.sessions['session-' + index.toString(16).padStart(32, '0')] = session;
  await drop(context, incoming);
  assert.equal(context.control('confirm').disabled, false);
  assert.doesNotThrow(() => context.window.PreparationProgress.updateSession('session-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', session));
  assert.equal(Object.keys(context.state().schedule.sessions).length, 1);
  assert.equal(context.control('confirm').disabled, true);
  assert.match(context.control('preview-text').textContent, /Your saved changes are unaffected/);
  context.control('confirm').click();
  assert.equal(Object.keys(context.state().schedule.sessions).length, 1);
  context.control('cancel').click();
  await drop(context, api.empty());
  assert.equal(context.control('confirm').disabled, false);
});

test('article revision banner acknowledges only the update and keeps the study record', async () => {
  const original = backup('Keep my next step');
  original.entries[identifier].status = 'practiced';
  original.workspace = {version: 1, records: {baseline: {edition: 1, updatedAt: '2026-01-01T00:00:00.000Z'}}};
  const catalogValue = {updatesVersion: 1, edition: 2, notes: {[identifier]: {
    pages: {en: {url: 'interview/example.en.html', title: 'Example'}}, topics: ['llm'],
    update: {introduced: 1, revision: 2, summary: {en: 'Added a worked example.'}}
  }}};
  const context = await environment({article: true, initial: JSON.stringify(original), catalogValue, updatesEnabled: true});
  assert.equal(context.editor.hidden, false);
  assert.equal(context.banner.hidden, false);
  assert.equal(context.banner.querySelector('[data-prep-update-summary]').textContent, 'Added a worked example.');
  context.banner.querySelector('[data-prep-update-read]').click();
  assert.equal(context.banner.hidden, true);
  assert.equal(context.state().entries[identifier].status, 'practiced');
  assert.equal(context.state().entries[identifier].note, 'Keep my next step');
  assert.equal(context.state().workspace.records['seen-' + identifier].revision, 2);
});

test('recovery preview and cancel do not restore, explicit confirm restores older settings', async () => {
  const original = backup();
  original.workspace = {version: 1, records: {preferences: {autoAdd: true, updatedAt: '2026-01-01T00:00:00.000Z'}}};
  const context = await environment({initial: JSON.stringify(original)});
  context.window.PreparationProgress.updateWorkspace({preferences: {autoAdd: false, updatedAt: '2026-02-01T00:00:00.000Z'}}, 'auto-add:off');
  const recoveryRow = context.control('snapshots').children[0];
  recoveryRow.children[1].click();
  await tick();
  assert.equal(context.control('preview').hidden, false);
  assert.equal(context.state().workspace.records.preferences.autoAdd, false);
  context.control('cancel').click();
  assert.equal(context.state().workspace.records.preferences.autoAdd, false);
  recoveryRow.children[1].click();
  await tick();
  context.control('policy').value = 'prefer-backup';
  context.control('confirm').click();
  assert.equal(context.state().workspace.records.preferences.autoAdd, true);
  assert.equal(context.state().entries[identifier].note, original.entries[identifier].note);
});

test('missing primary data offers explicit recovery without an automatic overwrite', async () => {
  const context = await environment({initial: JSON.stringify(backup())});
  context.window.PreparationProgress.updateWorkspace({preferences: {autoAdd: true, updatedAt: '2026-01-01T00:00:00.000Z'}});
  context.data.delete(api.KEY);
  context.events.storage({key: api.KEY});
  assert.equal(context.data.has(api.KEY), false);
  assert.match(context.control('storage').textContent, /main record is missing/);
  context.control('snapshots').children[0].children[1].click();
  await tick();
  assert.equal(context.data.has(api.KEY), false);
  context.control('confirm').click();
  assert.equal(context.state().entries[identifier].note, 'A backup note');
  assert.equal(context.window.PreparationProgress.getHealth().blocked, false);
});

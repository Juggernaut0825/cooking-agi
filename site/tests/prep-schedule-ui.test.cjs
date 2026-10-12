const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const {webcrypto} = require('node:crypto');
const api = require('../static/prep-progress-store.js');
const source = fs.readFileSync(path.join(__dirname, '../static/prep-schedule.js'), 'utf8');
const noteId = 'note-0123456789abcdef';

class Element {
  constructor(tag = 'div') {
    this.tag = tag;
    this.children = [];
    this.events = {};
    this.attributes = {};
    this.hidden = false;
    this.value = '';
    this.textContent = '';
    this.isConnected = true;
  }
  append(...children) { this.children.push(...children); }
  replaceChildren() {
    const detach = element => { element.isConnected = false; element.children.forEach(detach); };
    this.children.forEach(detach);
    this.children = [];
  }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(name, callback) { this.events[name] = callback; }
  fire(name) { this.events[name]?.({preventDefault() {}, currentTarget: this}); }
  focus() { this.focused = true; }
  reportValidity() { return true; }
}

function environment({data = new Map(), denied = false, language = 'en', query = '', catalogReady = true} = {}) {
  const storage = {
    getItem(key) { if (denied) throw Error('storage'); return data.get(key) ?? null; },
    setItem(key, value) { if (denied) throw Error('storage'); data.set(key, value); }
  };
  const store = api.createStore(storage);
  const controls = new Map();
  const root = new Element();
  root.querySelector = selector => {
    const name = selector.slice(6, -1);
    if (!controls.has(name)) controls.set(name, new Element());
    return controls.get(name);
  };
  const control = name => root.querySelector('[data-' + name + ']');
  control('schedule-filter').value = 'planned';
  control('schedule-form').hidden = control('schedule-checkin').hidden = true;
  const events = {};
  const catalog = {notes: {[noteId]: {pages: {en: {title: 'Attention'}, zh: {title: '注意力'}}}}};
  const document = {documentElement: {lang: language}, querySelector: () => root, createElement: tag => new Element(tag)};
  const window = {
    location: {href: 'https://example.org/interview/dashboard.html' + query},
    history: {replaceState(state, title, href) { window.location.href = href; }},
    dispatchEvent(event) { events[event.type]?.(event); },
    crypto: webcrypto,
    addEventListener(name, callback) { events[name] = callback; },
    PreparationProgress: {
      updateSession: (identifier, changes) => store.updateSession(identifier, changes),
      getState: () => store.read(), getHealth: () => store.health(), getCatalog: () => catalogReady ? catalog : null,
      getHealthMessage: () => store.health().unavailable ? 'Export before leaving.' : 'Saved locally.',
      getDestination: identifier => identifier === noteId ? {url: '/attention.html', title: 'Attention'} : null
    }
  };
  class CustomEvent { constructor(type, options) { this.type = type; this.detail = options.detail; } }
  vm.runInNewContext(source, {window, document, URL, Event, CustomEvent, Date, Intl, Uint8Array, Map, Object, Number, String, JSON});
  function button(label) {
    const find = element => element.children.flatMap(child => [child, ...find(child)]);
    return find(control('schedule-list')).find(element => element.tag === 'button' && element.textContent === label);
  }
  return {control, root, store, data, storage, events, catalog, button, window,
    loadCatalog() { catalogReady = true; events['notes:prep-catalog'](); },
    sessions: () => store.read().schedule?.sessions || {},
    add({title = 'Implement attention', date = '2026-04-06', minutes = '25', linkedNote = ''} = {}) {
      control('schedule-add').fire('click');
      control('session-title').value = title;
      control('session-date').value = date;
      control('session-minutes').value = minutes;
      control('session-note').value = linkedNote;
      control('schedule-form').fire('submit');
    },
    filter(value) { control('schedule-filter').value = value; control('schedule-filter').fire('change'); }
  };
}

test('route requests create a draft without overwriting an open draft or accepting unknown notes', () => {
  const context = environment();
  const send = detail => context.events['notes:prep-plan-request']({detail});
  send({noteId: 'unknown', title: 'Wrong', minutes: 30});
  assert.equal(context.control('schedule-form').hidden, true);
  send({noteId, title: 'Trace shapes', minutes: 25});
  assert.equal(context.control('session-title').value, 'Trace shapes');
  assert.equal(context.control('session-minutes').value, '25');
  assert.equal(context.control('session-note').value, noteId);
  assert.equal(Object.keys(context.sessions()).length, 0);
  send({noteId, title: 'Do not overwrite', minutes: 60});
  assert.equal(context.control('session-title').value, 'Trace shapes');
  assert.match(context.control('schedule-message').textContent, /open draft/);
  context.control('schedule-cancel').fire('click');
  send({noteId, title: 'Bad duration', minutes: NaN});
  assert.equal(context.control('schedule-form').hidden, true);
});

test('week selection filters dates and new plans use that date; rescheduling remains visible', () => {
  const context = environment();
  context.add({date: '2026-04-06'});
  context.add({date: '2026-04-10'});
  context.events['notes:prep-day']({detail: {date: '2026-04-06'}});
  assert.equal(context.control('schedule-list').children.length, 1);
  assert.equal(context.control('schedule-day-filter').hidden, false);
  context.control('schedule-add').fire('click');
  assert.equal(context.control('session-date').value, '2026-04-06');
  context.control('schedule-cancel').fire('click');
  context.button('Edit plan').fire('click');
  context.control('session-date').value = '2026-04-11';
  context.control('schedule-form').fire('submit');
  assert.match(context.control('schedule-day-label').textContent, /Apr 11/);
  assert.equal(context.control('schedule-list').children.length, 1);
  context.control('schedule-clear-day').fire('click');
  assert.equal(context.control('schedule-list').children.length, 2);
  assert.equal(context.control('schedule-day-filter').hidden, true);
  context.events['notes:prep-day']({detail: {date: '2026-99-99'}});
  assert.equal(context.control('schedule-day-filter').hidden, true);
});

test('changing a completed plan with a day filter does not hide it', () => {
  const context = environment();
  context.add({date: '2026-04-06'});
  context.events['notes:prep-day']({detail: {date: '2026-04-06'}});
  context.button('Record a session').fire('click');
  context.control('checkin-date').value = '2026-04-07';
  context.control('checkin-minutes').value = '';
  context.control('schedule-checkin').fire('submit');
  context.button('Edit plan').fire('click');
  context.control('session-date').value = '2026-04-08';
  context.control('schedule-form').fire('submit');
  assert.equal(context.control('schedule-filter').value, 'done');
  assert.equal(context.control('schedule-list').children.length, 1);
  assert.equal(Object.values(context.sessions())[0].completedOn, '2026-04-07');
});

test('note entry prefills a localized draft only; saving remains explicit', () => {
  for (const [language, title] of [['en', 'Attention'], ['zh-CN', '注意力']]) {
    const context = environment({language, query: '?note=' + noteId + '#schedule'});
    assert.equal(context.control('schedule-form').hidden, false);
    assert.equal(context.control('session-title').value, title);
    assert.equal(context.control('session-note').value, noteId);
    assert.equal(Object.keys(context.sessions()).length, 0);
    context.control('schedule-form').fire('submit');
    assert.equal(Object.values(context.sessions())[0].noteId, noteId);
    assert.equal(new URL(context.window.location.href).search, '');
  }
});

test('late catalog arrival prefills once and never replaces an existing draft', () => {
  const context = environment({catalogReady: false, query: '?note=' + noteId});
  assert.equal(context.control('schedule-form').hidden, true);
  context.loadCatalog();
  assert.equal(context.control('session-title').value, 'Attention');
  context.control('session-title').value = 'My custom task';
  context.loadCatalog();
  assert.equal(context.control('session-title').value, 'My custom task');
  const draft = environment({catalogReady: false, query: '?note=' + noteId});
  draft.control('schedule-add').fire('click');
  draft.control('session-title').value = 'Keep this';
  draft.loadCatalog();
  assert.equal(draft.control('session-title').value, 'Keep this');
  assert.equal(draft.control('session-note').value, '');
});

test('unknown or malicious query data cannot open a task or save progress', () => {
  for (const query of ['?note=https://evil.test', '?note=note-ffffffffffffffff', '?note=%3Cscript%3E', '']) {
    const context = environment({query});
    assert.equal(context.control('schedule-form').hidden, true);
    assert.equal(Object.keys(context.sessions()).length, 0);
  }
});

test('cancelling a prefilled note also clears the one-time entry link', () => {
  const context = environment({query: '?note=' + noteId + '#schedule'});
  context.control('schedule-cancel').fire('click');
  assert.equal(context.window.location.href, 'https://example.org/interview/dashboard.html#schedule');
  assert.equal(Object.keys(context.sessions()).length, 0);
});

test('nonconsecutive sessions retain different effective minutes; grouping uses civil dates', () => {
  const context = environment();
  context.add();
  context.add({title: 'Trace KV cache', date: '2026-04-10', minutes: '65'});
  const sessions = Object.values(context.sessions());
  assert.equal(sessions.length, 2);
  assert.deepEqual(sessions.map(entry => [entry.date, entry.minutes]), [['2026-04-06', 25], ['2026-04-10', 65]]);
  assert.equal(context.control('schedule-list').children.length, 2);
  assert.equal(context.control('schedule-list').children[0].children[0].children[0].dateTime, '2026-04-06');
  assert.equal(Object.keys(context.store.read().entries).length, 0);
  assert.match(context.control('schedule-summary').textContent, /2 planned/);
});

test('check-in records actual date and time independently; editing plan preserves check-in', () => {
  const context = environment();
  context.add();
  context.button('Record a session').fire('click');
  context.control('checkin-date').value = '2026-04-08';
  context.control('checkin-minutes').value = '15';
  context.control('schedule-checkin').fire('submit');
  let entry = Object.values(context.sessions())[0];
  assert.equal(entry.status, 'done');
  assert.equal(entry.completedOn, '2026-04-08');
  assert.equal(entry.actualMinutes, 15);
  assert.equal(entry.minutes, 25);
  assert.equal(context.control('schedule-filter').value, 'done');
  context.button('Edit plan').fire('click');
  context.control('session-date').value = '2026-04-07';
  context.control('session-minutes').value = '45';
  context.control('schedule-form').fire('submit');
  entry = Object.values(context.sessions())[0];
  assert.equal(entry.date, '2026-04-07');
  assert.equal(entry.actualMinutes, 15);
  assert.equal(entry.completedOn, '2026-04-08');
  assert.equal(Object.keys(context.store.read().entries).length, 0);
  assert.equal(context.control('schedule-add').focused, true);
});

test('optional check-in time is null rather than invented; undo and removal are reversible', () => {
  const context = environment();
  context.add();
  context.button('Record a session').fire('click');
  assert.equal(context.control('checkin-minutes').value, '');
  context.control('checkin-date').value = '2026-04-08';
  context.control('schedule-checkin').fire('submit');
  assert.equal(Object.values(context.sessions())[0].actualMinutes, null);
  context.button('Undo check-in').fire('click');
  assert.equal(Object.values(context.sessions())[0].status, 'planned');
  context.filter('planned');
  context.button('Remove').fire('click');
  assert.equal(context.control('schedule-list').children.length, 0);
  context.filter('cancelled');
  context.button('Restore').fire('click');
  assert.equal(Object.values(context.sessions())[0].status, 'planned');
  assert.equal(Object.keys(context.sessions()).length, 1);
  assert.equal(context.control('schedule-list').children.length, 0);
});

test('invalid dates, empty tasks, and fractional durations never create sessions', () => {
  const context = environment();
  for (const values of [{date: '2026-02-29'}, {date: '2026-04-31'}, {date: '1800-04-01'}, {title: ' '}, {minutes: '0'}, {minutes: '3.5'}, {minutes: ''}]) {
    context.add(values);
    assert.equal(Object.keys(context.sessions()).length, 0);
    assert.equal(context.control('schedule-form').hidden, false);
    assert.ok(context.control('schedule-form-error').textContent);
  }
  context.add({date: '2028-02-29', minutes: '1'});
  assert.equal(Object.keys(context.sessions()).length, 1);
});

test('check-in rejects future dates; zero is an explicit duration', () => {
  const context = environment();
  context.add();
  context.button('Record a session').fire('click');
  context.control('checkin-date').value = '2200-01-01';
  context.control('checkin-minutes').value = '0';
  context.control('schedule-checkin').fire('submit');
  assert.equal(Object.values(context.sessions())[0].status, 'planned');
  context.control('checkin-date').value = '2026-04-01';
  context.control('schedule-checkin').fire('submit');
  assert.equal(Object.values(context.sessions())[0].actualMinutes, 0);
});

test('title is plain text, note link resolves from catalog, and reload/language retain state', () => {
  const context = environment();
  const title = '<script>alert(1)</script>';
  context.add({title, linkedNote: noteId});
  const row = context.control('schedule-list').children[0].children[1].children[0];
  assert.equal(row.children[0].textContent, title);
  assert.equal(row.children[0].innerHTML, undefined);
  assert.equal(row.children[2].href, '/attention.html');
  const chinese = environment({data: context.data, language: 'zh-CN'});
  assert.equal(Object.values(chinese.sessions())[0].title, title);
  assert.equal(chinese.control('schedule-summary').textContent, '待完成 1 次 · 已完成 0 次');
  const restored = api.merge(api.empty(), api.parse(context.store.serialize())).state;
  assert.equal(Object.values(restored.schedule.sessions)[0].noteId, noteId);
});

test('Chinese session actions distinguish completion records from note progress', () => {
  const context = environment({language: 'zh-CN'});
  context.add({linkedNote: noteId});
  context.button('记录本次学习').fire('click');
  context.control('checkin-date').value = '2026-04-06';
  context.control('checkin-minutes').value = '20';
  context.control('schedule-checkin').fire('submit');
  assert.equal(context.control('schedule-summary').textContent, '待完成 0 次 · 已完成 1 次');
  assert.equal(Object.values(context.sessions())[0].actualMinutes, 20);
  assert.ok(context.button('修改记录'));
  assert.deepEqual(context.store.read().entries, {});
  context.button('撤销完成').fire('click');
  assert.equal(Object.values(context.sessions())[0].status, 'planned');
  assert.equal(context.control('schedule-summary').textContent, '待完成 1 次 · 已完成 0 次');
  context.filter('planned');
  assert.ok(context.button('记录本次学习'));
});

test('empty day copy describes the active filter, not an empty schedule', () => {
  for (const language of ['zh-CN', 'en']) {
    const context = environment({language});
    context.add({date: '2026-04-06'});
    context.events['notes:prep-day']({detail: {date: '2026-04-07'}});
    for (const filter of ['planned', 'done', 'all', 'cancelled']) {
      context.filter(filter);
      assert.equal(context.control('schedule-empty').hidden, false);
      assert.equal(Object.keys(context.sessions()).length, 1);
      assert.match(context.control('schedule-empty').textContent, language === 'en' ? /this day and filter/ : /这一天没有符合筛选条件/);
    }
    context.filter('planned');
    context.control('schedule-clear-day').fire('click');
    assert.equal(context.control('schedule-empty').hidden, true);
    assert.equal(context.control('schedule-list').children.length, 1);
  }
});

test('catalog arrival retains a selected missing note and does not erase typed input', () => {
  const context = environment();
  context.control('schedule-add').fire('click');
  context.control('session-title').value = 'A draft';
  context.control('session-note').value = 'note-aaaaaaaaaaaaaaaa';
  context.events['notes:prep-catalog']();
  assert.equal(context.control('session-title').value, 'A draft');
  assert.equal(context.control('session-note').value, 'note-aaaaaaaaaaaaaaaa');
  assert.equal(context.control('session-note').children.at(-1).value, 'note-aaaaaaaaaaaaaaaa');
});

test('external updates do not clobber the form or silently overwrite an edited session', () => {
  const context = environment();
  context.add();
  context.button('Edit plan').fire('click');
  context.control('session-title').value = 'Unsaved draft';
  const identifier = Object.keys(context.sessions())[0];
  api.createStore(context.storage).updateSession(identifier, {title: 'Changed in other tab', updatedAt: new Date().toISOString()});
  context.events['notes:prep-storage']();
  assert.equal(context.control('session-title').value, 'Unsaved draft');
  context.control('schedule-form').fire('submit');
  assert.match(context.control('schedule-form-error').textContent, /changed elsewhere/);
  assert.equal(context.sessions()[identifier].title, 'Changed in other tab');
});

test('storage failure keeps new sessions exportable; unsupported version disables writes', () => {
  const context = environment({denied: true});
  context.add();
  assert.equal(Object.keys(api.parse(context.store.serialize()).schedule.sessions).length, 1);
  assert.match(context.control('schedule-message').textContent, /Export before leaving/);
  const state = api.empty();
  state.schedule = {version: 2, sessions: {}};
  const unsupported = environment({data: new Map([[api.KEY, JSON.stringify(state)]])});
  assert.equal(unsupported.control('schedule-add').disabled, true);
  assert.equal(unsupported.control('schedule-fields').disabled, true);
});

test('cancel editing writes nothing and all-view excludes removed sessions', () => {
  const context = environment();
  context.add();
  const before = JSON.stringify(context.sessions());
  context.button('Edit plan').fire('click');
  context.control('session-title').value = 'Never saved';
  context.control('schedule-cancel').fire('click');
  assert.equal(JSON.stringify(context.sessions()), before);
  assert.equal(context.control('schedule-form').hidden, true);
  context.button('Remove').fire('click');
  context.filter('all');
  assert.equal(context.control('schedule-list').children.length, 0);
});

test('stale undo cannot erase another tab’s more recent check-in', () => {
  const context = environment();
  context.add();
  context.button('Record a session').fire('click');
  context.control('checkin-date').value = '2026-04-01';
  context.control('checkin-minutes').value = '20';
  context.control('schedule-checkin').fire('submit');
  const staleUndo = context.button('Undo check-in');
  const identifier = Object.keys(context.sessions())[0];
  api.createStore(context.storage).updateSession(identifier, {actualMinutes: 40, completedOn: '2026-04-02', updatedAt: new Date().toISOString()});
  staleUndo.fire('click');
  assert.equal(context.sessions()[identifier].status, 'done');
  assert.equal(context.sessions()[identifier].actualMinutes, 40);
  assert.match(context.control('schedule-message').textContent, /changed elsewhere/);
});

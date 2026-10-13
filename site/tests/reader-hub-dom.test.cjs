const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const store = require('../static/prep-progress-store.js');
const source = fs.readFileSync(require.resolve('../static/reader-hub.js'), 'utf8');

class Element {
  constructor(tag) {
    this.tag = tag;
    this.attributes = {};
    this.children = [];
    this.dataset = {};
    this.events = {};
    this.hidden = false;
    this.textContent = '';
  }
  setAttribute(key, value) {
    this.attributes[key] = String(value);
    if (key.startsWith('data-')) this.dataset[key.slice(5)] = String(value);
    if (key === 'hidden') this.hidden = true;
  }
  append(...children) { children.forEach(child => { child.parent = this; this.children.push(child); }); }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  addEventListener(name, handler) { this.events[name] = handler; }
  focus() {}
  matches(selector) {
    if (selector.startsWith('.')) return (this.attributes.class || '').split(' ').includes(selector.slice(1));
    const attribute = /^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(selector);
    return attribute ? Object.hasOwn(this.attributes, attribute[1]) && (attribute[2] === undefined || this.attributes[attribute[1]] === attribute[2]) : false;
  }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector); }
  click() { this.events.click?.({target: this}); }
}

function environment(initialSettings = {}, language = 'en') {
  const values = new Map();
  const storage = {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)};
  const progress = store.createStore(storage);
  progress.updateWorkspace({'reader-settings': {...initialSettings, updatedAt: '2026-10-12T08:00:00.000Z'}});
  const body = new Element('body');
  const right = new Element('div');
  right.insertBefore = child => right.append(child);
  body.append(right);
  const timers = [];
  const dispatched = [];
  const document = {
    body, documentElement: {lang: language, dataset: {}}, visibilityState: 'visible',
    createElement: tag => new Element(tag), createElementNS: (namespace, tag) => new Element(tag),
    createTextNode: text => Object.assign(new Element('text'), {textContent: text}),
    querySelector: selector => selector === '.topbar-right' ? right : null,
    addEventListener() {}
  };
  const window = {
    SITE: {prefix: '/'},
    PreparationProgress: {getState: () => progress.read(), updateWorkspace: (...args) => progress.updateWorkspace(...args), getCatalog: () => ({notes: {}})},
    addEventListener() {}, setTimeout: callback => { timers.push(callback); return timers.length; },
    dispatchEvent: event => { dispatched.push(event); return true; },
    matchMedia: () => ({matches: false})
  };
  vm.runInNewContext(source, {window, document, URL, Date, Event, CustomEvent, location: {href: 'https://example.com/note.html'}});
  const selectSettings = () => {
    body.querySelector('.reader-hub-toggle').click();
    const tab = body.querySelector('[data-tab="settings"]');
    body.querySelector('.reader-hub-tabs').events.click({target: tab});
  };
  const radio = label => body.querySelector('[id="reader-panel-settings"]').querySelectorAll('[role="radio"]').find(item => item.textContent === label);
  return {body, progress, storage, window, timers, dispatched, selectSettings, radio, toast: body.querySelector('.star-toast')};
}

test('only successful manual bookmark changes emit public-count actions', () => {
  const noteId = 'note-0123456789abcdef';
  for (const persisted of [true, false]) {
    const context = environment();
    context.progress.updateWorkspace({['bookmark-' + noteId]: {saved: true, updatedAt: new Date().toISOString()}});
    assert.equal(context.dispatched.length, 0);
    context.body.querySelector('.reader-hub-toggle').click();
    const tab = context.body.querySelector('[data-tab="saved"]');
    context.body.querySelector('.reader-hub-tabs').events.click({target: tab});
    if (!persisted) context.window.PreparationProgress.updateWorkspace = () => ({persisted: false});
    context.body.querySelector('.reader-hub-remove').click();
    const actions = context.dispatched.filter(event => event.type === 'notes:bookmark-action');
    assert.equal(actions.length, persisted ? 1 : 0);
    if (persisted) {
      assert.equal(actions[0].detail.noteId, noteId);
      assert.equal(actions[0].detail.saved, false);
    }
  }
});

test('Show restores legacy permanent hiding immediately and after a page reload', () => {
  for (const [language, show, hide] of [['en', 'Show', 'Hide'], ['zh', '显示', '隐藏']]) {
    const context = environment({mascot: 'hidden', starDone: true, snoozedUntil: '2199-01-01T00:00:00.000Z'}, language);
    assert.equal(context.toast.hidden, true);
    context.selectSettings();
    context.radio(show).click();
    assert.equal(context.toast.hidden, false);
    const settings = context.progress.read().workspace.records['reader-settings'];
    assert.equal(settings.starDone, false);
    assert.equal(settings.snoozedUntil, '');
    assert.equal(settings.mascot, 'collapsed');
    assert.equal(context.radio(show).attributes['aria-checked'], 'true');
    const reloaded = environment(settings, language);
    assert.equal(reloaded.timers.length, 0);
    context.radio(hide).click();
    assert.equal(context.toast.hidden, true);
    const nextDay = environment({...settings, starAskedOn: '2000-01-01'}, language);
    nextDay.timers[0]();
    assert.equal(nextDay.toast.hidden, false);
  }
});

test('Don’t show again hides the notice without pretending the reader starred the repo', () => {
  const context = environment();
  context.timers[0]();
  assert.equal(context.toast.hidden, false);
  context.body.querySelector('.star-toast-quiet').click();
  const settings = context.progress.read().workspace.records['reader-settings'];
  assert.equal(settings.mascot, 'hidden');
  assert.equal(settings.starDone, false);
  assert.equal(context.toast.hidden, true);
  context.selectSettings();
  context.radio('Show').click();
  assert.equal(context.toast.hidden, false);
});

test('clear reports persistence failures instead of claiming success', () => {
  const context = environment();
  context.progress.updateWorkspace({'reads-20261012': {notes: {'note-0123456789abcdef': 1}, updatedAt: '2026-10-12T08:00:00.000Z'}});
  context.selectSettings();
  context.window.PreparationProgress.updateWorkspace = () => { throw Error('blocked'); };
  const clear = context.body.querySelector('.reader-hub-danger');
  clear.click();
  clear.click();
  assert.match(context.body.querySelector('.reader-hub-status').textContent, /Could not save/);
  assert.equal(context.progress.read().workspace.records['reads-20261012'].notes['note-0123456789abcdef'], 1);
});

test('retrying a quota-failed clear writes the already empty in-memory snapshot', () => {
  const context = environment();
  context.progress.updateWorkspace({'reads-20261012': {notes: {'note-0123456789abcdef': 1}, updatedAt: '2026-10-12T08:00:00.000Z'}});
  context.selectSettings();
  const persist = context.storage.setItem;
  context.storage.setItem = () => { throw Error('quota'); };
  const clear = context.body.querySelector('.reader-hub-danger');
  clear.click();
  clear.click();
  assert.match(context.body.querySelector('.reader-hub-status').textContent, /Could not save/);
  assert.deepEqual(context.progress.read().workspace.records['reads-20261012'].notes, {});
  context.storage.setItem = persist;
  const retry = context.body.querySelector('.reader-hub-danger');
  retry.click();
  retry.click();
  assert.match(context.body.querySelector('.reader-hub-status').textContent, /Reading history cleared/);
  assert.deepEqual(store.createStore(context.storage).read().workspace.records['reads-20261012'].notes, {});
});

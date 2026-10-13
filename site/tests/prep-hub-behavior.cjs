const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../static/prep-hub.js'), 'utf8');

class Element {
  constructor(id) {
    this.id = id;
    this.attributes = {};
    this.dataset = {};
    this.events = {};
    this.hidden = false;
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, callback) { this.events[name] = callback; }
  focus() { this.focused = true; }
  closest() { return this.parent || this; }
}

function simulate(hash = '', present = true, progress = null) {
  const panels = ['review', 'plan'].map(name => new Element(name));
  const tabs = panels.map(panel => {
    const tab = new Element('prep-tab-' + panel.id);
    tab.dataset.prepTab = panel.id;
    return tab;
  });
  const list = new Element('modes');
  const root = {
    querySelectorAll: selector => selector === '[data-prep-tab]' ? tabs : panels,
    querySelector: () => list
  };
  const language = new URL('https://example.test/cooking-agi/interview/index.en.html?lang=en');
  const location = new URL('https://example.test/cooking-agi/interview/index.html' + hash);
  const events = {};
  const history = {entries: [], pushState(unusedState, unusedTitle, target) {
    this.entries.push(location.href);
    location.href = target;
  }, replaceState(unusedState, unusedTitle, target) { location.href = target; }};
  const nested = new Element('plan-title');
  nested.parent = panels[1];
  const legacy = new Element('_2');
  legacy.parent = panels[1];
  const document = {
    querySelector: () => present ? root : null,
    querySelectorAll: () => [language],
    getElementById: identifier => [...panels, nested, legacy].find(item => item.id === identifier) || null
  };
  const window = {addEventListener: (name, callback) => { events[name] = callback; }};
  if (progress) window.PreparationProgress = progress;
  vm.runInNewContext(source, {document, window, location, history, URL});
  function click(index, extra = {}) {
    const event = {button: 0, ...extra, preventDefault() { this.prevented = true; }};
    tabs[index].events.click(event);
    return event;
  }
  function key(index, key) {
    const event = {key, preventDefault() { this.prevented = true; }};
    tabs[index].events.keydown(event);
    return event;
  }
  return {panels, tabs, list, language, location, events, history, click, key};
}

const basic = simulate();
assert.equal(basic.list.attributes.role, 'tablist');
assert.equal(basic.panels[0].hidden, false);
assert.equal(basic.panels[1].hidden, true);
assert.equal(basic.tabs[0].tabIndex, 0);
assert.equal(basic.tabs[1].tabIndex, -1);
assert.equal(basic.click(1).prevented, true);
assert.equal(basic.panels[0].hidden, true);
assert.equal(basic.panels[1].hidden, false);
assert.equal(basic.tabs[1].attributes['aria-selected'], 'true');
assert.equal(basic.location.hash, '#plan');
assert.equal(basic.language.hash, '#plan');
assert.equal(basic.language.search, '?lang=en');
assert.equal(basic.history.entries.length, 1);
basic.click(1);
assert.equal(basic.history.entries.length, 1);
basic.location.href = basic.history.entries[0];
basic.events.popstate();
assert.equal(basic.panels[0].hidden, false);
assert.equal(basic.tabs[0].attributes['aria-selected'], 'true');

for (const modifier of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
  const state = simulate();
  assert.equal(state.click(1, {[modifier]: true}).prevented, undefined);
  assert.equal(state.history.entries.length, 0);
}
assert.equal(simulate().click(1, {button: 1}).prevented, undefined);

for (const key of ['ArrowRight', 'End']) {
  const state = simulate();
  state.key(0, key);
  assert.equal(state.tabs[1].focused, true);
  assert.equal(state.panels[1].hidden, false);
  state.key(1, 'Home');
  assert.equal(state.tabs[0].focused, true);
  assert.equal(state.panels[0].hidden, false);
}
const keyboard = simulate();
keyboard.key(0, 'ArrowLeft');
assert.equal(keyboard.panels[1].hidden, false);
for (const key of [' ', 'Enter']) assert.equal(keyboard.key(1, key).prevented, true);
assert.equal(keyboard.key(1, 'Tab').prevented, undefined);

for (const hash of ['#plan', '#plan-title']) {
  const state = simulate(hash);
  assert.equal(state.panels[1].hidden, false);
  assert.equal(state.language.hash, hash);
  state.location.hash = '#review';
  state.events.hashchange();
  assert.equal(state.panels[0].hidden, false);
}
for (const hash of ['#%E0%A4%A', '#unknown', '#prep-routes']) {
  assert.equal(simulate(hash).panels[0].hidden, false);
}
simulate('', false);
const legacy = simulate('#_2');
assert.equal(legacy.panels[1].hidden, false);
assert.equal(legacy.language.hash, '#plan');
assert.equal(simulate('#ml').language.hash, '#prep-routes');
const progress = {mode: 'plan', getMode() { return this.mode; }, setMode(value) { this.mode = value; }};
const remembered = simulate('', true, progress);
assert.equal(remembered.panels[1].hidden, false);
remembered.click(0);
assert.equal(progress.mode, 'review');
progress.mode = 'plan';
remembered.events['notes:prep-restored']();
assert.equal(remembered.location.hash, '#plan');
assert.equal(remembered.panels[1].hidden, false);
const dashboard = simulate('#progress', true, progress);
progress.mode = 'review';
dashboard.events['notes:prep-restored']();
assert.equal(dashboard.location.hash, '#progress');
assert.equal(dashboard.panels[0].hidden, false);
progress.mode = 'plan';
dashboard.events['notes:prep-storage']();
assert.equal(dashboard.panels[1].hidden, false);
dashboard.location.hash = '#review';
dashboard.events['notes:prep-storage']();
assert.equal(dashboard.panels[0].hidden, false);
assert.equal(simulate('#review', true, {getMode() { return 'plan'; }}).panels[0].hidden, false);
console.log('Prep hub: modes, keyboard, modified clicks, history, deep links, and language passed.');

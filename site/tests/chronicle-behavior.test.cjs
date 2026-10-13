const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../static/chronicle.js'), 'utf8');

function element(dataset = {}) {
  const attributes = {};
  return {
    dataset, attributes, events: {}, hidden: false,
    classList: {toggle() {}, add() {}, remove() {}},
    setAttribute(name, value) { attributes[name] = value; },
    addEventListener(name, handler) { this.events[name] = handler; },
    scrollIntoView() {}, querySelectorAll() { return []; },
    closest(selector) { return selector === '[hidden]' && this.hidden ? this : null; }
  };
}

function environment(href = 'https://example.com/cooking-agi/learn/technology-timeline.en.html') {
  const location = new URL(href);
  const english = location.pathname.endsWith('.en.html');
  const switcher = {href: new URL(english ? 'technology-timeline.html' : 'technology-timeline.en.html', location).href};
  const works = [element({workTopic: 'energy'}), element({workTopic: 'rl'})];
  const fields = ['energy', 'rl'].map(field => Object.assign(element({field}), {querySelector: () => ({textContent: field})}));
  const treeFields = ['energy', 'rl'].map(fieldLink => element({fieldLink}));
  const banner = element();
  const label = element();
  const reset = element();
  const era = Object.assign(element({era: 'recent'}), {querySelector: () => works.find(work => !work.hidden)});
  const ids = {'event-energy': works[0], 'event-grpo': works[1], 'era-recent': era};
  const root = {
    querySelectorAll: selector => ({
      '.chronicle-work': works, '.chronicle-branch': [era], '.chronicle-era': [era],
      '[data-field]': fields, '[data-field-link]': treeFields
    })[selector] || [],
    querySelector: selector => ({'[data-filter-banner]': banner, '[data-filter-label]': label, '[data-filter-reset]': reset})[selector] || null
  };
  const events = {};
  const document = {
    documentElement: {lang: english ? 'en' : 'zh'}, body: {append() {}},
    querySelector: selector => selector === '[data-chronicle]' ? root : null,
    querySelectorAll: selector => selector === '[data-language-switch]' ? [switcher] : [],
    getElementById: id => ids[id] || null, createElement: () => element()
  };
  vm.runInNewContext(source, {
    document, location, URL, URLSearchParams, window: {},
    history: {state: null, replaceState: (state, title, url) => { location.href = String(url); }},
    addEventListener: (name, callback) => { events[name] = callback; },
    matchMedia: () => ({matches: true}), requestAnimationFrame: callback => callback()
  });
  return {location, switcher, events, fields, treeFields, reset, works};
}

test('field selection and reset keep the opposite-language link in sync', () => {
  for (const suffix of ['.en', '']) {
    const context = environment(`https://example.com/cooking-agi/learn/technology-timeline${suffix}.html?view=compact`);
    context.treeFields[0].events.click({preventDefault() {}});
    const target = new URL(context.switcher.href);
    assert.equal(target.pathname, `/cooking-agi/learn/technology-timeline${suffix ? '' : '.en'}.html`);
    assert.equal(target.searchParams.get('field'), 'energy');
    assert.equal(target.searchParams.get('view'), 'compact');
    const switched = environment(target.href);
    assert.deepEqual(switched.works.map(work => work.hidden), [false, true]);
    context.reset.events.click();
    assert.equal(new URL(context.switcher.href).searchParams.has('field'), false);
    assert.deepEqual(context.works.map(work => work.hidden), [false, false]);
  }
});

test('shared event anchors survive language switching and hash changes', () => {
  const context = environment('https://example.com/cooking-agi/learn/technology-timeline.en.html?field=rl#event-grpo');
  assert.equal(new URL(context.switcher.href).hash, '#event-grpo');
  assert.equal(new URL(context.switcher.href).searchParams.get('field'), 'rl');
  context.location.hash = '#event-energy';
  context.events.hashchange();
  assert.equal(new URL(context.switcher.href).hash, '#event-energy');
  assert.equal(new URL(context.switcher.href).searchParams.has('field'), false);
  assert.deepEqual(context.works.map(work => work.hidden), [false, false]);
});

test('legacy field and milestone links have usable translated destinations', () => {
  const field = environment('https://example.com/cooking-agi/learn/technology-timeline.html#field-energy');
  assert.equal(new URL(field.switcher.href).searchParams.get('field'), 'energy');
  assert.equal(new URL(field.switcher.href).hash, '#field-energy');
  const event = environment('https://example.com/cooking-agi/learn/technology-timeline.html?milestone=grpo&field=energy');
  const target = new URL(event.switcher.href);
  assert.equal(target.hash, '#event-grpo');
  assert.equal(target.searchParams.has('milestone'), false);
  assert.equal(target.searchParams.has('field'), false);
});

test('browser history restores the field and language destination together', () => {
  const context = environment();
  context.fields[0].events.click();
  context.location.href = 'https://example.com/cooking-agi/learn/technology-timeline.en.html?field=rl#event-grpo';
  context.events.popstate();
  assert.deepEqual(context.works.map(work => work.hidden), [true, false]);
  assert.equal(new URL(context.switcher.href).searchParams.get('field'), 'rl');
  assert.equal(new URL(context.switcher.href).hash, '#event-grpo');
  context.location.search = '';
  context.location.hash = '';
  context.events.popstate();
  assert.deepEqual(context.works.map(work => work.hidden), [false, false]);
  assert.equal(new URL(context.switcher.href).search, '');
});

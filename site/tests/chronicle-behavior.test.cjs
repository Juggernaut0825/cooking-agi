const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../static/chronicle.js'), 'utf8');

// A small stand-in for the DOM: just the calls chronicle.js makes.
function element(props = {}) {
  const node = {dataset: {}, attributes: {}, events: {}, hidden: false, children: [], style: {}, textContent: '', classes: new Set(), ...props};
  node.classList = {
    add: name => node.classes.add(name),
    remove: (...names) => names.forEach(name => node.classes.delete(name)),
    toggle: (name, on = !node.classes.has(name)) => (on ? node.classes.add(name) : node.classes.delete(name)),
    contains: name => node.classes.has(name)
  };
  node.setAttribute = (name, value) => { node.attributes[name] = String(value); };
  node.getAttribute = name => (name in node.attributes ? node.attributes[name] : null);
  node.addEventListener = (name, handler) => { node.events[name] = handler; };
  node.append = (...children) => node.children.push(...children);
  node.contains = other => other === node || node.children.some(child => child.contains && child.contains(other));
  node.querySelector = node.querySelector || (() => null);
  node.querySelectorAll = node.querySelectorAll || (() => []);
  return node;
}

// [id, field, period, shown before the period is opened]
const MILESTONES = [
  ['energy', 'energy', 'origins', true], ['turing', 'algorithms', 'origins', true], ['transistor', 'chips', 'origins', true],
  ['perceptron', 'models', 'origins', false], ['grpo', 'rl', 'recent', true]
];

function environment(href = 'https://example.com/cooking-agi/learn/technology-timeline.en.html', milestones = MILESTONES) {
  const location = new URL(href);
  const english = location.pathname.endsWith('.en.html');
  const switcher = {href: new URL(english ? 'technology-timeline.html' : 'technology-timeline.en.html', location).href};
  const links = milestones.map(([id]) => element({dataset: {node: id}}));
  const items = milestones.map(([, topic, , key, track], index) => element({
    dataset: Object.assign({workTopic: topic, workTrack: track}, key ? {key: ''} : {}),
    querySelector: selector => (selector === '[data-node]' ? links[index] : null)
  }));
  const eras = ['origins', 'recent'].map(era => {
    const own = items.filter((item, index) => milestones[index][2] === era);
    const more = own.length > own.filter(item => 'key' in item.dataset).length
      ? element({dataset: {moreLabel: 'Show all', lessLabel: 'Show fewer'}}) : null;
    return element({
      dataset: {era}, more,
      querySelector: selector => (selector === '[data-more]' ? more : null),
      querySelectorAll: selector => (selector === '.ch-spine > li' ? own : [])
    });
  });
  const chips = ['energy', 'algorithms', 'chips', 'models', 'rl'].map(field => element({dataset: {field}}));
  const articles = milestones.map(([id, topic, era, , track]) => element({id: `event-${id}`, dataset: {workTopic: topic, era, workTrack: track}}));
  const branches = element();
  const resultCount = element();
  const options = [...new Map(milestones.filter(row => row[4]).map(row => [row[4], row[1]])).entries()]
    .map(([track, topic]) => element({value: track, dataset: {topic}}));
  const trackSelect = element({value: '', querySelectorAll: selector => selector === 'option[data-topic]' ? options : []});
  const reset = element();
  const empty = element();
  const root = element({
    querySelectorAll: selector => ({
      '.ch-era': eras, '.ch-spine > li': items, '[data-field]': chips, '.chronicle-work': articles, '[data-node]': links
    })[selector] || [],
    querySelector: selector => ({
      '[data-filter-reset]': reset, '[data-filter-empty]': empty, '[data-branches]': branches,
      '[data-track-select]': trackSelect, '[data-result-count]': resultCount
    })[selector] || null
  });
  const events = {};
  const document = {
    documentElement: {lang: english ? 'en' : 'zh', dataset: {}}, body: element(),
    querySelector: selector => (selector === '[data-chronicle]' ? root : null),
    querySelectorAll: selector => (selector === '[data-language-switch]' ? [switcher] : []),
    getElementById: id => id === 'branch-rl' ? {closest: () => articles[4]} : null, createElement: () => element(), addEventListener() {}
  };
  vm.runInNewContext(source, {
    document, location, URL, URLSearchParams, window: {},
    history: {state: null, replaceState: (state, title, url) => { location.href = String(url); }},
    addEventListener: (name, callback) => { events[name] = callback; },
    matchMedia: () => ({matches: true}), requestAnimationFrame: callback => callback()
  });
  return {location, switcher, events, chips, reset, items, eras, branches, trackSelect, options, resultCount, panel: document.body.children[0]};
}

test('legacy branch links open their previously hidden article', () => {
  const context = environment('https://example.com/cooking-agi/learn/technology-timeline.html#branch-rl');
  assert.equal(context.panel.hidden, false);
  assert.equal(new URL(context.switcher.href).hash, '#branch-rl');
});

test('changing fields closes the old milestone and produces a reproducible URL', () => {
  const context = environment('https://example.com/cooking-agi/learn/technology-timeline.en.html?field=rl#event-grpo');
  context.chips[0].events.click();
  assert.equal(context.panel.hidden, true);
  assert.equal(context.location.hash, '');
  assert.equal(context.location.searchParams.get('field'), 'energy');
  assert.deepEqual(hidden(context), hidden(environment(context.location.href)));
});

test('printing restores the article library and reopening restores the panel', () => {
  const context = environment('https://example.com/cooking-agi/learn/technology-timeline.en.html#event-grpo');
  context.events.beforeprint();
  assert.equal(context.panel.hidden, true);
  assert.equal(context.location.hash, '#event-grpo');
  context.events.afterprint();
  assert.equal(context.panel.hidden, false);
});

test('malformed fragments do not stop chronicle initialization', () => {
  assert.doesNotThrow(() => environment('https://example.com/cooking-agi/learn/technology-timeline.en.html#%E0%A4'));
});

const hidden = context => context.items.map(item => item.hidden);
const FOLDED = [false, false, false, true, false];

test('each period shows its key milestones first and opens on request', () => {
  const context = environment();
  assert.deepEqual(hidden(context), FOLDED);
  const more = context.eras[0].more;
  assert.equal(more.hidden, false);
  assert.equal(more.textContent, 'Show all');
  more.events.click();
  assert.deepEqual(hidden(context), [false, false, false, false, false]);
  assert.equal(more.attributes['aria-expanded'], 'true');
  assert.equal(more.textContent, 'Show fewer');
  more.events.click();
  assert.deepEqual(hidden(context), FOLDED);
  assert.equal(context.eras[1].more, null);
});

test('field selection and reset keep the opposite-language link in sync', () => {
  for (const suffix of ['.en', '']) {
    const context = environment(`https://example.com/cooking-agi/learn/technology-timeline${suffix}.html?view=compact`);
    context.chips[3].events.click();
    const target = new URL(context.switcher.href);
    assert.equal(target.pathname, `/cooking-agi/learn/technology-timeline${suffix ? '' : '.en'}.html`);
    assert.equal(target.searchParams.get('field'), 'models');
    assert.equal(target.searchParams.get('view'), 'compact');
    assert.equal(context.chips[3].attributes['aria-pressed'], 'true');
    // A field shows all of its milestones, folded or not, and hides periods without any.
    assert.deepEqual(hidden(context), [true, true, true, false, true]);
    assert.equal(context.eras[1].hidden, true);
    const switched = environment(target.href);
    assert.deepEqual(hidden(switched), [true, true, true, false, true]);
    context.reset.events.click();
    assert.equal(new URL(context.switcher.href).searchParams.has('field'), false);
    assert.deepEqual(hidden(context), FOLDED);
  }
});

test('shared event anchors survive language switching and open their period', () => {
  const context = environment('https://example.com/cooking-agi/learn/technology-timeline.en.html?field=rl#event-grpo');
  assert.equal(new URL(context.switcher.href).hash, '#event-grpo');
  assert.equal(new URL(context.switcher.href).searchParams.get('field'), 'rl');
  context.location.hash = '#event-perceptron';
  context.events.hashchange();
  assert.equal(new URL(context.switcher.href).hash, '#event-perceptron');
  assert.equal(new URL(context.switcher.href).searchParams.has('field'), false);
  // perceptron was folded; opening it opens its period
  assert.deepEqual(hidden(context), [false, false, false, false, false]);
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
  context.chips[0].events.click();
  context.location.href = 'https://example.com/cooking-agi/learn/technology-timeline.en.html?field=rl#event-grpo';
  context.events.popstate();
  assert.deepEqual(hidden(context), [true, true, true, true, false]);
  assert.equal(new URL(context.switcher.href).searchParams.get('field'), 'rl');
  assert.equal(new URL(context.switcher.href).hash, '#event-grpo');
  context.location.search = '';
  context.location.hash = '';
  context.events.popstate();
  assert.deepEqual(hidden(context), FOLDED);
  assert.equal(new URL(context.switcher.href).search, '');
});

const BRANCH_MILESTONES = [
  ['perceptron', 'models', 'origins', true, 'vision'],
  ['qlearning', 'models', 'origins', false, 'rl'],
  ['grpo', 'models', 'recent', true, 'rl'],
  ['ijepa', 'models', 'recent', true, 'vision'],
  ['cuda', 'chips', 'recent', true, 'accelerators']
];

test('branch links preserve filters through language switches, including field fragments', () => {
  for (const suffix of ['', '.en']) {
    const context = environment(`https://example.com/cooking-agi/learn/technology-timeline${suffix}.html?field=models&track=rl#field-models`, BRANCH_MILESTONES);
    assert.deepEqual(hidden(context), [true, false, false, true, true]);
    assert.equal(context.trackSelect.value, 'rl');
    assert.equal(context.branches.hidden, false);
    const translated = new URL(context.switcher.href);
    assert.equal(translated.searchParams.get('track'), 'rl');
    assert.deepEqual(hidden(environment(translated.href, BRANCH_MILESTONES)), hidden(context));
    assert.equal(context.resultCount.textContent, suffix ? '2 milestones · in date order' : '2 个节点 · 按年份排列');
    assert.equal(context.options.find(option => option.value === 'accelerators').disabled, true);
  }
});

test('selecting another branch closes details and reset clears branch state', () => {
  const context = environment('https://example.com/learn/technology-timeline.en.html?field=models&track=rl#event-grpo', BRANCH_MILESTONES);
  context.trackSelect.value = 'vision';
  context.trackSelect.events.change();
  assert.equal(context.panel.hidden, true);
  assert.deepEqual(hidden(context), [false, true, true, false, true]);
  assert.equal(context.location.hash, '');
  assert.equal(context.location.searchParams.get('track'), 'vision');
  context.reset.events.click();
  assert.equal(context.branches.hidden, true);
  assert.equal(context.trackSelect.value, '');
  assert.equal(new URL(context.switcher.href).searchParams.has('track'), false);
});

test('branch reading steps across periods in chronological order', () => {
  const context = environment('https://example.com/learn/technology-timeline.en.html?field=models&track=rl#event-qlearning', BRANCH_MILESTONES);
  const [previous, next, count] = context.panel.children[0].children;
  assert.equal(previous.disabled, true);
  assert.equal(next.disabled, false);
  assert.equal(count.textContent, '1 / 2');
  next.events.click();
  assert.equal(context.location.hash, '#event-grpo');
  assert.equal(next.disabled, true);
  assert.equal(count.textContent, '2 / 2');
  previous.events.click();
  assert.equal(context.location.hash, '#event-qlearning');
});

test('opening a related milestone outside the branch clears only the incompatible filter', () => {
  const context = environment('https://example.com/learn/technology-timeline.en.html?field=models&track=rl#event-grpo', BRANCH_MILESTONES);
  context.location.hash = '#event-ijepa';
  context.events.hashchange();
  assert.equal(context.trackSelect.value, '');
  assert.equal(context.panel.hidden, false);
  assert.deepEqual(hidden(context), [false, false, false, false, true]);
  assert.equal(new URL(context.switcher.href).searchParams.get('field'), 'models');
  assert.equal(new URL(context.switcher.href).searchParams.has('track'), false);
});

test('unknown branches and branches from a different field cannot hide all results', () => {
  for (const track of ['missing', 'accelerators']) {
    const context = environment(`https://example.com/learn/technology-timeline.en.html?field=models&track=${track}`, BRANCH_MILESTONES);
    assert.deepEqual(hidden(context), [false, false, false, false, true]);
    assert.equal(context.trackSelect.value, '');
    assert.equal(new URL(context.switcher.href).searchParams.has('track'), false);
  }
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../static/technology-tree.js'), 'utf8');

function simulate(options = {}) {
  const events = {};
  const observers = {};
  const frames = new Map();
  let nextFrame = 0;
  let drawCount = 0;
  const names = ['overview', 'language', 'vision', 'rl', 'robotics', 'systems'];
  const panels = names.map(name => ({
    dataset: {treePanel: name}, hidden: false, focused: false, scrolled: false,
    focus() { this.focused = true; },
    getBoundingClientRect: () => ({top: options.mobile ? 900 : 100}),
    scrollIntoView() { this.scrolled = true; },
    closest() { return this; }
  }));
  const links = names.map(name => ({
    dataset: {treeBranch: name}, hash: '#branch-' + name, attrs: {},
    setAttribute(key, value) { this.attrs[key] = value; },
    removeAttribute(key) { delete this.attrs[key]; },
    closest() { return this; }
  }));
  const location = {hash: options.hash || ''};
  const languageLinks = [{hash: ''}, {hash: ''}];
  const history = {entries: [], pushState(_, __, hash) { this.entries.push(hash); location.hash = hash; }};
  const motion = {matches: Boolean(options.reduced), addEventListener(type, callback) { events.motion = callback; }};
  const context = {
    clearRect() { drawCount++; }, fillRect() {}, beginPath() {}, arc() {}, fill() {}, setTransform() {},
    createRadialGradient: () => ({addColorStop() {}})
  };
  const scene = {clientWidth: 700, clientHeight: 560};
  const canvas = {getContext: () => options.noCanvas ? null : context};
  const classes = new Set();
  const tree = {
    dataset: {}, classList: {add: value => classes.add(value)},
    querySelectorAll: selector => selector === '[data-tree-panel]' ? panels : links,
    querySelector: selector => selector === '[data-chronicle]' ? (options.chronicle ? {} : null) : selector === 'canvas' ? canvas : scene
  };
  const document = {
    hidden: false, documentElement: {dataset: {theme: options.light ? 'light' : 'dark'}},
    querySelector: () => tree,
    querySelectorAll: () => languageLinks,
    getElementById: id => id === 'inside-vision' ? {closest: () => panels[2]} : panels.find(panel => 'branch-' + panel.dataset.treePanel === id) || null,
    addEventListener: (type, callback) => { events['document:' + type] = callback; }
  };
  const window = {
    matchMedia: () => motion, devicePixelRatio: 3,
    addEventListener: (type, callback) => { events['window:' + type] = callback; },
    dispatchEvent: event => events['window:' + event.type]?.(event)
  };
  const observer = name => class {
    constructor(callback) { observers[name] = callback; }
    observe() {}
  };
  vm.runInNewContext(source, {
    window, document, location, history, innerHeight: 800,
    Event: class { constructor(type) { this.type = type; } },
    ResizeObserver: observer('resize'), MutationObserver: observer('theme'),
    IntersectionObserver: observer('visibility'),
    requestAnimationFrame: callback => { const frame = ++nextFrame; frames.set(frame, callback); return frame; },
    cancelAnimationFrame: frame => frames.delete(frame)
  });
  function click(name, modifiers = {}) {
    const target = links.find(link => link.dataset.treeBranch === name);
    const event = {target, button: 0, prevented: false, preventDefault() { this.prevented = true; }, ...modifiers};
    events['document:click'](event);
    return event;
  }
  function visiblePanel() { return panels.filter(panel => !panel.hidden).map(panel => panel.dataset.treePanel); }
  return {tree, panels, links, location, history, motion, events, observers, frames, canvas, document, context,
    classes, click, visiblePanel, languageLinks, draws: () => drawCount};
}

const basic = simulate({noCanvas: true});
const chronicle = simulate({chronicle: true});
assert.equal(chronicle.frames.size, 0);
assert.equal(chronicle.draws(), 0);
assert.ok(chronicle.languageLinks.every(link => link.hash === ''));
for (const hash of ['#era-branching', '#twig-branching-graphs', '#event-gcn']) {
  chronicle.location.hash = hash;
  chronicle.events['window:hashchange']();
  assert.ok(chronicle.languageLinks.every(link => link.hash === hash.slice(1)));
}
chronicle.location.hash = '';
chronicle.events['window:popstate']();
assert.ok(chronicle.languageLinks.every(link => link.hash === ''));
assert.deepEqual(basic.visiblePanel(), ['overview']);
for (const branch of ['rl', 'robotics', 'language', 'vision', 'systems', 'overview']) {
  assert.equal(basic.click(branch).prevented, true);
  assert.deepEqual(basic.visiblePanel(), [branch]);
  assert.equal(basic.tree.dataset.selected, branch);
  assert.equal(basic.links.filter(link => link.attrs['aria-current'] === 'true').length, 1);
  assert.equal(basic.location.hash, '#branch-' + branch);
  assert.ok(basic.languageLinks.every(link => link.hash === 'branch-' + branch));
  assert.equal(basic.panels.find(panel => panel.dataset.treePanel === branch).focused, true);
}
const entries = basic.history.entries.length;
basic.click('overview');
assert.equal(basic.history.entries.length, entries);
for (const modifiers of [{metaKey: true}, {ctrlKey: true}, {shiftKey: true}, {altKey: true}, {button: 1}, {defaultPrevented: true}]) {
  assert.equal(basic.click('rl', modifiers).prevented, false);
  assert.deepEqual(basic.visiblePanel(), ['overview']);
}
basic.location.hash = '#branch-rl';
basic.events['window:popstate']();
assert.deepEqual(basic.visiblePanel(), ['rl']);
basic.location.hash = '#tree-map';
basic.events['window:hashchange']();
assert.deepEqual(basic.visiblePanel(), ['overview']);
assert.ok(basic.languageLinks.every(link => link.hash === 'tree-map'));
basic.location.hash = '#unknown';
basic.events['window:hashchange']();
assert.deepEqual(basic.visiblePanel(), ['overview']);
assert.ok(basic.languageLinks.every(link => link.hash === 'unknown'));
basic.location.hash = '';
basic.events['window:popstate']();
assert.ok(basic.languageLinks.every(link => link.hash === ''));
const nested = simulate({hash:'#inside-vision', noCanvas:true});
assert.deepEqual(nested.visiblePanel(), ['vision']);
assert.ok(nested.languageLinks.every(link => link.hash === 'inside-vision'));
assert.deepEqual(simulate({hash:'#branch%2Dvision', noCanvas:true}).visiblePanel(), ['vision']);
assert.deepEqual(simulate({hash:'#branch-%E0%A4%A', noCanvas:true}).visiblePanel(), ['overview']);
assert.deepEqual(simulate({hash: '#branch-vision', noCanvas: true}).visiblePanel(), ['vision']);
assert.deepEqual(simulate({hash: '#tree-map', noCanvas: true}).visiblePanel(), ['overview']);
const mobile = simulate({mobile: true, noCanvas: true});
mobile.click('rl');
assert.equal(mobile.panels.find(panel => panel.dataset.treePanel === 'rl').scrolled, true);

const animated = simulate();
assert.equal(animated.canvas.width, 1400);
assert.equal(animated.canvas.height, 1120);
assert.equal(animated.frames.size, 1);
assert.ok(animated.classes.has('tree-canvas-ready'));
animated.observers.visibility([{isIntersecting: false}]);
assert.equal(animated.frames.size, 0);
animated.observers.visibility([{isIntersecting: true}]);
assert.equal(animated.frames.size, 1);
animated.document.hidden = true;
animated.events['document:visibilitychange']();
assert.equal(animated.frames.size, 0);
animated.document.hidden = false;
animated.events['document:visibilitychange']();
assert.equal(animated.frames.size, 1);
animated.motion.matches = true;
animated.events.motion();
assert.equal(animated.frames.size, 0);
const before = animated.draws();
animated.click('rl');
assert.ok(animated.draws() > before);
assert.equal(animated.frames.size, 0);
animated.document.documentElement.dataset.theme = 'light';
animated.observers.theme();
assert.match(animated.context.fillStyle, /^rgba\(38,43,47,/);
const still = simulate({reduced: true});
assert.equal(still.frames.size, 0);
assert.ok(still.draws() > 0);
console.log('Technology tree behavior passed: navigation, fallback, history, motion, theme, and visibility.');

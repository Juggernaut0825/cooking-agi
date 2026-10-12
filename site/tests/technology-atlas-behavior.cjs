const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../static/technology-atlas.js'), 'utf8');
const treeSource = fs.readFileSync(path.join(__dirname, '../static/technology-tree.js'), 'utf8');

class Element {
  constructor(tagName, id, parentElement) {
    this.tagName = tagName;
    this.id = id;
    this.parentElement = parentElement;
    this.open = false;
    this.hidden = false;
    this.dataset = {};
    this.attributes = {};
    this.events = {};
    this.classes = new Set();
    this.classList = {toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name)};
    this.summary = {events:{}, addEventListener(name, handler) { this.events[name] = handler; }, focus() { this.focused = true; }};
  }
  querySelector(selector) {
    return {'summary':this.summary, '.chronicle-branch-label small':this.label,
      '[data-work-title]':this.title, '[data-branch-summary]':this.description,
      '[data-era-title]':this.title, '[data-era-focus]':this.focusTitle,
      '.chronicle-featured':this.featured, 'strong':this.title}[selector] || null;
  }
  addEventListener(name, handler) { this.events[name] = handler; }
  setAttribute(name, value) { this.attributes[name] = value; }
  focus() { this.focused = true; }
  contains(element) { return element === this || !!element.parentElement && this.contains(element.parentElement); }
  closest(selector) {
    if (selector === '[hidden]') return this.hidden ? this : this.parentElement?.closest(selector);
    return this.tagName === 'DETAILS' || this.tagName === 'SECTION' ? this : this.parentElement.closest(selector);
  }
  scrollIntoView(options) {
    assert.equal(this.closest('[hidden]'), undefined);
    let ancestor = this.parentElement;
    while (ancestor) {
      if (ancestor.tagName === 'DETAILS') assert.equal(ancestor.open, true);
      ancestor = ancestor.parentElement;
    }
    this.scrolled = options;
    this.scrollCount = (this.scrollCount || 0) + 1;
  }
}

function simulate(hash = '', reduced = true, options = {}) {
  const root = new Element('SECTION', 'tree-map');
  const era = new Element('SECTION', 'era-reasoning', root);
  const branch = new Element('DETAILS', 'twig-reasoning-reasoning-rl', era);
  const group = new Element('DIV', '', branch);
  const work = new Element('DETAILS', 'event-grpo', group);
  work.dataset.workTopic = 'models';
  work.title = {textContent:'GRPO · group comparison'};
  branch.label = {hidden:false, textContent:'GRPO'};
  branch.description = {hidden:false};
  const hardwareEra = new Element('SECTION', 'era-early-ai', root);
  const hardwareBranch = new Element('DETAILS', 'twig-early-ai-field-chips', hardwareEra);
  hardwareBranch.label = {hidden:false, textContent:'Intel 4004'};
  hardwareBranch.description = {hidden:false};
  const hardware = new Element('DETAILS', 'event-intel-4004-1971', hardwareBranch);
  hardware.dataset.workTopic = 'chips';
  hardware.title = {textContent:'Intel 4004 · CPU'};
  const topics = ['models', 'chips', 'applications'].map(name => {
    const button = new Element('BUTTON', 'field-' + name, root);
    button.dataset.topic = name;
    button.title = {textContent:name};
    return button;
  });
  const panels = ['all', 'models', 'chips', 'applications'].map(name => ({dataset:{topicPanel:name}}));
  const reset = new Element('BUTTON', '', root);
  const motionButton = new Element('BUTTON', '', root);
  const announcement = {textContent:''};
  const limbs = topics.map(topic => ({dataset:{limb:topic.dataset.topic}}));
  const scope = new Element('DETAILS', '', root);
  const media = {matches:reduced, addEventListener(name, handler) { this.changed = handler; }};
  const application = new Element('DETAILS', 'event-deepseek-r1', group);
  application.dataset.workTopic = 'applications';
  application.title = {textContent:'DeepSeek-R1 · reasoning'};
  branch.label.textContent += ' · DeepSeek-R1';
  const all = [era, branch, work, application, hardwareEra, hardwareBranch, hardware, ...topics];
  for (const period of [era, hardwareEra]) {
    period.title = {hidden:false};
    period.focusTitle = {hidden:true};
  }
  const feature = new Element('A', '', era);
  feature.dataset.workTopic = 'models';
  era.featured = {hidden:false, querySelectorAll: () => [feature]};
  const selectors = {
    'details':[scope, branch, work, application, hardwareBranch, hardware], '[id]':all,
    '[data-limb]':limbs,
    '[data-topic]':topics, '[data-topic-panel]':panels, '.chronicle-work':[work, application, hardware],
    '.chronicle-branch':[branch, hardwareBranch], '.chronicle-era':[era, hardwareEra],
    '[data-work-topic]':[work, application, hardware, feature], '.chronicle-nav a':[{hash:'#era-reasoning'},{hash:'#era-early-ai'}]
  };
  root.querySelectorAll = selector => selectors[selector] || [];
  root.querySelector = selector => ({'[data-topic-reset]':reset,
    '[data-world-motion]':motionButton, '[data-world-announcement]':announcement}[selector] || null);
  const events = {}, frames = [];
  function listen(name, handler) {
    const previous = events[name];
    events[name] = event => { previous?.(event); handler(event); };
  }
  const languageLinks = [
    new URL('https://example.test/learn/technology-timeline.html?lang=zh'),
    new URL('https://example.test/learn/technology-timeline.html?view=reading')
  ];
  const location = new URL('https://example.test/learn/technology-timeline.en.html' + hash);
  const history = {
    entries:[], pushState(_, __, next) { location.href = new URL(next, location.href).href; this.entries.push(location.href); },
    replaceState(_, __, next) { location.href = new URL(next, location.href).href; }
  };
  const treePanels = ['overview', 'rl'].map(name => ({
    dataset:{treePanel:name}, hidden:false, closest() { return this; },
    focus() {}, getBoundingClientRect: () => ({top:100})
  }));
  const tree = {
    dataset:{}, querySelector: () => root,
    querySelectorAll: selector => selector === '[data-tree-panel]' ? treePanels : []
  };
  const document = {
    hidden:false, querySelector: selector => selector === '[data-technology-tree]' ? tree : root,
    querySelectorAll: () => languageLinks,
    getElementById: id => treePanels.find(panel => 'branch-' + panel.dataset.treePanel === id) || null,
    addEventListener: (name, handler) => listen('document:' + name, handler)
  };
  const window = {
    matchMedia: query => query.includes('max-width') ? {matches:false} : media,
    addEventListener: (name, handler) => listen(name, handler),
    dispatchEvent: event => events[event.type]?.(event)
  };
  const context = vm.createContext({
    document, window, location, history, URL, innerHeight:800,
    Event:class {constructor(type) { this.type = type; }},
    requestAnimationFrame: handler => frames.push(handler)
  });
  if (options.combined) vm.runInContext(treeSource, context);
  vm.runInContext(source, context);
  function clickSummary(item) {
    const event = {button:0, preventDefault() { this.prevented = true; }};
    item.summary.events.click(event);
    return event;
  }
  function clickLink(identifier, options = {}) {
    const link = new Element('A', '', options.external ? null : root);
    link.hash = '#' + identifier;
    link.closest = selector => selector.includes('#branch-') && !identifier.startsWith('branch-') ? null : link;
    const event = {target:link,
      button:0, preventDefault() { this.prevented = this.defaultPrevented = true; }, ...options};
    events['document:click']?.(event);
    return event;
  }
  return {root, era, branch, work, application, hardwareEra, hardwareBranch, hardware, topics, panels, reset,
    events, frames, document, history, location, languageLinks, clickSummary, clickLink, treePanels, selectors,
    limbs, scope, media, motionButton, announcement};
}

const visual = simulate('', false);
assert.equal(visual.scope.summary.events.click, undefined);
assert.ok(visual.limbs.every(limb => limb.dataset.focus === 'all'));
visual.topics[1].events.pointerenter();
assert.equal(visual.limbs[1].dataset.focus, 'active');
assert.equal(visual.limbs[0].dataset.focus, 'other');
assert.equal(visual.root.dataset.topic, 'all');
visual.topics[1].events.pointerleave();
assert.ok(visual.limbs.every(limb => limb.dataset.focus === 'all'));
visual.topics[0].events.click();
assert.equal(visual.limbs[0].dataset.focus, 'active');
assert.match(visual.announcement.textContent, /models/);
visual.topics[1].events.focus();
assert.equal(visual.limbs[1].dataset.focus, 'active');
visual.topics[1].events.blur();
assert.equal(visual.limbs[0].dataset.focus, 'active');
assert.equal(visual.motionButton.attributes['aria-pressed'], 'false');
visual.motionButton.events.click();
assert.equal(visual.motionButton.textContent, 'Play motion');
assert.ok(visual.root.classes.has('world-motion-paused'));
visual.motionButton.events.click();
assert.equal(visual.root.classes.has('world-motion-paused'), false);
visual.media.matches = true;
visual.media.changed();
assert.equal(visual.motionButton.disabled, true);
assert.equal(visual.motionButton.textContent, 'Reduced motion');
assert.ok(visual.root.classes.has('world-motion-paused'));
visual.media.matches = false;
visual.media.changed();
assert.equal(visual.motionButton.disabled, false);
assert.equal(visual.root.classes.has('world-motion-paused'), false);

const basic = simulate();
assert.equal(basic.branch.open, false);
assert.equal(basic.work.open, false);
assert.equal(basic.frames.length, 0);
basic.clickSummary(basic.branch);
assert.equal(basic.branch.open, true);
assert.equal(basic.location.hash, '#twig-reasoning-reasoning-rl');
basic.clickSummary(basic.work);
assert.equal(basic.work.open, true);
assert.equal(basic.location.hash, '#event-grpo');
assert.ok(basic.languageLinks.every(link => link.hash === '#event-grpo'));
basic.clickSummary(basic.work);
assert.equal(basic.work.open, false);
assert.equal(basic.location.hash, '#twig-reasoning-reasoning-rl');
basic.clickSummary(basic.branch);
assert.equal(basic.branch.open, false);
assert.equal(basic.location.hash, '#era-reasoning');
assert.equal(basic.clickLink('event-grpo').prevented, true);
assert.equal(basic.branch.open, true);
assert.equal(basic.work.open, true);
assert.equal(basic.work.summary.focused, true);
assert.equal(basic.work.scrolled.behavior, 'auto');
const entries = basic.history.entries.length;
assert.equal(basic.clickLink('event-grpo', {ctrlKey:true}).prevented, undefined);
assert.equal(basic.clickLink('unrelated').prevented, undefined);
assert.equal(basic.history.entries.length, entries);
basic.location.hash = '#twig-reasoning-reasoning-rl';
basic.events.popstate();
assert.equal(basic.branch.scrolled.block, 'start');
assert.ok(basic.languageLinks.every(link => link.hash === '#twig-reasoning-reasoning-rl'));
basic.document.hidden = true;
basic.events['document:visibilitychange']();
assert.equal(basic.root.classes.has('chronicle-paused'), true);
basic.document.hidden = false;
basic.events['document:visibilitychange']();
assert.equal(basic.root.classes.has('chronicle-paused'), false);

const linked = simulate('#event-grpo', false);
assert.equal(linked.branch.open, true);
assert.equal(linked.work.open, true);
assert.equal(linked.frames.length, 1);
linked.frames[0]();
assert.equal(linked.work.scrolled.behavior, 'smooth');
assert.equal(linked.history.entries.length, 0);
const unknown = simulate('#event-missing');
assert.equal(unknown.work.open, false);
assert.equal(unknown.frames.length, 0);
const filtered = simulate('#field-chips');
assert.equal(filtered.work.hidden, true);
assert.equal(filtered.era.hidden, true);
assert.equal(filtered.hardware.hidden, false);
assert.equal(filtered.hardwareEra.hidden, false);
assert.equal(filtered.topics[1].attributes['aria-pressed'], 'true');
assert.equal(filtered.topics[1].disabled, false);
assert.equal(filtered.panels[2].hidden, false);
assert.equal(filtered.reset.disabled, false);
assert.ok(filtered.languageLinks.every(link => link.hash === '#field-chips'));
filtered.clickLink('event-grpo');
assert.equal(filtered.work.hidden, false);
assert.equal(filtered.work.open, true);
assert.equal(filtered.root.dataset.topic, 'all');
filtered.topics[0].events.click();
assert.equal(filtered.hardware.hidden, true);
assert.equal(filtered.hardwareBranch.hidden, true);
assert.equal(filtered.location.hash, '#field-models');
filtered.topics[0].events.click();
assert.equal(filtered.hardware.hidden, false);
assert.equal(filtered.root.dataset.topic, 'all');
filtered.topics[1].events.click();
filtered.reset.events.click();
assert.equal(filtered.hardware.hidden, false);
assert.equal(filtered.work.hidden, false);
filtered.location.hash = '#field-models';
filtered.events.popstate();
assert.equal(filtered.hardware.hidden, true);
assert.equal(filtered.topics[0].scrolled.block, 'start');
filtered.location.href = 'https://example.test/learn/technology-timeline.en.html';
filtered.events.popstate();
assert.equal(filtered.hardware.hidden, false);

for (const combined of [false, true]) {
  const state = simulate('', true, {combined});
  state.topics[0].events.click();
  state.clickSummary(state.work);
  assert.equal(state.location.searchParams.get('topic'), 'models');
  assert.ok(state.languageLinks.every(link => link.hash === '#event-grpo' && link.searchParams.get('topic') === 'models'));
  assert.equal(state.languageLinks[0].searchParams.get('lang'), 'zh');
  assert.equal(state.languageLinks[1].searchParams.get('view'), 'reading');
  const saved = state.location.href;
  const reloaded = simulate(state.location.search + state.location.hash, true, {combined});
  assert.equal(reloaded.root.dataset.topic, 'models');
  assert.equal(reloaded.work.open, true);
  assert.equal(reloaded.hardware.hidden, true);
  state.topics[1].events.click();
  const forwardURL = state.location.href;
  state.location.href = saved;
  state.events.popstate();
  assert.equal(state.root.dataset.topic, 'models');
  assert.equal(state.hardware.hidden, true);
  state.location.href = forwardURL;
  state.events.popstate();
  assert.equal(state.root.dataset.topic, 'chips');
  assert.equal(state.hardware.hidden, false);
  state.location.href = saved;
  state.events.popstate();
  state.clickLink('event-intel-4004-1971');
  assert.equal(state.root.dataset.topic, 'all');
  assert.equal(state.location.searchParams.has('topic'), false);
  assert.equal(state.hardware.open, true);
  state.location.hash = '#event-missing';
  state.events.hashchange();
  assert.ok(!state.hardware.classes.has('chronicle-selected'));
  assert.ok(state.languageLinks.every(link => link.hash === '#event-missing'));
  state.location.hash = '';
  state.events.popstate();
  assert.ok(state.languageLinks.every(link => link.hash === ''));
  state.topics[1].events.click();
  state.reset.events.click();
  assert.equal(state.root.dataset.topic, 'all');
  assert.equal(state.location.searchParams.has('topic'), false);
  assert.ok(!state.work.classes.has('chronicle-selected'));
  assert.ok(!state.hardware.classes.has('chronicle-selected'));
  assert.ok(state.languageLinks.every(link => link.hash === '#tree-map' && !link.searchParams.has('topic')));
  if (combined) {
    state.clickLink('branch-rl');
    assert.equal(state.treePanels[1].hidden, false);
    state.location.hash = '#tree-map';
    state.events.popstate();
    assert.equal(state.treePanels[0].hidden, false);
    assert.equal(state.treePanels[1].hidden, true);
    assert.ok(state.languageLinks.every(link => link.hash === '#tree-map'));
  }
}

const sparse = simulate('#field-applications');
assert.equal(sparse.work.hidden, true);
assert.equal(sparse.application.hidden, false);
assert.equal(sparse.era.hidden, false);
assert.equal(sparse.era.featured.hidden, true);
assert.equal(sparse.era.title.hidden, true);
assert.equal(sparse.era.focusTitle.textContent, 'applications');
assert.equal(sparse.branch.label.hidden, false);
assert.equal(sparse.branch.label.textContent, 'DeepSeek-R1');
assert.equal(sparse.branch.description.hidden, true);
assert.equal(sparse.selectors['.chronicle-nav a'][0].hidden, false);
assert.equal(sparse.selectors['.chronicle-nav a'][1].hidden, true);
sparse.reset.events.click();
assert.equal(sparse.branch.label.textContent, 'GRPO · DeepSeek-R1');
assert.equal(sparse.branch.description.hidden, false);
assert.equal(sparse.era.title.hidden, false);
assert.equal(sparse.era.featured.hidden, false);

const external = simulate('#field-chips', true, {combined:true});
assert.equal(external.root.events.click, undefined);
const outsideLink = external.clickLink('event-grpo', {external:true});
assert.equal(external.root.contains(outsideLink.target), false);
assert.equal(outsideLink.prevented, true);
assert.equal(external.root.dataset.topic, 'all');
assert.equal(external.work.open, true);
assert.equal(external.branch.open, true);
assert.equal(external.work.scrolled.block, 'start');
assert.equal(external.work.summary.focused, true);
assert.equal(external.history.entries.length, 1);
assert.equal(external.clickLink('field-models', {external:true}).prevented, true);
assert.equal(external.root.dataset.topic, 'models');
assert.equal(external.topics[0].focused, true);
assert.equal(external.topics[0].scrolled.block, 'start');
assert.ok(external.languageLinks.every(link => link.hash === '#field-models'));
const externalEntries = external.history.entries.length;
for (const modifiers of [{ctrlKey:true}, {metaKey:true}, {shiftKey:true}, {altKey:true}, {button:1}, {defaultPrevented:true}]) {
  assert.equal(external.clickLink('event-grpo', modifiers).prevented, undefined);
}
assert.equal(external.clickLink('unrelated').prevented, undefined);
assert.equal(external.history.entries.length, externalEntries);

const scrolling = simulate('#event-grpo', false);
scrolling.topics[1].events.click();
scrolling.frames[0]();
assert.equal(scrolling.topics[1].scrolled, undefined);
const repeated = simulate('#event-grpo', false);
repeated.clickLink('event-grpo', {external:true});
assert.equal(repeated.work.scrollCount, 1);
repeated.frames[0]();
assert.equal(repeated.work.scrollCount, 1);
const encoded = simulate('#event%2Dgrpo', true, {combined:true});
assert.equal(encoded.work.open, true);
assert.ok(encoded.languageLinks.every(link => link.hash === '#event%2Dgrpo'));
assert.equal(simulate('?topic=unknown#event-grpo').root.dataset.topic, 'all');
assert.equal(simulate('#event-%E0%A4%A').work.open, false);
const otherParameters = simulate('?reader=compact#field-models');
otherParameters.reset.events.click();
assert.equal(otherParameters.location.searchParams.get('reader'), 'compact');
assert.equal(otherParameters.location.searchParams.has('topic'), false);
const readerLocation = simulate('?milestone=grpo#event-grpo');
readerLocation.frames[0]();
assert.equal(readerLocation.work.scrolled, undefined);
assert.equal(readerLocation.work.open, true);
assert.equal(readerLocation.location.searchParams.get('milestone'), 'grpo');
assert.ok(readerLocation.languageLinks.every(link => link.hash === '#event-grpo'));
console.log('Technology atlas behavior passed: native subtrees, nested works, history, language hashes, reduced motion, and focus.');

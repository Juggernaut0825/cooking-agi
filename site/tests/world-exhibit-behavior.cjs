const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../static/world-exhibit.js'), 'utf8');

class Element {
  constructor(dataset = {}) {
    this.dataset = dataset;
    this.events = {};
    this.attributes = {};
    this.classes = new Set();
    this.classList = {add:name => this.classes.add(name), remove:name => this.classes.delete(name)};
    this.style = {setProperty:(name, value) => { this.attributes[name] = value; }};
    this.selectors = {};
  }
  addEventListener(name, listener) { this.events[name] = listener; }
  setAttribute(name, value) { this.attributes[name] = value; if (name === 'href') this.hash = value; }
  getAttribute(name) { return this.attributes[name]; }
  focus() { this.focused = true; }
  scrollIntoView() { this.scrolled = true; }
  replaceChildren(child) { this.child = child; }
  cloneNode(deep) { return {original:this, deep}; }
  showModal() { this.open = true; }
  close() { this.open = false; this.events.close?.(); }
  getBoundingClientRect() { return {left:100, right:700, top:100, bottom:600}; }
  closest() { return null; }
  querySelector(selector) { return this.selectors[selector] || null; }
}

function simulate(search = '', supported = true) {
  const rail = {clientWidth:300, scrollLeft:0};
  const controls = ['all', 'origins', 'recent'].map((key, index) => {
    const control = new Element({worldEra:String(index), worldEraKey:key, eraStart:index === 1 ? '1882' : '2016', eraEnd:index === 1 ? '1955' : '2025'});
    control.setAttribute('aria-label', key);
    control.parentElement = rail;
    control.offsetLeft = index * 60;
    control.offsetWidth = 60;
    return control;
  });
  const eraSteps = [-1, 1].map(step => {
    const button = new Element({worldEraStep:String(step)});
    button.parentElement = {hidden:true};
    return button;
  });
  const eraPosition = new Element();
  const copies = controls.map(control => new Element({worldEraCopy:control.dataset.worldEra}));
  const leaves = controls.map(control => new Element({worldEraLeaves:control.dataset.worldEra}));
  const limbs = [new Element({birth:'1'}), new Element({birth:'2'})];
  const canopy = new Element(), status = new Element(), dialog = new Element();
  if (!supported) dialog.showModal = undefined;
  const title = new Element(), year = new Element(), body = new Element(), readLink = new Element(), closeButton = new Element();
  const readerContext = new Element(), readerBack = new Element(), dialogLanguage = new Element();
  const readerSteps = [-1, 1].map(step => {
    const button = new Element({worldReaderStep:String(step)});
    button.selectors.span = new Element();
    return button;
  });
  const eras = ['1882—1955', '2016—2025'].map(period => ({querySelectorAll:() => [{textContent:period}]}));
  const works = [['older', '1900', 'chips', 0], ['milestone', '2017', 'models', 1], ['next', '2018', 'models', 1], ['later', '2022', 'chips', 1]].map(([name, year, topic, era]) => {
    const work = new Element({workTopic:topic});
    work.id = 'event-' + name;
    work.selectors = {'.chronicle-work-body':new Element(), time:{textContent:year}, '[data-work-title]':{textContent:name}};
    work.closest = () => eras[era];
    return work;
  });
  const link = new Element();
  link.hash = '#event-milestone';
  const selectors = {'[data-world-era]':controls, '[data-world-era-copy]':copies, '[data-world-era-leaves]':leaves,
    '[data-birth]':limbs, '[data-world-peek]':[link], '.chronicle-work':works,
    '[data-world-era-step]':eraSteps, '[data-world-reader-step]':readerSteps};
  const singles = {'.world-canopy':canopy, '[data-world-era-status]':status, '.world-dialog':dialog,
    '#world-dialog-title':title, '[data-world-year]':year, '[data-world-dialog-body]':body, '[data-world-dialog-read]':readLink, '[data-world-close]':closeButton,
    '[data-world-era-position]':eraPosition, '[data-world-dialog-context]':readerContext, '[data-world-reader-back]':readerBack,
    '[data-world-language]':dialogLanguage, 'button[data-topic="chips"] strong':{textContent:'Chips'}};
  const root = {querySelectorAll:selector => selectors[selector] || [], querySelector:selector => singles[selector] || null};
  const languageLinks = [{href:'https://example.test/tree.en.html?topic=chips#field-chips'}];
  const documentElement = new Element();
  documentElement.lang = 'en';
  const document = {querySelector:() => root, querySelectorAll:() => languageLinks, documentElement};
  const location = new URL('https://example.test/tree.html' + search);
  const events = {};
  const window = {addEventListener(name, listener) {
    const previous = events[name];
    events[name] = event => { previous?.(event); listener(event); };
  }, dispatchEvent(event) { events[event.type]?.(event); }};
  const entries = [{state:{marker:1}, href:location.href}];
  let cursor = 0;
  const history = {
    get state() { return entries[cursor].state; },
    replaceState(state, title, href) { location.href = href; entries[cursor] = {state, href}; },
    pushState(state, title, href) { entries.splice(++cursor); entries.push({state, href}); location.href = href; },
    back() { if (cursor > 0) { location.href = entries[--cursor].href; events.popstate(); } },
    forward() { if (cursor + 1 < entries.length) { location.href = entries[++cursor].href; events.popstate(); } }
  };
  class CustomEvent {
    constructor(type, options) { this.type = type; this.detail = options.detail; }
  }
  vm.runInNewContext(source, {document, window, location, history, URL, CustomEvent});
  return {controls, copies, leaves, limbs, status, dialog, title, year, body, readLink, closeButton, link, works,
    events, location, history, languageLinks, documentElement, readerContext, readerBack, readerSteps, eraSteps, eraPosition, rail, dialogLanguage};
}

function click(context, overrides = {}) {
  const event = {button:0, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...overrides};
  context.link.events.click(event);
  return event;
}

const context = simulate('?topic=chips#field-chips');
assert.equal(context.controls[0].attributes['aria-pressed'], 'true');
assert.equal(context.copies[0].hidden, false);
assert.equal(context.copies[1].hidden, true);
assert.equal(context.limbs.every(limb => limb.dataset.future === 'false'), true);
assert.equal(context.eraSteps[0].disabled, true);
context.eraSteps[1].events.click();
assert.equal(context.location.searchParams.get('era'), 'origins');
assert.equal(context.location.searchParams.get('topic'), 'chips');
assert.equal(context.location.hash, '#field-chips');
assert.equal(context.leaves[1].hidden, false);
assert.equal(context.limbs[1].dataset.future, 'true');
assert.equal(new URL(context.languageLinks[0].href).searchParams.get('era'), 'origins');
assert.equal(context.status.textContent, 'origins');
assert.equal(context.eraPosition.textContent, '1 / 2');
let prevented = false;
context.controls[1].events.keydown({key:'ArrowRight', preventDefault() { prevented = true; }});
assert.equal(prevented, true);
assert.equal(context.controls[2].focused, true);
assert.equal(context.controls[2].scrolled, true);
assert.equal(context.eraSteps[1].disabled, true);
assert.equal(context.location.searchParams.get('era'), 'recent');
context.controls[2].events.keydown({key:'Home', preventDefault() {}});
assert.equal(context.location.searchParams.has('era'), false);
assert.equal(new URL(context.languageLinks[0].href).searchParams.has('era'), false);
context.location.searchParams.set('era', 'recent');
context.events.popstate();
assert.equal(context.copies[2].hidden, false);
context.location.searchParams.set('era', 'invalid');
context.events.hashchange();
assert.equal(context.copies[0].hidden, false);
assert.equal(simulate('?era=origins').copies[1].hidden, false);

assert.equal(click(context, {metaKey:true}).prevented, undefined);
assert.equal(context.dialog.open, undefined);
const opening = click(context);
assert.equal(opening.prevented, true);
assert.equal(opening.stopped, true);
assert.equal(context.dialog.open, true);
assert.equal(context.title.textContent, 'milestone');
assert.equal(context.year.textContent, '2017');
assert.equal(context.body.child.original, context.works[1].selectors['.chronicle-work-body']);
assert.equal(context.body.child.deep, true);
assert.equal(context.readLink.getAttribute('href'), '#event-milestone');
assert.equal(context.documentElement.classes.has('world-dialog-open'), true);
assert.equal(context.title.focused, true);
assert.equal(context.readerContext.textContent, '2016—2025 · 1 / 3');
assert.equal(context.readerSteps[0].disabled, true);
assert.equal(context.location.searchParams.get('milestone'), 'milestone');
assert.equal(context.history.state.marker, 1);
context.readerSteps[1].events.click();
assert.equal(context.title.textContent, 'next');
assert.equal(context.year.textContent, '2018');
assert.equal(context.location.searchParams.get('milestone'), 'next');
assert.equal(new URL(context.languageLinks[0].href).searchParams.get('milestone'), 'next');
assert.equal(context.dialogLanguage.href, context.languageLinks[0].href);
assert.equal(context.dialogLanguage.hidden, false);
context.readerSteps[0].events.click();
assert.equal(context.title.textContent, 'milestone');
assert.equal(context.year.textContent, '2017');

const related = {hash:'#event-older'};
const relatedClick = {target:{closest:() => related}, preventDefault() { this.prevented = true; }, stopPropagation() {}};
context.dialog.events.click(relatedClick);
assert.equal(relatedClick.prevented, true);
assert.equal(context.dialog.open, true);
assert.equal(context.title.textContent, 'older');
assert.equal(context.year.textContent, '1900');
assert.equal(context.readerContext.textContent, 'Chips · 1 / 2');
assert.equal(context.readerBack.hidden, false);
context.readerBack.events.click();
assert.equal(context.title.textContent, 'milestone');
assert.equal(context.year.textContent, '2017');
assert.equal(context.readerBack.hidden, true);
context.closeButton.events.click();
assert.equal(context.dialog.open, false);
assert.equal(context.location.searchParams.has('milestone'), false);
assert.equal(context.documentElement.classes.has('world-dialog-open'), false);
assert.equal(context.link.focused, true);
context.history.forward();
assert.equal(context.dialog.open, true);
assert.equal(context.title.textContent, 'milestone');
assert.equal(context.year.textContent, '2017');
context.dialog.events.cancel({preventDefault() {}});
assert.equal(context.dialog.open, false);
click(context);
context.dialog.events.click({target:context.dialog, clientX:200, clientY:200});
assert.equal(context.dialog.open, true);
context.dialog.events.click({target:context.dialog, clientX:10, clientY:10});
assert.equal(context.dialog.open, false);
click(context);
context.dialog.events.click({target:{closest:() => context.readLink}});
assert.equal(context.dialog.open, false);
assert.equal(context.location.searchParams.has('milestone'), false);
assert.equal(context.history.state.worldReader, undefined);
context.link.hash = '#missing';
assert.equal(click(context).prevented, undefined);
assert.equal(simulate('', false).link.events.click, undefined);
const restored = simulate('?era=recent&milestone=next#tree-map');
assert.equal(restored.dialog.open, true);
assert.equal(restored.title.textContent, 'next');
assert.equal(restored.year.textContent, '2018');
restored.closeButton.events.click();
assert.equal(restored.dialog.open, false);
assert.equal(restored.location.searchParams.get('era'), 'recent');
assert.equal(restored.location.searchParams.has('milestone'), false);
assert.equal(simulate('?milestone=invalid').location.searchParams.has('milestone'), false);
const locating = simulate();
click(locating);
locating.dialog.events.click({target:{closest:() => locating.readLink}});
assert.equal(locating.link.focused, undefined);
console.log('World exhibit behavior passed');

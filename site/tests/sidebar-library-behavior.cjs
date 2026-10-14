const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../static/sidebar.js'), 'utf8');

function mount(blocked = false) {
  function element() {
    return {hidden:true, textContent:'', dataset:{}, listeners:{}, attributes:{}, children:[],
      addEventListener(name, callback) { this.listeners[name] = callback; },
      setAttribute(name, value) { this.attributes[name] = value; },
      replaceChildren() { this.children = []; }, append(child) { this.children.push(child); },
      click() { return this.listeners.click && this.listeners.click(); }, remove() {}, focus() {}};
  }
  const selectors = Object.fromEntries(['.side-scroll','[data-side-save]'].map(selector => [selector, element()]));
  const active = Object.assign(element(), {dataset:{note:'learn/one.md'}, title:'First note',
    getAttribute:() => '../learn/one.html', getBoundingClientRect: () => ({top:0,bottom:100}),
    closest: selector => selector === '[data-grp]' ? {querySelector:() => ({textContent:'Basics'})} : {dataset:{category:'learn'}}});
  const locate = element(), collapse = element();
  const directoryActions = Object.assign(element(), {querySelector: selector => selector === '[data-side-current]' ? locate : collapse});
  const currentGroup = Object.assign(element(), {tagName:'DETAILS', dataset:{grp:'basics'}, open:true, querySelector:() => active});
  const otherGroup = Object.assign(element(), {tagName:'DETAILS', dataset:{grp:'other'}, open:true, querySelector:() => null});
  const directory = {
    querySelectorAll: selector => selector === 'a[data-note]' ? [active] : selector === 'details' ? [currentGroup, otherGroup] : [],
    querySelector: selector => selector === '.side-directory-actions' ? directoryActions : selector === 'a.active[data-note]' ? active : null
  };
  active.parentElement = currentGroup;
  currentGroup.parentElement = directory;
  const inlineSave = element(), inlineStatus = element(), noteTools = element();
  const side = {querySelector: selector => selector === '#side-directory' ? directory : selectors[selector], querySelectorAll:() => []};
  const storage = new Map(), windowEvents = {}, dispatched = [];
  selectors['.side-scroll'].getBoundingClientRect = () => ({top:0,bottom:200,height:200});
  const document = {documentElement:{lang:'en'},
    querySelector: selector => selector === '#side' ? side : selector === '.note-tool-status' ? inlineStatus : noteTools,
    querySelectorAll: () => [selectors['[data-side-save]'], inlineSave], createElement:element};
  vm.runInNewContext(source, {document, localStorage:{
    getItem: key => { if (blocked) throw Error('blocked'); return storage.get(key) || null; },
    setItem: (key, value) => { if (blocked) throw Error('blocked'); storage.set(key,value); }},
    window:{addEventListener:(name, callback) => { windowEvents[name] = callback; }, dispatchEvent:event => { dispatched.push(event.type); }},
    requestAnimationFrame:callback => callback(), Event:class {constructor(type) {this.type=type;}},
    CustomEvent:class {constructor(type, init) {this.type=type; this.detail=init && init.detail;}}});
  return {selectors, inlineSave, inlineStatus, noteTools, storage, windowEvents, dispatched,
    locate, collapse, currentGroup, otherGroup, directoryActions};
}

(async function () {
  const page = mount();
  assert.equal(page.directoryActions.hidden, false);
  page.collapse.click();
  assert.equal(page.currentGroup.open, true);
  assert.equal(page.otherGroup.open, false);
  page.currentGroup.open = false;
  page.locate.click();
  assert.equal(page.currentGroup.open, true);
  assert.equal(page.inlineSave.textContent, '+ Save this page');
  page.inlineSave.click();
  assert.equal(page.inlineSave.attributes['aria-pressed'], 'true');
  assert.equal(page.selectors['[data-side-save]'].attributes['aria-pressed'], 'true');
  assert.match(page.inlineStatus.textContent, /Saved\. Find it under “My reading”/);
  assert.deepEqual(JSON.parse(page.storage.get('cooking-agi:reading:v1')).saved, ['learn/one.md']);
  assert.ok(page.dispatched.includes('notes:prep-storage'));
  assert.equal(page.noteTools.hidden, false);
  page.selectors['[data-side-save]'].click();
  assert.equal(page.inlineSave.attributes['aria-pressed'], 'false');
  assert.match(page.inlineStatus.textContent, /Note unsaved/);
  // another tab saved it: the button follows without a reload
  page.storage.set('cooking-agi:reading:v1', JSON.stringify({saved:['learn/one.md'], recent:[]}));
  page.windowEvents.storage({key:'cooking-agi:reading:v1'});
  assert.equal(page.inlineSave.attributes['aria-pressed'], 'true');
  const blocked = mount(true);
  blocked.inlineSave.click();
  assert.match(blocked.inlineStatus.textContent, /storage is unavailable/);
  console.log('Sidebar: directory actions, both save buttons, cross-tab refresh, storage failure OK');
})().catch(error => { console.error(error); process.exitCode = 1; });

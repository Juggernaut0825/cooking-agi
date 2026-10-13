const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../static/prep-workspace.js'), 'utf8');

class Element {
  constructor(href = '') { this.href = href; this.attributes = {}; this.hidden = false; this.events = {}; }
  getAttribute(name) { return name === 'href' ? this.href : this.attributes[name]; }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(name, callback) { this.events[name] = callback; }
  contains() { return false; }
  focus() { this.focused = true; }
}

function environment({language = 'en', hash = '', query = ''} = {}) {
  const controls = new Map();
  const control = name => {
    if (!controls.has(name)) controls.set(name, new Element());
    return controls.get(name);
  };
  const nav = ['#overview', '#schedule', '#routes', '#updates', '#progress'].map(href => new Element(href));
  const make = attributes => { const element = new Element(); element.attributes = attributes; element.id = attributes['data-workspace-panel'] || ''; return element; };
  const panels = ['overview', 'schedule', 'routes', 'updates', 'progress'].map(name => make({'data-workspace-panel': name}));
  const topics = ['ml', 'post', 'systems', 'algorithms'].map(name => make({'data-route-topic': name}));
  const levels = ['start', 'refresh'].map(name => make({'data-route-level': name}));
  const routes = topics.flatMap(topic => levels.map(level => make({'data-topic': topic.attributes['data-route-topic'], 'data-level': level.attributes['data-route-level']})));
  const plan = make({'data-note-id': 'known', 'data-task-title': 'Write attention', 'data-task-minutes': '40'});
  const switcher = new Element('https://example.org/interview/dashboard.html');
  const location = {hash, href: 'https://example.org/interview/dashboard.en.html' + query + hash};
  const state = {entries: {}, mode: {value: 'plan'}, schedule: {sessions: {}}};
  const events = {};
  const root = {querySelector: selector => control(selector === '[data-prep-backups]' ? 'backups' : selector.startsWith('[data-workspace-') ? selector.slice(16, -1) : selector), querySelectorAll: selector => ({'[id]': panels, '[data-workspace-nav]': nav, '[data-workspace-panel]': panels, '[data-route-topic]': topics, '[data-route-level]': levels, '[data-study-route]': routes, '[data-route-plan]': [plan]})[selector] || []};
  const document = {documentElement: {lang: language}, querySelector: () => root, querySelectorAll: () => [switcher]};
  const window = {
    history: {replaceState(state, title, href) { location.href = href; }},
    scrollTo() {},
    dispatchEvent(event) { events[event.type]?.(event); },
    addEventListener(name, callback) { events[name] = callback; },
    PreparationProgress: {
      getState: () => state,
      getCatalog: () => ({notes: {known: {}}}), getHealth: () => ({blocked: false}),
      getDestination: identifier => identifier === 'known' ? {url: '/trusted/attention.html', title: 'Attention'} : null
    }
  };
  class CustomEvent { constructor(type, options) { this.type = type; this.detail = options.detail; } }
  vm.runInNewContext(source, {window, document, location, URL, Date, Intl, CustomEvent});
  return {state, events, control, nav, switcher, location, panels, topics, levels, routes, plan};
}

test('empty overview is useful without fabricated progress', () => {
  const context = environment();
  assert.equal(context.control('planned').textContent, '0');
  assert.equal(context.control('completed').textContent, '0');
  assert.equal(context.control('next-title').textContent, 'Start with one small task');
  assert.equal(context.control('next-link').href, '#routes');
  assert.equal(context.control('resume').hidden, true);
  assert.equal(context.control('overview').hidden, false);
  assert.equal(context.control('route').hash, 'plan');
});

test('schedule and note updates refresh counts and trusted links', () => {
  const context = environment();
  context.state.schedule.sessions = {
    later: {status: 'planned', date: '2026-10-20', minutes: 65, title: 'Later'},
    next: {status: 'planned', date: '2026-10-12', minutes: 25, title: '<script>not HTML</script>', noteId: 'known'},
    done: {status: 'done'}, removed: {status: 'cancelled'}
  };
  context.state.entries = {known: {status: 'learning', updatedAt: '2026-10-11T00:00:00.000Z'}};
  context.events['notes:prep-changed']();
  assert.equal(context.control('planned').textContent, '2');
  assert.equal(context.control('completed').textContent, '1');
  assert.equal(context.control('notes').textContent, '1');
  assert.equal(context.control('next-title').textContent, '<script>not HTML</script>');
  assert.equal(context.control('next-title').innerHTML, undefined);
  assert.equal(context.control('next-link').href, '/trusted/attention.html');
  assert.equal(context.control('resume').href, '/trusted/attention.html');
  context.state.entries.known.status = 'practiced';
  context.state.schedule.sessions.next.noteId = 'unknown';
  context.events['notes:prep-changed']();
  assert.equal(context.control('next-link').href, '#schedule');
  assert.equal(context.control('resume').hidden, true);
});

test('language switch retains section and valid note ID; backups open directly', () => {
  const context = environment({hash: '#progress', query: '?note=note-0123456789abcdef'});
  assert.equal(context.control('backups').open, true);
  assert.equal(context.nav[4].attributes['aria-current'], 'location');
  assert.equal(new URL(context.switcher.href).hash, '#progress');
  assert.equal(new URL(context.switcher.href).searchParams.get('note'), 'note-0123456789abcdef');
  context.location.hash = '#schedule';
  context.events.hashchange();
  assert.equal(context.nav[1].attributes['aria-current'], 'location');
  assert.equal(context.nav[4].attributes['aria-current'], undefined);
  context.location.href = 'https://example.org/interview/dashboard.en.html#schedule';
  context.events['notes:prep-navigation']();
  assert.equal(new URL(context.switcher.href).searchParams.has('note'), false);
  const untrusted = environment({query: '?note=https://evil.test'});
  assert.equal(new URL(untrusted.switcher.href).searchParams.has('note'), false);
});

test('Chinese interface uses Chinese task hints', () => {
  const context = environment({language: 'zh-Hans'});
  assert.equal(context.control('next-title').textContent, '还没有学习安排');
  assert.equal(context.control('next-link').textContent, '选择练习 →');
  for (const [section, heading] of Object.entries({overview: '学习概览', schedule: '学习安排', routes: '选择学习路线', updates: '更新与设置', progress: '笔记与备份'})) {
    context.location.hash = '#' + section;
    context.events.hashchange();
    assert.equal(context.control('heading').textContent, heading);
  }
});

test('five views use URL navigation and only show the selected panel', () => {
  const context = environment({hash: '#routes'});
  assert.ok(context.panels.every(panel => panel.id.startsWith('workspace-')));
  assert.deepEqual(context.panels.map(panel => panel.hidden), [true, true, false, true, true]);
  assert.equal(context.control('heading').textContent, 'Start where it helps you most.');
  context.location.hash = '#schedule';
  context.events.hashchange();
  assert.deepEqual(context.panels.map(panel => panel.hidden), [true, false, true, true, true]);
  context.location.hash = '#content';
  context.events.hashchange();
  assert.deepEqual(context.panels.map(panel => panel.hidden), [true, false, true, true, true]);
  context.location.hash = '#updates';
  context.events.hashchange();
  assert.deepEqual(context.panels.map(panel => panel.hidden), [true, true, true, false, true]);
  assert.equal(context.control('heading').textContent, 'New material. Still your plan.');
  context.location.hash = '#unknown';
  context.events.hashchange();
  assert.deepEqual(context.panels.map(panel => panel.hidden), [false, true, true, true, true]);
});

test('route filters are bookmarkable, bilingual and do not change saved progress', () => {
  const context = environment({hash: '#routes', query: '?topic=systems&level=refresh'});
  assert.equal(context.routes.filter(route => !route.hidden).length, 1);
  assert.equal(context.routes.find(route => !route.hidden).attributes['data-topic'], 'systems');
  context.topics[3].events.click();
  context.levels[0].events.click();
  const visible = context.routes.find(route => !route.hidden);
  assert.equal(visible.attributes['data-topic'], 'algorithms');
  assert.equal(visible.attributes['data-level'], 'start');
  assert.equal(new URL(context.location.href).searchParams.get('topic'), 'algorithms');
  assert.equal(new URL(context.switcher.href).searchParams.get('level'), 'start');
  assert.deepEqual(context.state.entries, {});
  assert.deepEqual(context.state.schedule.sessions, {});
});

test('route action navigates and asks the planner for a draft, never saves directly', () => {
  const context = environment({hash: '#routes'});
  let request;
  context.events['notes:prep-plan-request'] = event => { request = event.detail; };
  context.plan.events.click();
  assert.equal(context.location.hash, '#schedule');
  assert.equal(request.title, 'Write attention');
  assert.equal(request.minutes, 40);
  assert.equal(request.noteId, 'known');
  assert.deepEqual(context.state.schedule.sessions, {});
});

test('returning to an older history URL restores its route filters', () => {
  const context = environment({hash: '#routes', query: '?topic=systems&level=refresh'});
  context.location.href = 'https://example.org/interview/dashboard.en.html?topic=ml&level=start#routes';
  context.events.hashchange();
  const visible = context.routes.find(route => !route.hidden);
  assert.equal(visible.attributes['data-topic'], 'ml');
  assert.equal(visible.attributes['data-level'], 'start');
});

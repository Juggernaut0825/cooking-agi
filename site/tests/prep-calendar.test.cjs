const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const calendar = require('../static/prep-calendar.js');

test('civil weeks cross months, years, leap days and DST without missing a day', () => {
  assert.deepEqual(calendar.week('2026-03-08'), ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08']);
  assert.equal(calendar.monday('2027-01-01'), '2026-12-28');
  assert.equal(calendar.week('2024-02-29')[3], '2024-02-29');
  assert.equal(calendar.shift('2026-11-01', 1), '2026-11-02');
  assert.equal(calendar.shift('2026-12-31', 1), '2027-01-01');
});

test('validation handles untrusted or unsupported date values without throwing', () => {
  for (const value of [undefined, null, 1, {}, '', '2026-99-99', '2026-02-29', '1899-12-31', '2201-01-01', '2026-10-11<script>']) assert.equal(calendar.valid(value), false);
  for (const value of ['1900-01-01', '2200-12-31', '2024-02-29']) assert.equal(calendar.valid(value), true);
});

class Element {
  constructor() { this.children = []; this.attributes = {}; this.events = {}; }
  append(...children) { this.children.push(...children); }
  replaceChildren() { this.children = []; }
  setAttribute(name, value) { this.attributes[name] = value; }
  getAttribute(name) { return this.attributes[name]; }
  addEventListener(name, handler) { this.events[name] = handler; }
  focus() { this.focused = true; }
}

function environment(language = 'en') {
  const controls = new Map();
  const control = name => {
    if (!controls.has(name)) controls.set(name, new Element());
    return controls.get(name);
  };
  const root = {querySelector: selector => control(selector.slice(15, -1))};
  const state = {schedule: {sessions: {
    one: {status: 'planned', date: '2026-10-12', minutes: 25},
    two: {status: 'planned', date: '2026-10-12', minutes: 40},
    done: {status: 'done', date: '2026-10-12', minutes: 90},
    removed: {status: 'cancelled', date: '2026-10-12', minutes: 60}
  }}};
  const events = {};
  const window = {
    PreparationProgress: {getState: () => state},
    addEventListener(name, handler) { events[name] = handler; },
    dispatchEvent(event) { events[event.type]?.(event); }
  };
  class CustomEvent { constructor(type, options) { this.type = type; this.detail = options.detail; } }
  const document = {documentElement: {lang: language}, querySelector: () => root, createElement: () => new Element()};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../static/prep-calendar.js'), 'utf8'), {window, document, Date, Intl, CustomEvent});
  return {control, events, state, root};
}

test('calendar derives planned counts and durations, not invented study or mastery', () => {
  const context = environment();
  context.events['notes:prep-day']({detail: {date: '2026-10-12'}});
  const days = context.control('days').children;
  assert.equal(days.length, 7);
  assert.match(days[0].attributes['aria-label'], /2 planned · 65 min/);
  assert.match(days[1].attributes['aria-label'], /Free/);
  assert.equal(days[0].attributes['aria-pressed'], 'true');
  assert.equal(context.root.hidden, false);
  context.state.schedule.sessions.one.status = 'done';
  context.events['notes:prep-changed']();
  assert.match(context.control('days').children[0].attributes['aria-label'], /1 planned · 40 min/);
});

test('week navigation, selected day focus, reset and civil-date boundaries work', () => {
  const context = environment('zh-CN');
  context.events['notes:prep-day']({detail: {date: '2026-10-12'}});
  context.control('next').events.click();
  assert.equal(context.control('days').children[0].children[1].textContent, '19');
  context.control('prev').events.click();
  context.control('days').children[1].events.click();
  assert.equal(context.control('days').children[1].attributes['aria-pressed'], 'true');
  assert.equal(context.control('days').children[1].focused, true);
  assert.match(context.control('days').children[1].attributes['aria-label'], /留空/);
  context.events['notes:prep-day']({detail: {date: ''}});
  assert.ok(context.control('days').children.every(day => day.attributes['aria-pressed'] === 'false'));
  context.events['notes:prep-day']({detail: {date: '1900-01-01'}});
  assert.equal(context.control('prev').disabled, true);
  context.events['notes:prep-day']({detail: {date: '2200-12-31'}});
  assert.equal(context.control('next').disabled, true);
  assert.ok(context.control('days').children.some(day => day.disabled));
});

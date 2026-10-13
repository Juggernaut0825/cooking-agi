const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto').webcrypto;
const source = fs.readFileSync(require.resolve('../static/note-metrics.js'), 'utf8');
const note = 'note-78153ce088c6824e';
const settle = () => new Promise(resolve => setImmediate(resolve));

function environment({enabled = true, language = 'zh-Hans', privacy = false, configFails = false} = {}) {
  const node = () => ({textContent: '—', hidden: true, disabled: true, checked: false, events: {},
    addEventListener(name, callback) { this.events[name] = callback; }, removeAttribute() {}});
  const controls = new Map();
  for (const name of ['status', 'notice', 'consent', 'retry']) controls.set('[data-metrics-' + name + ']', node());
  for (const name of ['reads', 'month-reads', 'saves', 'month-saves']) controls.set('[data-metric="' + name + '"]', node());
  const panel = {dataset: {noteMetrics: note}, querySelector: selector => controls.get(selector)};
  const clock = {now: Date.parse('2026-10-12T12:00:00Z')};
  class ClockDate extends Date {
    constructor(...arguments_) { super(...(arguments_.length ? arguments_ : [clock.now])); }
    static now() { return clock.now; }
  }
  const storage = new Map();
  const intervals = [];
  const requests = [];
  const document = {documentElement: {lang: language}, visibilityState: 'visible', events: {},
    querySelector: () => panel, addEventListener(name, callback) { this.events[name] = callback; }};
  const window = {SITE: {prefix: './'}, crypto, events: {},
    localStorage: {getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value)},
    addEventListener(name, callback) { this.events[name] = callback; }, setTimeout() { return 1; }, clearTimeout() {},
    setInterval(callback) { intervals.push(callback); }};
  const faults = {config: configFails, post: false};
  const counts = {version: 1, noteId: note, month: '2026-10', mode: 'local', reads: 0, monthReads: 0, saves: 0, monthSaves: 0};
  const fetch = async (url, options) => {
    requests.push({url: String(url), ...options});
    if (String(url).endsWith('note-metrics-config.json')) {
      if (faults.config) throw Error('offline');
      return {ok: true, json: async () => ({version: 1, endpoint: enabled ? '/api/counts/' : ''})};
    }
    if (options.method === 'POST') {
      if (faults.post) throw Error('offline');
      const event = JSON.parse(options.body);
      if (event.kind === 'view') { counts.reads += 1; counts.monthReads += 1; }
      else { counts.saves = Number(event.saved); counts.monthSaves = Number(event.saved); }
    }
    return {ok: true, json: async () => ({...counts})};
  };
  vm.runInNewContext(source, {window, document, navigator: {globalPrivacyControl: privacy},
    URL, location: {href: 'https://example.com/note.html'}, Date: ClockDate, Intl, AbortController, fetch, Uint8Array});
  const control = name => controls.get('[data-metrics-' + name + ']');
  const opt = value => { control('consent').checked = value; control('consent').events.change(); };
  const advance = async seconds => {
    for (let elapsed = 0; elapsed < seconds; elapsed++) { clock.now += 1000; intervals.forEach(callback => callback()); await settle(); }
  };
  const posts = () => requests.filter(request => request.method === 'POST');
  const bookmark = saved => window.events['notes:bookmark-action']({detail: {noteId: note, saved}});
  return {control, opt, advance, posts, bookmark, requests, faults, window, document,
    value: name => controls.get('[data-metric="' + name + '"]').textContent};
}

test('disabled configuration stays at dashes, with no analytics events or enabled consent', async () => {
  const context = environment({enabled: false});
  await settle();
  await context.advance(20);
  assert.equal(context.value('reads'), '—');
  assert.equal(context.control('consent').disabled, true);
  assert.equal(context.posts().length, 0);
  assert.equal(context.requests.length, 1);
});

test('only visible time after opting in counts, once per page/day', async () => {
  const context = environment();
  await settle();
  await context.advance(20);
  context.bookmark(true);
  assert.equal(context.posts().length, 0);
  assert.equal(context.value('reads'), '0');
  context.opt(true);
  context.document.visibilityState = 'hidden';
  context.document.events.visibilitychange();
  await context.advance(30);
  assert.equal(context.posts().length, 0);
  context.document.visibilityState = 'visible';
  context.document.events.visibilitychange();
  await context.advance(14);
  assert.equal(context.posts().length, 0);
  await context.advance(1);
  assert.equal(context.posts().length, 1);
  assert.equal(context.value('reads'), '1');
  await context.advance(30);
  assert.equal(context.posts().length, 1);
  assert.match(context.control('status').textContent, /本地预览/);
});

test('manual bookmarks count, backups do not, and opting out leaves no subsequent writes', async () => {
  const context = environment({language: 'en'});
  await settle();
  context.opt(true);
  context.bookmark(true);
  await settle();
  assert.equal(context.value('saves'), '1');
  context.window.events['notes:prep-restored']?.({});
  assert.equal(context.posts().length, 1);
  context.bookmark(false);
  await settle();
  assert.equal(context.value('saves'), '0');
  context.opt(false);
  context.bookmark(true);
  await context.advance(20);
  assert.equal(context.posts().length, 2);
  for (const request of context.posts()) {
    assert.equal(request.credentials, 'omit');
    assert.equal(request.referrerPolicy, 'no-referrer');
    assert.deepEqual(Object.keys(JSON.parse(request.body)).sort(), ['kind', 'saved', 'token']);
  }
});

test('privacy signal prevents submissions even if the checkbox is forced on', async () => {
  const context = environment({privacy: true});
  await settle();
  assert.equal(context.control('consent').disabled, true);
  context.opt(true);
  context.bookmark(true);
  await context.advance(20);
  assert.equal(context.posts().length, 0);
});

test('configuration and pending writes recover through the retry button without invented counts', async () => {
  const context = environment({configFails: true});
  await settle();
  assert.equal(context.value('reads'), '—');
  assert.equal(context.control('retry').hidden, false);
  context.faults.config = false;
  context.control('retry').events.click();
  await settle();
  assert.equal(context.value('reads'), '0');
  context.opt(true);
  context.faults.post = true;
  context.bookmark(true);
  await settle();
  assert.equal(context.value('saves'), '0');
  assert.equal(context.control('retry').hidden, false);
  context.faults.post = false;
  context.control('retry').events.click();
  await settle();
  assert.equal(context.value('saves'), '1');
});

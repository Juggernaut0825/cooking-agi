const assert = require('node:assert/strict');
const {test} = require('node:test');
const {createNavigation} = require('../static/fragment-navigation.js');

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return {promise, resolve};
}

function events() {
  const handlers = new Map();
  return {
    addEventListener(name, handler) {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name).add(handler);
    },
    removeEventListener(name, handler) { handlers.get(name)?.delete(handler); },
    emit(name) { for (const handler of [...(handlers.get(name) || [])]) handler(); },
    size() { return [...handlers.values()].reduce((total, entries) => total + entries.size, 0); }
  };
}

function browser(options = {}) {
  const frames = [];
  const calls = [];
  const queried = [];
  const font = deferred();
  const document = {
    ...events(),
    fonts: options.noFonts ? undefined : {get ready() { calls.push('fonts'); return font.promise; }},
    getElementById(identifier) {
      queried.push(identifier);
      if (options.missing) return null;
      return {
        closest(selector) {
          if (selector === '.article-body') return options.outside ? null : {};
          if (selector === '[data-chronicle]') return options.chronicle ? {} : null;
          return null;
        },
        getClientRects: () => options.hidden ? [] : [{}],
        scrollIntoView: settings => calls.push(settings)
      };
    }
  };
  const window = {
    ...events(),
    location: {href: options.href || 'https://example.org/notes.html#cache'},
    performance: options.noPerformance ? undefined : {getEntriesByType: () => [{type: options.type || 'navigate'}]},
    requestAnimationFrame: callback => frames.push(callback)
  };
  const navigation = createNavigation(window, document);
  return {window, document, frames, calls, queried, font, navigation};
}

async function tick() { await Promise.resolve(); await Promise.resolve(); }
async function frame(state) {
  const callbacks = state.frames.splice(0);
  callbacks.forEach(callback => callback());
  await tick();
}
async function finish(state, pending) {
  await tick();
  await frame(state);
  state.font.resolve();
  await tick();
  await frame(state);
  await pending;
}

test('waits for math, diagrams, a layout frame, and fonts; restores just once', async () => {
  const state = browser();
  const math = deferred(), diagrams = deferred();
  const pending = state.navigation.settle(Promise.all([math.promise, diagrams.promise]));
  math.resolve();
  await tick();
  assert.equal(state.frames.length, 0);
  diagrams.resolve();
  await tick();
  assert.deepEqual(state.calls, []);
  await frame(state);
  assert.deepEqual(state.calls, ['fonts']);
  state.font.resolve();
  await tick();
  assert.equal(state.calls.length, 1);
  await frame(state);
  await pending;
  assert.deepEqual(state.calls[1], {block: 'start', inline: 'nearest', behavior: 'instant'});
  await state.navigation.settle(Promise.resolve());
  assert.equal(state.calls.length, 2);
  assert.equal(state.document.size() + state.window.size(), 0);
});

for (const gesture of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
  test(`does not override ${gesture} while layout is pending`, async () => {
    const state = browser();
    const layout = deferred();
    const pending = state.navigation.settle(layout.promise);
    state.document.emit(gesture);
    layout.resolve();
    await pending;
    assert.deepEqual(state.calls, []);
    assert.equal(state.document.size() + state.window.size(), 0);
  });
}

test('also cancels a gesture during font loading or the final frame', async () => {
  for (const phase of ['fonts', 'frame']) {
    const state = browser();
    const pending = state.navigation.settle(Promise.resolve());
    await tick();
    await frame(state);
    if (phase === 'frame') { state.font.resolve(); await tick(); }
    state.document.emit('wheel');
    await finish(state, pending);
    assert.equal(state.calls.filter(value => typeof value === 'object').length, 0);
  }
});

for (const departure of ['hashchange', 'popstate', 'pagehide']) {
  test(`does not fight ${departure}`, async () => {
    const state = browser();
    const pending = state.navigation.settle(Promise.resolve());
    state.window.emit(departure);
    await pending;
    assert.deepEqual(state.calls, []);
  });
}

test('does not restore a URL changed with replaceState', async () => {
  const state = browser();
  const pending = state.navigation.settle(Promise.resolve());
  state.window.location.href = 'https://example.org/notes.html#other';
  await finish(state, pending);
  assert.deepEqual(state.queried, []);
});

for (const options of [
  {href: 'https://example.org/notes.html'},
  {href: 'https://example.org/notes.html#%broken'},
  {href: 'https://example.org/notes.html#cache:~:text=hello'},
  {type: 'back_forward'},
  {type: 'reload'}
]) {
  test(`leaves native navigation alone for ${JSON.stringify(options)}`, async () => {
    const state = browser(options);
    await state.navigation.settle(Promise.resolve());
    assert.deepEqual(state.calls, []);
    assert.equal(state.document.size() + state.window.size(), 0);
  });
}

for (const option of ['missing', 'hidden', 'outside', 'chronicle']) {
  test(`does not scroll to a ${option} target`, async () => {
    const state = browser({[option]: true});
    await finish(state, state.navigation.settle(Promise.resolve()));
    assert.equal(state.calls.filter(value => typeof value === 'object').length, 0);
  });
}

test('supports encoded IDs without needing a CSS selector', async () => {
  const state = browser({href: 'https://example.org/notes.html#%E7%BC%93%E5%AD%98'});
  await finish(state, state.navigation.settle(Promise.resolve()));
  assert.deepEqual(state.queried, ['缓存']);
});

test('works without optional font and navigation APIs', async () => {
  const state = browser({noFonts: true, noPerformance: true});
  await finish(state, state.navigation.settle(Promise.resolve()));
  assert.equal(state.calls.length, 1);
});

test('cleans up if a rendering task fails', async () => {
  const state = browser();
  await state.navigation.settle(Promise.reject(Error('render failure')));
  assert.deepEqual(state.calls, []);
  assert.equal(state.document.size() + state.window.size(), 0);
});

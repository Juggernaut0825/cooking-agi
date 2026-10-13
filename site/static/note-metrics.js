(function (scope) {
  'use strict';
  const NOTE = /^note-[a-f0-9]{16}$/;
  const TOKEN = /^[a-f0-9]{32}$/;

  function endpointURL(value, base) {
    if (!value || typeof value !== 'string') return null;
    const origin = new URL(base);
    const endpoint = new URL(value, origin);
    const local = endpoint.origin === origin.origin && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
    if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
        (endpoint.protocol !== 'https:' && !(local && endpoint.protocol === 'http:'))) throw Error('endpoint');
    endpoint.pathname = endpoint.pathname.replace(/\/+$/, '') + '/';
    return endpoint;
  }

  function snapshot(value, note) {
    const fields = ['reads', 'monthReads', 'saves', 'monthSaves'];
    if (!value || value.version !== 1 || value.noteId !== note || !NOTE.test(note) ||
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(value.month) ||
        !['local', 'public'].includes(value.mode) ||
        fields.some(field => !Number.isSafeInteger(value[field]) || value[field] < 0) ||
        value.monthReads > value.reads || value.monthSaves > value.saves) throw Error('snapshot');
    return value;
  }

  function identity(storage, crypto, key, note) {
    if (!NOTE.test(note)) return null;
    try {
      const saved = storage.getItem(key + ':token:' + note);
      if (TOKEN.test(saved || '')) return saved;
      const token = Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('');
      storage.setItem(key + ':token:' + note, token);
      return token;
    } catch { return null; }
  }

  function createQueue({allowed, send, onResult, onError}) {
    const pending = new Map();
    let busy = false;
    async function flush() {
      if (busy) return;
      busy = true;
      try {
        while (pending.size && allowed()) {
          const [key, action] = pending.entries().next().value;
          try {
            const result = await send(action);
            if (pending.get(key) === action) pending.delete(key);
            onResult(result, action);
          } catch (error) { onError(error); break; }
        }
      } finally { busy = false; }
    }
    function enqueue(action) {
      if (!allowed() || !NOTE.test(action.noteId) || !['view', 'bookmark'].includes(action.kind) ||
          (action.kind === 'bookmark' && typeof action.saved !== 'boolean')) return;
      const key = action.kind + ':' + action.noteId;
      if (action.kind === 'view' && pending.has(key)) return;
      pending.set(key, action);
      void flush();
    }
    return {enqueue, flush, clear: () => pending.clear(), size: () => pending.size};
  }

  const api = {endpointURL, snapshot, identity, createQueue};
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  const panel = document.querySelector('[data-note-metrics]');
  const note = panel?.dataset.noteMetrics;
  const base = new URL(scope.SITE?.prefix || './', location.href);
  const key = 'cooking-agi:' + base.pathname + ':metrics:v1';
  const chinese = document.documentElement.lang.startsWith('zh');
  const say = (zh, en) => chinese ? zh : en;
  const status = panel?.querySelector('[data-metrics-status]');
  const notice = panel?.querySelector('[data-metrics-notice]');
  const checkbox = panel?.querySelector('[data-metrics-consent]');
  const retry = panel?.querySelector('[data-metrics-retry]');
  const privateBrowser = () => navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
  let endpoint = null;
  let visibleTime = 0;
  let lastTick = Date.now();
  let wasVisible = document.visibilityState === 'visible';
  let readDay = '';
  let readQueued = false;
  let lastRetry = 0;
  let refreshNumber = 0;
  function optedIn() {
    try { return !privateBrowser() && scope.localStorage.getItem(key + ':consent') === 'on'; }
    catch { return false; }
  }
  function setStatus(message) { if (status) status.textContent = message; }
  function render(value) {
    if (!panel || value.noteId !== note) return;
    const fields = {reads: 'reads', 'month-reads': 'monthReads', saves: 'saves', 'month-saves': 'monthSaves'};
    for (const [selector, field] of Object.entries(fields)) {
      const node = panel.querySelector('[data-metric="' + selector + '"]');
      node.textContent = new Intl.NumberFormat(chinese ? 'zh-CN' : 'en-US').format(value[field]);
      node.removeAttribute('aria-label');
    }
    setStatus((value.mode === 'local' ? say('本地预览 · 非线上数据 · ', 'Local preview · not live counts · ') : '') + value.month + ' (UTC)');
    retry.hidden = true;
  }
  function updateConsent() {
    if (!checkbox) return;
    checkbox.checked = optedIn();
    checkbox.disabled = !endpoint || privateBrowser();
    notice.textContent = privateBrowser()
      ? say('浏览器已请求不跟踪，不会提交统计。', 'Your browser requests no tracking; no count events will be sent.')
      : optedIn() ? say('已开启，只统计后续操作。', 'On. Only subsequent activity is counted.')
        : say('未参与统计；阅读和本地收藏照常使用。', 'Not contributing counts. Reading and local bookmarks still work.');
  }
  async function request(url, body) {
    const controller = new AbortController();
    const timeout = scope.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, {method: body ? 'POST' : 'GET', credentials: 'omit',
        referrerPolicy: 'no-referrer', cache: 'no-store', signal: controller.signal,
        ...(body ? {headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)} : {})});
      if (!response.ok) throw Error('service');
      return await response.json();
    } finally { scope.clearTimeout(timeout); }
  }
  async function refresh() {
    if (!endpoint || !NOTE.test(note || '')) return;
    const attempt = ++refreshNumber;
    try {
      const value = snapshot(await request(new URL(note, endpoint)), note);
      if (attempt === refreshNumber) render(value);
    } catch {
      if (attempt !== refreshNumber) return;
      setStatus(say('暂时连不上统计服务，不影响阅读或收藏。', 'Counts are temporarily unavailable. Reading and saving still work.'));
      retry.hidden = false;
    }
  }
  const queue = createQueue({
    allowed: () => Boolean(endpoint) && optedIn(),
    send: async action => {
      const token = identity(scope.localStorage, scope.crypto, key, action.noteId);
      if (!token) throw Error('storage');
      const body = {kind: action.kind, token};
      if (action.kind === 'bookmark') body.saved = action.saved;
      return snapshot(await request(new URL(action.noteId, endpoint), body), action.noteId);
    },
    onResult: (value, action) => {
      if (action.noteId === note) {
        refreshNumber += 1;
        render(value);
        if (action.kind === 'view') { readDay = new Date().toISOString().slice(0, 10); readQueued = false; }
      }
    },
    onError: () => {
      setStatus(say('统计暂未同步；本地收藏已保留。连接恢复后可重试。', 'Counts have not synced. Local bookmarks are kept; retry when connected.'));
      if (retry) retry.hidden = false;
      lastRetry = Date.now();
    }
  });
  function resetClock() { visibleTime = 0; lastTick = Date.now(); wasVisible = document.visibilityState === 'visible'; }
  function tick() {
    const now = Date.now();
    if (optedIn() && endpoint && NOTE.test(note || '')) {
      if (wasVisible) visibleTime += Math.min(2000, Math.max(0, now - lastTick));
      const day = new Date().toISOString().slice(0, 10);
      if (visibleTime >= 15000 && !readQueued && readDay !== day && document.visibilityState === 'visible') {
        readQueued = true;
        queue.enqueue({kind: 'view', noteId: note});
      }
    }
    lastTick = now;
    wasVisible = document.visibilityState === 'visible';
    if (queue.size() && now - lastRetry >= 60000 && wasVisible) { lastRetry = now; void queue.flush(); }
  }
  scope.addEventListener('notes:bookmark-action', event => {
    const action = event.detail;
    if (action && NOTE.test(action.noteId || '') && typeof action.saved === 'boolean')
      queue.enqueue({kind: 'bookmark', noteId: action.noteId, saved: action.saved});
  });
  scope.addEventListener('online', () => { void queue.flush(); if (endpoint) void refresh(); else void connect(); });
  scope.addEventListener('storage', event => {
    if (event.key !== key + ':consent' && event.key !== null) return;
    if (!optedIn()) { queue.clear(); readQueued = false; }
    resetClock();
    updateConsent();
  });
  if (checkbox) checkbox.addEventListener('change', () => {
    try { scope.localStorage.setItem(key + ':consent', checkbox.checked ? 'on' : 'off'); }
    catch { checkbox.checked = false; notice.textContent = say('浏览器无法保存设置，未开启统计。', 'Storage is unavailable; counting remains off.'); return; }
    if (!optedIn()) { queue.clear(); readQueued = false; }
    resetClock();
    updateConsent();
  });
  if (retry) retry.addEventListener('click', () => { void queue.flush(); if (endpoint) void refresh(); else void connect(); });
  document.addEventListener('visibilitychange', tick);
  scope.setInterval(tick, 1000);
  async function connect() {
    try {
      const config = await request(new URL('static/note-metrics-config.json', base));
      if (config.version !== 1) throw Error('config');
      endpoint = endpointURL(config.endpoint, base);
      updateConsent();
      if (endpoint) await refresh();
      else {
        setStatus(say('公开统计尚未启用', 'Public counts are not enabled yet'));
        if (retry) retry.hidden = true;
      }
    } catch {
      setStatus(say('统计配置暂不可用，不影响阅读或收藏。', 'Count settings are unavailable. Reading and saving still work.'));
      if (retry) retry.hidden = false;
    }
  }
  void connect();
})(typeof window === 'undefined' ? globalThis : window);

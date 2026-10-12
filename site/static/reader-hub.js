/* Reader hub: reading history, saved notes, settings, and the little golden crow.

   Everything is stored in the shared progress envelope (workspace records), so
   it travels with the existing JSON backup and never leaves the browser:
     reads-YYYYMMDD   {notes: {note-id: count}, updatedAt}   one record per local day
     reader-settings  {history, mascot, starAskedOn, starDone, snoozedUntil, updatedAt}
   A page counts as read once per load, after it has been visible for 15 seconds.
   Days older than 90 are emptied (not deleted), so merges stay timestamp-based.
   No network request except the site's own public note catalog. */
(function (scope) {
  'use strict';
  const DAY = 'reads-';
  const SETTINGS = 'reader-settings';
  const KEEP_DAYS = 90;
  const MAX_PER_DAY = 200;
  const NOTE = /^note-[a-f0-9]{16}$/;
  const MASCOT_STATES = ['open', 'collapsed', 'hidden'];

  const pad = value => String(value).padStart(2, '0');
  function dayKey(date) {
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  }
  function fromKey(key) {
    const digits = key.slice(DAY.length);
    return new Date(Number(digits.slice(0, 4)), Number(digits.slice(4, 6)) - 1, Number(digits.slice(6, 8)));
  }
  function daysBetween(earlier, later) {
    return Math.round((new Date(later.getFullYear(), later.getMonth(), later.getDate()) -
      new Date(earlier.getFullYear(), earlier.getMonth(), earlier.getDate())) / 86400000);
  }

  function settings(records) {
    const record = records?.[SETTINGS] || {};
    return {
      history: record.history !== false,
      mascot: MASCOT_STATES.includes(record.mascot) ? record.mascot : 'collapsed',
      starAskedOn: typeof record.starAskedOn === 'string' ? record.starAskedOn : '',
      starDone: record.starDone === true,
      snoozedUntil: typeof record.snoozedUntil === 'string' ? record.snoozedUntil : ''
    };
  }

  /* Changes that add one read of noteId on date, and empty days past the window. */
  function increment(records, noteId, date, at) {
    if (!NOTE.test(noteId)) return {};
    const key = DAY + dayKey(date);
    const notes = Object.assign({}, records?.[key]?.notes || {});
    if (!(noteId in notes) && Object.keys(notes).length >= MAX_PER_DAY) return {};
    notes[noteId] = Math.min(9999, (Number.isInteger(notes[noteId]) ? notes[noteId] : 0) + 1);
    const changes = {[key]: {notes, updatedAt: at}};
    for (const [other, record] of Object.entries(records || {})) {
      if (!other.startsWith(DAY) || other === key || !Object.keys(record?.notes || {}).length) continue;
      if (daysBetween(fromKey(other), date) >= KEEP_DAYS) changes[other] = {notes: {}, updatedAt: at};
    }
    return changes;
  }

  /* Changes that empty every reading day. */
  function clear(records, at) {
    return Object.fromEntries(Object.keys(records || {})
      .filter(key => key.startsWith(DAY) && Object.keys(records[key]?.notes || {}).length)
      .map(key => [key, {notes: {}, updatedAt: at}]));
  }

  /* Today, the last `span` days, and recently read notes, from the records alone. */
  function summarize(records, today, span = 14) {
    const days = new Map();
    for (const [key, record] of Object.entries(records || {})) {
      if (!/^reads-\d{8}$/.test(key)) continue;
      const age = daysBetween(fromKey(key), today);
      if (age < 0 || age >= KEEP_DAYS) continue;
      days.set(age, record.notes || {});
    }
    const series = [];
    for (let age = span - 1; age >= 0; age--) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - age);
      const notes = days.get(age) || {};
      series.push({date, total: Object.values(notes).reduce((sum, count) => sum + count, 0)});
    }
    const todayNotes = Object.entries(days.get(0) || {}).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]);
    const recent = new Map();
    [...days.entries()].sort((a, b) => a[0] - b[0]).forEach(([age, notes]) => {
      for (const [id, count] of Object.entries(notes)) {
        if (!count) continue;
        const item = recent.get(id) || {id, lastAge: age, total: 0};
        item.total += count;
        item.lastAge = Math.min(item.lastAge, age);
        recent.set(id, item);
      }
    });
    return {
      today: {total: todayNotes.reduce((sum, [, count]) => sum + count, 0), notes: todayNotes},
      series,
      window: series.reduce((sum, day) => sum + day.total, 0),
      recent: [...recent.values()].sort((a, b) => a.lastAge - b.lastAge || b.total - a.total)
    };
  }

  const api = {DAY, SETTINGS, KEEP_DAYS, dayKey, settings, increment, clear, summarize};
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  scope.ReaderHub = api;

  /* ---------------------------------------------------------------- page UI */
  const progress = scope.PreparationProgress;
  if (!progress) return;
  const zh = (document.documentElement.lang || '').startsWith('zh');
  const say = (chinese, english) => (zh ? chinese : english);
  const lang = zh ? 'zh' : 'en';
  const base = new URL((scope.SITE && scope.SITE.prefix) || './', location.href);
  const repoLink = document.querySelector('.repo-btn');
  const repo = repoLink ? repoLink.href : 'https://github.com/tianyi-zhang-02/cooking-agi';
  const pageNote = document.querySelector('[data-prep-note]')?.dataset.prepNote || '';
  const reduce = () => scope.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const records = () => progress.getState()?.workspace?.records || {};
  const now = () => new Date().toISOString();
  const todayKey = () => {
    const date = new Date();
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };
  let catalog = null;
  let catalogLoading = null;

  function write(changes, action) {
    if (!Object.keys(changes).length) return true;
    try { return progress.updateWorkspace(changes, action)?.persisted !== false; } catch { return false; }
  }
  function saveSettings(patch) {
    const current = settings(records());
    return write({[SETTINGS]: Object.assign({}, current, patch, {updatedAt: now()})});
  }
  function loadCatalog() {
    if (catalog) return Promise.resolve(catalog);
    const shared = progress.getCatalog && progress.getCatalog();
    if (shared) { catalog = shared; return Promise.resolve(catalog); }
    if (!catalogLoading) {
      catalogLoading = fetch(new URL('static/prep-progress-catalog.json', base)).then(response => {
        if (!response.ok) throw Error('catalog');
        return response.json();
      }).then(value => { catalog = value; return value; }).catch(() => null);
    }
    return catalogLoading;
  }
  function pageOf(id) {
    const note = catalog?.notes?.[id];
    const page = note?.pages?.[lang] || note?.pages?.zh || note?.pages?.en;
    return page ? {title: page.title, href: new URL(page.url, base).href} : null;
  }
  const el = (tag, attributes = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) {
      if (key === 'text') node.textContent = value;
      else if (value !== false && value !== null && value !== undefined) node.setAttribute(key, value === true ? '' : value);
    }
    for (const child of [].concat(children)) if (child) node.append(child);
    return node;
  };
  const svg = (tag, attributes = {}) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    return node;
  };

  /* Count this page once it has been visible for 15 seconds. */
  if (pageNote) {
    let visible = 0, last = document.visibilityState === 'visible' ? Date.now() : 0, counted = false;
    const tick = () => {
      if (counted) return;
      if (document.visibilityState === 'visible') {
        if (last) visible += Date.now() - last;
        last = Date.now();
      } else { if (last) visible += Date.now() - last; last = 0; }
      if (visible >= 15000) {
        counted = true;
        if (settings(records()).history) {
          write(increment(records(), pageNote, new Date(), now()));
          render();
        }
      }
    };
    const timer = scope.setInterval(() => { tick(); if (counted) scope.clearInterval(timer); }, 1000);
    document.addEventListener('visibilitychange', tick);
  }

  /* ------------------------------------------------------------- the drawer */
  const toggle = el('button', {type: 'button', class: 'icon-btn reader-hub-toggle', 'aria-label': say('我的阅读', 'My reading'),
    'aria-haspopup': 'dialog', 'aria-controls': 'reader-hub', 'aria-expanded': 'false'});
  const icon = svg('svg', {viewBox: '0 0 20 20', width: '18', height: '18', 'aria-hidden': 'true'});
  icon.append(svg('path', {d: 'M5.5 3.5h9v13l-4.5-3-4.5 3z', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linejoin': 'round'}));
  toggle.append(icon, el('span', {class: 'reader-hub-badge', hidden: true, 'aria-hidden': 'true'}));
  const right = document.querySelector('.topbar-right');
  const themeButton = document.querySelector('.icon-btn.theme');
  if (right) right.insertBefore(toggle, themeButton || null);

  const tabs = [['reading', say('阅读记录', 'Reading')], ['saved', say('收藏', 'Saved')], ['settings', say('设置', 'Settings')]];
  const drawer = el('aside', {id: 'reader-hub', class: 'reader-hub', role: 'dialog', 'aria-labelledby': 'reader-hub-title', hidden: true});
  const close = el('button', {type: 'button', class: 'reader-hub-close', 'aria-label': say('关闭', 'Close'), text: '×'});
  const tabList = el('div', {class: 'reader-hub-tabs', role: 'tablist'});
  const panels = {};
  for (const [name, label] of tabs) {
    tabList.append(el('button', {type: 'button', role: 'tab', id: `reader-tab-${name}`, 'aria-controls': `reader-panel-${name}`,
      'aria-selected': name === 'reading' ? 'true' : 'false', 'data-tab': name, text: label}));
    panels[name] = el('section', {class: 'reader-hub-panel', role: 'tabpanel', id: `reader-panel-${name}`,
      'aria-labelledby': `reader-tab-${name}`, hidden: name !== 'reading'});
  }
  const status = el('p', {class: 'reader-hub-status', role: 'status', 'aria-live': 'polite'});
  drawer.append(el('header', {class: 'reader-hub-head'}, [el('h2', {id: 'reader-hub-title', text: say('我的', 'Mine')}), close]),
    tabList, ...Object.values(panels), status,
    el('p', {class: 'reader-hub-local', text: say('这些记录只存在这个浏览器里，不会上传；换设备时到学习台导出、导入备份。',
      'These records stay in this browser and are never uploaded. To move devices, export and import a backup in the study workspace.')}));
  document.body.append(drawer);

  let active = 'reading';
  function select(name) {
    active = name;
    tabList.querySelectorAll('[role="tab"]').forEach(tab => {
      const on = tab.dataset.tab === name;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    });
    for (const [key, panel] of Object.entries(panels)) panel.hidden = key !== name;
    render();
  }
  tabList.addEventListener('click', event => { const tab = event.target.closest('[data-tab]'); if (tab) select(tab.dataset.tab); });
  tabList.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const order = tabs.map(([name]) => name);
    const next = order[(order.indexOf(active) + (event.key === 'ArrowRight' ? 1 : order.length - 1)) % order.length];
    select(next);
    tabList.querySelector(`[data-tab="${next}"]`).focus();
  });
  function open(tab) {
    if (tab) select(tab);
    drawer.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    loadCatalog().then(render);
    render();
    close.focus();
  }
  function shut() {
    drawer.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus();
  }
  toggle.addEventListener('click', () => (drawer.hidden ? open() : shut()));
  close.addEventListener('click', shut);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !drawer.hidden) shut(); });
  document.addEventListener('click', event => {
    // Use the path from dispatch time: a button that re-rendered itself is no longer inside the drawer.
    const path = event.composedPath();
    if (!drawer.hidden && !path.includes(drawer) && !path.includes(toggle) && !path.includes(mascot)) shut();
  });

  const dateLabel = date => (zh ? `${date.getMonth() + 1}月${date.getDate()}日` : date.toLocaleDateString('en', {month: 'short', day: 'numeric'}));
  function noteLink(id, extra) {
    const page = pageOf(id);
    const item = el('li');
    item.append(page ? el('a', {href: page.href, text: page.title}) : el('span', {class: 'reader-hub-unknown', text: say('（目录里没有这篇）', '(not in the current catalog)')}));
    if (extra) item.append(el('small', {text: extra}));
    return item;
  }

  function renderReading(panel, state) {
    panel.replaceChildren();
    const config = settings(state);
    const summary = summarize(state, new Date());
    if (!config.history) {
      const enable = el('button', {type: 'button', class: 'reader-hub-button', text: say('打开阅读记录', 'Turn on reading history')});
      enable.addEventListener('click', () => { saveSettings({history: true}); render(); });
      panel.append(el('p', {class: 'reader-hub-empty', text: say('阅读记录已关闭，读过的笔记不会被计数。', 'Reading history is off, so pages are not counted.')}), enable);
      return;
    }
    const stats = el('div', {class: 'reader-hub-stats'}, [
      el('div', {}, [el('strong', {text: String(summary.today.total)}), el('span', {text: say('今天读的次数', 'reads today')})]),
      el('div', {}, [el('strong', {text: String(summary.today.notes.length)}), el('span', {text: say('今天读的篇数', 'notes today')})]),
      el('div', {}, [el('strong', {text: String(summary.window)}), el('span', {text: say('近 14 天', 'last 14 days')})])
    ]);
    const peak = Math.max(1, ...summary.series.map(day => day.total));
    const chart = svg('svg', {class: 'reader-hub-chart', viewBox: '0 0 280 74', role: 'img',
      'aria-label': say(`近 14 天每天的阅读次数，共 ${summary.window} 次`, `Reads per day over the last 14 days: ${summary.window} in total`)});
    summary.series.forEach((day, index) => {
      const height = day.total ? Math.max(4, 54 * day.total / peak) : 2;
      const bar = svg('rect', {x: String(4 + index * 19.7), y: String(58 - height), width: '14', height: String(height), rx: '3',
        class: index === summary.series.length - 1 ? 'is-today' : (day.total ? 'has-reads' : '')});
      const title = svg('title');
      title.textContent = `${dateLabel(day.date)} · ${day.total} ${say('次', day.total === 1 ? 'read' : 'reads')}`;
      bar.append(title);
      chart.append(bar);
    });
    [[0, summary.series[0].date], [summary.series.length - 1, summary.series[summary.series.length - 1].date]].forEach(([index, date], i) => {
      const label = svg('text', {x: String(4 + index * 19.7 + (i ? 14 : 0)), y: '72', 'text-anchor': i ? 'end' : 'start'});
      label.textContent = i ? say('今天', 'today') : dateLabel(date);
      chart.append(label);
    });
    panel.append(stats, chart);
    if (summary.today.notes.length) {
      panel.append(el('h3', {text: say('今天读过', 'Read today')}),
        el('ul', {class: 'reader-hub-list'}, summary.today.notes.slice(0, 12).map(([id, count]) => noteLink(id, say(`${count} 次`, `${count}×`)))));
    }
    const earlier = summary.recent.filter(item => item.lastAge > 0).slice(0, 10);
    if (earlier.length) {
      panel.append(el('h3', {text: say('最近读过', 'Recently read')}),
        el('ul', {class: 'reader-hub-list'}, earlier.map(item => noteLink(item.id,
          say(`${item.lastAge === 1 ? '昨天' : item.lastAge + ' 天前'} · 共 ${item.total} 次`, `${item.lastAge === 1 ? 'yesterday' : item.lastAge + ' days ago'} · ${item.total} total`)))));
    }
    if (!summary.today.notes.length && !earlier.length) {
      panel.append(el('p', {class: 'reader-hub-empty', text: say('还没有阅读记录。打开一篇笔记读上 15 秒，这里就会记一次。', 'No reading yet. Spend 15 seconds on a note and it will show up here.')}));
    }
  }

  function renderSaved(panel, state) {
    panel.replaceChildren();
    if (pageNote) {
      const saved = Boolean(state['bookmark-' + pageNote]?.saved);
      const button = el('button', {type: 'button', class: 'reader-hub-button' + (saved ? ' is-on' : ''), 'aria-pressed': String(saved),
        text: saved ? say('已收藏这篇 · 点击取消', 'Saved · select to remove') : say('收藏这篇', 'Save this note')});
      button.addEventListener('click', () => {
        const ok = write({['bookmark-' + pageNote]: {saved: !saved, updatedAt: now()}});
        status.textContent = ok ? (saved ? say('已取消收藏。', 'Removed from saved notes.') : say('已收藏。', 'Saved.')) : say('没能保存，浏览器可能禁止了本地存储。', 'Could not save; browser storage may be blocked.');
        scope.dispatchEvent(new Event('notes:prep-storage'));
        render();
      });
      panel.append(button);
    }
    const saved = Object.entries(state).filter(([key, record]) => key.startsWith('bookmark-') && record?.saved)
      .sort((a, b) => String(b[1].updatedAt).localeCompare(String(a[1].updatedAt))).map(([key]) => key.slice('bookmark-'.length));
    if (!saved.length) {
      panel.append(el('p', {class: 'reader-hub-empty', text: say('还没有收藏。在笔记页点「收藏这篇」，或用侧边栏的收藏按钮。', 'Nothing saved yet. Use “Save this note” on a note page or the sidebar.')}));
      return;
    }
    panel.append(el('h3', {text: say(`收藏的笔记（${saved.length}）`, `Saved notes (${saved.length})`)}),
      el('ul', {class: 'reader-hub-list'}, saved.slice(0, 100).map(id => {
        const item = noteLink(id);
        const remove = el('button', {type: 'button', class: 'reader-hub-remove', 'aria-label': say('取消收藏', 'Remove'), text: '×'});
        remove.addEventListener('click', () => { write({['bookmark-' + id]: {saved: false, updatedAt: now()}}); scope.dispatchEvent(new Event('notes:prep-storage')); render(); });
        item.append(remove);
        return item;
      })));
  }

  function renderSettings(panel, state) {
    panel.replaceChildren();
    const config = settings(state);
    const row = (label, hint, control) => el('div', {class: 'reader-hub-setting'}, [el('div', {}, [el('strong', {text: label}), el('small', {text: hint})]), control]);
    const history = el('button', {type: 'button', role: 'switch', class: 'reader-hub-switch', 'aria-checked': String(config.history), 'aria-label': say('记录阅读次数', 'Count my reading')});
    history.addEventListener('click', () => { saveSettings({history: !config.history}); render(); });
    const mascot = el('div', {class: 'reader-hub-segment', role: 'radiogroup', 'aria-label': say('角落的星星', 'Corner star')});
    for (const [value, label] of [['collapsed', say('显示', 'Show')], ['hidden', say('隐藏', 'Hide')]]) {
      const on = value === 'hidden' ? config.mascot === 'hidden' : config.mascot !== 'hidden';
      const option = el('button', {type: 'button', role: 'radio', 'aria-checked': String(on), text: label});
      option.addEventListener('click', () => { saveSettings({mascot: value, snoozedUntil: ''}); renderMascot(); render(); });
      mascot.append(option);
    }
    const theme = el('div', {class: 'reader-hub-segment', role: 'radiogroup', 'aria-label': say('主题', 'Theme')});
    const light = document.documentElement.dataset.theme === 'light';
    for (const [value, label] of [['dark', say('深色', 'Dark')], ['light', say('浅色', 'Light')]]) {
      const option = el('button', {type: 'button', role: 'radio', 'aria-checked': String((value === 'light') === light), text: label});
      option.addEventListener('click', () => { if ((value === 'light') !== (document.documentElement.dataset.theme === 'light')) themeButton?.click(); render(); });
      theme.append(option);
    }
    let armed = false;
    const wipe = el('button', {type: 'button', class: 'reader-hub-danger', text: say('清空阅读记录', 'Clear reading history')});
    wipe.addEventListener('click', () => {
      if (!armed) { armed = true; wipe.textContent = say('再点一次确认清空', 'Select again to confirm'); return; }
      write(clear(records(), now()), say('清空阅读记录', 'Cleared reading history'));
      status.textContent = say('阅读记录已清空，收藏和学习进度没有变。', 'Reading history cleared. Saved notes and study progress are unchanged.');
      render();
    });
    const backup = el('a', {class: 'reader-hub-link', href: new URL(say('interview/dashboard.html#progress', 'interview/dashboard.en.html#progress'), base).href, text: say('去学习台导出 / 导入备份 →', 'Export or import a backup in the workspace →')});
    panel.append(
      row(say('记录阅读次数', 'Count my reading'), say('打开一篇笔记读满 15 秒记一次，只存在本机。', 'A note counts after 15 seconds; stored on this device only.'), history),
      row(say('角落的星星', 'Corner star'), say('右下角那颗请你点 Star 的小星星。', 'The little star in the corner that asks for a GitHub star.'), mascot),
      row(say('主题', 'Theme'), say('和顶栏的切换按钮是同一个设置。', 'Same setting as the toggle in the top bar.'), theme),
      el('div', {class: 'reader-hub-actions'}, [wipe, backup]));
  }

  function render() {
    const state = records();
    const summary = summarize(state, new Date());
    const badge = toggle.querySelector('.reader-hub-badge');
    badge.hidden = !(settings(state).history && summary.today.total);
    badge.textContent = summary.today.total > 99 ? '99+' : String(summary.today.total);
    if (!drawer.hidden) {
      if (active === 'reading') renderReading(panels.reading, state);
      if (active === 'saved') renderSaved(panels.saved, state);
      if (active === 'settings') renderSettings(panels.settings, state);
    }
    renderMascotMessage();
  }

  /* ------------------------------------------------------- the corner star
     A small glass star that glows; hovering it lets a few hearts float up.
     Collapsible, and quiet unless invited (the star request shows at most
     once a day, and never again once the reader stars or declines). */
  const mascot = el('div', {class: 'corner-star', 'data-state': 'collapsed'});
  const bird = el('button', {type: 'button', class: 'corner-star-button', 'aria-label': say('打开星星的提示', 'Open the star’s note'), 'aria-expanded': 'false'});
  const glyph = svg('svg', {viewBox: '0 0 48 48', 'aria-hidden': 'true'});
  const defs = svg('defs');
  const core = svg('radialGradient', {id: 'cs-core', cx: '50%', cy: '44%', r: '62%'});
  [['0', '#ffffff', '1'], ['.32', '#fff6dc', '.92'], ['.68', '#ffd98c', '.5'], ['1', '#ffbf5c', '.12']].forEach(([offset, color, opacity]) =>
    core.append(svg('stop', {offset, 'stop-color': color, 'stop-opacity': opacity})));
  const rim = svg('linearGradient', {id: 'cs-rim', x1: '0', y1: '0', x2: '1', y2: '1'});
  [['0', '#ffffff', '.95'], ['1', '#ffcf7a', '.35']].forEach(([offset, color, opacity]) =>
    rim.append(svg('stop', {offset, 'stop-color': color, 'stop-opacity': opacity})));
  const aura = svg('radialGradient', {id: 'cs-aura'});
  [['0', '#ffe2a3', '.55'], ['.5', '#ffc966', '.18'], ['1', '#ffc966', '0']].forEach(([offset, color, opacity]) =>
    aura.append(svg('stop', {offset, 'stop-color': color, 'stop-opacity': opacity})));
  defs.append(core, rim, aura);
  const points = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 ? 7.6 : 16.5;
    const angle = Math.PI / 2 + i * Math.PI / 5;
    points.push(`${(24 + radius * Math.cos(angle)).toFixed(2)},${(25 - radius * Math.sin(angle)).toFixed(2)}`);
  }
  glyph.append(defs,
    svg('circle', {class: 'corner-star-aura', cx: '24', cy: '25', r: '23', fill: 'url(#cs-aura)'}),
    svg('path', {class: 'corner-star-rays', d: 'M24 2v7M24 41v5M3 25h6M39 25h6'}),
    svg('polygon', {class: 'corner-star-body', points: points.join(' '), fill: 'url(#cs-core)', stroke: 'url(#cs-rim)'}),
    svg('ellipse', {class: 'corner-star-gleam', cx: '20.5', cy: '20', rx: '3.6', ry: '2.2'}));
  bird.append(glyph);
  const hearts = el('div', {class: 'corner-star-hearts', 'aria-hidden': 'true'});
  const bubble = el('div', {class: 'corner-star-bubble', role: 'dialog', 'aria-label': say('星星的提示', 'Note from the star'), hidden: true});
  const message = el('p', {class: 'corner-star-message'});
  const actions = el('div', {class: 'corner-star-actions'});
  const tuck = el('button', {type: 'button', class: 'corner-star-tuck', 'aria-label': say('收起', 'Tuck away'), text: '–'});
  bubble.append(tuck, message, actions);
  mascot.append(bubble, hearts, bird);
  document.body.append(mascot);

  let lastHearts = 0;
  function popHearts(count = 4) {
    if (reduce() || Date.now() - lastHearts < 700) return;
    lastHearts = Date.now();
    for (let i = 0; i < count; i++) {
      const heart = el('span', {class: 'corner-star-heart'});
      heart.style.setProperty('--drift', `${Math.round((Math.random() - .5) * 46)}px`);
      heart.style.setProperty('--rise', `${Math.round(54 + Math.random() * 30)}px`);
      heart.style.setProperty('--size', `${(10 + Math.random() * 7).toFixed(1)}px`);
      heart.style.animationDelay = `${i * 90}ms`;
      const shape = svg('svg', {viewBox: '0 0 24 24'});
      shape.append(svg('path', {d: 'M12 21s-7.2-4.6-9.6-8.8C.7 9 2.6 4.8 6.7 4.8c2.2 0 3.6 1.2 5.3 3.1 1.7-1.9 3.1-3.1 5.3-3.1 4.1 0 6 4.2 4.3 7.4C19.2 16.4 12 21 12 21z'}));
      heart.append(shape);
      heart.addEventListener('animationend', () => heart.remove());
      hearts.append(heart);
    }
  }
  bird.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') popHearts(4); });
  bird.addEventListener('focus', () => popHearts(3));

  const snoozed = config => Boolean(config.snoozedUntil) && Date.parse(config.snoozedUntil) > Date.now();
  function renderMascotMessage() {
    const state = records();
    const config = settings(state);
    const summary = summarize(state, new Date());
    actions.replaceChildren();
    const button = (label, handler, className = 'corner-star-choice') => {
      const node = el('button', {type: 'button', class: className, text: label});
      node.addEventListener('click', handler);
      return node;
    };
    const never = button(say('不再显示', 'Don’t show again'), () => { saveSettings({mascot: 'hidden', starDone: true}); renderMascot(); });
    if (!config.starDone) {
      message.textContent = say('喜欢这些笔记的话，可以去 GitHub 点个 Star。', 'If you like these notes, you can star the repo on GitHub.');
      const star = el('a', {class: 'corner-star-cta', href: repo, target: '_blank', rel: 'noopener', text: say('★ 去点 Star', '★ Star on GitHub')});
      star.addEventListener('click', () => { popHearts(6); saveSettings({starDone: true, starAskedOn: todayKey(), mascot: 'collapsed'}); renderMascot(); });
      const later = button(say('这次先不显示', 'Not now'), () => {
        saveSettings({snoozedUntil: new Date(Date.now() + 12 * 3600 * 1000).toISOString(), starAskedOn: todayKey(), mascot: 'collapsed'});
        renderMascot();
      });
      actions.append(star, later, never);
      return;
    }
    message.textContent = config.history && summary.today.total
      ? say(`今天读了 ${summary.today.notes.length} 篇，共 ${summary.today.total} 次。`,
        `Today: ${summary.today.notes.length} note${summary.today.notes.length === 1 ? '' : 's'}, ${summary.today.total} read${summary.today.total === 1 ? '' : 's'}.`)
      : say('今天还没有阅读记录。', 'No reading recorded today.');
    actions.append(button(say('阅读记录', 'My reading'), () => open('reading')), never);
  }
  function renderMascot() {
    const config = settings(records());
    mascot.hidden = config.mascot === 'hidden' || snoozed(config);
    const opened = config.mascot === 'open';
    mascot.dataset.state = opened ? 'open' : 'collapsed';
    bubble.hidden = !opened;
    bird.setAttribute('aria-expanded', String(opened));
    renderMascotMessage();
  }
  bird.addEventListener('click', () => {
    const opened = mascot.dataset.state === 'open';
    saveSettings({mascot: opened ? 'collapsed' : 'open'});
    renderMascot();
  });
  tuck.addEventListener('click', () => { saveSettings({mascot: 'collapsed'}); renderMascot(); bird.focus(); });
  renderMascot();
  // Once a day, the star says hello by itself (never while reduced motion asks for calm).
  const initial = settings(records());
  if (initial.mascot === 'collapsed' && !initial.starDone && !snoozed(initial) && initial.starAskedOn !== todayKey() && !reduce()) {
    scope.setTimeout(() => {
      if (settings(records()).mascot !== 'collapsed') return;
      mascot.dataset.state = 'open';
      bubble.hidden = false;
      bird.setAttribute('aria-expanded', 'true');
      renderMascotMessage();
    }, 6000);
  }

  scope.addEventListener('notes:prep-storage', render);
  scope.addEventListener('notes:prep-restored', render);
  render();
})(typeof window === 'undefined' ? globalThis : window);

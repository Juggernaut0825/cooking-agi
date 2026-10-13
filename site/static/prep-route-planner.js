(function (scope) {
  'use strict';
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '2200-12-31') return false;
    const parsed = new Date(value + 'T12:00:00Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }

  function draft(steps, start, sessions) {
    if (!Array.isArray(steps) || !steps.length || steps.length > 24 || !validDate(start)) throw Error('invalid');
    const active = Object.values(sessions).filter(entry => entry.status !== 'cancelled');
    const taken = new Set(active.filter(entry => !entry.exerciseId).map(entry => entry.noteId));
    const exercises = new Set(active.map(entry => entry.exerciseId));
    const seen = new Set();
    let offset = 0;
    return steps.map(step => {
      if (!/^note-[a-f0-9]{16}$/.test(step.noteId) || !/^exercise-[a-z0-9-]{1,80}$/.test(step.exerciseId) || seen.has(step.exerciseId) || typeof step.title !== 'string' || !step.title.trim() || step.title.length > 160 || !Number.isInteger(step.minutes) || step.minutes < 1 || step.minutes > 1440) throw Error('invalid');
      seen.add(step.exerciseId);
      const alreadyPlanned = taken.has(step.noteId) || exercises.has(step.exerciseId);
      const day = new Date(start + 'T12:00:00Z');
      day.setUTCDate(day.getUTCDate() + offset);
      if (!alreadyPlanned) offset += 2;
      const date = day.toISOString().slice(0, 10);
      if (!validDate(date)) throw Error('invalid');
      return {...step, date, selected: !alreadyPlanned, alreadyPlanned};
    });
  }

  function selected(rows) {
    const chosen = rows.filter(row => row.selected && !row.alreadyPlanned);
    if (!chosen.length || chosen.some(row => !validDate(row.date) || !Number.isInteger(row.minutes) || row.minutes < 1 || row.minutes > 1440)) throw Error('invalid');
    return chosen;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = {draft, selected, validDate};
  if (!scope.document) return;
  const root = scope.document.querySelector('[data-prep-workspace]');
  const progress = scope.PreparationProgress;
  if (!root || !progress?.addSessions) return;
  const choose = (zh, en) => scope.document.documentElement.lang.startsWith('zh') ? zh : en;
  const control = name => root.querySelector('[data-route-' + name + ']');
  const form = control('preview');
  let rows = [];
  let opener = null;
  let fields = [];
  const today = () => {
    const date = new Date();
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  };
  const element = (tag, text, className) => {
    const item = scope.document.createElement(tag);
    if (text !== undefined) item.textContent = text;
    if (className) item.className = className;
    return item;
  };

  function available() {
    const catalog = progress.getCatalog();
    root.querySelectorAll('[data-study-route]').forEach(route => {
      const button = route.querySelector('[data-route-batch]');
      button.hidden = false;
      button.disabled = !form.hidden || progress.getHealth().blocked || [...route.querySelectorAll('[data-route-plan]')].some(step => !catalog?.notes?.[step.getAttribute('data-note-id')]);
    });
    control('preview-save').disabled = progress.getHealth().blocked || !rows.some(row => row.selected && !row.alreadyPlanned);
  }

  function summarize() {
    const chosen = rows.filter(row => row.selected && !row.alreadyPlanned);
    const minutes = chosen.reduce((total, row) => total + (Number.isInteger(row.minutes) ? row.minutes : 0), 0);
    const days = new Set(chosen.map(row => row.date).filter(validDate)).size;
    control('preview-summary').textContent = choose(
      `${chosen.length} 个练习 · 分 ${days} 天 · 计划学习 ${minutes} 分钟。保存后仍可修改。`,
      `${chosen.length} exercise${chosen.length === 1 ? '' : 's'} · ${days} date${days === 1 ? '' : 's'} · ${minutes} planned focus minutes. You can change these later.`);
    fields.forEach(({checkbox, date, minutes}, index) => {
      date.disabled = minutes.disabled = !checkbox.checked || rows[index].alreadyPlanned;
    });
    available();
  }

  function close() {
    form.hidden = true;
    rows = [];
    fields = [];
    available();
    if (opener?.getClientRects().length) opener.focus();
    else root.querySelector('[data-route-topic][aria-pressed="true"]')?.focus();
  }

  root.querySelectorAll('[data-study-route]').forEach(route => {
    const button = route.querySelector('[data-route-batch]');
    button.addEventListener('click', () => {
      if (button.disabled) return;
      const steps = [...route.querySelectorAll('[data-route-plan]')].map(step => ({
        exerciseId: step.getAttribute('data-exercise-id'), noteId: step.getAttribute('data-note-id'), title: step.getAttribute('data-task-title'), minutes: Number(step.getAttribute('data-task-minutes'))
      }));
      try { rows = draft(steps, today(), progress.getState().schedule?.sessions || {}); }
      catch { return; }
      opener = button;
      control('preview-title').textContent = route.querySelector('h2').textContent;
      control('preview-error').textContent = '';
      control('save-message').hidden = true;
      const list = control('preview-rows');
      list.replaceChildren();
      fields = rows.map(row => {
        const container = element('fieldset', undefined, 'study-draft-row');
        container.append(element('legend', row.title));
        const pick = element('label', undefined, 'study-draft-pick');
        const checkbox = element('input');
        checkbox.type = 'checkbox';
        checkbox.checked = row.selected;
        checkbox.disabled = row.alreadyPlanned;
        pick.append(checkbox, element('span', row.alreadyPlanned ? choose('已有安排或学习记录，这次不重复添加', 'Already scheduled or recorded; not added again') : choose('加入这次安排', 'Include this exercise')));
        const dateLabel = element('label', choose('计划日期', 'Date'));
        const date = element('input');
        date.type = 'date';
        date.min = '1900-01-01';
        date.max = '2200-12-31';
        date.required = true;
        date.value = row.date;
        dateLabel.append(date);
        const minutesLabel = element('label', choose('计划学习时长（分钟）', 'Focus time (minutes)'));
        const minutes = element('input');
        minutes.type = 'number';
        minutes.min = '1';
        minutes.max = '1440';
        minutes.step = '1';
        minutes.required = true;
        minutes.value = String(row.minutes);
        minutesLabel.append(minutes);
        container.append(pick, dateLabel, minutesLabel);
        for (const input of [checkbox, date, minutes]) input.addEventListener('input', () => {
          row.selected = checkbox.checked;
          row.date = date.value;
          row.minutes = Number(minutes.value);
          control('preview-error').textContent = '';
          summarize();
        });
        list.append(container);
        return {checkbox, date, minutes};
      });
      form.hidden = false;
      summarize();
      control('preview-title').focus({preventScroll: true});
      form.scrollIntoView({block: 'start', behavior: 'instant'});
    });
  });

  control('preview-cancel').addEventListener('click', close);
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const chosen = selected(rows);
      if (chosen.some(row => !progress.getCatalog()?.notes?.[row.noteId])) throw Error('catalog');
      const records = {};
      for (const row of chosen) {
        const bytes = new Uint8Array(16);
        scope.crypto.getRandomValues(bytes);
        const identifier = 'session-' + [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
        records[identifier] = {title: row.title, noteId: row.noteId, exerciseId: row.exerciseId, date: row.date, minutes: row.minutes,
          status: 'planned', completedOn: '', actualMinutes: null, updatedAt: new Date().toISOString()};
      }
      const result = progress.addSessions(records);
      close();
      const message = control('save-message');
      message.hidden = false;
      message.replaceChildren(element('span', result.persisted
        ? choose(`已加入 ${chosen.length} 次安排，已有记录没有改动。`, `${chosen.length} session${chosen.length === 1 ? '' : 's'} added. Existing records are unchanged.`)
        : choose('安排暂存在本页，浏览器未能保存。离开前请导出备份。', 'Sessions are in memory only; browser storage failed. Export before leaving.')));
      const link = element('a', result.persisted ? choose('查看安排 →', 'View schedule →') : choose('导出备份 →', 'Export a backup →'));
      link.href = result.persisted ? '#schedule' : '#progress';
      message.append(link);
      link.focus();
    } catch (error) {
      control('preview-error').textContent = error.message === 'conflict'
        ? choose('其中一篇刚刚已有安排，没有重复添加。请取消草稿后重新预览，其他输入尚未保存。', 'A note was just scheduled elsewhere. Nothing was added. Cancel this draft and preview again.')
        : choose('还没保存。请检查日期和时长；若记录已达容量上限或目录未加载，请先备份。草稿仍在这里。', 'Not saved. Check dates and durations; if storage is full or the catalog is unavailable, back up first. Your draft is still here.');
    }
  });
  for (const name of ['notes:prep-changed', 'notes:prep-catalog', 'notes:prep-storage', 'notes:prep-restored']) scope.addEventListener(name, available);
  available();
})(typeof window === 'undefined' ? globalThis : window);
